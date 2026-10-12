import { Request, Response, NextFunction } from 'express';
import { UserService } from '../../services/user/user.service';
import { AppError, AuthRequest } from '../middleware';
import bcrypt from 'bcrypt';
import { AppDataSource } from '../../db/data-source';
import { User } from '../../db/entities';

export class UserController {
  /**
   * Get all users (admin only)
   */
  static async getAllUsers(req: Request, res: Response, next: NextFunction) {
    try {
      const users = await UserService.getAllUsers();

      res.json({
        users: users.map(user => ({
          id: user.id,
          email: user.email,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        })),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get username suggestions based on first and last name
   */
  static async getUsernameSuggestions(req: Request, res: Response, next: NextFunction) {
    try {
      const { firstName, lastName } = req.query;

      if (!firstName || !lastName) {
        throw new AppError(400, 'First name and last name are required');
      }

      const suggestions = await UserService.getUsernameSuggestions(
        firstName as string,
        lastName as string
      );

      res.json({ suggestions });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create a new user (admin only)
   */
  static async createUser(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, username, firstName, lastName, role } = req.body;

      if (!email || !username || !firstName || !lastName) {
        throw new AppError(400, 'Email, username, first name, and last name are required');
      }

      const { user, generatedPassword } = await UserService.createUser({
        email,
        username,
        firstName,
        lastName,
        role,
      });

      res.status(201).json({
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
        generatedPassword,
      });
    } catch (error) {
      if (error instanceof Error) {
        next(new AppError(400, error.message));
      } else {
        next(error);
      }
    }
  }

  /**
   * Delete a user (admin only)
   */
  static async deleteUser(req: Request, res: Response, next: NextFunction) {
    try {
      const { userId } = req.params;

      await UserService.deleteUser(userId);

      res.status(204).send();
    } catch (error) {
      if (error instanceof Error) {
        next(new AppError(400, error.message));
      } else {
        next(error);
      }
    }
  }

  /**
   * Update user role (admin only)
   */
  static async updateUserRole(req: Request, res: Response, next: NextFunction) {
    try {
      const { userId } = req.params;
      const { role } = req.body;

      if (!role) {
        throw new AppError(400, 'Role is required');
      }

      const user = await UserService.updateUserRole(userId, role);

      res.json({
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
      });
    } catch (error) {
      if (error instanceof Error) {
        next(new AppError(400, error.message));
      } else {
        next(error);
      }
    }
  }

  /**
   * Update current user's password
   */
  static async updatePassword(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.userId!;
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        throw new AppError(400, 'Current password and new password are required');
      }

      if (newPassword.length < 8) {
        throw new AppError(400, 'New password must be at least 8 characters');
      }

      const userRepo = AppDataSource.getRepository(User);
      const user = await userRepo.findOne({ where: { id: userId } });

      if (!user) {
        throw new AppError(404, 'User not found');
      }

      // Verify current password
      const valid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!valid) {
        throw new AppError(401, 'Current password is incorrect');
      }

      // Hash new password
      const passwordHash = await bcrypt.hash(newPassword, 10);
      user.passwordHash = passwordHash;
      await userRepo.save(user);

      res.json({ message: 'Password updated successfully' });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update current user's email
   */
  static async updateEmail(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.userId!;
      const { email, password } = req.body;

      if (!email || !password) {
        throw new AppError(400, 'Email and password are required');
      }

      const userRepo = AppDataSource.getRepository(User);
      const user = await userRepo.findOne({ where: { id: userId } });

      if (!user) {
        throw new AppError(404, 'User not found');
      }

      // Verify password for security
      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        throw new AppError(401, 'Password is incorrect');
      }

      // Check if email is already taken
      const existing = await userRepo.findOne({ where: { email } });
      if (existing && existing.id !== userId) {
        throw new AppError(409, 'Email already in use');
      }

      user.email = email;
      await userRepo.save(user);

      res.json({
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          profilePhotoUrl: user.profilePhotoUrl,
          role: user.role,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update current user's profile (first name, last name)
   */
  static async updateProfile(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.userId!;
      const { firstName, lastName } = req.body;

      const userRepo = AppDataSource.getRepository(User);
      const user = await userRepo.findOne({ where: { id: userId } });

      if (!user) {
        throw new AppError(404, 'User not found');
      }

      if (firstName !== undefined) user.firstName = firstName;
      if (lastName !== undefined) user.lastName = lastName;

      await userRepo.save(user);

      res.json({
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          profilePhotoUrl: user.profilePhotoUrl,
          role: user.role,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Upload profile photo for current user
   */
  static async uploadProfilePhoto(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.userId!;
      const file = (req as any).file;

      if (!file) {
        throw new AppError(400, 'No file uploaded');
      }

      const userRepo = AppDataSource.getRepository(User);
      const user = await userRepo.findOne({ where: { id: userId } });

      if (!user) {
        throw new AppError(404, 'User not found');
      }

      // Store relative path
      const photoUrl = `/uploads/profiles/${file.filename}`;
      user.profilePhotoUrl = photoUrl;
      await userRepo.save(user);

      res.json({
        profilePhotoUrl: photoUrl,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          profilePhotoUrl: user.profilePhotoUrl,
          role: user.role,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}
