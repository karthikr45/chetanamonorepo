import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

/** Per-tenant SMTP credentials (from tenant_configurations). */
export interface TenantSmtp {
  host: string | null;
  port: number | null;
  user: string | null;
  pass: string | null;
  fromName: string | null;
  fromEmail: string | null;
  secure: boolean | null;
}

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
    await this.dispatch(
      {
        host: smtpHost,
        port,
        secure: port === 465,
        user: smtpUser,
        pass: this.configService.get<string>('smtp.pass') ?? '',
        allowInsecure: this.configService.get<boolean>('smtp.allowInsecure'),
      },
      this.configService.get<string>('smtp.from') ?? smtpUser,
      to,
      subject,
      html,
    );
  }

  /**
   * Send using a tenant's own SMTP credentials (from its configuration),
   * falling back to the platform SMTP when the tenant hasn't configured one.
   * Demo mode still short-circuits to a log so dev never sends real mail.
   */
  async sendForTenant(
    smtp: TenantSmtp | null | undefined,
    to: string,
    subject: string,
    html: string,
  ): Promise<void> {
    const demoMode = this.configService.get<boolean>('demoMode');
    const hasTenantSmtp = Boolean(smtp?.host && smtp?.user);

    if (demoMode) {
      this.logger.warn(
        `[MAIL] to=${to} subject="${subject}" (demo mode — not sent)`,
      );
      return;
    }

    if (!hasTenantSmtp) {
      // No tenant SMTP — use the platform transport (which itself logs if
      // the platform SMTP isn't configured either).
      return this.send(to, subject, html);
    }

    const port = smtp!.port ?? 587;
    const fromEmail = smtp!.fromEmail || smtp!.user!;
    const from = smtp!.fromName ? `${smtp!.fromName} <${fromEmail}>` : fromEmail;
    await this.dispatch(
      {
        host: smtp!.host!,
        port,
        secure: smtp!.secure ?? port === 465,
        user: smtp!.user!,
        pass: smtp!.pass ?? '',
      },
      from,
      to,
      subject,
      html,
    );
  }

  /** Builds a transporter and sends one message. */
  private async dispatch(
    cfg: {
      host: string;
      port: number;
      secure: boolean;
      user: string;
      pass: string;
      allowInsecure?: boolean;
    },
    from: string,
    to: string,
    subject: string,
    html: string,
  ): Promise<void> {
    const transporterOptions: Record<string, any> = {
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      requireTLS: !cfg.secure,
      auth: { user: cfg.user, pass: cfg.pass },
    };
    if (cfg.allowInsecure) {
      transporterOptions.tls = { rejectUnauthorized: false };
    }

    try {
      const transporter = nodemailer.createTransport(transporterOptions);
      await transporter.sendMail({ from, to, subject, html });
      this.logger.log(`[MAIL] sent to ${to} — "${subject}"`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`[MAIL] failed to ${to}: ${message}`);
      throw new Error('Could not send email. Check SMTP configuration.');
    }
  }
}
