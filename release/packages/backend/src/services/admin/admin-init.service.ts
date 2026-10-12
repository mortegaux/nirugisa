import bcrypt from 'bcrypt';
import { AppDataSource } from '../../db/data-source';
import { User } from '../../db/entities';
import { UserRole } from '@nommable/shared';
import { config } from '../../config';

export class AdminInitService {
  static async initializeAdminAccount(): Promise<void> {
    try {
      const userRepo = AppDataSource.getRepository(User);

      // Check if system admin already exists
      const existingAdmin = await userRepo.findOne({
        where: { isSystemAdmin: true },
      });

      if (existingAdmin) {
        console.log('System admin account already exists');
        return;
      }

      // Check if username is already taken
      const existingByUsername = await userRepo.findOne({
        where: { username: config.admin.username },
      });

      if (existingByUsername) {
        console.log('Admin username already in use, skipping admin creation');
        return;
      }

      // Create admin account
      const passwordHash = await bcrypt.hash(config.admin.password, 10);

      const admin = userRepo.create({
        email: `${config.admin.username}@system.local`, // System-generated email
        username: config.admin.username,
        passwordHash,
        role: UserRole.ADMIN,
        isSystemAdmin: true,
      });

      await userRepo.save(admin);

      console.log(`System admin account created: ${config.admin.username}`);
    } catch (error) {
      console.error('Error initializing admin account:', error);
      throw error;
    }
  }
}
