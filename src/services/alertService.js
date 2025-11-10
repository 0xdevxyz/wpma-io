const { query } = require('../config/database');

class AlertService {
    constructor() {
        this.transporter = null;
        // SMTP würde hier konfiguriert werden
    }

    async sendAlert(siteId, alertData) {
        try {
            const siteResult = await query(
                `SELECT s.*, u.email, u.first_name, u.last_name 
                FROM sites s 
                JOIN users u ON s.user_id = u.id 
                WHERE s.id = $1`,
                [siteId]
            );

            if (siteResult.rows.length === 0) {
                return { success: false, error: 'Site nicht gefunden' };
            }

            await this.saveAlert(siteId, alertData);
            return { success: true };
        } catch (error) {
            console.error('Error sending alert:', error);
            return { success: false, error: error.message };
        }
    }

    async saveAlert(siteId, alertData) {
        try {
            await query(
                `INSERT INTO alerts (
                    site_id, alert_type, severity, title, message, created_at
                ) VALUES ($1, $2, $3, $4, $5, NOW())`,
                [
                    siteId,
                    alertData.type || 'general',
                    alertData.severity || 'medium',
                    alertData.title,
                    alertData.message
                ]
            );
        } catch (error) {
            console.log('Alerts table not yet created');
        }
    }

    async shouldSendAlert(siteId, alertType) {
        try {
            const result = await query(
                `SELECT COUNT(*) as count 
                FROM alerts 
                WHERE site_id = $1 
                AND alert_type = $2 
                AND created_at >= NOW() - INTERVAL '30 minutes'`,
                [siteId, alertType]
            );

            return result.rows[0].count === '0';
        } catch (error) {
            return true;
        }
    }
}

module.exports = new AlertService();

