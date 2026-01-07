/**
 * Auto-Update Service
 * Automatische WordPress-Updates mit KI-gestützter Sicherheitsanalyse
 */

const { query } = require('../config/database');
const AIService = require('./aiService');

class AutoUpdateService {
    constructor() {
        this.updateQueue = [];
        this.isProcessing = false;
    }

    /**
     * Prüft eine Site auf verfügbare Updates und analysiert diese
     */
    async checkForUpdates(siteId) {
        try {
            // Hole Site-Daten
            const siteResult = await query(
                'SELECT * FROM sites WHERE id = $1',
                [siteId]
            );

            if (siteResult.rows.length === 0) {
                return { success: false, error: 'Site nicht gefunden' };
            }

            const site = siteResult.rows[0];

            // In einer echten Implementierung würde hier das WordPress-Plugin
            // die Update-Infos senden. Für jetzt simulieren wir das.
            const updates = await this.getAvailableUpdates(site);

            if (updates.total === 0) {
                return {
                    success: true,
                    data: {
                        hasUpdates: false,
                        message: 'Alle Komponenten sind aktuell'
                    }
                };
            }

            // KI-Analyse der Updates
            const analysis = await AIService.analyzeUpdateSafety(
                siteId,
                'mixed',
                updates
            );

            return {
                success: true,
                data: {
                    hasUpdates: true,
                    updates,
                    analysis: analysis.data,
                    canAutoUpdate: analysis.data?.can_auto_update || false,
                    riskLevel: analysis.data?.risk_level || 'unknown'
                }
            };
        } catch (error) {
            console.error('Check for updates error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Führt automatische Updates durch (wenn KI es als sicher einstuft)
     */
    async performAutoUpdate(siteId, options = {}) {
        try {
            const { forceUpdate = false, updateTypes = ['plugins', 'themes'] } = options;

            // Prüfe Updates
            const updateCheck = await this.checkForUpdates(siteId);
            
            if (!updateCheck.success || !updateCheck.data.hasUpdates) {
                return {
                    success: true,
                    data: {
                        performed: false,
                        message: 'Keine Updates verfügbar'
                    }
                };
            }

            const { analysis, updates } = updateCheck.data;

            // Prüfe ob Auto-Update sicher ist
            if (!forceUpdate && !analysis?.can_auto_update) {
                return {
                    success: true,
                    data: {
                        performed: false,
                        message: 'Auto-Update nicht empfohlen',
                        reason: analysis?.recommendation || 'Manuelle Prüfung erforderlich',
                        riskLevel: analysis?.risk_level
                    }
                };
            }

            // Erstelle Backup vor Update
            if (analysis?.requires_backup !== false) {
                await this.createPreUpdateBackup(siteId);
            }

            // Log Update-Versuch
            const updateLogId = await this.logUpdateAttempt(siteId, updates);

            try {
                // Führe Updates durch (über WordPress Plugin API)
                const results = await this.executeUpdates(siteId, updates, updateTypes);

                // Verifiziere Site-Gesundheit nach Update
                const healthCheck = await this.verifySiteHealth(siteId);

                if (!healthCheck.healthy) {
                    // Rollback wenn Site nicht gesund
                    await this.rollbackUpdate(siteId, updateLogId);
                    return {
                        success: false,
                        data: {
                            performed: true,
                            rolledBack: true,
                            message: 'Update durchgeführt aber zurückgerollt wegen Problemen',
                            healthIssues: healthCheck.issues
                        }
                    };
                }

                // Erfolgreich!
                await this.logUpdateSuccess(updateLogId, results);

                return {
                    success: true,
                    data: {
                        performed: true,
                        results,
                        message: 'Updates erfolgreich durchgeführt'
                    }
                };

            } catch (updateError) {
                // Fehler beim Update - Rollback
                await this.rollbackUpdate(siteId, updateLogId);
                await this.logUpdateFailure(updateLogId, updateError.message);

                return {
                    success: false,
                    data: {
                        performed: true,
                        rolledBack: true,
                        error: updateError.message
                    }
                };
            }

        } catch (error) {
            console.error('Auto update error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Holt verfügbare Updates von der Site
     */
    async getAvailableUpdates(site) {
        // In der echten Implementierung würde dies vom WordPress Plugin kommen
        // Hier simulieren wir es basierend auf gespeicherten Daten
        
        try {
            const result = await query(
                `SELECT update_data FROM site_updates WHERE site_id = $1 
                 ORDER BY created_at DESC LIMIT 1`,
                [site.id]
            );

            if (result.rows.length > 0 && result.rows[0].update_data) {
                return JSON.parse(result.rows[0].update_data);
            }

            // Fallback: Keine Update-Daten
            return {
                core: null,
                plugins: [],
                themes: [],
                total: 0
            };
        } catch (error) {
            console.error('Error getting updates:', error);
            return { core: null, plugins: [], themes: [], total: 0 };
        }
    }

    /**
     * Erstellt ein Backup vor dem Update
     */
    async createPreUpdateBackup(siteId) {
        try {
            await query(
                `INSERT INTO backups (site_id, backup_type, status, provider) 
                 VALUES ($1, 'pre_update', 'pending', 'local')`,
                [siteId]
            );
            console.log(`Pre-update backup created for site ${siteId}`);
            return true;
        } catch (error) {
            console.error('Pre-update backup error:', error);
            return false;
        }
    }

    /**
     * Führt die eigentlichen Updates durch
     */
    async executeUpdates(siteId, updates, updateTypes) {
        // Diese Funktion würde normalerweise über die WordPress REST API
        // oder das Plugin kommunizieren
        
        const results = {
            core: null,
            plugins: [],
            themes: [],
            timestamp: new Date().toISOString()
        };

        // Simuliere Update-Ausführung
        // In der echten Implementierung würde hier ein API-Call an das Plugin erfolgen
        
        if (updateTypes.includes('plugins') && updates.plugins?.length > 0) {
            results.plugins = updates.plugins.map(p => ({
                name: p.name,
                from: p.current_version,
                to: p.new_version,
                status: 'updated'
            }));
        }

        if (updateTypes.includes('themes') && updates.themes?.length > 0) {
            results.themes = updates.themes.map(t => ({
                name: t.name,
                from: t.current_version,
                to: t.new_version,
                status: 'updated'
            }));
        }

        if (updateTypes.includes('core') && updates.core) {
            results.core = {
                from: updates.core.current,
                to: updates.core.new,
                status: 'updated'
            };
        }

        return results;
    }

    /**
     * Verifiziert die Site-Gesundheit nach einem Update
     */
    async verifySiteHealth(siteId) {
        try {
            const siteResult = await query(
                'SELECT site_url, health_score FROM sites WHERE id = $1',
                [siteId]
            );

            if (siteResult.rows.length === 0) {
                return { healthy: false, issues: ['Site nicht gefunden'] };
            }

            const site = siteResult.rows[0];
            const issues = [];

            // Prüfe ob Site erreichbar ist
            try {
                const response = await fetch(site.site_url, { 
                    method: 'HEAD',
                    timeout: 10000 
                });
                
                if (!response.ok) {
                    issues.push(`Site antwortet mit Status ${response.status}`);
                }
            } catch (fetchError) {
                issues.push('Site nicht erreichbar');
            }

            return {
                healthy: issues.length === 0,
                issues
            };
        } catch (error) {
            console.error('Health check error:', error);
            return { healthy: false, issues: [error.message] };
        }
    }

    /**
     * Rollback eines fehlgeschlagenen Updates
     */
    async rollbackUpdate(siteId, updateLogId) {
        try {
            console.log(`Rolling back update ${updateLogId} for site ${siteId}`);
            
            // Markiere Update als zurückgerollt
            await query(
                `UPDATE update_logs SET status = 'rolled_back', 
                 rolled_back_at = CURRENT_TIMESTAMP WHERE id = $1`,
                [updateLogId]
            );

            // In der echten Implementierung würde hier das Backup wiederhergestellt
            // und/oder die alten Plugin-Versionen neu installiert werden

            return true;
        } catch (error) {
            console.error('Rollback error:', error);
            return false;
        }
    }

    /**
     * Logging-Funktionen
     */
    async logUpdateAttempt(siteId, updates) {
        try {
            const result = await query(
                `INSERT INTO update_logs (site_id, update_data, status) 
                 VALUES ($1, $2, 'in_progress') RETURNING id`,
                [siteId, JSON.stringify(updates)]
            );
            return result.rows[0].id;
        } catch (error) {
            console.error('Log update attempt error:', error);
            return null;
        }
    }

    async logUpdateSuccess(updateLogId, results) {
        try {
            await query(
                `UPDATE update_logs SET status = 'success', 
                 result_data = $1, completed_at = CURRENT_TIMESTAMP WHERE id = $2`,
                [JSON.stringify(results), updateLogId]
            );
        } catch (error) {
            console.error('Log update success error:', error);
        }
    }

    async logUpdateFailure(updateLogId, errorMessage) {
        try {
            await query(
                `UPDATE update_logs SET status = 'failed', 
                 error_message = $1, completed_at = CURRENT_TIMESTAMP WHERE id = $2`,
                [errorMessage, updateLogId]
            );
        } catch (error) {
            console.error('Log update failure error:', error);
        }
    }

    /**
     * Aktiviert/Deaktiviert Auto-Updates für eine Site
     */
    async setAutoUpdateSettings(siteId, settings) {
        try {
            const { enabled, updateCore, updatePlugins, updateThemes, schedule } = settings;

            await query(
                `INSERT INTO site_settings (site_id, setting_key, setting_value)
                 VALUES ($1, 'auto_update', $2)
                 ON CONFLICT (site_id, setting_key) 
                 DO UPDATE SET setting_value = $2, updated_at = CURRENT_TIMESTAMP`,
                [siteId, JSON.stringify({
                    enabled,
                    updateCore,
                    updatePlugins,
                    updateThemes,
                    schedule
                })]
            );

            return { success: true, message: 'Auto-Update Einstellungen gespeichert' };
        } catch (error) {
            console.error('Set auto update settings error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Holt Auto-Update Einstellungen einer Site
     */
    async getAutoUpdateSettings(siteId) {
        try {
            const result = await query(
                `SELECT setting_value FROM site_settings 
                 WHERE site_id = $1 AND setting_key = 'auto_update'`,
                [siteId]
            );

            if (result.rows.length === 0) {
                return {
                    success: true,
                    data: {
                        enabled: false,
                        updateCore: false,
                        updatePlugins: true,
                        updateThemes: true,
                        schedule: 'weekly'
                    }
                };
            }

            return {
                success: true,
                data: JSON.parse(result.rows[0].setting_value)
            };
        } catch (error) {
            console.error('Get auto update settings error:', error);
            return { success: false, error: error.message };
        }
    }
}

module.exports = new AutoUpdateService();

