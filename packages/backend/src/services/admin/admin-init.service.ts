import { AppDataSource } from '../../db/data-source';
import { User } from '../../db/entities';
import { UserRole } from '@nommable/shared';
import { config } from '../../config';
import { auth, getAuthDb, ensureAppUser } from '../../lib/auth';

export class AdminInitService {
  static async initializeAdminAccount(): Promise<void> {
    try {
      const userRepo = AppDataSource.getRepository(User);

      // Check if system admin already exists (app-side)
      const existingAdmin = await userRepo.findOne({
        where: { isSystemAdmin: true },
      });

      if (existingAdmin) {
        console.log('System admin account already exists');
        return;
      }

      const authDb = getAuthDb();

      // Check if username is already taken (Better Auth side)
      const existingByUsername = authDb
        .prepare('SELECT id FROM "user" WHERE username = ?')
        .get(config.admin.username) as { id: string } | undefined;

      if (existingByUsername) {
        console.log('Admin username already in use, skipping admin creation');
        return;
      }

      // Create the credential via Better Auth (scrypt hashing).
      const signUp = await auth.api.signUpEmail({
        body: {
          email: `${config.admin.username}@system.local`,
          password: config.admin.password,
          name: config.admin.username,
          username: config.admin.username,
        },
        headers: new Headers(),
      });

      // Create the app-side row as admin + system admin, and set the
      // Better Auth role to match.
      authDb
        .prepare('UPDATE "user" SET role = ? WHERE id = ?')
        .run(UserRole.ADMIN, signUp.user.id);
      const admin = await ensureAppUser(signUp.user.id, {
        email: `${config.admin.username}@system.local`,
        username: config.admin.username,
        role: UserRole.ADMIN,
      });
      admin.isSystemAdmin = true;
      await userRepo.save(admin);

      console.log(`System admin account created: ${config.admin.username}`);
    } catch (error) {
      console.error('Error initializing admin account:', error);
      throw error;
    }
  }
}
