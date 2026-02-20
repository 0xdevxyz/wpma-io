const nodemailer = require('nodemailer');
const { logger } = require('../utils/logger');

class EmailService {
    constructor() {
        this.configured = !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
        if (this.configured) {
            this.transporter = nodemailer.createTransporter({
                host: process.env.SMTP_HOST,
                port: parseInt(process.env.SMTP_PORT || '587'),
                secure: process.env.SMTP_PORT === '465',
                auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
            });
        }
    }

    async send(to, subject, html) {
        if (!this.configured) {
            logger.info(`[EMAIL-STUB] To: ${to} | Subject: ${subject}`);
            return;
        }
        await this.transporter.sendMail({
            from: process.env.EMAIL_FROM || process.env.SMTP_USER,
            to, subject, html
        });
    }

    async sendPasswordReset(to, resetUrl) {
        await this.send(to, 'Passwort zurücksetzen — WPMA.io', `
            <h2>Passwort zurücksetzen</h2>
            <p>Klicke auf den Link um dein Passwort zurückzusetzen:</p>
            <a href="${resetUrl}" style="background:#3B82F6;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block">
                Passwort zurücksetzen
            </a>
            <p style="color:#666;font-size:12px">Der Link ist 1 Stunde gültig. Falls du kein Reset angefordert hast, ignoriere diese E-Mail.</p>
        `);
    }

    async sendTeamInvite(to, inviteUrl, siteName, inviterName) {
        await this.send(to, `Einladung zu ${siteName} — WPMA.io`, `
            <h2>Du wurdest eingeladen</h2>
            <p>${inviterName} hat dich eingeladen, <strong>${siteName}</strong> auf WPMA.io zu verwalten.</p>
            <a href="${inviteUrl}" style="background:#3B82F6;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block">
                Einladung annehmen
            </a>
            <p style="color:#666;font-size:12px">Die Einladung ist 7 Tage gültig.</p>
        `);
    }

    async sendAlert(to, subject, message) {
        await this.send(to, subject, `<h2>${subject}</h2><p>${message}</p>`);
    }
}

module.exports = new EmailService();
