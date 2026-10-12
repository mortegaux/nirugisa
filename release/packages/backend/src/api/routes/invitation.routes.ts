import { Router } from 'express';
import { InvitationController } from '../controllers/invitation.controller';
import { authMiddleware, requireAdmin } from '../middleware';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Create invitation (admin only)
router.post('/', requireAdmin, InvitationController.create);

// Get pending invitations (admin only)
router.get('/', requireAdmin, InvitationController.getAll);

// Validate invitation token (public - no auth needed, so we override)
router.get('/validate/:token', InvitationController.validate);

// Revoke invitation (admin only)
router.delete('/:id', requireAdmin, InvitationController.revoke);

export default router;
