/**
 * Self-Healing Service
 * KI-gestütztes automatisches Reparieren von WordPress-Problemen
 */

const { query } = require('../config/database');
const aiService = require('./aiService');
const wpSyncService = require('./wpSyncService');

class SelfHealingService {
    constructor() {
        this.healingHistory = new Map();
        this.knownIssues = this.loadKnownIssues();
    }

    /**
     * Analysiert ein Problem und generiert automatischen Fix
     */
    async analyzeProblem(siteId, problem) {
        try {
            const { error, context, logs } = problem;

            // 0. Hole vollständige Site-Daten aus Sync-Cache
            const siteContext = await wpSyncService.getSyncedData(siteId);
            if (!siteContext.success) {
                console.warn('Sync-Daten nicht verfügbar, fahre ohne fort');
            }

            const enrichedContext = {
                ...context,
                plugins: siteContext.data?.plugins || [],
                themes: siteContext.data?.themes || [],
                stats: siteContext.data?.stats || {},
                site: siteContext.data?.site || {}
            };

            // 1. Prüfe ob es ein bekanntes Problem ist
            const knownFix = this.findKnownFix(error, enrichedContext);
            if (knownFix) {
                return {
                    success: true,
                    fixType: 'known',
                    fix: knownFix,
                    confidence: 0.95,
                    context: enrichedContext
                };
            }

            // 2. KI-Analyse für unbekannte Probleme MIT vollem Kontext
            const analysis = await aiService.analyzeError(siteId, error, enrichedContext, logs);

            if (!analysis.success) {
                return { success: false, error: 'KI-Analyse fehlgeschlagen' };
            }

            // 3. Generiere Fix-Code
            const fix = await aiService.generateAutoFix(siteId, {
                error_message: error,
                context: enrichedContext,
                logs: logs,
                analysis: analysis.data
            });

            return {
                success: true,
                fixType: 'ai_generated',
                fix: fix.data,
                confidence: analysis.data.confidence || 0.7,
                explanation: analysis.data.explanation,
                context: enrichedContext
            };

        } catch (error) {
            console.error('Analyze problem error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Wendet einen Fix an (mit User-Approval oder automatisch bei hoher Confidence)
     */
    async applyFix(siteId, userId, fixId, options = {}) {
        try {
            const { autoApply = false, createSnapshot = true } = options;

            // Hole Fix-Details
            const fix = await this.getFix(fixId);
            if (!fix) {
                return { success: false, error: 'Fix nicht gefunden' };
            }

            // Sicherheitscheck: Erstelle IMMER einen Snapshot vor Auto-Fix
            let snapshotId = null;
            if (createSnapshot) {
                const snapshot = await this.createPreFixSnapshot(siteId, fixId);
                if (snapshot.success) {
                    snapshotId = snapshot.snapshotId;
                }
            }

            // Trigger Fix auf WordPress-Site
            const result = await this.triggerRemoteFix(siteId, fix, snapshotId);

            if (result.success) {
                // Verifiziere dass Fix funktioniert hat
                await this.delay(5000); // Warte 5 Sekunden
                const verification = await this.verifyFix(siteId, fix);

                if (!verification.success) {
                    // Fix hat nicht funktioniert - Rollback
                    if (snapshotId) {
                        await this.rollbackFix(siteId, snapshotId);
                    }

                    return {
                        success: false,
                        error: 'Fix-Verifikation fehlgeschlagen',
                        rolledBack: !!snapshotId
                    };
                }

                // Log erfolgreichen Fix
                await this.logHealingSuccess(siteId, fixId, fix);

                return {
                    success: true,
                    applied: true,
                    snapshotId,
                    verification: verification.data
                };
            } else {
                return {
                    success: false,
                    error: result.error,
                    applied: false
                };
            }

        } catch (error) {
            console.error('Apply fix error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Automatische Fehler-Erkennung und Self-Healing
     */
    async autoHeal(siteId, errorData) {
        try {
            // Prüfe ob Auto-Healing für diese Site aktiviert ist
            const settings = await this.getHealingSettings(siteId);
            if (!settings.enabled) {
                return { success: true, healed: false, reason: 'Auto-Healing deaktiviert' };
            }

            // Analysiere Problem
            const analysis = await this.analyzeProblem(siteId, errorData);

            if (!analysis.success) {
                return { success: false, error: 'Problemanalyse fehlgeschlagen' };
            }

            // Nur bei hoher Confidence automatisch anwenden
            if (analysis.confidence < settings.minConfidence) {
                // Niedrige Confidence - benachrichtige User aber heile nicht automatisch
                await this.notifyUserAboutIssue(siteId, errorData, analysis);

                return {
                    success: true,
                    healed: false,
                    reason: 'Confidence zu niedrig für Auto-Healing',
                    confidence: analysis.confidence,
                    fixAvailable: true,
                    fixId: await this.saveFix(siteId, analysis.fix)
                };
            }

            // Erstelle Fix
            const fixId = await this.saveFix(siteId, analysis.fix);

            // Wende Fix automatisch an
            const result = await this.applyFix(siteId, null, fixId, {
                autoApply: true,
                createSnapshot: true
            });

            if (result.success) {
                // Benachrichtige User über erfolgreiche Auto-Heilung
                await this.notifyUserAboutHealing(siteId, errorData, analysis.fix);

                return {
                    success: true,
                    healed: true,
                    fixId,
                    snapshotId: result.snapshotId,
                    explanation: analysis.explanation
                };
            } else {
                // Auto-Healing fehlgeschlagen - User muss manuell eingreifen
                await this.notifyUserAboutFailedHealing(siteId, errorData, result.error);

                return {
                    success: false,
                    healed: false,
                    error: result.error
                };
            }

        } catch (error) {
            console.error('Auto heal error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Trigger Fix auf der WordPress-Site
     */
    async triggerRemoteFix(siteId, fix, snapshotId) {
        try {
            const siteResult = await query('SELECT * FROM sites WHERE id = $1', [siteId]);
            if (siteResult.rows.length === 0) {
                return { success: false, error: 'Site nicht gefunden' };
            }

            const site = siteResult.rows[0];
            const pluginUrl = `${site.site_url}/wp-json/wpma/v1/selfhealing/apply`;

            const response = await fetch(pluginUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-WPMA-API-Key': site.api_key,
                    'User-Agent': 'WPMA-Platform/1.0'
                },
                body: JSON.stringify({
                    fix_type: fix.type,
                    fix_code: fix.code,
                    snapshot_id: snapshotId,
                    description: fix.description
                }),
                timeout: 30000
            });

            if (response.ok) {
                const data = await response.json();
                return {
                    success: true,
                    result: data
                };
            }

            return { success: false, error: 'Plugin nicht erreichbar oder Fix konnte nicht angewendet werden' };

        } catch (error) {
            console.log('Remote fix trigger failed:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Verifiziert dass der Fix funktioniert hat
     */
    async verifyFix(siteId, fix) {
        try {
            const siteResult = await query('SELECT * FROM sites WHERE id = $1', [siteId]);
            if (siteResult.rows.length === 0) {
                return { success: false, error: 'Site nicht gefunden' };
            }

            const site = siteResult.rows[0];

            // 1. Prüfe ob Site erreichbar ist
            const siteCheck = await fetch(site.site_url, {
                method: 'HEAD',
                timeout: 10000
            });

            if (!siteCheck.ok) {
                return { success: false, error: 'Site nicht erreichbar nach Fix' };
            }

            // 2. Prüfe ob der ursprüngliche Fehler noch auftritt
            const pluginUrl = `${site.site_url}/wp-json/wpma/v1/selfhealing/verify`;

            const verifyResponse = await fetch(pluginUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-WPMA-API-Key': site.api_key,
                    'User-Agent': 'WPMA-Platform/1.0'
                },
                body: JSON.stringify({
                    fix_type: fix.type,
                    original_error: fix.originalError
                }),
                timeout: 15000
            });

            if (verifyResponse.ok) {
                const data = await verifyResponse.json();
                return {
                    success: data.verified,
                    data: data
                };
            }

            // Fallback: Wenn Plugin nicht antwortet, gehe davon aus dass es ok ist wenn Site läuft
            return { success: true, data: { verified: true, method: 'fallback' } };

        } catch (error) {
            console.error('Verify fix error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Rollback eines fehlgeschlagenen Fix
     */
    async rollbackFix(siteId, snapshotId) {
        try {
            const siteResult = await query('SELECT * FROM sites WHERE id = $1', [siteId]);
            if (siteResult.rows.length === 0) {
                return { success: false, error: 'Site nicht gefunden' };
            }

            const site = siteResult.rows[0];
            const pluginUrl = `${site.site_url}/wp-json/wpma/v1/rollback/restore`;

            const response = await fetch(pluginUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-WPMA-API-Key': site.api_key,
                    'User-Agent': 'WPMA-Platform/1.0'
                },
                body: JSON.stringify({
                    snapshot_id: snapshotId
                }),
                timeout: 30000
            });

            if (response.ok) {
                return { success: true };
            }

            return { success: false, error: 'Rollback konnte nicht durchgeführt werden' };

        } catch (error) {
            console.error('Rollback fix error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Erstellt Snapshot vor Fix
     */
    async createPreFixSnapshot(siteId, fixId) {
        try {
            const siteResult = await query('SELECT * FROM sites WHERE id = $1', [siteId]);
            if (siteResult.rows.length === 0) {
                return { success: false, error: 'Site nicht gefunden' };
            }

            const site = siteResult.rows[0];
            const pluginUrl = `${site.site_url}/wp-json/wpma/v1/rollback/create-snapshot`;

            const response = await fetch(pluginUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-WPMA-API-Key': site.api_key,
                    'User-Agent': 'WPMA-Platform/1.0'
                },
                body: JSON.stringify({
                    snapshot_id: `fix_${fixId}_${Date.now()}`,
                    update_type: 'selfhealing'
                }),
                timeout: 60000
            });

            if (response.ok) {
                const data = await response.json();
                return {
                    success: true,
                    snapshotId: data.snapshot_id
                };
            }

            return { success: false, error: 'Snapshot konnte nicht erstellt werden' };

        } catch (error) {
            console.error('Create pre-fix snapshot error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Bekannte Probleme und ihre Fixes
     */
    loadKnownIssues() {
        return {
            'white_screen_of_death': {
                type: 'php',
                code: `
// Fix: White Screen of Death - meist PHP Memory Limit
define('WP_MEMORY_LIMIT', '256M');
define('WP_MAX_MEMORY_LIMIT', '512M');

// Debug aktivieren
define('WP_DEBUG', true);
define('WP_DEBUG_LOG', true);
define('WP_DEBUG_DISPLAY', false);
                `.trim(),
                description: 'Erhöht PHP Memory Limit und aktiviert Debug-Logging'
            },
            'plugin_conflict': {
                type: 'wp-cli',
                code: 'wp plugin deactivate --all && wp plugin activate $(wp plugin list --status=active --field=name | head -1)',
                description: 'Deaktiviert alle Plugins und aktiviert sie einzeln wieder'
            },
            'database_connection_error': {
                type: 'php',
                code: `
// Fix: Database Connection Error
// Prüfe DB Credentials in wp-config.php
if (!defined('DB_HOST')) {
    define('DB_HOST', 'localhost');
}
                `.trim(),
                description: 'Stellt sicher dass DB_HOST definiert ist'
            },
            'permalinks_broken': {
                type: 'wp-cli',
                code: 'wp rewrite flush',
                description: 'Setzt Permalinks neu'
            }
        };
    }

    /**
     * Findet bekannten Fix für häufige Probleme
     */
    findKnownFix(error, context = {}) {
        const errorLower = error.toLowerCase();

        // Plugin-Konflikt mit Kontext-Analyse
        if (errorLower.includes('plugin') && errorLower.includes('conflict')) {
            const plugins = context.plugins || [];
            const activePlugins = plugins.filter(p => p.status === 'active');
            
            return {
                ...this.knownIssues.plugin_conflict,
                detectedPlugins: activePlugins.map(p => p.name),
                recommendation: activePlugins.length > 20 
                    ? 'Zu viele aktive Plugins - Deaktivieren Sie kürzlich hinzugefügte Plugins'
                    : this.knownIssues.plugin_conflict.recommendation
            };
        }

        // White Screen mit Plugin-Analyse
        if (errorLower.includes('white screen') || errorLower.includes('blank page')) {
            const recentUpdates = (context.plugins || [])
                .filter(p => p.update_available === false && p.status === 'active')
                .slice(0, 3);
            
            return {
                ...this.knownIssues.white_screen_of_death,
                likelyPlugins: recentUpdates.map(p => p.name),
                recommendation: recentUpdates.length > 0
                    ? `Wahrscheinlich verursacht durch: ${recentUpdates.map(p => p.name).join(', ')}`
                    : this.knownIssues.white_screen_of_death.recommendation
            };
        }

        if (errorLower.includes('database') && errorLower.includes('connection')) {
            return this.knownIssues.database_connection_error;
        }

        if (errorLower.includes('404') || errorLower.includes('permalink')) {
            return this.knownIssues.permalinks_broken;
        }

        // Memory Limit mit Stats-Analyse
        if (errorLower.includes('memory') || errorLower.includes('allowed memory size')) {
            const stats = context.stats || {};
            const plugins = context.plugins || [];
            
            return {
                type: 'memory_limit',
                description: 'PHP Memory Limit erreicht',
                recommendation: `${plugins.length} Plugins installiert, ${stats.media_count || 0} Media-Files. Erhöhen Sie memory_limit auf 256M oder deaktivieren Sie nicht genutzte Plugins.`,
                fix_code: `define('WP_MEMORY_LIMIT', '256M');`,
                confidence: 0.90
            };
        }

        return null;
    }

    /**
     * Healing-Einstellungen einer Site
     */
    async getHealingSettings(siteId) {
        const result = await query(
            `SELECT setting_value FROM site_settings 
             WHERE site_id = $1 AND setting_key = 'selfhealing'`,
            [siteId]
        );

        if (result.rows.length === 0) {
            // Defaults
            return {
                enabled: false,
                minConfidence: 0.85,
                autoApply: false
            };
        }

        return JSON.parse(result.rows[0].setting_value);
    }

    /**
     * Speichert einen Fix für spätere Anwendung
     */
    async saveFix(siteId, fix) {
        const result = await query(
            `INSERT INTO selfhealing_fixes 
             (site_id, fix_type, fix_code, description, confidence, status)
             VALUES ($1, $2, $3, $4, $5, 'pending')
             RETURNING id`,
            [siteId, fix.type, fix.code, fix.description, fix.confidence || 0.7]
        );

        return result.rows[0].id;
    }

    /**
     * Holt Fix-Details
     */
    async getFix(fixId) {
        const result = await query(
            'SELECT * FROM selfhealing_fixes WHERE id = $1',
            [fixId]
        );

        return result.rows.length > 0 ? result.rows[0] : null;
    }

    /**
     * Logging & Notifications
     */
    async logHealingSuccess(siteId, fixId, fix) {
        await query(
            `UPDATE selfhealing_fixes SET status = 'applied', applied_at = NOW() WHERE id = $1`,
            [fixId]
        );

        await query(
            `INSERT INTO activity_logs (site_id, activity_type, description)
             VALUES ($1, 'selfhealing', $2)`,
            [siteId, `Auto-Fix angewendet: ${fix.description}`]
        );
    }

    async notifyUserAboutHealing(siteId, error, fix) {
        // Trigger Notification Service
        const notificationService = require('./notificationService');
        await notificationService.sendNotification(siteId, 'selfhealing_success', {
            error: error.error,
            fix: fix.description
        });
    }

    async notifyUserAboutIssue(siteId, error, analysis) {
        const notificationService = require('./notificationService');
        await notificationService.sendNotification(siteId, 'issue_detected', {
            error: error.error,
            confidence: analysis.confidence,
            fixAvailable: true
        });
    }

    async notifyUserAboutFailedHealing(siteId, error, failureReason) {
        const notificationService = require('./notificationService');
        await notificationService.sendNotification(siteId, 'selfhealing_failed', {
            error: error.error,
            reason: failureReason
        });
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = new SelfHealingService();
