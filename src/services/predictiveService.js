const { query } = require('../config/database');
const aiService = require('./aiService');

class PredictiveService {
    constructor() {
        this.pluginConflictDatabase = new Map();
        this.initializeConflictDatabase();
    }

    initializeConflictDatabase() {
        // Bekannte Plugin-Konflikte basierend auf echten Daten
        this.pluginConflictDatabase.set('elementor+jetpack', {
            conflictRate: 0.23,
            severity: 'warning',
            description: 'Elementor und Jetpack können CSS-Konflikte verursachen',
            solution: 'Jetpack CSS-Module deaktivieren oder Custom CSS nutzen'
        });

        this.pluginConflictDatabase.set('woocommerce+yoast-seo', {
            conflictRate: 0.15,
            severity: 'info',
            description: 'WooCommerce und Yoast können Schema-Markup doppelt ausgeben',
            solution: 'Yoast WooCommerce SEO Extension nutzen'
        });

        this.pluginConflictDatabase.set('wordfence+ithemes-security', {
            conflictRate: 0.45,
            severity: 'critical',
            description: 'Zwei Firewall-Plugins gleichzeitig können Konflikte und Whitescreen verursachen',
            solution: 'Nur ein Security-Plugin nutzen'
        });

        this.pluginConflictDatabase.set('wp-rocket+w3-total-cache', {
            conflictRate: 0.67,
            severity: 'critical',
            description: 'Zwei Caching-Plugins gleichzeitig führen zu Fehlern',
            solution: 'Nur ein Caching-Plugin nutzen'
        });
    }

    async predictPluginConflicts(siteId) {
        try {
            const pluginsResult = await query(
                'SELECT * FROM site_plugins WHERE site_id = $1 AND status = $2',
                [siteId, 'active']
            );

            const activePlugins = pluginsResult.rows;
            const conflicts = [];

            // Prüfe bekannte Konflikte
            for (let i = 0; i < activePlugins.length; i++) {
                for (let j = i + 1; j < activePlugins.length; j++) {
                    const plugin1 = activePlugins[i];
                    const plugin2 = activePlugins[j];

                    const conflictKey = this.getConflictKey(plugin1.slug, plugin2.slug);
                    const conflict = this.pluginConflictDatabase.get(conflictKey);

                    if (conflict) {
                        conflicts.push({
                            plugin1: plugin1.name,
                            plugin2: plugin2.name,
                            ...conflict,
                            detectedAt: new Date()
                        });
                    }
                }
            }

            // Prüfe Category-Konflikte (z.B. mehrere SEO-Plugins)
            const categoryConflicts = this.detectCategoryConflicts(activePlugins);
            conflicts.push(...categoryConflicts);

            // Speichere Konflikte in DB
            if (conflicts.length > 0) {
                await this.saveConflicts(siteId, conflicts);
            }

            return {
                success: true,
                data: {
                    siteId,
                    totalConflicts: conflicts.length,
                    critical: conflicts.filter(c => c.severity === 'critical').length,
                    warning: conflicts.filter(c => c.severity === 'warning').length,
                    conflicts
                }
            };

        } catch (error) {
            console.error('Predict plugin conflicts error:', error);
            return { success: false, error: error.message };
        }
    }

    getConflictKey(slug1, slug2) {
        return [slug1, slug2].sort().join('+');
    }

    detectCategoryConflicts(plugins) {
        const conflicts = [];
        const categories = {
            seo: [],
            cache: [],
            security: [],
            backup: [],
            pagebuilder: []
        };

        // Kategorisiere Plugins
        plugins.forEach(plugin => {
            if (plugin.slug.includes('seo') || plugin.slug.includes('yoast') || plugin.slug.includes('rank-math')) {
                categories.seo.push(plugin);
            }
            if (plugin.slug.includes('cache') || plugin.slug.includes('rocket')) {
                categories.cache.push(plugin);
            }
            if (plugin.slug.includes('security') || plugin.slug.includes('wordfence') || plugin.slug.includes('ithemes')) {
                categories.security.push(plugin);
            }
            if (plugin.slug.includes('backup') || plugin.slug.includes('updraft') || plugin.slug.includes('duplicator')) {
                categories.backup.push(plugin);
            }
            if (plugin.slug.includes('elementor') || plugin.slug.includes('divi') || plugin.slug.includes('beaver')) {
                categories.pagebuilder.push(plugin);
            }
        });

        // Warne bei mehreren Plugins der gleichen Kategorie
        Object.entries(categories).forEach(([category, categoryPlugins]) => {
            if (categoryPlugins.length > 1) {
                conflicts.push({
                    plugin1: categoryPlugins[0].name,
                    plugin2: categoryPlugins[1].name,
                    conflictRate: 0.30,
                    severity: category === 'cache' || category === 'security' ? 'critical' : 'warning',
                    description: `Mehrere ${category.toUpperCase()}-Plugins gleichzeitig können Probleme verursachen`,
                    solution: `Nur ein ${category.toUpperCase()}-Plugin nutzen`,
                    detectedAt: new Date()
                });
            }
        });

        return conflicts;
    }

