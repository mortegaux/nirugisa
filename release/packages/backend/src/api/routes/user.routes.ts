import { Router } from 'express';
import { UserController } from '../controllers/user.controller';
import { authMiddleware, requireAdmin } from '../middleware';
import { profilePhotoUpload } from '../middleware/upload';

const router = Router();

// Profile management routes (authenticated users)
router.put('/profile/password', authMiddleware, UserController.updatePassword);
router.put('/profile/email', authMiddleware, UserController.updateEmail);
router.put('/profile', authMiddleware, UserController.updateProfile);
router.post('/profile/photo', authMiddleware, profilePhotoUpload.single('photo'), UserController.uploadProfilePhoto);

// Admin routes - require admin role
router.use(authMiddleware, requireAdmin);

// Get all users
router.get('/', UserController.getAllUsers);

// Get username suggestions
router.get('/username-suggestions', UserController.getUsernameSuggestions);

// Create a new user
router.post('/', UserController.createUser);

// Update user role
router.patch('/:userId/role', UserController.updateUserRole);

// Delete a user
router.delete('/:userId', UserController.deleteUser);

export default router;
