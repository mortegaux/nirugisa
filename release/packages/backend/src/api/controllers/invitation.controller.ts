import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware';
import { InvitationService } from '../../services/invitation/invitation.service';
import { EmailService } from '../../services/email/email.service';
import { AppError } from '../middleware';

export class InvitationController {
  static async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { email, role } = req.body;
      const adminId = req.userId!;

      const invitation = await InvitationService.createInvitation(adminId, email, role);

      // Send invitation email
      await EmailService.sendInvitation(invitation);

      res.status(201).json({
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        expiresAt: invitation.expiresAt,
        createdAt: invitation.createdAt,
      });
    } catch (error: any) {
      if (error.message.includes('already exists') || error.message.includes('already sent')) {
        next(new AppError(409, error.message));
      } else {
        next(error);
      }
    }
  }

  static async getAll(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const adminId = req.userId!;

      const invitations = await InvitationService.getPendingInvitations(adminId);

      res.json(
        invitations.map((inv) => ({
          id: inv.id,
          email: inv.email,
          role: inv.role,
          expiresAt: inv.expiresAt,
          createdAt: inv.createdAt,
        }))
      );
    } catch (error) {
      next(error);
    }
  }

  static async validate(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { token } = req.params;

      const invitation = await InvitationService.validateInvitation(token);

      if (!invitation) {
        throw new AppError(400, 'Invalid or expired invitation');
      }

      res.json({
        email: invitation.email,
        role: invitation.role,
        valid: true,
      });
    } catch (error) {
      next(error);
    }
  }

  static async revoke(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const adminId = req.userId!;

      await InvitationService.revokeInvitation(id, adminId);

      res.status(204).send();
    } catch (error: any) {
      if (error.message.includes('not found')) {
        next(new AppError(404, error.message));
      } else if (error.message.includes('Cannot revoke')) {
        next(new AppError(400, error.message));
      } else {
        next(error);
      }
    }
  }
}
