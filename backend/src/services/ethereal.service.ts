import nodemailer, { Transporter } from 'nodemailer';

export interface SendMailOptions {
  from: string;
  to: string;
  subject: string;
  html?: string;
  text?: string;
}

export interface SendMailResult {
  messageId: string;
  previewUrl: string | false;
  response: string;
}

class EtherealService {
  private transporter: Transporter | null = null;
  private initializingPromise: Promise<Transporter> | null = null;

  /**
   * Initializes or returns the cached Ethereal transporter
   */
  async getTransporter(): Promise<Transporter> {
    if (this.transporter) {
      return this.transporter;
    }

    if (this.initializingPromise) {
      return this.initializingPromise;
    }

    this.initializingPromise = (async () => {
      try {
        console.log('🔄 Creating new Ethereal test account...');
        const testAccount = await nodemailer.createTestAccount();

        console.log(`✉️ Ethereal credentials generated: ${testAccount.user}`);

        const transporter = nodemailer.createTransport({
          host: 'smtp.ethereal.email',
          port: 587,
          secure: false, // true for 465, false for other ports
          auth: {
            user: testAccount.user,
            pass: testAccount.pass,
          },
        });

        // Verify connection configuration
        await transporter.verify();
        console.log('✅ Ethereal SMTP transporter verified and ready');

        this.transporter = transporter;
        return transporter;
      } catch (error) {
        console.error('❌ Failed to initialize Ethereal transporter:', error);
        this.initializingPromise = null;
        throw error;
      }
    })();

    return this.initializingPromise;
  }

  /**
   * Send email using Ethereal SMTP and extract preview URL
   */
  async sendEmail(options: SendMailOptions): Promise<SendMailResult> {
    const transporter = await this.getTransporter();

    const info = await transporter.sendMail({
      from: options.from,
      to: options.to,
      subject: options.subject,
      text: options.text || options.html?.replace(/<[^>]*>?/gm, '') || '',
      html: options.html || options.text,
    });

    const previewUrl = nodemailer.getTestMessageUrl(info);

    console.log(`📧 Email sent to ${options.to} | MessageId: ${info.messageId}`);
    if (previewUrl) {
      console.log(`🔗 Ethereal Preview URL: ${previewUrl}`);
    }

    return {
      messageId: info.messageId,
      previewUrl,
      response: info.response,
    };
  }
}

export const etherealService = new EtherealService();
export default etherealService;
