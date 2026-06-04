import { createTransport, type Transporter } from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';
import { createLogger } from '../utils/logger.util';

const logger = createLogger('Mailer');

type MailRecipient = string | string[];

type SendMailOptions = {
  to: MailRecipient;
  subject: string;
  text?: string;
  html?: string;
  cc?: MailRecipient;
  bcc?: MailRecipient;
  replyTo?: string;
  headers?: Record<string, string>;
};

type MailOptions = SendMailOptions & Record<string, any>;

type EmailConfig = {
  user?: string;
  pass?: string;
  appEnv: string;
  devEmailSink?: string;
};

type EmailDeliveryResolution = {
  options: MailOptions;
  overridden: boolean;
  originalTo: string;
  originalCc?: string;
  originalBcc?: string;
  sink?: string;
};

// =============================================================================
// Get email config from environment directly (lazy loading)
// =============================================================================
function normalizeAppEnv(value: string | undefined): string {
  return (value || 'development').split('#')[0].trim().toLowerCase();
}

function getEmailConfig(): EmailConfig {
  return {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
    appEnv: normalizeAppEnv(process.env.APP_ENV),
    devEmailSink: process.env.DEV_EMAIL_SINK?.trim() || undefined,
  };
}

function formatRecipients(value?: MailRecipient): string {
  if (!value) return '-';
  return Array.isArray(value) ? value.join(', ') : value;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildOverrideTextNotice(params: {
  appEnv: string;
  originalTo: string;
  originalCc?: string;
  originalBcc?: string;
  sink: string;
}) {
  const lines = [
    '=== DEVELOPMENT EMAIL OVERRIDE ===',
    `APP_ENV: ${params.appEnv}`,
    `Original-To: ${params.originalTo}`,
  ];

  if (params.originalCc) lines.push(`Original-Cc: ${params.originalCc}`);
  if (params.originalBcc) lines.push(`Original-Bcc: ${params.originalBcc}`);

  lines.push(`Delivered-To: ${params.sink}`);
  lines.push('==================================');

  return lines.join('\n');
}

function buildOverrideHtmlNotice(params: {
  appEnv: string;
  originalTo: string;
  originalCc?: string;
  originalBcc?: string;
  sink: string;
}) {
  const rows = [
    ['APP_ENV', params.appEnv],
    ['Original-To', params.originalTo],
    ...(params.originalCc ? [['Original-Cc', params.originalCc]] : []),
    ...(params.originalBcc ? [['Original-Bcc', params.originalBcc]] : []),
    ['Delivered-To', params.sink],
  ];

  return `
    <div style="border:1px solid #f59e0b;background:#fffbeb;color:#78350f;padding:12px 16px;margin-bottom:16px;border-radius:8px;font-family:Arial,sans-serif;font-size:14px;line-height:1.5;">
      <strong>Development Email Override</strong>
      <table style="margin-top:8px;border-collapse:collapse;">
        ${rows
          .map(
            ([label, value]) => `
              <tr>
                <td style="padding:2px 12px 2px 0;font-weight:bold;vertical-align:top;">${escapeHtml(label)}</td>
                <td style="padding:2px 0;vertical-align:top;">${escapeHtml(value)}</td>
              </tr>`
          )
          .join('')}
      </table>
    </div>
  `;
}

function applyDevelopmentEmailOverride(
  options: MailOptions
): EmailDeliveryResolution {
  const emailConfig = getEmailConfig();
  const originalTo = formatRecipients(options.to);
  const originalCc = options.cc ? formatRecipients(options.cc) : undefined;
  const originalBcc = options.bcc ? formatRecipients(options.bcc) : undefined;
  const alreadyOverridden =
    options.headers?.['X-Email-Override-Applied'] === 'true';

  if (emailConfig.appEnv === 'production' || alreadyOverridden) {
    return {
      options,
      overridden: false,
      originalTo,
      originalCc,
      originalBcc,
    };
  }

  if (!emailConfig.devEmailSink) {
    throw new Error(
      'DEV_EMAIL_SINK wajib diisi saat APP_ENV bukan production agar email testing tidak terkirim ke user asli.'
    );
  }

  const noticeParams = {
    appEnv: emailConfig.appEnv,
    originalTo,
    originalCc,
    originalBcc,
    sink: emailConfig.devEmailSink,
  };
  const textNotice = buildOverrideTextNotice(noticeParams);
  const htmlNotice = buildOverrideHtmlNotice(noticeParams);
  const subjectPrefix = `[${emailConfig.appEnv.toUpperCase()} EMAIL OVERRIDE]`;

  return {
    options: {
      ...options,
      to: emailConfig.devEmailSink,
      cc: undefined,
      bcc: undefined,
      subject: options.subject.startsWith(subjectPrefix)
        ? options.subject
        : `${subjectPrefix} ${options.subject}`,
      text: options.text ? `${textNotice}\n\n${options.text}` : textNotice,
      html: options.html ? `${htmlNotice}${options.html}` : undefined,
      headers: {
        ...(options.headers || {}),
        'X-Email-Override-Applied': 'true',
        'X-Email-Override-Env': emailConfig.appEnv,
        'X-Original-To': originalTo,
        ...(originalCc ? { 'X-Original-Cc': originalCc } : {}),
        ...(originalBcc ? { 'X-Original-Bcc': originalBcc } : {}),
      },
    },
    overridden: true,
    originalTo,
    originalCc,
    originalBcc,
    sink: emailConfig.devEmailSink,
  };
}

// =============================================================================
// Mail Service Singleton Class
// =============================================================================
class MailService {
  private static instance: MailService | null = null;
  private transporter: Transporter<SMTPTransport.SentMessageInfo> | null = null;
  private isInitialized: boolean = false;

  private constructor() {}

  public static getInstance(): MailService {
    if (!MailService.instance) {
      MailService.instance = new MailService();
    }
    return MailService.instance;
  }

  private createTransporter(): Transporter<SMTPTransport.SentMessageInfo> {
    const emailConfig = getEmailConfig();

    const transporter = createTransport({
      name: 'live',
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: emailConfig.user,
        pass: emailConfig.pass,
      },
    });

    const originalSendMail = transporter.sendMail.bind(transporter);
    (transporter as any).sendMail = (
      mailOptions: MailOptions,
      callback?: any
    ) =>
      originalSendMail(
        applyDevelopmentEmailOverride(mailOptions).options,
        callback
      );

    return transporter;
  }

  public getTransporter(): Transporter<SMTPTransport.SentMessageInfo> {
    if (!this.transporter) {
      this.transporter = this.createTransporter();
      this.isInitialized = true;
      const emailConfig = getEmailConfig();
      logger.info('Mail transporter initialized', {
        user: emailConfig.user ? 'configured' : 'not configured',
        appEnv: emailConfig.appEnv,
        devEmailSink:
          emailConfig.appEnv !== 'production'
            ? emailConfig.devEmailSink
              ? 'configured'
              : 'not configured'
            : 'disabled in production',
      });
    }
    return this.transporter;
  }

  public async sendMail(
    options: SendMailOptions
  ): Promise<SMTPTransport.SentMessageInfo> {
    const transporter = this.getTransporter();
    const emailConfig = getEmailConfig();
    const delivery = applyDevelopmentEmailOverride({
      from: emailConfig.user,
      ...options,
    });

    try {
      const result = await transporter.sendMail(delivery.options);

      logger.info('Email sent successfully', {
        to: formatRecipients(delivery.options.to),
        originalTo: delivery.overridden ? delivery.originalTo : undefined,
        overrideApplied: delivery.overridden,
        devEmailSink: delivery.overridden ? delivery.sink : undefined,
        subject: delivery.options.subject,
        messageId: result.messageId,
      });

      return result;
    } catch (error) {
      logger.error('Failed to send email', {
        error: error instanceof Error ? error.message : String(error),
        to: formatRecipients(options.to),
        overrideApplied: delivery.overridden,
        devEmailSink: delivery.overridden ? delivery.sink : undefined,
      });
      throw error;
    }
  }

  public async verifyConnection(): Promise<boolean> {
    const transporter = this.getTransporter();

    try {
      await transporter.verify();
      logger.info('Mail connection verified successfully');
      return true;
    } catch (error) {
      logger.error('Mail connection verification failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  public isHealthy(): boolean {
    return this.isInitialized && this.transporter !== null;
  }

  public async close(): Promise<void> {
    if (this.transporter) {
      this.transporter.close();
      this.transporter = null;
      this.isInitialized = false;
      logger.info('Mail transporter closed');
    }
  }

  public static resetInstance(): void {
    if (MailService.instance) {
      MailService.instance.transporter = null;
      MailService.instance.isInitialized = false;
    }
    MailService.instance = null;
  }
}

// =============================================================================
// Export singleton instance and lazy getter for transporter
// =============================================================================
export const mailService = MailService.getInstance();

// Lazy getter for transporter
export function getTransporter(): Transporter<SMTPTransport.SentMessageInfo> {
  return mailService.getTransporter();
}

// Proxy for backward compatibility
export const transporter = new Proxy(
  {} as Transporter<SMTPTransport.SentMessageInfo>,
  {
    get(_, prop) {
      return (mailService.getTransporter() as any)[prop];
    },
  }
);

export default transporter;
