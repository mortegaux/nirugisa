import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { authMiddleware } from '../middleware';
import { z } from 'zod';
import { validateBody } from '../middleware';

const router = Router();

const loginSchema = z.object({
  username: z.string().min(1, 'Username or email is required'),
  password: z.string().min(1, 'Password is required'),
});

const registerWithInviteSchema = z.object({
  token: z.string().uuid(),
  username: z.string().min(3),
  password: z.string().min(6),
});

router.post('/register/invite', validateBody(registerWithInviteSchema), AuthController.registerWithInvitation);
router.post('/login', validateBody(loginSchema), AuthController.login);
router.get('/me', authMiddleware, AuthController.me);

export default router;
