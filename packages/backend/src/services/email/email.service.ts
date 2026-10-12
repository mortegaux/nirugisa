import net from 'net';
import tls from 'tls';
import { UserInvitation } from '../../db/entities';
import { AppDataSource } from '../../db/data-source';
import { config } from '../../config';
import { encrypt, safeDecrypt } from '../../utils/crypto';

interface SmtpSendOptions {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
  from: string;
  fromName?: string;
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface SmtpSettingsResponse {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  hasPassword: boolean;
  fromEmail: string;
  fromName: string;
  enabled: boolean;
  source: 'database' | 'env' | 'unconfigured';
  isConfigured: boolean;
}

export interface SmtpSettingsUpdateInput {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
  clearPassword?: boolean;
  fromEmail?: string;
  fromName?: string;
  enabled?: boolean;
}

interface EffectiveSmtpConfig extends SmtpSettingsResponse {
  pass: string;
}

/**
 * Lightweight, zero-dependency SMTP client using native Node.js net/tls sockets.
 * Supports direct TLS (port 465), plain/STARTTLS (port 587/25), and AUTH LOGIN / AUTH PLAIN.
 */
function sendRawSmtp(options: SmtpSendOptions): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeoutMs = 20000;
    let timer: NodeJS.Timeout | null = null;
    let socket: net.Socket | tls.TLSSocket;
    let buffer = '';

    const cleanup = () => {
      if (timer) clearTimeout(timer);
      if (socket && !socket.destroyed) {
        socket.destroy();
      }
    };

    timer = setTimeout(() => {
      cleanup();
      reject(new Error(`SMTP connection timed out after ${timeoutMs / 1000}s`));
    }, timeoutMs);

    const onConnect = async () => {
      try {
        await executeSmtpDialog();
        cleanup();
        resolve();
      } catch (err) {
        cleanup();
        reject(err);
      }
    };

    if (options.secure || options.port === 465) {
      socket = tls.connect(
        {
          host: options.host,
          port: options.port,
          rejectUnauthorized: false,
        },
        onConnect
      );
    } else {
      socket = net.connect(
        {
          host: options.host,
          port: options.port,
        },
        onConnect
      );
    }

    socket.on('error', (err) => {
      cleanup();
      reject(err);
    });