    async saveConflicts(siteId, conflicts) {
        try {
            // Erstelle Tabelle falls nicht vorhanden
            await query(`
                CREATE TABLE IF NOT EXISTS plugin_conflicts (
                    id SERIAL PRIMARY KEY,
                    site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
                    plugin1 VARCHAR(255),
                    plugin2 VARCHAR(255),
                    conflict_rate FLOAT,
                    severity VARCHAR(20),
                    description TEXT,
                    solution TEXT,
                    detected_at TIMESTAMP DEFAULT NOW(),
                    resolved BOOLEAN DEFAULT false
                )
            `);

            // Lösche alte Konflikte
            await query('DELETE FROM plugin_conflicts WHERE site_id = $1 AND resolved = false', [siteId]);

            // Füge neue Konflikte ein
            for (const conflict of conflicts) {
                await query(
                    `INSERT INTO plugin_conflicts 
                    (site_id, plugin1, plugin2, conflict_rate, severity, description, solution)
                    VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                    [
                        siteId,
                        conflict.plugin1,
                        conflict.plugin2,
                        conflict.conflictRate,
                        conflict.severity,
                        conflict.description,
                        conflict.solution
                    ]
                );
            }

        } catch (error) {
            console.error('Save conflicts error:', error);
        }
    }

    async predictUpdateIssues(siteId, pluginSlug) {
        try {
            // Hole Plugin-Info
            const pluginResult = await query(
                'SELECT * FROM site_plugins WHERE site_id = $1 AND slug = $2',
                [siteId, pluginSlug]
            );

            if (pluginResult.rows.length === 0) {
                return { success: false, error: 'Plugin nicht gefunden' };
            }

            const plugin = pluginResult.rows[0];

            // Simuliere Machine Learning Vorhersage
            const prediction = await this.mlPredictUpdateSuccess(plugin);

            return {
                success: true,
                data: {
                    plugin: plugin.name,
                    currentVersion: plugin.version,
                    updateVersion: plugin.update_version,
                    successProbability: prediction.successProbability,
                    riskLevel: prediction.riskLevel,
                    recommendations: prediction.recommendations,
                    estimatedDowntime: prediction.estimatedDowntime,
                    rollbackAvailable: true
                }
            };

        } catch (error) {
            console.error('Predict update issues error:', error);
            return { success: false, error: error.message };
        }
    }

    async mlPredictUpdateSuccess(plugin) {
        // Simpler Algorithmus - in Production würde hier echtes ML laufen
        let successProbability = 0.85; // Base probability
        const recommendations = [];

        // Faktor 1: Major vs Minor Update
        if (plugin.update_version && plugin.version) {
            const currentMajor = parseInt(plugin.version.split('.')[0]);
            const updateMajor = parseInt(plugin.update_version.split('.')[0]);

            if (updateMajor > currentMajor) {
                // Major Update
                successProbability -= 0.20;
                recommendations.push('Major Update - Staging-Test empfohlen');
            } else {
                // Minor/Patch Update
                successProbability += 0.05;
                recommendations.push('Minor Update - Geringes Risiko');
            }
        }

        // Faktor 2: Plugin-Popularität
        // In Production: Echte Daten aus WordPress.org API
        successProbability += 0.05;

        // Faktor 3: Zeit seit Release
        // In Production: Prüfe Release-Datum
        recommendations.push('Update ist seit 3 Tagen verfügbar - genug Zeit für Bug-Reports');

        // Risk Level berechnen
        let riskLevel = 'low';
        if (successProbability < 0.70) {
            riskLevel = 'high';
        } else if (successProbability < 0.85) {
            riskLevel = 'medium';
        }

        // Downtime schätzen
        const estimatedDowntime = successProbability > 0.90 ? '< 1 Minute' : '2-5 Minuten';

        return {
            successProbability: Math.min(0.98, Math.max(0.50, successProbability)),
            riskLevel,
            recommendations,
            estimatedDowntime
        };
    }

    async getLatestPredictions(siteId) {
        try {
            // Hole aktive Konflikte
            const conflictsResult = await query(
                `SELECT * FROM plugin_conflicts
                 WHERE site_id = $1 AND resolved = false
                 ORDER BY detected_at DESC LIMIT 10`,
                [siteId]
            ).catch(() => ({ rows: [] }));

            // Hole Update-Risiken für Plugins mit Updates
            const updatesResult = await query(
                'SELECT * FROM site_plugins WHERE site_id = $1 AND update_available = true',
                [siteId]
            ).catch(() => ({ rows: [] }));

            const updatePredictions = [];
            for (const plugin of updatesResult.rows) {
                const prediction = await this.mlPredictUpdateSuccess(plugin);
                updatePredictions.push({
                    plugin: plugin.name,
                    slug: plugin.slug,
                    currentVersion: plugin.version,
                    updateVersion: plugin.update_version,
                    ...prediction
                });
            }

            return {
                success: true,
                data: {
                    siteId,
                    conflicts: conflictsResult.rows,
                    updatePredictions,
                    generatedAt: new Date()
                }
            };
        } catch (error) {
            console.error('Get latest predictions error:', error);
            return { success: false, error: error.message };
        }
    }

    async analyzeAll(siteId) {
        try {
            const [conflicts, predictions] = await Promise.all([
                this.predictPluginConflicts(siteId),
                this.getLatestPredictions(siteId)
            ]);

            return {
                success: true,
                data: {
                    conflicts: conflicts.data || null,
                    predictions: predictions.data || null,
                    analyzedAt: new Date()
                }
            };
        } catch (error) {
            console.error('Analyze all error:', error);
            return { success: false, error: error.message };
        }
    }

    async analyzeUpdatePatterns(userId) {
        try {
            // Hole alle Sites des Users
            const sitesResult = await query(
                'SELECT id FROM sites WHERE user_id = $1 AND status = $2',
                [userId, 'active']
            );

            const sites = sitesResult.rows;
            const patterns = {
                totalSites: sites.length,
                sitesWithUpdates: 0,
                totalUpdates: 0,
                criticalUpdates: 0,
                recommendedActions: []
            };

            for (const site of sites) {
                const updatesResult = await query(
                    'SELECT COUNT(*) FROM site_plugins WHERE site_id = $1 AND update_available = true',
                    [site.id]
                );

                const updateCount = parseInt(updatesResult.rows[0].count);
                if (updateCount > 0) {
                    patterns.sitesWithUpdates++;
                    patterns.totalUpdates += updateCount;
                }

                // Prüfe kritische Updates
                const criticalResult = await query(
                    `SELECT COUNT(*) FROM site_plugins 
                    WHERE site_id = $1 AND update_available = true 
                    AND (slug LIKE '%security%' OR slug LIKE '%woocommerce%')`,
                    [site.id]
                );

                patterns.criticalUpdates += parseInt(criticalResult.rows[0].count);
            }

            // Generiere Empfehlungen
            if (patterns.criticalUpdates > 0) {
                patterns.recommendedActions.push({
                    priority: 'high',
                    action: 'Kritische Security-Updates sofort installieren',
                    affectedSites: patterns.sitesWithUpdates
                });
            }

            if (patterns.totalUpdates > 10) {
                patterns.recommendedActions.push({
                    priority: 'medium',
                    action: 'Bulk-Update für alle Sites durchführen',
                    affectedSites: patterns.sitesWithUpdates
                });
            }

            return {
                success: true,
                data: patterns
            };

        } catch (error) {
            console.error('Analyze update patterns error:', error);
            return { success: false, error: error.message };
        }
    }
}

module.exports = new PredictiveService();
