import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware';
import { InvitationService } from '../../services/invitation/invitation.service';
import { EmailService } from '../../services/email/email.service';
import { AppError } from '../middleware';
import { config } from '../../config';

function getFrontendBaseUrl(req: AuthRequest): string {
  const originHeader = req.get('origin') || req.get('referer');
  let base = originHeader ? originHeader.replace(/\/$/, '') : '';
  if (base) {
    try {
      const parsed = new URL(base);
      base = parsed.origin;
    } catch {
      // ignore
    }
  }
  if (!base || base.includes('/api')) {
    if (typeof config.cors.origin === 'string' && config.cors.origin !== '*') {
      base = config.cors.origin;
    } else {
      const host = req.get('host') || 'localhost:8765';
      base = `${req.protocol}://${host}`;
    }
  }
  // Common self-hosted Portainer mapping: backend port 8766 -> frontend port 8765
  if (base.includes(':8766')) {
    base = base.replace(':8766', ':8765');
  }
  return base;
}

export class InvitationController {
  static async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { email, role } = req.body;
      const adminId = req.userId!;

      const invitation = await InvitationService.createInvitation(adminId, email, role);

      const frontendBase = getFrontendBaseUrl(req);
      const inviteUrl = `${frontendBase}/register?token=${invitation.token}`;

      // Send invitation email via SMTP (gracefully falls back if not configured)
      const emailResult = await EmailService.sendInvitation(invitation, inviteUrl);

      res.status(201).json({
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        token: invitation.token,
        inviteUrl,
        expiresAt: invitation.expiresAt,
        createdAt: invitation.createdAt,
        emailSent: emailResult.success,
        emailStatus: emailResult.message,
      });
    } catch (error: any) {
      if (error.message?.includes('already exists') || error.message?.includes('already sent')) {
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
      const frontendBase = getFrontendBaseUrl(req);

      res.json(
        invitations.map((inv) => ({
          id: inv.id,
          email: inv.email,
          role: inv.role,
          token: inv.token,
          inviteUrl: `${frontendBase}/register?token=${inv.token}`,
          expiresAt: inv.expiresAt,
          createdAt: inv.createdAt,
          isExpired: new Date() > new Date(inv.expiresAt),
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

  static async resend(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const adminId = req.userId!;

      const invitation = await InvitationService.resendInvitation(id, adminId);
      const frontendBase = getFrontendBaseUrl(req);
      const inviteUrl = `${frontendBase}/register?token=${invitation.token}`;
      const emailResult = await EmailService.sendInvitation(invitation, inviteUrl);

      res.json({
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        token: invitation.token,
        inviteUrl,
        expiresAt: invitation.expiresAt,
        createdAt: invitation.createdAt,
        emailSent: emailResult.success,
        emailStatus: emailResult.message,
      });
    } catch (error: any) {
      if (error.message?.includes('not found')) {
        next(new AppError(404, error.message));
      } else {
        next(new AppError(400, error.message));
      }
    }
  }

  static async revoke(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const adminId = req.userId!;

      await InvitationService.revokeInvitation(id, adminId);

      res.status(204).send();
    } catch (error: any) {
      if (error.message?.includes('not found')) {
        next(new AppError(404, error.message));
      } else if (error.message?.includes('Cannot revoke')) {
        next(new AppError(400, error.message));
      } else {
        next(error);
      }
    }
  }
}
