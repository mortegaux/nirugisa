import { AppDataSource } from '../../db/data-source';
import { User } from '../../db/entities';
import bcrypt from 'bcrypt';
import { generatePassword, generateUsernameSuggestions } from '../../utils/password.utils';
import { UserRole } from '@nommable/shared';
import { config } from '../../config';
import { TaxonomyService } from '../taxonomy/taxonomy.service';

export class UserService {
  /**
   * Get all users (admin only)
   */
  static async getAllUsers(): Promise<User[]> {
    const userRepo = AppDataSource.getRepository(User);
    const users = await userRepo.find({
      select: [
        'id',
        'email',
        'username',
        'firstName',
        'lastName',
        'role',
        'isSystemAdmin',
        'profilePhotoUrl',
        'createdAt',
        'updatedAt',
      ],
      order: { createdAt: 'DESC' },
    });

    return users.map((user) => {
      // Auto-heal/guarantee system admin flag for configured admin
      if (user.username === config.admin.username) {
        user.isSystemAdmin = true;
      }
      return user;
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
    const existingUsernames = existingUsers.map((u) => u.username);

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
      isSystemAdmin: false,
    });

    await userRepo.save(user);

    // Give the new user their own taxonomy set (default categories/tags)
    await new TaxonomyService().seedForUser(user.id);

    return { user, generatedPassword };
  }

  /**
   * Delete a user with multi-layered safety guards:
   * - Cannot delete oneself
   * - Cannot delete the system administrator
   * - Cannot delete the last remaining administrator
   */
  static async deleteUser(userId: string, currentUserId: string): Promise<void> {
    if (userId === currentUserId) {
      throw new Error('You cannot delete your own account.');
    }

    const userRepo = AppDataSource.getRepository(User);
    const user = await userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new Error('User not found');
    }

    if (user.isSystemAdmin || user.username === config.admin.username) {
      throw new Error('The system administrator account is protected and cannot be deleted.');
    }

      // Guard against deleting the last remaining admin
    if (user.role === UserRole.ADMIN) {
      const adminCount = await userRepo.count({
        where: { role: UserRole.ADMIN },
      });
      if (adminCount <= 1) {
        throw new Error('Cannot delete the only remaining administrator in the system.');
      }
    }

    // Preserve shared library items by reassigning ownership to the admin performing the deletion
    const { SystemSettingsService } = await import('../settings/system-settings.service');
    const settings = await SystemSettingsService.getSettings();
    const {
      Recipe,
      RecipeCollection,
      MealPlan,
      MealPlanTemplate,
      ShoppingList,
      PantryItem,
      BatchCookingPlan,
    } = await import('../../db/entities');

    if (settings.sharedRecipes) {
      await AppDataSource.getRepository(Recipe).update({ userId }, { userId: currentUserId });
    }
    if (settings.sharedCollections) {
      await AppDataSource.getRepository(RecipeCollection).update(
        { userId },
        { userId: currentUserId }
      );
    }
    if (settings.sharedMealPlans) {
      await AppDataSource.getRepository(MealPlan).update({ userId }, { userId: currentUserId });
      await AppDataSource.getRepository(MealPlanTemplate).update(
        { userId },
        { userId: currentUserId }
      );
    }
    if (settings.sharedShoppingLists) {
      await AppDataSource.getRepository(ShoppingList).update({ userId }, { userId: currentUserId });
    }
    if (settings.sharedPantry) {
      await AppDataSource.getRepository(PantryItem).update({ userId }, { userId: currentUserId });
    }
    if (settings.sharedBatchCooking) {
      await AppDataSource.getRepository(BatchCookingPlan).update(
        { userId },
        { userId: currentUserId }
      );
    }

    await userRepo.remove(user);
  }

  /**
   * Update user role with safety guards:
   * - Cannot demote system admin
   * - Cannot demote oneself
   * - Cannot demote last remaining admin
   */
  static async updateUserRole(
    userId: string,
    role: UserRole,
    currentUserId: string
  ): Promise<User> {
    const userRepo = AppDataSource.getRepository(User);
    const user = await userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new Error('User not found');
    }

    if (user.isSystemAdmin || user.username === config.admin.username) {
      throw new Error('The system administrator role is permanent and cannot be modified.');
    }

    if (userId === currentUserId && role !== UserRole.ADMIN) {
      throw new Error('You cannot remove administrator privileges from your own account.');
    }

    if (user.role === UserRole.ADMIN && role !== UserRole.ADMIN) {
      const adminCount = await userRepo.count({
        where: { role: UserRole.ADMIN },
      });
      if (adminCount <= 1) {
        throw new Error('Cannot demote the only remaining administrator in the system.');
      }
    }

    user.role = role;
    await userRepo.save(user);

    return user;
  }

  /**
   * Reset a user's password (admin-initiated)
   */
  static async resetPassword(
    userId: string,
    newPassword?: string
  ): Promise<{ user: User; temporaryPassword: string }> {
    const userRepo = AppDataSource.getRepository(User);
    const user = await userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new Error('User not found');
    }

    const temporaryPassword =
      newPassword && newPassword.trim() ? newPassword.trim() : generatePassword(12);

    if (temporaryPassword.length < 6) {
      throw new Error('Password must be at least 6 characters');
    }

    user.passwordHash = await bcrypt.hash(temporaryPassword, 10);
    await userRepo.save(user);

    return { user, temporaryPassword };
  }
}
