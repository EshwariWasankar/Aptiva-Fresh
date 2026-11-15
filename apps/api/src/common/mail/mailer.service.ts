import { Inject, Injectable, Logger } from '@nestjs/common';
import nodemailer, { type Transporter } from 'nodemailer';
import { ENV, type Env } from '../config/env';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface MailDeliveryResult {
  accepted: boolean;
  provider: 'smtp' | 'resend' | 'console';
  messageId?: string | undefined;
  response?: string | undefined;
}

/**
 * Enterprise Mail Adapter supporting SMTP (Gmail, Brevo, SendGrid, Amazon SES)
 * and HTTP transactional API (Resend).
 *
 * In tests or when explicitly permitted via ALLOW_CONSOLE_MAIL, falls back to console logging.
 * In development and production, throws an explicit configuration/delivery error if no provider
 * is configured or if the outgoing delivery is rejected by the server/provider.
 */
@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private smtpTransporter: Transporter | null = null;

  constructor(@Inject(ENV) private readonly env: Env) {
    if (this.isSmtpConfigured()) {
      const port = this.env.SMTP_PORT || (this.env.SMTP_SECURE === 'true' ? 465 : 587);
      const secure = this.env.SMTP_SECURE === 'true' || port === 465;
      this.smtpTransporter = nodemailer.createTransport({
        host: this.env.SMTP_HOST,
        port,
        secure,
        auth: {
          user: this.env.SMTP_USER,
          pass: this.env.SMTP_PASS,
        },
      });
      this.logger.log(
        `SMTP transporter configured for host=${this.env.SMTP_HOST}:${port} secure=${secure}`,
      );
    }
  }

  isSmtpConfigured(): boolean {
    return Boolean(this.env.SMTP_HOST && this.env.SMTP_USER && this.env.SMTP_PASS);
  }

  isResendConfigured(): boolean {
    return Boolean(this.env.EMAIL_API_KEY && this.env.EMAIL_API_KEY !== 'replace');
  }

  isConfigured(): boolean {
    return this.isSmtpConfigured() || this.isResendConfigured();
  }

  getProviderName(): 'smtp' | 'resend' | 'console' | 'none' {
    if (this.isSmtpConfigured()) return 'smtp';
    if (this.isResendConfigured()) return 'resend';
    if (this.env.NODE_ENV === 'test' || process.env.ALLOW_CONSOLE_MAIL === 'true') return 'console';
    return 'none';
  }

  /**
   * Verifies SMTP connection readiness if SMTP is configured.
   */
  async verifyConnection(): Promise<{ ok: boolean; error?: string }> {
    if (!this.smtpTransporter) {
      return { ok: false, error: 'SMTP transporter not initialized' };
    }
    try {
      await this.smtpTransporter.verify();
      return { ok: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, error: message };
    }
  }

  /**
   * Delivers an email through the active provider.
   * Throws an error if no provider is configured or if the delivery is rejected.
   */
  async send(message: MailMessage): Promise<MailDeliveryResult> {
    const fromAddress =
      this.env.EMAIL_FROM || this.env.SMTP_USER || 'Aptiva Security <no-reply@aptiva.local>';

    // 1. SMTP Provider (Nodemailer)
    if (this.isSmtpConfigured()) {
      try {
        const transporter = this.smtpTransporter!;
        const info = await transporter.sendMail({
          from: fromAddress,
          to: message.to,
          subject: message.subject,
          text: message.text,
          html: message.html,
        });

        this.logger.log(
          `[mail:smtp] Outgoing email accepted by ${this.env.SMTP_HOST} for ${message.to}. MessageId: ${info.messageId}`,
        );

        return {
          accepted: true,
          provider: 'smtp',
          ...(info.messageId ? { messageId: info.messageId } : {}),
          ...(info.response ? { response: info.response } : {}),
        };
      } catch (err: unknown) {
        const messageText = err instanceof Error ? err.message : String(err);
        this.logger.error(`[mail:smtp] SMTP delivery failed to ${message.to}: ${messageText}`);
        throw new Error(`SMTP_DELIVERY_FAILED: ${messageText}`);
      }
    }

    // 2. Resend REST API
    if (this.isResendConfigured()) {
      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.env.EMAIL_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: fromAddress.includes('@') ? fromAddress : 'onboarding@resend.dev',
            to: message.to,
            subject: message.subject,
            text: message.text,
            html: message.html,
          }),
        });

        if (!res.ok) {
          const errorText = await res.text();
          this.logger.error(
            `[mail:resend] Resend API rejected message to ${message.to}: ${res.status} ${errorText}`,
          );
          throw new Error(`RESEND_REJECTED: HTTP ${res.status} ${errorText}`);
        }

        const data = (await res.json()) as { id: string };
        this.logger.log(
          `[mail:resend] Outgoing email accepted by Resend for ${message.to}. ID: ${data.id}`,
        );

        return {
          accepted: true,
          provider: 'resend',
          messageId: data.id,
        };
      } catch (err: unknown) {
        const messageText = err instanceof Error ? err.message : String(err);
        this.logger.error(`[mail:resend] Delivery failed: ${messageText}`);
        throw new Error(`EMAIL_PROVIDER_FAILED: ${messageText}`);
      }
    }

    // 3. Fallback for Automated Vitest Runs
    if (this.env.NODE_ENV === 'test' || process.env.ALLOW_CONSOLE_MAIL === 'true') {
      this.logger.log(
        `[mail:console] to=${message.to} subject=${message.subject}\n${message.text}`,
      );
      return {
        accepted: true,
        provider: 'console',
        messageId: `console-${Date.now()}`,
      };
    }

    // 4. Missing Configuration
    const missingMessage =
      'EMAIL_SERVICE_NOT_CONFIGURED: No email provider configured. Please configure SMTP credentials (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM) or EMAIL_API_KEY in apps/api/.env.';
    this.logger.error(`[mail:error] Cannot deliver email to ${message.to}: ${missingMessage}`);
    throw new Error(missingMessage);
  }
}
