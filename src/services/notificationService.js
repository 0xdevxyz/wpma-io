/**
 * Notification Service
 * Sendet Benachrichtigungen an verschiedene Kanäle (Slack, Discord, E-Mail, Webhooks)
 */

const { query } = require('../config/database');

class NotificationService {
    constructor() {
        this.channels = {
            slack: this.sendSlack.bind(this),
            discord: this.sendDiscord.bind(this),
            email: this.sendEmail.bind(this),
            telegram: this.sendTelegram.bind(this),
            webhook: this.sendWebhook.bind(this)
        };
    }

    /**
     * Sendet eine Benachrichtigung an alle konfigurierten Kanäle
     */
    async notify(userId, eventType, data) {
        try {
            // Hole Notification-Settings des Users
            const settings = await this.getUserNotificationSettings(userId);
            
            if (!settings) {
                console.log(`No notification settings for user ${userId}`);
                return { success: true, sent: 0 };
            }

            // Prüfe ob Event-Typ aktiviert ist
            if (!this.isEventEnabled(settings, eventType)) {
                return { success: true, sent: 0, reason: 'Event type disabled' };
            }

            const message = this.formatMessage(eventType, data);
            const results = [];

            // Sende an alle konfigurierten Kanäle
            for (const [channel, config] of Object.entries(settings.channels || {})) {
                if (config.enabled && this.channels[channel]) {
                    try {
                        await this.channels[channel](config, message, data);
                        results.push({ channel, success: true });
                    } catch (error) {
                        console.error(`Notification error for ${channel}:`, error);
                        results.push({ channel, success: false, error: error.message });
                    }
                }
            }

            // Log Notification
            await this.logNotification(userId, eventType, results);

            return {
                success: true,
                sent: results.filter(r => r.success).length,
                results
            };
        } catch (error) {
            console.error('Notify error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Sendet Benachrichtigung an Slack
     */
    async sendSlack(config, message, data) {
        if (!config.webhookUrl) {
            throw new Error('Slack Webhook URL nicht konfiguriert');
        }

        const payload = {
            text: message.title,
            blocks: [
                {
                    type: 'header',
                    text: {
                        type: 'plain_text',
                        text: message.title,
                        emoji: true
                    }
                },
                {
                    type: 'section',
                    text: {
                        type: 'mrkdwn',
                        text: message.body
                    }
                }
            ]
        };

        // Füge Felder hinzu wenn vorhanden
        if (message.fields && message.fields.length > 0) {
            payload.blocks.push({
                type: 'section',
                fields: message.fields.map(f => ({
                    type: 'mrkdwn',
                    text: `*${f.label}:*\n${f.value}`
                }))
            });
        }

        // Füge Button hinzu wenn URL vorhanden
        if (data.url) {
            payload.blocks.push({
                type: 'actions',
                elements: [{
                    type: 'button',
                    text: {
                        type: 'plain_text',
                        text: 'Details anzeigen'
                    },
                    url: data.url,
                    style: 'primary'
                }]
            });
        }

        const response = await fetch(config.webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`Slack API error: ${response.status}`);
        }

        return true;
    }

    /**
     * Sendet Benachrichtigung an Discord
     */
    async sendDiscord(config, message, data) {
        if (!config.webhookUrl) {
            throw new Error('Discord Webhook URL nicht konfiguriert');
        }

        const embed = {
            title: message.title,
            description: message.body,
            color: this.getColorForEvent(data.eventType),
            timestamp: new Date().toISOString(),
            footer: {
                text: 'WPMA.io'
            }
        };

        // Füge Felder hinzu
        if (message.fields && message.fields.length > 0) {
            embed.fields = message.fields.map(f => ({
                name: f.label,
                value: f.value,
                inline: true
            }));
        }

        // Füge URL hinzu
        if (data.url) {
            embed.url = data.url;
        }

        const payload = {
            embeds: [embed]
        };

        const response = await fetch(config.webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`Discord API error: ${response.status}`);
        }

        return true;
    }

    /**
     * Sendet E-Mail Benachrichtigung
     */
    async sendEmail(config, message, data) {
        // TODO: Implementiere E-Mail-Versand via SendGrid/SES/etc.
        console.log('Email notification:', {
            to: config.email,
            subject: message.title,
            body: message.body
        });
        return true;
    }

    /**
     * Sendet Benachrichtigung via Telegram Bot API
     * config: { botToken, chatId }
     */
    async sendTelegram(config, message, data) {
        if (!config.botToken || !config.chatId) {
            throw new Error('Telegram botToken und chatId erforderlich');
        }

        // Einfaches Markdown-Format für Telegram
        let text = `*${this.escapeTelegramMd(message.title)}*\n\n${this.escapeTelegramMd(message.body)}`;

        if (message.fields && message.fields.length > 0) {
            text += '\n\n' + message.fields
                .map(f => `• *${this.escapeTelegramMd(f.label)}:* ${this.escapeTelegramMd(String(f.value || ''))}`)
                .join('\n');
        }

        if (data.url) {
            text += `\n\n[Details anzeigen](${data.url})`;
        }

        const response = await fetch(
            `https://api.telegram.org/bot${config.botToken}/sendMessage`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: config.chatId,
                    text,
                    parse_mode: 'MarkdownV2',
                    disable_web_page_preview: true,
                }),
            }
        );

        if (!response.ok) {
            const body = await response.text();
            throw new Error(`Telegram API error: ${response.status} – ${body}`);
        }

        return true;
    }

    /**
     * Escaped Sonderzeichen für Telegram MarkdownV2
     */
    escapeTelegramMd(text) {
        if (!text) return '';
        return String(text).replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\$&');
    }

    /**
     * Sendet an benutzerdefinierten Webhook (Zapier, Make, etc.)
     */
    async sendWebhook(config, message, data) {
        if (!config.url) {
            throw new Error('Webhook URL nicht konfiguriert');
        }

        const payload = {
            event: data.eventType,
            timestamp: new Date().toISOString(),
            message: message,
            data: data
        };

        const headers = {
            'Content-Type': 'application/json'
        };

        // Füge Auth-Header hinzu wenn konfiguriert
        if (config.authHeader) {
            headers['Authorization'] = config.authHeader;
        }

        const response = await fetch(config.url, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`Webhook error: ${response.status}`);
        }

        return true;
    }

    /**
     * Formatiert die Nachricht basierend auf Event-Typ
     */
    formatMessage(eventType, data) {
        const messages = {
            site_down: {
                title: '🔴 Site Down: ' + (data.domain || 'Unbekannt'),
                body: `Die Site *${data.domain}* ist nicht erreichbar.\n` +
                      `Status: ${data.statusCode || 'Timeout'}\n` +
                      `Geprüft: ${new Date().toLocaleString('de-DE')}`,
                fields: [
                    { label: 'Domain', value: data.domain },
                    { label: 'Antwortzeit', value: (data.responseTime || 'N/A') + 'ms' }
                ]
            },
            site_up: {
                title: '🟢 Site Up: ' + (data.domain || 'Unbekannt'),
                body: `Die Site *${data.domain}* ist wieder erreichbar.\n` +
                      `Downtime: ${data.downtimeDuration || 'Unbekannt'}`,
                fields: [
                    { label: 'Domain', value: data.domain },
                    { label: 'Antwortzeit', value: (data.responseTime || 'N/A') + 'ms' }
                ]
            },
            security_issue: {
                title: '⚠️ Sicherheitsproblem: ' + (data.domain || 'Unbekannt'),
                body: `Ein Sicherheitsproblem wurde auf *${data.domain}* gefunden.\n` +
                      `Typ: ${data.issueType || 'Unbekannt'}\n` +
                      `Schweregrad: ${data.severity || 'Mittel'}`,
                fields: [
                    { label: 'Problem', value: data.issueType },
                    { label: 'Schweregrad', value: data.severity }
                ]
            },
            backup_completed: {
                title: '✅ Backup erfolgreich: ' + (data.domain || 'Unbekannt'),
                body: `Backup für *${data.domain}* wurde erfolgreich erstellt.\n` +
                      `Größe: ${data.size || 'Unbekannt'}`,
                fields: [
                    { label: 'Typ', value: data.backupType || 'Full' },
                    { label: 'Größe', value: data.size }
                ]
            },
            backup_failed: {
                title: '❌ Backup fehlgeschlagen: ' + (data.domain || 'Unbekannt'),
                body: `Backup für *${data.domain}* ist fehlgeschlagen.\n` +
                      `Fehler: ${data.error || 'Unbekannt'}`,
                fields: []
            },
            update_available: {
                title: '📦 Updates verfügbar: ' + (data.domain || 'Unbekannt'),
                body: `Es sind ${data.count || 0} Updates für *${data.domain}* verfügbar.`,
                fields: [
                    { label: 'Plugins', value: String(data.pluginUpdates || 0) },
                    { label: 'Themes', value: String(data.themeUpdates || 0) }
                ]
            },
            update_completed: {
                title: '✅ Updates installiert: ' + (data.domain || 'Unbekannt'),
                body: `${data.count || 0} Updates wurden auf *${data.domain}* installiert.`,
                fields: []
            },
            ssl_expiring: {
                title: '🔒 SSL läuft ab: ' + (data.domain || 'Unbekannt'),
                body: `Das SSL-Zertifikat für *${data.domain}* läuft in ${data.daysUntilExpiry || '?'} Tagen ab.`,
                fields: [
                    { label: 'Ablaufdatum', value: data.expiryDate }
                ]
            },
            performance_degraded: {
                title: '🐢 Performance-Problem: ' + (data.domain || 'Unbekannt'),
                body: `Die Ladezeit von *${data.domain}* hat sich verschlechtert.\n` +
                      `Aktuelle Ladezeit: ${data.loadTime || 'N/A'}ms`,
                fields: [
                    { label: 'Ladezeit', value: (data.loadTime || 'N/A') + 'ms' },
                    { label: 'Schwellwert', value: (data.threshold || 3000) + 'ms' }
                ]
            },
            onboarding_step_ok: {
                title: '✅ Setup-Schritt abgeschlossen: ' + (data.domain || 'Unbekannt'),
                body: `*${data.step || 'Schritt'}* wurde erfolgreich abgeschlossen.\n${data.detail || ''}`,
                fields: [{ label: 'Site', value: data.domain }]
            },
            onboarding_step_warning: {
                title: '⚠️ Setup-Warnung: ' + (data.domain || 'Unbekannt'),
                body: `Schritt *${data.step || 'Unbekannt'}* konnte nicht vollständig ausgeführt werden.\n${data.detail || ''}`,
                fields: [{ label: 'Site', value: data.domain }]
            },
            onboarding_malware_found: {
                title: '🚨 Malware gefunden: ' + (data.domain || 'Unbekannt'),
                body: `Beim Setup-Scan wurden kritische Sicherheitsprobleme auf *${data.domain}* gefunden.\nBitte sofort prüfen!`,
                fields: [
                    { label: 'Site', value: data.domain },
                    { label: 'Security Score', value: String(data.score ?? 'n/a') }
                ]
            },
            onboarding_license_required: {
                title: '🔑 Lizenz erforderlich: ' + (data.domain || 'Unbekannt'),
                body: `Für ${(data.plugins || []).length} Premium-Plugin(s) auf *${data.domain}* werden Lizenzschlüssel benötigt, um Updates einzuspielen.\n` +
                      `Plugins: ${(data.plugins || []).join(', ')}`,
                fields: [{ label: 'Site', value: data.domain }]
            },
            onboarding_rollback: {
                title: '↩️ Rollback durchgeführt: ' + (data.domain || 'Unbekannt'),
                body: `Nach einem fehlgeschlagenen Funktionstest wurde *${data.domain}* auf das Backup zurückgesetzt.\n\n` +
                      `Diagnose: ${data.diagnosis || 'Unbekannt'}`,
                fields: [
                    { label: 'HTTP Status', value: String(data.httpStatus || 'Timeout') },
                    { label: 'Empfehlung', value: 'Bitte Plugin-Kompatibilität prüfen' }
                ]
            },
            onboarding_completed: {
                title: '🎉 Setup abgeschlossen: ' + (data.domain || 'Unbekannt'),
                body: `*${data.domain}* wurde erfolgreich eingerichtet!\n` +
                      `Alle Features sind jetzt verfügbar: Monitoring, Backups, Updates, Security.`,
                fields: [{ label: 'Site', value: data.domain }]
            }
        };

        return messages[eventType] || {
            title: `Benachrichtigung: ${eventType}`,
            body: JSON.stringify(data),
            fields: []
        };
    }

    /**
     * Gibt Discord-Farbe basierend auf Event zurück
     */
    getColorForEvent(eventType) {
        const colors = {
            site_down: 0xff0000,      // Rot
            site_up: 0x00ff00,        // Grün
            security_issue: 0xffa500, // Orange
            backup_completed: 0x00ff00,
            backup_failed: 0xff0000,
            update_available: 0x0099ff,
            update_completed: 0x00ff00,
            ssl_expiring: 0xffa500,
            performance_degraded: 0xffa500,
            onboarding_step_ok: 0x00ff00,
            onboarding_step_warning: 0xffa500,
            onboarding_malware_found: 0xff0000,
            onboarding_license_required: 0x0099ff,
            onboarding_rollback: 0xff6600,
            onboarding_completed: 0x00ff00
        };
        return colors[eventType] || 0x6366f1; // Default: Indigo
    }

    /**
     * Prüft ob Event-Typ aktiviert ist
     */
    isEventEnabled(settings, eventType) {
        const enabledEvents = settings.enabledEvents || [];
        return enabledEvents.includes(eventType) || enabledEvents.includes('all');
    }

    /**
     * Holt Notification-Settings eines Users
     */
    async getUserNotificationSettings(userId) {
        try {
            const result = await query(
                `SELECT * FROM notification_settings WHERE user_id = $1`,
                [userId]
            );

            if (result.rows.length === 0) {
                return null;
            }

            const row = result.rows[0];
            // JSONB wird automatisch geparst, kein JSON.parse nötig
            return {
                channels: typeof row.channels === 'string' ? JSON.parse(row.channels) : (row.channels || {}),
                enabledEvents: typeof row.enabled_events === 'string' ? JSON.parse(row.enabled_events) : (row.enabled_events || [])
            };
        } catch (error) {
            console.error('Get notification settings error:', error);
            return null;
        }
    }

    /**
     * Speichert Notification-Settings
     */
    async saveNotificationSettings(userId, settings) {
        try {
            await query(
                `INSERT INTO notification_settings (user_id, channels, enabled_events)
                 VALUES ($1, $2, $3)
                 ON CONFLICT (user_id)
                 DO UPDATE SET 
                    channels = EXCLUDED.channels,
                    enabled_events = EXCLUDED.enabled_events,
                    updated_at = CURRENT_TIMESTAMP`,
                [
                    userId,
                    JSON.stringify(settings.channels || {}),
                    JSON.stringify(settings.enabledEvents || [])
                ]
            );

            return { success: true, message: 'Einstellungen gespeichert' };
        } catch (error) {
            console.error('Save notification settings error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Testet einen Notification-Kanal
     */
    async testChannel(channelType, config) {
        try {
            const testMessage = {
                title: '🧪 Test-Benachrichtigung',
                body: 'Dies ist eine Test-Nachricht von WPMA.io',
                fields: [
                    { label: 'Status', value: 'Test erfolgreich' },
                    { label: 'Zeit', value: new Date().toLocaleString('de-DE') }
                ]
            };

            const testData = {
                eventType: 'test',
                url: process.env.FRONTEND_URL || 'https://app.wpma.io'
            };

            if (!this.channels[channelType]) {
                throw new Error(`Unbekannter Kanal: ${channelType}`);
            }

            await this.channels[channelType](config, testMessage, testData);

            return { success: true, message: 'Test-Nachricht gesendet' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Loggt eine Benachrichtigung
     */
    async logNotification(userId, eventType, results) {
        try {
            await query(
                `INSERT INTO notification_log (user_id, event_type, results)
                 VALUES ($1, $2, $3)`,
                [userId, eventType, JSON.stringify(results)]
            );
        } catch (error) {
            console.error('Log notification error:', error);
        }
    }

    /**
     * Holt Notification-History
     */
    async getNotificationHistory(userId, limit = 50) {
        try {
            const result = await query(
                `SELECT * FROM notification_log 
                 WHERE user_id = $1 
                 ORDER BY created_at DESC 
                 LIMIT $2`,
                [userId, limit]
            );

            return {
                success: true,
                data: result.rows
            };
        } catch (error) {
            console.error('Get notification history error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Verfügbare Event-Typen
     */
    getAvailableEventTypes() {
        return [
            { id: 'site_down', name: 'Site Down', description: 'Website ist nicht erreichbar' },
            { id: 'site_up', name: 'Site Up', description: 'Website ist wieder online' },
            { id: 'security_issue', name: 'Sicherheitsproblem', description: 'Sicherheitsproblem gefunden' },
            { id: 'backup_completed', name: 'Backup erfolgreich', description: 'Backup wurde erstellt' },
            { id: 'backup_failed', name: 'Backup fehlgeschlagen', description: 'Backup ist fehlgeschlagen' },
            { id: 'update_available', name: 'Updates verfügbar', description: 'Neue Updates vorhanden' },
            { id: 'update_completed', name: 'Updates installiert', description: 'Updates wurden installiert' },
            { id: 'ssl_expiring', name: 'SSL läuft ab', description: 'SSL-Zertifikat läuft bald ab' },
            { id: 'performance_degraded', name: 'Performance-Problem', description: 'Ladezeit verschlechtert' },
            { id: 'onboarding_step_ok', name: 'Setup-Schritt OK', description: 'Einrichtungsschritt abgeschlossen' },
            { id: 'onboarding_step_warning', name: 'Setup-Warnung', description: 'Einrichtungsschritt mit Warnung' },
            { id: 'onboarding_malware_found', name: 'Malware gefunden', description: 'Sicherheitsscan fand Bedrohungen' },
            { id: 'onboarding_license_required', name: 'Lizenz erforderlich', description: 'Premium-Plugin braucht Lizenzschlüssel' },
            { id: 'onboarding_rollback', name: 'Rollback durchgeführt', description: 'Site nach Update-Fehler zurückgesetzt' },
            { id: 'onboarding_completed', name: 'Setup abgeschlossen', description: 'Vollständige Einrichtung erfolgreich' }
        ];
    }
}

module.exports = new NotificationService();

