/**
 * White-Label Service
 * Ermöglicht Agenturen, WPMA mit eigenem Branding zu nutzen
 */

const { query } = require('../config/database');
const crypto = require('crypto');

class WhiteLabelService {
    /**
     * Erstellt oder aktualisiert White-Label Konfiguration
     */
    async saveWhiteLabelConfig(userId, config) {
        try {
            const {
                brandName,
                primaryColor,
                secondaryColor,
                logoUrl,
                faviconUrl,
                customDomain,
                supportEmail,
                supportUrl,
                hideWpmaBranding,
                customCss,
                emailFromName,
                emailFromAddress,
                footerText
            } = config;

            // Prüfe ob User existiert
            const userResult = await query(
                'SELECT id FROM users WHERE id = $1',
                [userId]
            );

            if (userResult.rows.length === 0) {
                return { success: false, error: 'User nicht gefunden' };
            }
            
            // TODO: In Produktion hier Stripe-Abo prüfen für Premium-Features

            // Validiere Custom Domain
            if (customDomain) {
                const domainValid = await this.validateCustomDomain(customDomain);
                if (!domainValid.valid) {
                    return { success: false, error: domainValid.error };
                }
            }

            // Upsert White-Label Config
            const result = await query(
                `INSERT INTO white_label_configs 
                 (user_id, brand_name, primary_color, secondary_color, logo_url, favicon_url,
                  custom_domain, support_email, support_url, hide_wpma_branding, custom_css,
                  email_from_name, email_from_address, footer_text)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
                 ON CONFLICT (user_id) 
                 DO UPDATE SET 
                    brand_name = EXCLUDED.brand_name,
                    primary_color = EXCLUDED.primary_color,
                    secondary_color = EXCLUDED.secondary_color,
                    logo_url = EXCLUDED.logo_url,
                    favicon_url = EXCLUDED.favicon_url,
                    custom_domain = EXCLUDED.custom_domain,
                    support_email = EXCLUDED.support_email,
                    support_url = EXCLUDED.support_url,
                    hide_wpma_branding = EXCLUDED.hide_wpma_branding,
                    custom_css = EXCLUDED.custom_css,
                    email_from_name = EXCLUDED.email_from_name,
                    email_from_address = EXCLUDED.email_from_address,
                    footer_text = EXCLUDED.footer_text,
                    updated_at = CURRENT_TIMESTAMP
                 RETURNING id`,
                [
                    userId, brandName, primaryColor, secondaryColor, logoUrl, faviconUrl,
                    customDomain, supportEmail, supportUrl, hideWpmaBranding || false,
                    customCss, emailFromName, emailFromAddress, footerText
                ]
            );

            return {
                success: true,
                data: {
                    configId: result.rows[0].id,
                    message: 'White-Label Konfiguration gespeichert'
                }
            };
        } catch (error) {
            console.error('Save white-label config error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Holt White-Label Konfiguration eines Users
     */
    async getWhiteLabelConfig(userId) {
        try {
            const result = await query(
                'SELECT * FROM white_label_configs WHERE user_id = $1',
                [userId]
            );

            if (result.rows.length === 0) {
                return {
                    success: true,
                    data: this.getDefaultConfig()
                };
            }

            return {
                success: true,
                data: this.formatConfig(result.rows[0])
            };
        } catch (error) {
            console.error('Get white-label config error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Holt White-Label Config basierend auf Custom Domain
     */
    async getConfigByDomain(domain) {
        try {
            const result = await query(
                `SELECT wlc.*, u.id as owner_id 
                 FROM white_label_configs wlc
                 JOIN users u ON wlc.user_id = u.id
                 WHERE wlc.custom_domain = $1 AND wlc.domain_verified = true`,
                [domain]
            );

            if (result.rows.length === 0) {
                return {
                    success: true,
                    data: this.getDefaultConfig()
                };
            }

            return {
                success: true,
                data: this.formatConfig(result.rows[0]),
                ownerId: result.rows[0].owner_id
            };
        } catch (error) {
            console.error('Get config by domain error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Validiert eine Custom Domain
     */
    async validateCustomDomain(domain) {
        // Basis-Validierung
        const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9](?:\.[a-zA-Z]{2,})+$/;
        if (!domainRegex.test(domain)) {
            return { valid: false, error: 'Ungültiges Domain-Format' };
        }

        // Prüfe ob Domain bereits verwendet wird
        const existingResult = await query(
            'SELECT id FROM white_label_configs WHERE custom_domain = $1',
            [domain]
        );

        if (existingResult.rows.length > 0) {
            return { valid: false, error: 'Domain wird bereits verwendet' };
        }

        return { valid: true };
    }

    /**
     * Generiert DNS-Verifizierungstoken
     */
    async generateDomainVerificationToken(userId, domain) {
        try {
            const token = crypto.randomBytes(32).toString('hex');
            
            await query(
                `UPDATE white_label_configs 
                 SET domain_verification_token = $1, 
                     domain_verification_expires = NOW() + INTERVAL '7 days'
                 WHERE user_id = $2`,
                [token, userId]
            );

            return {
                success: true,
                data: {
                    token,
                    dnsRecord: {
                        type: 'TXT',
                        name: `_wpma-verify.${domain}`,
                        value: `wpma-verification=${token}`
                    },
                    cnameRecord: {
                        type: 'CNAME',
                        name: domain,
                        value: 'app.wpma.io'
                    },
                    expiresIn: '7 days'
                }
            };
        } catch (error) {
            console.error('Generate verification token error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Verifiziert Custom Domain via DNS
     */
    async verifyCustomDomain(userId) {
        try {
            const configResult = await query(
                `SELECT custom_domain, domain_verification_token, domain_verification_expires 
                 FROM white_label_configs WHERE user_id = $1`,
                [userId]
            );

            if (configResult.rows.length === 0) {
                return { success: false, error: 'Keine White-Label Konfiguration gefunden' };
            }

            const config = configResult.rows[0];

            if (!config.custom_domain || !config.domain_verification_token) {
                return { success: false, error: 'Keine Domain-Verifizierung ausstehend' };
            }

            if (new Date(config.domain_verification_expires) < new Date()) {
                return { success: false, error: 'Verifizierungstoken abgelaufen' };
            }

            // DNS-Abfrage durchführen
            const dns = require('dns').promises;
            try {
                const records = await dns.resolveTxt(`_wpma-verify.${config.custom_domain}`);
                const flatRecords = records.flat();
                const expectedValue = `wpma-verification=${config.domain_verification_token}`;

                if (flatRecords.includes(expectedValue)) {
                    // Domain verifiziert!
                    await query(
                        `UPDATE white_label_configs 
                         SET domain_verified = true, 
                             domain_verified_at = CURRENT_TIMESTAMP,
                             domain_verification_token = NULL
                         WHERE user_id = $1`,
                        [userId]
                    );

                    return {
                        success: true,
                        data: {
                            verified: true,
                            domain: config.custom_domain,
                            message: 'Domain erfolgreich verifiziert!'
                        }
                    };
                } else {
                    return {
                        success: false,
                        error: 'DNS-Eintrag nicht gefunden oder falsch',
                        expected: expectedValue,
                        found: flatRecords
                    };
                }
            } catch (dnsError) {
                return {
                    success: false,
                    error: `DNS-Abfrage fehlgeschlagen: ${dnsError.message}`
                };
            }
        } catch (error) {
            console.error('Verify custom domain error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Generiert White-Label E-Mail Template
     */
    generateEmailTemplate(config, content) {
        const brandName = config.brandName || 'WPMA.io';
        const primaryColor = config.primaryColor || '#6366f1';
        const logoUrl = config.logoUrl || '';
        const footerText = config.footerText || `© ${new Date().getFullYear()} ${brandName}`;

        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; }
        .header { background: ${primaryColor}; padding: 30px; text-align: center; }
        .header img { max-height: 50px; }
        .header h1 { color: white; margin: 0; font-size: 24px; }
        .content { padding: 40px 30px; background: #ffffff; }
        .footer { padding: 20px 30px; background: #f5f5f5; text-align: center; color: #666; font-size: 12px; }
        .button { display: inline-block; padding: 12px 30px; background: ${primaryColor}; color: white; 
                  text-decoration: none; border-radius: 6px; font-weight: bold; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            ${logoUrl ? `<img src="${logoUrl}" alt="${brandName}" />` : `<h1>${brandName}</h1>`}
        </div>
        <div class="content">
            ${content}
        </div>
        <div class="footer">
            <p>${footerText}</p>
            ${config.supportEmail ? `<p>Support: ${config.supportEmail}</p>` : ''}
        </div>
    </div>
</body>
</html>
        `.trim();
    }

    /**
     * Generiert CSS für White-Label Frontend
     */
    generateCustomCss(config) {
        return `
:root {
    --wl-primary: ${config.primaryColor || '#6366f1'};
    --wl-secondary: ${config.secondaryColor || '#a855f7'};
    --wl-brand-name: "${config.brandName || 'WPMA.io'}";
}

/* Custom White-Label Overrides */
.brand-logo { background-image: url('${config.logoUrl || ''}'); }
.brand-name::before { content: var(--wl-brand-name); }
.btn-primary { background-color: var(--wl-primary); }
.btn-primary:hover { background-color: color-mix(in srgb, var(--wl-primary), black 10%); }
.text-primary { color: var(--wl-primary); }
.bg-primary { background-color: var(--wl-primary); }
.border-primary { border-color: var(--wl-primary); }

${config.hideWpmaBranding ? '.wpma-branding { display: none !important; }' : ''}

${config.customCss || ''}
        `.trim();
    }

    /**
     * Holt Default-Konfiguration
     */
    getDefaultConfig() {
        return {
            brandName: 'WPMA.io',
            primaryColor: '#6366f1',
            secondaryColor: '#a855f7',
            logoUrl: null,
            faviconUrl: null,
            customDomain: null,
            domainVerified: false,
            supportEmail: 'support@wpma.io',
            supportUrl: 'https://wpma.io/help',
            hideWpmaBranding: false,
            customCss: null,
            emailFromName: 'WPMA.io',
            emailFromAddress: 'noreply@wpma.io',
            footerText: '© 2025 WPMA.io - WordPress Management Automation'
        };
    }

    /**
     * Formatiert DB-Ergebnis zu Config-Objekt
     */
    formatConfig(row) {
        return {
            brandName: row.brand_name,
            primaryColor: row.primary_color,
            secondaryColor: row.secondary_color,
            logoUrl: row.logo_url,
            faviconUrl: row.favicon_url,
            customDomain: row.custom_domain,
            domainVerified: row.domain_verified,
            supportEmail: row.support_email,
            supportUrl: row.support_url,
            hideWpmaBranding: row.hide_wpma_branding,
            customCss: row.custom_css,
            emailFromName: row.email_from_name,
            emailFromAddress: row.email_from_address,
            footerText: row.footer_text,
            updatedAt: row.updated_at
        };
    }
}

module.exports = new WhiteLabelService();

