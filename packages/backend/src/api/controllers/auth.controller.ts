import { Request, Response, NextFunction } from 'express';
import { AppDataSource } from '../../db/data-source';
import { User } from '../../db/entities';
import { AppError } from '../middleware';
import { toAuthHeaders } from '../middleware/auth';
import { auth, getAuthDb, ensureAppUser } from '../../lib/auth';
import { InvitationService } from '../../services/invitation/invitation.service';
import { TaxonomyService } from '../../services/taxonomy/taxonomy.service';
import { UserRole } from '@nommable/shared';

function toUserJson(user: User) {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    profilePhotoUrl: user.profilePhotoUrl,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export class AuthController {
  static async registerWithInvitation(req: Request, res: Response, next: NextFunction) {
    try {
      const { token, username, password } = req.body;

      // Validate invitation
      const invitation = await InvitationService.validateInvitation(token);

      if (!invitation) {
        throw new AppError(400, 'Invalid or expired invitation');
      }

      // Check if username is taken (Better Auth user table)
      const authDb = getAuthDb();
      const existingAuth = authDb
        .prepare('SELECT id FROM "user" WHERE username = ? OR email = ?')
        .get(username, invitation.email) as { id: string } | undefined;

      if (existingAuth) {
        throw new AppError(409, 'Username or email already taken');
      }

      // Create the credential via Better Auth.
      const signUp = await auth.api.signUpEmail({
        body: {
          email: invitation.email,
          password,
          name: username,
          username,
        },
        headers: toAuthHeaders(req),
      });

      // Create the matching app-side user row with the invitation's role.
      const appUser = await ensureAppUser(signUp.user.id, {
        email: invitation.email,
        username,
        role: invitation.role,
      });
      authDb
        .prepare('UPDATE "user" SET role = ? WHERE id = ?')
        .run(invitation.role, signUp.user.id);

      // Mark invitation as accepted
      await InvitationService.acceptInvitation(token);

      // Give the new user their own taxonomy set
      await new TaxonomyService().seedForUser(signUp.user.id);

      // Sign the new user in to return a session token (matches old API shape)
      const signIn = await auth.api.signInUsername({
        body: { username, password },
        headers: toAuthHeaders(req),
      });

      res.status(201).json({
        token: signIn.token,
        user: toUserJson(appUser),
      });
    } catch (error) {
      next(error);
    }
  }

  static async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { username, password } = req.body;

      // Better Auth verifies the password (scrypt) and mints a session.
      // The bearer plugin returns the session token for the SPA's
      // `Authorization: Bearer` pattern.
      const signIn = await auth.api.signInUsername({
        body: { username, password },
        headers: toAuthHeaders(req),
      });

      if (!signIn?.token || !signIn?.user) {
        throw new AppError(401, 'Invalid credentials');
      }

      const userRepo = AppDataSource.getRepository(User);
      const appUser = await userRepo.findOne({
        where: { id: signIn.user.id },
      });

      if (!appUser) {
        throw new AppError(401, 'Invalid credentials');
      }

      // Forward any Set-Cookie headers (defense in depth; SPA uses bearer)
      const setCookie = (signIn as { headers?: Headers }).headers?.getSetCookie?.();
      if (setCookie?.length) {
        res.setHeader('set-cookie', setCookie);
      }

      res.json({
        token: signIn.token,
        user: toUserJson(appUser),
      });
    } catch (error) {
      // Better Auth throws on bad credentials — normalize to 401
      if ((error as Error)?.message?.toLowerCase().includes('invalid')) {
        return next(new AppError(401, 'Invalid credentials'));
      }
      next(error);
    }
  }

  static async logout(req: Request, res: Response, next: NextFunction) {
    try {
      await auth.api.signOut({ headers: toAuthHeaders(req) });
      res.json({ message: 'Logged out successfully' });
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

      res.json(toUserJson(user));
    } catch (error) {
      next(error);
    }
  }
}
