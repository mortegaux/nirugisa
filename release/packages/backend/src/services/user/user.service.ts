import { AppDataSource } from '../../db/data-source';
import { User } from '../../db/entities';
import bcrypt from 'bcrypt';
import { generatePassword, generateUsernameSuggestions } from '../../utils/password.utils';
import { UserRole } from '@nommable/shared';

export class UserService {
  /**
   * Get all users (admin only)
   */
  static async getAllUsers(): Promise<User[]> {
    const userRepo = AppDataSource.getRepository(User);
    return await userRepo.find({
      select: ['id', 'email', 'username', 'firstName', 'lastName', 'role', 'createdAt', 'updatedAt'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get username suggestions based on first and last name
   */
  static async getUsernameSuggestions(
    firstName: string,
    lastName: string
  ): Promise<string[]> {
    const userRepo = AppDataSource.getRepository(User);

    // Get all existing usernames
    const existingUsers = await userRepo.find({ select: ['username'] });
    const existingUsernames = existingUsers.map(u => u.username);

    return generateUsernameSuggestions(firstName, lastName, existingUsernames);
  }

  /**
   * Create a new user with auto-generated password
   */
  static async createUser(data: {
    email: string;
    username: string;
    firstName: string;
    lastName: string;
    role?: UserRole;
  }): Promise<{ user: User; generatedPassword: string }> {
    const userRepo = AppDataSource.getRepository(User);

    // Check if email or username already exists
    const existing = await userRepo.findOne({
      where: [{ email: data.email }, { username: data.username }],
    });

    if (existing) {
      if (existing.email === data.email) {
        throw new Error('Email already exists');
      }
      if (existing.username === data.username) {
        throw new Error('Username already exists');
      }
    }

    // Generate password
    const generatedPassword = generatePassword(12);
    const passwordHash = await bcrypt.hash(generatedPassword, 10);

    // Create user
    const user = userRepo.create({
      email: data.email,
      username: data.username,
      firstName: data.firstName,
      lastName: data.lastName,
      passwordHash,
      role: data.role || UserRole.USER,
    });

    await userRepo.save(user);

    return { user, generatedPassword };
  }

  /**
   * Delete a user
   */
  static async deleteUser(userId: string): Promise<void> {
    const userRepo = AppDataSource.getRepository(User);

    const user = await userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new Error('User not found');
    }

    if (user.isSystemAdmin) {
      throw new Error('Cannot delete system admin');
    }

    await userRepo.remove(user);
  }

  /**
   * Update user role
   */
  static async updateUserRole(userId: string, role: UserRole): Promise<User> {
    const userRepo = AppDataSource.getRepository(User);

    const user = await userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new Error('User not found');
    }

    if (user.isSystemAdmin) {
      throw new Error('Cannot modify system admin role');
    }

    user.role = role;
    await userRepo.save(user);

    return user;
  }
}
