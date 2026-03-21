const tls = require('tls');
const https = require('https');
const { query } = require('../config/database');

class SslService {

    /**
     * Prüft das SSL-Zertifikat einer Domain via TLS-Handshake.
     * Gibt issuer, validFrom, validTo, daysRemaining, grade zurück.
     */
    async checkCertificate(domain) {
        return new Promise((resolve) => {
            const hostname = domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '').split(':')[0];
            const port = 443;
            const timeout = 10000;

            const socket = tls.connect(
                { host: hostname, port, servername: hostname, rejectUnauthorized: false },
                () => {
                    try {
                        const cert = socket.getPeerCertificate(true);
                        socket.destroy();

                        if (!cert || !cert.subject) {
                            return resolve({ success: false, error: 'Kein Zertifikat erhalten' });
                        }

                        const validFrom    = new Date(cert.valid_from);
                        const validTo      = new Date(cert.valid_to);
                        const now          = new Date();
                        const daysRemaining = Math.floor((validTo - now) / (1000 * 60 * 60 * 24));
                        const authorized   = socket.authorized !== false;

                        // SANs auflisten
                        const san = cert.subjectaltname
                            ? cert.subjectaltname.replace(/DNS:/g, '').split(', ')
                            : [cert.subject?.CN || hostname];

                        // Grade bestimmen
                        let grade = 'A';
                        if (daysRemaining <= 0)  grade = 'F';
                        else if (daysRemaining <= 7)  grade = 'C';
                        else if (daysRemaining <= 30) grade = 'B';

                        resolve({
                            success: true,
                            hostname,
                            issuer:        cert.issuer?.O || cert.issuer?.CN || 'Unbekannt',
                            subject:       cert.subject?.CN || hostname,
                            validFrom:     validFrom.toISOString(),
                            validTo:       validTo.toISOString(),
                            daysRemaining,
                            grade,
                            authorized,
                            san,
                            serialNumber:  cert.serialNumber || null,
                            fingerprint:   cert.fingerprint  || null,
                        });
                    } catch (e) {
                        socket.destroy();
                        resolve({ success: false, error: e.message });
                    }
                }
            );

            socket.setTimeout(timeout, () => {
                socket.destroy();
                resolve({ success: false, error: 'Verbindungs-Timeout' });
            });

            socket.on('error', (err) => {
                resolve({ success: false, error: err.message });
            });
        });
    }

    /**
     * Prüft SSL für eine Site und speichert/aktualisiert den Eintrag in ssl_certs.
     */
    async checkAndStoreSite(siteId, siteUrl) {
        const result = await this.checkCertificate(siteUrl);

        if (!result.success) {
            // Fehler speichern, aber nicht abbrechen
            await query(
                `INSERT INTO ssl_certs (site_id, domain, status, error_message, last_checked)
                 VALUES ($1, $2, 'error', $3, NOW())
                 ON CONFLICT (site_id) DO UPDATE
                 SET status = 'error', error_message = $3, last_checked = NOW()`,
                [siteId, result.hostname || siteUrl, result.error]
            );
            return { siteId, success: false, error: result.error };
        }

        const status = result.daysRemaining <= 0
            ? 'expired'
            : result.daysRemaining <= 7
                ? 'critical'
                : result.daysRemaining <= 30
                    ? 'warning'
                    : 'valid';

        await query(
            `INSERT INTO ssl_certs
                (site_id, domain, issuer, subject, valid_from, valid_to, days_remaining,
                 grade, authorized, san, fingerprint, status, error_message, last_checked)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NULL,NOW())
             ON CONFLICT (site_id) DO UPDATE SET
                domain        = EXCLUDED.domain,
                issuer        = EXCLUDED.issuer,
                subject       = EXCLUDED.subject,
                valid_from    = EXCLUDED.valid_from,
                valid_to      = EXCLUDED.valid_to,
                days_remaining= EXCLUDED.days_remaining,
                grade         = EXCLUDED.grade,
                authorized    = EXCLUDED.authorized,
                san           = EXCLUDED.san,
                fingerprint   = EXCLUDED.fingerprint,
                status        = EXCLUDED.status,
                error_message = NULL,
                last_checked  = NOW()`,
            [
                siteId,
                result.hostname,
                result.issuer,
                result.subject,
                result.validFrom,
                result.validTo,
                result.daysRemaining,
                result.grade,
                result.authorized,
                JSON.stringify(result.san),
                result.fingerprint,
                status,
            ]
        );

        return { siteId, success: true, status, daysRemaining: result.daysRemaining, grade: result.grade };
    }

    /**
     * Prüft alle aktiven Sites und gibt Zusammenfassung zurück.
     */
    async checkAllSites() {
        const sitesResult = await query(
            `SELECT id, site_url FROM sites WHERE status = 'active' AND site_url IS NOT NULL`
        );

        const results = [];
        for (const site of sitesResult.rows) {
            try {
                const r = await this.checkAndStoreSite(site.id, site.site_url);
                results.push(r);
            } catch (e) {
                results.push({ siteId: site.id, success: false, error: e.message });
            }
        }

        const expired  = results.filter(r => r.status === 'expired').length;
        const critical = results.filter(r => r.status === 'critical').length;
        const warning  = results.filter(r => r.status === 'warning').length;
        const valid    = results.filter(r => r.status === 'valid').length;
        const errors   = results.filter(r => !r.success).length;

        console.log(`SSL-Check abgeschlossen: ${valid} OK, ${warning} Warnung, ${critical} Kritisch, ${expired} Abgelaufen, ${errors} Fehler`);
        return { results, summary: { valid, warning, critical, expired, errors } };
    }

    /**
     * Gibt SSL-Status einer einzelnen Site zurück.
     */
    async getSiteSSL(siteId) {
        const result = await query(
            `SELECT * FROM ssl_certs WHERE site_id = $1`,
            [siteId]
        );
        if (result.rows.length === 0) return { success: false, error: 'Noch nicht geprüft' };
        return { success: true, data: result.rows[0] };
    }

    /**
     * Gibt alle SSL-Certs mit Site-Info zurück (für Dashboard-Übersicht).
     */
    async getAllSSLStatus() {
        const result = await query(
            `SELECT s.id as site_id, s.domain, s.site_url, s.site_name,
                    sc.issuer, sc.subject, sc.valid_from, sc.valid_to,
                    sc.days_remaining, sc.grade, sc.authorized, sc.status,
                    sc.error_message, sc.last_checked
             FROM sites s
             LEFT JOIN ssl_certs sc ON sc.site_id = s.id
             WHERE s.status = 'active'
             ORDER BY sc.days_remaining ASC NULLS LAST`
        );
        return { success: true, data: result.rows };
    }
}

module.exports = new SslService();
