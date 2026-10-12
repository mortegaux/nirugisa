import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { config } from '../config';
import { AppDataSource } from '../db/data-source';

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/heic': '.heic',
  'image/heif': '.heif',
};

const EXT_TO_MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.heic': 'image/heic',
  '.heif': 'image/heif',
};

/**
 * Unified image storage service for all recipe and profile images
 * (user-uploaded, AI-generated, and imported).
 *
 * Stores images in the configured upload directory (/uploads/recipes or /uploads/profiles)
 * AND persists a copy in PostgreSQL (`stored_images`) so images remain reliably
 * accessible across container rebuilds, volume changes, or migrations.
 */
export class ImageStorageService {
  private static initialized = false;

  /**
   * Resolve and ensure the target subdirectory under the primary upload directory.
   */
  static getSubdirPath(subdir: string): string {
    const safeSubdir = path.basename(subdir);
    const dir = path.join(config.upload.dir, safeSubdir);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  /**
   * Return all candidate upload root directories so files can be found or mirrored
   * regardless of working directory or Docker volume mount point.
   */
  static getCandidateUploadRoots(): string[] {
    const roots = new Set<string>();
    roots.add(path.resolve(config.upload.dir));
    if (fs.existsSync('/app/uploads')) {
      roots.add('/app/uploads');
    }
    roots.add(path.resolve(process.cwd(), 'uploads'));
    return Array.from(roots);
  }

  /**
   * Ensure the `stored_images` table exists in PostgreSQL and synchronize
   * existing disk images <-> database.
   */
  static async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      this.getSubdirPath('recipes');
      this.getSubdirPath('profiles');

      if (!AppDataSource.isInitialized) {
        return;
      }

      await AppDataSource.query(`
        CREATE TABLE IF NOT EXISTS "stored_images" (
          "file_path" varchar(255) PRIMARY KEY,
          "mime_type" varchar(100) NOT NULL,
          "data" blob NOT NULL,
          "created_at" datetime NOT NULL DEFAULT (datetime('now'))
        )
      `);

      this.initialized = true;

      // Sync existing files on disk into DB and restore any DB images missing from disk
      await this.syncDiskAndDatabase();
    } catch (err) {
      console.warn('ImageStorageService initialization warning:', err);
    }
  }

  /**
   * Synchronize images between disk directories and PostgreSQL `stored_images`.
   */
  static async syncDiskAndDatabase(): Promise<void> {
    if (!AppDataSource.isInitialized) return;

    const subdirs = ['recipes', 'profiles'];

    // 1. Back up any files found on disk into PostgreSQL
    for (const root of this.getCandidateUploadRoots()) {
      for (const subdir of subdirs) {
        const dirPath = path.join(root, subdir);
        if (!fs.existsSync(dirPath)) continue;

        let files: string[] = [];
        try {
          files = await fs.promises.readdir(dirPath);
        } catch {
          continue;
        }

        for (const filename of files) {
          if (filename.startsWith('.')) continue;
          const fullPath = path.join(dirPath, filename);
          try {
            const stat = await fs.promises.stat(fullPath);
            if (!stat.isFile() || stat.size === 0) continue;

            const relPath = `${subdir}/${filename}`;
            const existing = await AppDataSource.query(
              `SELECT 1 FROM "stored_images" WHERE "file_path" = $1 LIMIT 1`,
              [relPath]
            );

            if (!existing || existing.length === 0) {
              const buffer = await fs.promises.readFile(fullPath);
              const ext = path.extname(filename).toLowerCase();
              const mimeType = EXT_TO_MIME[ext] || 'image/jpeg';
              await AppDataSource.query(
                `INSERT INTO "stored_images" ("file_path", "mime_type", "data")
                 VALUES ($1, $2, $3)
                 ON CONFLICT ("file_path") DO NOTHING`,
                [relPath, mimeType, buffer]
              );
            }
          } catch (fileErr) {
            console.warn(`Failed to sync disk image ${fullPath} to DB:`, fileErr);
          }
        }
      }
    }

    // 2. Restore any images in PostgreSQL that are missing from the primary upload directory
    try {
      const rows: Array<{ file_path: string }> = await AppDataSource.query(
        `SELECT "file_path" FROM "stored_images"`
      );

      for (const row of rows) {
        const [subdir, filename] = (row.file_path || '').split('/');
        if (!subdir || !filename) continue;

        const targetDir = this.getSubdirPath(subdir);
        const targetPath = path.join(targetDir, path.basename(filename));
        if (!fs.existsSync(targetPath)) {
          const dataRows: Array<{ data: Buffer }> = await AppDataSource.query(
            `SELECT "data" FROM "stored_images" WHERE "file_path" = $1 LIMIT 1`,
            [row.file_path]
          );
          if (dataRows?.[0]?.data) {
            await fs.promises.writeFile(targetPath, dataRows[0].data);
          }
        }
      }
    } catch (restoreErr) {
      console.warn('Failed to restore images from DB to disk:', restoreErr);
    }
  }

  /**
   * Save an image buffer to both the unified upload directory and PostgreSQL.
   * Used by AI-generated images, uploaded images, and downloaded recipe images.
   */
  static async saveImageBuffer(
    subdir: 'recipes' | 'profiles',
    buffer: Buffer,
    mimeType: string = 'image/jpeg',
    prefix: string = 'recipe'
  ): Promise<{ filename: string; imageUrl: string; filePath: string }> {
    await this.initialize();

    const normalizedMime = (mimeType || 'image/jpeg').toLowerCase().split(';')[0].trim();
    const ext =
      MIME_TO_EXT[normalizedMime] ||
      (normalizedMime.includes('png') ? '.png' : normalizedMime.includes('webp') ? '.webp' : '.jpg');

    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const filename = `${prefix}-${uniqueSuffix}${ext}`;
    const targetDir = this.getSubdirPath(subdir);
    const filePath = path.join(targetDir, filename);

    // 1. Write to primary upload directory
    await fs.promises.writeFile(filePath, buffer);

    // 2. Mirror to secondary upload roots if they exist and differ
    for (const root of this.getCandidateUploadRoots()) {
      const candidateDir = path.join(root, subdir);
      const candidateFile = path.join(candidateDir, filename);
      if (path.resolve(candidateFile) !== path.resolve(filePath)) {
        try {
          if (!fs.existsSync(candidateDir)) {
            await fs.promises.mkdir(candidateDir, { recursive: true });
          }
          await fs.promises.writeFile(candidateFile, buffer);
        } catch {
          // Ignore non-writable secondary paths
        }
      }
    }

    // 3. Persist in PostgreSQL so it survives container rebuilds or volume resets
    const relPath = `${subdir}/${filename}`;
    if (AppDataSource.isInitialized) {
      try {
        await AppDataSource.query(
          `INSERT INTO "stored_images" ("file_path", "mime_type", "data")
           VALUES ($1, $2, $3)
           ON CONFLICT ("file_path") DO UPDATE
           SET "mime_type" = EXCLUDED."mime_type", "data" = EXCLUDED."data"`,
          [relPath, normalizedMime, buffer]
        );
      } catch (dbErr) {
        console.warn(`Failed to persist image ${relPath} to database:`, dbErr);
      }
    }

    const imageUrl = `/uploads/${subdir}/${filename}`;
    return { filename, imageUrl, filePath };
  }

  /**
   * Persist an already-uploaded Multer disk file into PostgreSQL and mirror directories.
   */
  static async persistUploadedDiskFile(
    subdir: 'recipes' | 'profiles',
    diskFilePath: string,
    filename: string,
    mimeType?: string
  ): Promise<string> {
    await this.initialize();

    const safeFilename = path.basename(filename);
    const ext = path.extname(safeFilename).toLowerCase();
    const resolvedMime = (mimeType || EXT_TO_MIME[ext] || 'image/jpeg').toLowerCase().split(';')[0].trim();

    try {
      const buffer = await fs.promises.readFile(diskFilePath);

      // Ensure file is in primary upload dir
      const primaryPath = path.join(this.getSubdirPath(subdir), safeFilename);
      if (path.resolve(primaryPath) !== path.resolve(diskFilePath)) {
        await fs.promises.writeFile(primaryPath, buffer);
      }

      // Mirror to any secondary upload root
      for (const root of this.getCandidateUploadRoots()) {
        const candidateDir = path.join(root, subdir);
        const candidateFile = path.join(candidateDir, safeFilename);
        if (path.resolve(candidateFile) !== path.resolve(diskFilePath)) {
          try {
            if (!fs.existsSync(candidateDir)) {
              await fs.promises.mkdir(candidateDir, { recursive: true });
            }
            await fs.promises.writeFile(candidateFile, buffer);
          } catch {
            // Ignore
          }
        }
      }

      // Save in PostgreSQL
      const relPath = `${subdir}/${safeFilename}`;
      if (AppDataSource.isInitialized) {
        await AppDataSource.query(
          `INSERT INTO "stored_images" ("file_path", "mime_type", "data")
           VALUES ($1, $2, $3)
           ON CONFLICT ("file_path") DO UPDATE
           SET "mime_type" = EXCLUDED."mime_type", "data" = EXCLUDED."data"`,
          [relPath, resolvedMime, buffer]
        );
      }
    } catch (err) {
      console.warn(`Failed to back up uploaded file ${diskFilePath} to DB:`, err);
    }

    return `/uploads/${subdir}/${safeFilename}`;
  }

  /**
   * Retrieve an image from PostgreSQL if missing from disk, and restore it to disk.
   */
  static async getAndRestoreImage(
    subdir: string,
    filename: string
  ): Promise<{ buffer: Buffer; mimeType: string } | null> {
    await this.initialize();
    if (!AppDataSource.isInitialized) return null;

    const safeSubdir = path.basename(subdir);
    const safeFilename = path.basename(filename);
    const relPath = `${safeSubdir}/${safeFilename}`;

    try {
      const rows: Array<{ mime_type: string; data: Buffer }> = await AppDataSource.query(
        `SELECT "mime_type", "data" FROM "stored_images" WHERE "file_path" = $1 LIMIT 1`,
        [relPath]
      );

      if (!rows || rows.length === 0 || !rows[0].data) {
        return null;
      }

      const { mime_type: mimeType, data: buffer } = rows[0];

      // Restore to disk so future requests are served directly by express.static
      try {
        const targetDir = this.getSubdirPath(safeSubdir);
        const targetPath = path.join(targetDir, safeFilename);
        await fs.promises.writeFile(targetPath, buffer);
      } catch {
        // Ignore disk write error if read-only; buffer is still returned to caller
      }

      return { buffer, mimeType: mimeType || 'image/jpeg' };
    } catch (err) {
      console.warn(`Failed to load image ${relPath} from database:`, err);
      return null;
    }
  }

  /**
   * Download an external recipe image URL and store it locally in the unified
   * recipe image storage + PostgreSQL. If downloading fails, returns the original URL.
   */
  static async localizeExternalImage(externalUrl?: string): Promise<string | undefined> {
    if (!externalUrl || typeof externalUrl !== 'string') return externalUrl;
    const trimmed = externalUrl.trim();
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      return trimmed;
    }

    try {
      const response = await axios.get(trimmed, {
        responseType: 'arraybuffer',
        timeout: 12000,
        maxContentLength: 10 * 1024 * 1024,
        headers: {
          'User-Agent': 'Nommable/1.0 (Recipe Importer; +https://github.com/mortegaux/nommable)',
          Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        },
      });

      const contentType = (response.headers['content-type'] as string) || 'image/jpeg';
      if (!contentType.startsWith('image/')) {
        return trimmed;
      }

      const buffer = Buffer.from(response.data);
      if (buffer.length < 100) {
        return trimmed;
      }

      const { imageUrl } = await this.saveImageBuffer('recipes', buffer, contentType, 'recipe');
      return imageUrl;
    } catch {
      // Fallback to original remote URL if hotlink download is blocked
      return trimmed;
    }
  }
}
