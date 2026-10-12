import { Request, Response, NextFunction } from 'express';
import { auth } from '../../lib/auth';
import { AppDataSource } from '../../db/data-source';
import { User } from '../../db/entities';
import { UserRole } from '@nommable/shared';

export interface AuthRequest extends Request {
  userId?: string;
  userRole?: UserRole;
}

/**
 * Convert Express request headers into a Fetch `Headers` object for
 * Better Auth. Forwards `authorization` (bearer plugin) and `cookie`.
 */
function toAuthHeaders(req: Request): Headers {
  const headers = new Headers();
  const authHeader = req.headers.authorization;
  if (authHeader) headers.set('authorization', authHeader);
  const cookie = req.headers.cookie;
  if (cookie) headers.set('cookie', cookie);
  if (req.ip) headers.set('x-forwarded-for', req.ip);
  const ua = req.get('user-agent');
  if (ua) headers.set('user-agent', ua);
  return headers;
}

export { toAuthHeaders };

export const authMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const session = await auth.api.getSession({
      headers: toAuthHeaders(req),
    });

    if (!session?.user) {
      return res.status(401).json({ error: 'No session provided' });
    }

    // Load the app-side user for role-based access control.
    const userRepo = AppDataSource.getRepository(User);
    const appUser = await userRepo.findOne({
      where: { id: session.user.id },
    });

    if (!appUser) {
      return res.status(401).json({ error: 'User not found' });
    }

    req.userId = appUser.id;
    req.userRole = appUser.role;

    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid session' });
  }
};
