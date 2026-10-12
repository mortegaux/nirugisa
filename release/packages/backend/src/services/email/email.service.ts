import { UserInvitation } from '../../db/entities';
import { config } from '../../config';

export class EmailService {
  /**
   * Send invitation email (mock implementation)
   * TODO: Replace with nodemailer integration for production
   */
  static async sendInvitation(invitation: UserInvitation): Promise<void> {
    const frontendUrl = config.cors.origin;
    const inviteUrl = `${frontendUrl}/register?token=${invitation.token}`;

    // Mock implementation - log to console
    console.log('='.repeat(80));
    console.log('INVITATION EMAIL');
    console.log('='.repeat(80));
    console.log(`To: ${invitation.email}`);
    console.log(`Role: ${invitation.role}`);
    console.log(`Expires: ${invitation.expiresAt.toISOString()}`);
    console.log(`\nInvitation Link: ${inviteUrl}`);
    console.log('='.repeat(80));

    // TODO: Implement actual email sending with nodemailer
    /*
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: invitation.email,
      subject: 'You are invited to Nommable',
      html: `
        <h1>Welcome to Nommable!</h1>
        <p>You have been invited to join Nommable as a ${invitation.role}.</p>
        <p>Click the link below to complete your registration:</p>
        <a href="${inviteUrl}">${inviteUrl}</a>
        <p>This invitation expires on ${invitation.expiresAt.toLocaleString()}.</p>
      `,
    });
    */
  }
}
