import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

/**
 * Thin SMTP wrapper. In demo mode or when SMTP isn't configured it logs the
 * message instead of sending so local/dev flows still work end-to-end.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly configService: ConfigService) {}

  async send(to: string, subject: string, html: string): Promise<void> {
    const smtpUser = this.configService.get<string>('smtp.user');
    const smtpHost = this.configService.get<string>('smtp.host');
    const demoMode = this.configService.get<boolean>('demoMode');

    if (demoMode || !smtpUser || !smtpHost) {
      this.logger.warn(
        `[MAIL] to=${to} subject="${subject}" (demo / no SMTP — not sent)`,
      );
      return;
    }

    const port = this.configService.get<number>('smtp.port') ?? 587;
    const secure = port === 465;
    const transporterOptions: Record<string, any> = {
      host: smtpHost,
      port,
      secure,
      requireTLS: !secure,
      auth: { user: smtpUser, pass: this.configService.get<string>('smtp.pass') },
    };
    if (this.configService.get<boolean>('smtp.allowInsecure')) {
      transporterOptions.tls = { rejectUnauthorized: false };
    }

    try {
      const transporter = nodemailer.createTransport(transporterOptions);
      await transporter.sendMail({
        from: this.configService.get<string>('smtp.from'),
        to,
        subject,
        html,
      });
      this.logger.log(`[MAIL] sent to ${to} — "${subject}"`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`[MAIL] failed to ${to}: ${message}`);
      throw new Error('Could not send email. Check SMTP configuration.');
    }
  }
}
