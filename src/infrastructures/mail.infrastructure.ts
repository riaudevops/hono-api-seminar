import { createTransport, Transporter } from 'nodemailer';
import SMTPTransport from 'nodemailer/lib/smtp-transport';
import { createLogger } from '../utils/logger.util';

const logger = createLogger('Mailer');

// =============================================================================
// Get email config from environment directly (lazy loading)
// =============================================================================
function getEmailConfig() {
  return {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
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

    return transporter;
  }

  public getTransporter(): Transporter<SMTPTransport.SentMessageInfo> {
    if (!this.transporter) {
      this.transporter = this.createTransporter();
      this.isInitialized = true;
      const emailConfig = getEmailConfig();
      logger.info('Mail transporter initialized', {
        user: emailConfig.user ? 'configured' : 'not configured',
      });
    }
    return this.transporter;
  }

  public async sendMail(options: {
    to: string | string[];
    subject: string;
    text?: string;
    html?: string;
  }): Promise<SMTPTransport.SentMessageInfo> {
    const transporter = this.getTransporter();
    const emailConfig = getEmailConfig();

    try {
      const result = await transporter.sendMail({
        from: emailConfig.user,
        ...options,
      });

      logger.info('Email sent successfully', {
        to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
        subject: options.subject,
        messageId: result.messageId,
      });

      return result;
    } catch (error) {
      logger.error('Failed to send email', {
        error: error instanceof Error ? error.message : String(error),
        to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
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