    const readResponse = (): Promise<{ code: number; lines: string[] }> => {
      return new Promise((res, rej) => {
        const onData = (data: Buffer) => {
          buffer += data.toString('utf-8');
          // Check if response has completed (e.g. line starting with 3 digits and space)
          const lines = buffer.split('\r\n');
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (/^\d{3} /.test(line)) {
              // Found terminal line of response
              const code = parseInt(line.substring(0, 3), 10);
              const responseLines = lines.slice(0, i + 1);
              buffer = lines.slice(i + 1).join('\r\n');
              socket.off('data', onData);
              socket.off('error', onError);
              return res({ code, lines: responseLines });
            }
          }
        };

        const onError = (err: Error) => {
          socket.off('data', onData);
          socket.off('error', onError);
          rej(err);
        };

        socket.on('data', onData);
        socket.on('error', onError);
      });
    };

    const sendLine = (line: string): Promise<void> => {
      return new Promise((res, rej) => {
        socket.write(line + '\r\n', (err) => {
          if (err) rej(err);
          else res();
        });
      });
    };

    const executeSmtpDialog = async () => {
      // 1. Initial greeting (220)
      const greeting = await readResponse();
      if (greeting.code >= 400) {
        throw new Error(`SMTP greeting rejected: ${greeting.lines.join(' ')}`);
      }

      // 2. Send EHLO
      await sendLine(`EHLO nommable.local`);
      let ehloResp = await readResponse();
      if (ehloResp.code >= 400) {
        // Fallback to HELO if EHLO rejected
        await sendLine(`HELO nommable.local`);
        ehloResp = await readResponse();
        if (ehloResp.code >= 400) {
          throw new Error(`SMTP EHLO/HELO rejected: ${ehloResp.lines.join(' ')}`);
        }
      }

      // 3. Check for STARTTLS on unencrypted connections
      const supportsStarttls = ehloResp.lines.some((l) => l.toUpperCase().includes('STARTTLS'));
      if (!options.secure && options.port !== 465 && supportsStarttls) {
        await sendLine('STARTTLS');
        const starttlsResp = await readResponse();
        if (starttlsResp.code === 220) {
          // Upgrade plain socket to TLS
          await new Promise<void>((upgradeResolve, upgradeReject) => {
            const tlsSocket = tls.connect(
              {
                socket: socket as net.Socket,
                host: options.host,
                rejectUnauthorized: false,
              },
              () => {
                socket = tlsSocket;
                upgradeResolve();
              }
            );
            tlsSocket.on('error', upgradeReject);
          });

          // Re-issue EHLO after TLS upgrade
          await sendLine(`EHLO nommable.local`);
          const reEhlo = await readResponse();
          if (reEhlo.code >= 400) {
            throw new Error(`SMTP EHLO after STARTTLS failed: ${reEhlo.lines.join(' ')}`);
          }
        }
      }

      // 4. Authenticate if credentials provided
      if (options.user && options.pass) {
        await sendLine('AUTH LOGIN');
        const authReq = await readResponse();
        if (authReq.code === 334) {
          await sendLine(Buffer.from(options.user).toString('base64'));
          const passReq = await readResponse();
          if (passReq.code === 334) {
            await sendLine(Buffer.from(options.pass).toString('base64'));
            const authOk = await readResponse();
            if (authOk.code >= 400) {
              throw new Error(`SMTP authentication failed: ${authOk.lines.join(' ')}`);
            }
          } else {
            throw new Error(`SMTP auth password prompt failed: ${passReq.lines.join(' ')}`);
          }
        } else {
          // Fallback to AUTH PLAIN
          const plainToken = Buffer.from(`\0${options.user}\0${options.pass}`).toString('base64');
          await sendLine(`AUTH PLAIN ${plainToken}`);
          const plainResp = await readResponse();
          if (plainResp.code >= 400) {
            throw new Error(`SMTP authentication rejected: ${plainResp.lines.join(' ')}`);
          }
        }
      }

      // 5. MAIL FROM
      await sendLine(`MAIL FROM:<${options.from}>`);
      const mailFromResp = await readResponse();
      if (mailFromResp.code >= 400) {
        throw new Error(`SMTP MAIL FROM rejected: ${mailFromResp.lines.join(' ')}`);
      }

      // 6. RCPT TO
      await sendLine(`RCPT TO:<${options.to}>`);
      const rcptToResp = await readResponse();
      if (rcptToResp.code >= 400) {
        throw new Error(`SMTP RCPT TO rejected: ${rcptToResp.lines.join(' ')}`);
      }

      // 7. DATA
      await sendLine('DATA');
      const dataResp = await readResponse();
      if (dataResp.code !== 354) {
        throw new Error(`SMTP DATA rejected: ${dataResp.lines.join(' ')}`);
      }

      // 8. Send MIME payload
      const senderName = (options.fromName || 'Nommable').replace(/["\r\n]/g, '').trim() || 'Nommable';
      const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).substring(2)}`;
      const messageHeaders = [
        `From: "${senderName}" <${options.from}>`,
        `To: <${options.to}>`,
        `Subject: =?UTF-8?B?${Buffer.from(options.subject).toString('base64')}?=`,
        `Date: ${new Date().toUTCString()}`,
        `MIME-Version: 1.0`,
        `Content-Type: multipart/alternative; boundary="${boundary}"`,
      ];

      const messageBody = [
        `--${boundary}`,
        `Content-Type: text/plain; charset=UTF-8`,
        `Content-Transfer-Encoding: 7bit`,
        ``,
        options.text,
        ``,
        `--${boundary}`,
        `Content-Type: text/html; charset=UTF-8`,
        `Content-Transfer-Encoding: 7bit`,
        ``,
        options.html,
        ``,
        `--${boundary}--`,
        `.`,
      ];

      await sendLine(messageHeaders.join('\r\n') + '\r\n\r\n' + messageBody.join('\r\n'));

      const finishResp = await readResponse();
      if (finishResp.code >= 400) {
        throw new Error(`SMTP message rejected: ${finishResp.lines.join(' ')}`);
      }

      // 9. QUIT
      try {
        await sendLine('QUIT');
        await readResponse();
      } catch {
        // Safe to ignore QUIT acknowledgment
      }
    };
  });
}

export class EmailService {
  private static tableInitialized = false;

  static async initialize(): Promise<void> {
    if (this.tableInitialized || !AppDataSource.isInitialized) return;
    try {
      await AppDataSource.query(`
        CREATE TABLE IF NOT EXISTS "smtp_settings" (
          "id" varchar(32) PRIMARY KEY DEFAULT 'default',
          "host" varchar(255) NOT NULL DEFAULT '',
          "port" integer NOT NULL DEFAULT 587,
          "secure" boolean NOT NULL DEFAULT 0,
          "username" varchar(255) NOT NULL DEFAULT '',
          "password_encrypted" text NOT NULL DEFAULT '',
          "from_email" varchar(255) NOT NULL DEFAULT 'noreply@nommable.local',
          "from_name" varchar(255) NOT NULL DEFAULT 'Nommable',
          "enabled" boolean NOT NULL DEFAULT 1,
          "updated_at" datetime NOT NULL DEFAULT (datetime('now'))
        )
      `);
      this.tableInitialized = true;
    } catch (err) {
      console.warn('[EmailService] Failed to ensure smtp_settings table:', err);
    }
  }

  private static async getEffectiveConfig(): Promise<EffectiveSmtpConfig> {
    await this.initialize();

    if (AppDataSource.isInitialized) {
      try {
        const rows = await AppDataSource.query(
          `SELECT * FROM "smtp_settings" WHERE "id" = 'default' LIMIT 1`
        );
        if (rows && rows.length > 0) {
          const row = rows[0];
          const host = (row.host || '').trim();
          const pass = safeDecrypt(row.password_encrypted) || '';
          const enabled =
            row.enabled === undefined || row.enabled === null
              ? true
              : row.enabled !== false && row.enabled !== 0 && row.enabled !== '0';
          const secure =
            row.secure === true || row.secure === 1 || row.secure === '1' || row.secure === 'true';
          const isConfigured = Boolean(enabled && host);

          return {
            host,
            port: Number(row.port) || 587,
            secure,
            user: (row.username || '').trim(),
            pass,
            hasPassword: Boolean(pass),
            fromEmail: (row.from_email || config.smtp.from || 'noreply@nommable.local').trim(),
            fromName: (row.from_name || 'Nommable').trim(),
            enabled,
            source: host ? 'database' : 'unconfigured',
            isConfigured,
          };
        }
      } catch (err) {
        console.warn('[EmailService] Failed to read smtp_settings from DB:', err);
      }
    }

    const envHost = (config.smtp.host || '').trim();
    if (envHost) {
      const envPass = config.smtp.pass || '';
      return {
        host: envHost,
        port: Number(config.smtp.port) || 587,
        secure: Boolean(config.smtp.secure),
        user: (config.smtp.user || '').trim(),
        pass: envPass,
        hasPassword: Boolean(envPass),
        fromEmail: (config.smtp.from || 'noreply@nommable.local').trim(),
        fromName: 'Nommable',
        enabled: true,
        source: 'env',
        isConfigured: true,
      };
    }

    return {
      host: '',
      port: 587,
      secure: false,
      user: '',
      pass: '',
      hasPassword: false,
      fromEmail: (config.smtp.from || 'noreply@nommable.local').trim(),
      fromName: 'Nommable',
      enabled: true,
      source: 'unconfigured',
      isConfigured: false,
    };
  }

  static async getSettings(): Promise<SmtpSettingsResponse> {
    const effective = await this.getEffectiveConfig();
    const { pass: _pass, ...publicSettings } = effective;
    return publicSettings;
  }

  static async saveSettings(input: SmtpSettingsUpdateInput): Promise<SmtpSettingsResponse> {
    await this.initialize();
    const current = await this.getEffectiveConfig();

    const host = (input.host ?? '').trim();
    const port = Number(input.port) || 587;
    const secure = Boolean(input.secure);
    const user = (input.user ?? '').trim();
    const fromEmail = (input.fromEmail || current.fromEmail || 'noreply@nommable.local').trim();
    const fromName = (input.fromName || current.fromName || 'Nommable').trim();
    const enabled = input.enabled !== undefined ? Boolean(input.enabled) : true;

    let finalPlainPassword = current.pass;
    if (input.clearPassword) {
      finalPlainPassword = '';
    } else if (typeof input.pass === 'string' && input.pass.trim() !== '' && input.pass !== '••••••••') {
      finalPlainPassword = input.pass;
    }

    const passwordEncrypted = finalPlainPassword ? encrypt(finalPlainPassword) : '';

    await AppDataSource.query(
      `INSERT INTO "smtp_settings" (
        "id", "host", "port", "secure", "username", "password_encrypted", "from_email", "from_name", "enabled", "updated_at"
      ) VALUES ('default', ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT ("id") DO UPDATE SET
        "host" = EXCLUDED."host",
        "port" = EXCLUDED."port",
        "secure" = EXCLUDED."secure",
        "username" = EXCLUDED."username",
        "password_encrypted" = EXCLUDED."password_encrypted",
        "from_email" = EXCLUDED."from_email",
        "from_name" = EXCLUDED."from_name",
        "enabled" = EXCLUDED."enabled",
        "updated_at" = datetime('now')`,
      [host, port, secure ? 1 : 0, user, passwordEncrypted, fromEmail, fromName, enabled ? 1 : 0]
    );

    return this.getSettings();
  }

  static async sendTestEmail(
    input: Partial<SmtpSettingsUpdateInput> & { toEmail: string }
  ): Promise<{ success: boolean; message: string }> {
    const current = await this.getEffectiveConfig();

    const host = (input.host !== undefined ? input.host : current.host).trim();
    const port = Number(input.port !== undefined ? input.port : current.port) || 587;
    const secure = input.secure !== undefined ? Boolean(input.secure) : current.secure;
    const user = (input.user !== undefined ? input.user : current.user).trim();
    const fromEmail = (input.fromEmail || current.fromEmail || user || 'noreply@nommable.local').trim();
    const fromName = (input.fromName || current.fromName || 'Nommable').trim();
    const toEmail = (input.toEmail || fromEmail).trim();

    let pass = current.pass;
    if (typeof input.pass === 'string' && input.pass.trim() !== '' && input.pass !== '••••••••') {
      pass = input.pass;
    }

    if (!host) {
      return {
        success: false,
        message: 'SMTP host is required to test the connection.',
      };
    }

    if (!toEmail) {
      return {
        success: false,
        message: 'A recipient email address is required for the test email.',
      };
    }

    const plainText = [
      `Nommable SMTP Test Successful!`,
      ``,
      `Your SMTP configuration (${host}:${port}) is working properly.`,
      `Invitation emails will now be delivered automatically from ${fromName} <${fromEmail}>.`,
      ``,
      `— Nommable`,
    ].join('\n');

    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Nommable SMTP Test</title>
</head>
<body style="margin: 0; padding: 24px; background-color: #f4f6f8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1f2937;">
  <div style="max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e5e7eb;">
    <div style="background-color: #10b981; padding: 20px 24px; text-align: center;">
      <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 700;">Nommable SMTP Test</h1>
    </div>
    <div style="padding: 24px;">
      <p style="margin: 0 0 12px 0; font-size: 15px; line-height: 22px; color: #111827; font-weight: 600;">
        Your email settings are working!
      </p>
      <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 20px; color: #4b5563;">
        Nommable successfully connected to <strong>${host}:${port}</strong> and delivered this test message from <strong>${fromName} &lt;${fromEmail}&gt;</strong>.
      </p>
      <p style="margin: 0; font-size: 12px; color: #9ca3af;">
        Sent at ${new Date().toUTCString()}
      </p>
    </div>
  </div>
</body>
</html>`.trim();

    try {
      await sendRawSmtp({
        host,
        port,
        secure,
        user: user || undefined,
        pass: pass || undefined,
        from: fromEmail,
        fromName,
        to: toEmail,
        subject: 'Nommable — SMTP Test Email',
        html: htmlContent,
        text: plainText,
      });

      return {
        success: true,
        message: `Test email sent to ${toEmail} via ${host}:${port}.`,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `SMTP test failed: ${err.message || 'Unknown connection error'}`,
      };
    }
  }

  /**
   * Send invitation email via configured SMTP server with clean HTML branding.
   * If SMTP is not configured or delivery fails, returns structured status
   * so the admin can always share the invitation link directly.
   */
  static async sendInvitation(
    invitation: UserInvitation,
    inviteUrl: string
  ): Promise<{ success: boolean; message: string }> {
    const formattedDate = new Date(invitation.expiresAt).toLocaleDateString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const smtp = await this.getEffectiveConfig();

    if (!smtp.isConfigured) {
      console.log('='.repeat(80));
      console.log('[EmailService] SMTP not configured. Invitation link generated for manual sharing:');
      console.log(`To: ${invitation.email}`);
      console.log(`Role: ${invitation.role}`);
      console.log(`Expires: ${invitation.expiresAt.toISOString()}`);
      console.log(`Invitation Link: ${inviteUrl}`);
      console.log('='.repeat(80));

      return {
        success: false,
        message: 'SMTP is not configured yet. Configure SMTP in Email Settings, or copy and share the invitation link below directly.',
      };
    }

    const roleName = invitation.role === 'admin' ? 'Administrator' : 'Member';

    const plainText = [
      `You're invited to join Nommable!`,
      ``,
      `You have been invited to join Nommable as a ${roleName}.`,
      `Complete your registration by opening the following link in your browser:`,
      ``,
      `${inviteUrl}`,
      ``,
      `This invitation will expire on ${formattedDate}.`,
      ``,
      `— The Nommable Team`,
    ].join('\n');

    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You're invited to Nommable</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f6f8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1f2937;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f6f8; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 560px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03); border: 1px solid #e5e7eb;">
          <!-- Header -->
          <tr>
            <td style="background-color: #10b981; padding: 28px 32px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 26px; font-weight: 700; letter-spacing: -0.5px;">Nommable</h1>
              <p style="margin: 4px 0 0 0; color: #d1fae5; font-size: 14px;">Recipe Management &amp; Culinary Planning</p>
            </td>
          </tr>
          
          <!-- Body -->
          <tr>
            <td style="padding: 32px;">
              <h2 style="margin: 0 0 16px 0; color: #111827; font-size: 20px; font-weight: 600;">You're Invited!</h2>
              <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 24px; color: #4b5563;">
                You've been invited to join Nommable as a <strong style="color: #111827;">${roleName}</strong>. 
                With Nommable, you can organize your recipes, import from the web, build calendar meal plans, and use AI-assisted culinary tools.
              </p>
              
              <!-- Action Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 28px 0;">
                <tr>
                  <td align="center">
                    <a href="${inviteUrl}" target="_blank" style="display: inline-block; background-color: #10b981; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 600; padding: 14px 28px; border-radius: 8px; box-shadow: 0 2px 4px rgba(16, 185, 129, 0.3);">
                      Accept Invitation &amp; Create Account
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Fallback Link -->
              <p style="margin: 24px 0 8px 0; font-size: 13px; color: #6b7280; line-height: 20px;">
                If the button above does not work, copy and paste this link into your web browser:
              </p>
              <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 10px 12px; font-size: 12px; word-break: break-all; color: #374151; font-family: monospace;">
                ${inviteUrl}
              </div>

              <!-- Expiry Note -->
              <p style="margin: 20px 0 0 0; font-size: 12px; color: #9ca3af;">
                Note: This invitation link is valid until <strong>${formattedDate}</strong>.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 20px 32px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                Sent by your Nommable administrator. If you were not expecting this invitation, you can safely ignore this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();

    try {
      await sendRawSmtp({
        host: smtp.host,
        port: smtp.port,
        secure: smtp.secure,
        user: smtp.user || undefined,
        pass: smtp.pass || undefined,
        from: smtp.fromEmail,
        fromName: smtp.fromName,
        to: invitation.email,
        subject: `You're invited to join Nommable (${roleName})`,
        html: htmlContent,
        text: plainText,
      });

      console.log(`[EmailService] Invitation email successfully sent to ${invitation.email}`);
      return {
        success: true,
        message: `Invitation email sent successfully to ${invitation.email}.`,
      };
    } catch (err: any) {
      console.warn(`[EmailService] Failed to send email to ${invitation.email}:`, err.message);
      return {
        success: false,
        message: `Could not deliver email (${err.message}). Share the invitation link directly with the user.`,
      };
    }
  }
}
