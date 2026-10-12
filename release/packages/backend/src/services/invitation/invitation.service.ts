import { v4 as uuidv4 } from 'uuid';
import { AppDataSource } from '../../db/data-source';
import { UserInvitation, User } from '../../db/entities';
import { UserRole } from '@nommable/shared';

export class InvitationService {
  static async createInvitation(
    adminId: string,
    email: string,
    role: UserRole
  ): Promise<UserInvitation> {
    const invitationRepo = AppDataSource.getRepository(UserInvitation);
    const userRepo = AppDataSource.getRepository(User);

    // Check if user with this email already exists
    const existingUser = await userRepo.findOne({ where: { email } });
    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    // Check if there's a pending invitation for this email
    const existingInvitation = await invitationRepo.findOne({
      where: { email, accepted: false },
    });

    if (existingInvitation) {
      throw new Error('Invitation already sent to this email');
    }

    // Create invitation with 7-day expiry
    const token = uuidv4();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const invitation = invitationRepo.create({
      email,
      invitedById: adminId,
      role,
      token,
      expiresAt,
      accepted: false,
    });

    await invitationRepo.save(invitation);

    return invitation;
  }

  static async validateInvitation(token: string): Promise<UserInvitation | null> {
    const invitationRepo = AppDataSource.getRepository(UserInvitation);

    const invitation = await invitationRepo.findOne({
      where: { token },
    });

    if (!invitation) {
      return null;
    }

    // Check if already accepted
    if (invitation.accepted) {
      return null;
    }

    // Check if expired
    if (new Date() > invitation.expiresAt) {
      return null;
    }

    return invitation;
  }

  static async acceptInvitation(token: string): Promise<void> {
    const invitationRepo = AppDataSource.getRepository(UserInvitation);

    const invitation = await invitationRepo.findOne({ where: { token } });

    if (!invitation) {
      throw new Error('Invitation not found');
    }

    invitation.accepted = true;
    await invitationRepo.save(invitation);
  }

  static async getPendingInvitations(adminId: string): Promise<UserInvitation[]> {
    const invitationRepo = AppDataSource.getRepository(UserInvitation);

    const invitations = await invitationRepo.find({
      where: { accepted: false },
      order: { createdAt: 'DESC' },
    });

    return invitations;
  }

  static async revokeInvitation(invitationId: string, adminId: string): Promise<void> {
    const invitationRepo = AppDataSource.getRepository(UserInvitation);

    const invitation = await invitationRepo.findOne({
      where: { id: invitationId },
    });

    if (!invitation) {
      throw new Error('Invitation not found');
    }

    if (invitation.accepted) {
      throw new Error('Cannot revoke accepted invitation');
    }

    await invitationRepo.remove(invitation);
  }
}
