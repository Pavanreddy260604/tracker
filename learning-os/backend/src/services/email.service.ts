import nodemailer from 'nodemailer';
import { getOptionalEnv } from '../config/env.js';

class EmailService {
    private transporter: nodemailer.Transporter | null = null;
    private fromEmail: string;

    constructor() {
        const host = getOptionalEnv('SMTP_HOST');
        const port = getOptionalEnv('SMTP_PORT');
        const user = getOptionalEnv('SMTP_USER');
        const pass = getOptionalEnv('SMTP_PASS');
        this.fromEmail = getOptionalEnv('EMAIL_FROM') || user || 'noreply@learningos.com';

        if (host && user && pass) {
            this.transporter = nodemailer.createTransport({
                host,
                port: Number(port) || 587,
                secure: Number(port) === 465, // true for 465, false for other ports
                auth: { user, pass },
            });
            console.log(`[EmailService] SMTP configured: ${host}:${port || 587}`);
        } else {
            console.warn('[EmailService] SMTP not configured. Emails will be logged to console.');
        }
    }

    private async sendEmail(to: string, subject: string, html: string): Promise<void> {
        if (!this.transporter) {
            console.log(`[Email Mock] To: ${to} | Subject: ${subject}`);
            console.log(`[Email Mock Body HTML]:\n${html}`);
            return;
        }

        try {
            await this.transporter.sendMail({
                from: `Learning OS <${this.fromEmail}>`,
                to,
                subject,
                html,
            });
        } catch (error) {
            console.error('Failed to send email:', error);
            throw error;
        }
    }

    public async sendVerificationEmail(to: string, code: string): Promise<void> {
        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2>Welcome to Learning OS!</h2>
                <p>Please verify your email address using the code below:</p>
                <div style="background-color: #f4f4f5; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
                    <h1 style="letter-spacing: 4px; margin: 0; color: #18181b;">${code}</h1>
                </div>
                <p>This code will expire in 15 minutes.</p>
                <p>If you didn't create an account, you can safely ignore this email.</p>
            </div>
        `;
        await this.sendEmail(to, 'Verify your Learning OS account', html);
    }

    public async sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2>Reset Your Password</h2>
                <p>We received a request to reset your Learning OS password.</p>
                <p>Click the button below to choose a new password:</p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${resetUrl}" style="background-color: #09090b; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Reset Password</a>
                </div>
                <p>This link will expire in 1 hour.</p>
                <p>If you didn't request a password reset, you can safely ignore this email.</p>
            </div>
        `;
        await this.sendEmail(to, 'Reset your Learning OS password', html);
    }

    public async sendWelcomeEmail(to: string, name: string): Promise<void> {
        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2>Welcome aboard, ${name}! 🚀</h2>
                <p>We're thrilled to have you join Learning OS.</p>
                <p>Our goal is to help you master DSA, system design, and ace your interviews.</p>
                <p>Head over to your dashboard to set up your learning goals and start your first session.</p>
            </div>
        `;
        await this.sendEmail(to, 'Welcome to Learning OS!', html);
    }
}

export const emailService = new EmailService();
