import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import jwt, { SignOptions } from 'jsonwebtoken';
import { AppDataSource } from '../../db/data-source';
import { User } from '../../db/entities';
import { AppError } from '../middleware';
import { config } from '../../config';
import { InvitationService } from '../../services/invitation/invitation.service';

export class AuthController {
  static async registerWithInvitation(req: Request, res: Response, next: NextFunction) {
    try {
      const { token, username, password } = req.body;

      // Validate invitation
      const invitation = await InvitationService.validateInvitation(token);

      if (!invitation) {
        throw new AppError(400, 'Invalid or expired invitation');
      }

      const userRepo = AppDataSource.getRepository(User);

      // Check if username is taken
      const existing = await userRepo.findOne({ where: { username } });

      if (existing) {
        throw new AppError(409, 'Username already taken');
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 10);

      // Create user with role from invitation
      const user = userRepo.create({
        email: invitation.email,
        username,
        passwordHash,
        role: invitation.role,
      });

      await userRepo.save(user);

      // Mark invitation as accepted
      await InvitationService.acceptInvitation(token);

      // Generate token
      const signOptions: SignOptions = {
        expiresIn: config.jwt.expiresIn as jwt.SignOptions['expiresIn'],
        algorithm: 'HS256',
      };
      const jwtToken = jwt.sign({ userId: user.id, role: user.role }, config.jwt.secret, signOptions);

      res.status(201).json({
        token: jwtToken,
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

  static async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { username, password } = req.body;

      const userRepo = AppDataSource.getRepository(User);

      // Find user by username or email
      const user = await userRepo.findOne({
        where: [{ username }, { email: username }],
      });

      if (!user) {
        throw new AppError(401, 'Invalid credentials');
      }

      // Check password
      const valid = await bcrypt.compare(password, user.passwordHash);

      if (!valid) {
        throw new AppError(401, 'Invalid credentials');
      }

      // Generate token
      const signOptions: SignOptions = {
        expiresIn: config.jwt.expiresIn as jwt.SignOptions['expiresIn'],
        algorithm: 'HS256',
      };
      const token = jwt.sign({ userId: user.id, role: user.role }, config.jwt.secret, signOptions);

      res.json({
        token,
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

  static async me(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).userId;

      const userRepo = AppDataSource.getRepository(User);
      const user = await userRepo.findOne({ where: { id: userId } });

      if (!user) {
        throw new AppError(404, 'User not found');
      }

      res.json({
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        profilePhotoUrl: user.profilePhotoUrl,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      });
    } catch (error) {
      next(error);
    }
  }
}
