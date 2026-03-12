const { query } = require('../config/database');
const aiService = require('./aiService');

const THEME_BUNDLED_SLUGS = new Set([
    'js_composer','wpbakery-page-builder','revslider','revolution-slider',
    'layerslider','slider-revolution','essential-grid','master-slider',
    'the-grid','wp-instagram-widget','vc_extensions_bundle',
    'envato-market','themeforest','tf-updater',
]);

class AIRecommendationsService {
    async generateSiteRecommendations(siteId) {
        try {
            const siteData = await this.getSiteAnalysisData(siteId);
            
            if (!siteData) {
                return { success: false, error: 'Site nicht gefunden' };
            }

            const recommendations = [];

            // 1. Security-Empfehlungen
            const securityRecs = this.analyzeSecurityIssues(siteData);
            recommendations.push(...securityRecs);

            // 2. Update-Empfehlungen
            const updateRecs = this.analyzeUpdates(siteData);
            recommendations.push(...updateRecs);

            // 3. Performance-Empfehlungen
            const performanceRecs = this.analyzePerformance(siteData);
            recommendations.push(...performanceRecs);

            // 4. Content-Empfehlungen
            const contentRecs = this.analyzeContent(siteData);
            recommendations.push(...contentRecs);

            // 5. Plugin-Empfehlungen
            const pluginRecs = await this.analyzePlugins(siteData);
            recommendations.push(...pluginRecs);

            // Sortiere nach Priorität
            recommendations.sort((a, b) => this.getPriorityScore(b) - this.getPriorityScore(a));

            return {
                success: true,
                data: {
                    siteId,
                    siteName: siteData.site_name,
                    totalRecommendations: recommendations.length,
                    critical: recommendations.filter(r => r.severity === 'critical').length,
                    warning: recommendations.filter(r => r.severity === 'warning').length,
                    info: recommendations.filter(r => r.severity === 'info').length,
                    recommendations: recommendations.slice(0, 10), // Top 10
                    generatedAt: new Date()
                }
            };

        } catch (error) {
            console.error('Generate recommendations error:', error);
            return { success: false, error: error.message };
        }
    }

    async getSiteAnalysisData(siteId) {
        try {
            const [site, plugins, themes, stats] = await Promise.all([
                query('SELECT * FROM sites WHERE id = $1', [siteId]),
                query(`SELECT * FROM site_plugins WHERE site_id = $1`, [siteId]),
                query(`SELECT * FROM site_themes WHERE site_id = $1`, [siteId]),
                query(`SELECT * FROM site_stats WHERE site_id = $1`, [siteId])
            ]);

            if (site.rows.length === 0) return null;

            return {
                ...site.rows[0],
                plugins: plugins.rows,
                themes: themes.rows,
                stats: stats.rows[0] || {}
            };

        } catch (error) {
            console.error('Get site analysis data error:', error);
            return null;
        }
    }

    analyzeSecurityIssues(siteData) {
        const recommendations = [];

        // SSL: URL-basiert prüfen (zuverlässiger als DB-Feld)
        const sslEnabled = siteData.site_url?.startsWith('https://') || siteData.ssl_enabled;

        if (!sslEnabled) {
            recommendations.push({
                type: 'security',
                severity: 'critical',
                title: 'SSL-Zertifikat fehlt',
                description: 'Ihre Website ist nicht über HTTPS erreichbar. Dies gefährdet Nutzerdaten und schadet dem SEO-Ranking.',
                impact: 'Hohes Sicherheitsrisiko, schlechtes Google-Ranking',
                action: 'SSL-Zertifikat installieren',
                actionable: true,
                actionEndpoint: '/api/v1/security/enable-ssl',
                estimatedTime: '5 Minuten'
            });
        }

        // Security Score: nur warnen wenn < 60 (60-100 = akzeptabel)
        const effectiveScore = siteData.security_score > 0 ? siteData.security_score : null;
        if (effectiveScore !== null && effectiveScore < 60) {
            recommendations.push({
                type: 'security',
                severity: effectiveScore < 40 ? 'critical' : 'warning',
                title: `Niedriger Security Score (${effectiveScore}/100)`,
                description: `Ihr Security Score liegt bei ${effectiveScore}/100. Es wurden Sicherheitsprobleme erkannt die behoben werden sollten.`,
                impact: 'Erhöhtes Risiko für Hacks und Malware',
                action: 'Security-Scan durchführen und Probleme beheben',
                actionable: true,
                actionEndpoint: '/api/v1/security/scan',
                estimatedTime: '2 Minuten'
            });
        }

        // Kein Security-Plugin aktiv — explizite Slug-Liste statt .includes()
        const SECURITY_PLUGIN_SLUGS = new Set([
            'wordfence', 'wordfence-login-security',
            'better-wp-security', 'ithemes-security', 'ithemes-security-pro',
            'sucuri-scanner', 'all-in-one-wp-security',
            'wp-cerber', 'shield-security', 'wps-hide-login',
            'jetpack', 'bulletproof-security', 'security-ninja',
            'malcare-security', 'defender-security',
        ]);

        const hasSecurityPlugin = siteData.plugins?.some(p =>
            p.active === true && SECURITY_PLUGIN_SLUGS.has(p.slug)
        );

        if (!hasSecurityPlugin) {
            recommendations.push({
                type: 'security',
                severity: 'warning',
                title: 'Kein Security-Plugin aktiv',
                description: 'Ihre Site hat kein aktives Security-Plugin. Wir empfehlen Wordfence oder iThemes Security.',
                impact: 'Keine Firewall, kein Malware-Scan, keine Login-Protection',
                action: 'Wordfence installieren',
                actionable: true,
                actionEndpoint: '/api/v1/plugins/install',
                actionData: { slug: 'wordfence' },
                estimatedTime: '3 Minuten'
            });
        }

        // Offene Security-Issues aus letztem Scan — nur high/critical, keine Update-Hinweise (Duplikat)
        let issues = [];
        try {
            issues = typeof siteData.security_issues === 'string'
                ? JSON.parse(siteData.security_issues)
                : (siteData.security_issues || []);
        } catch { issues = []; }

        const highIssues = issues.filter(i =>
            (i.severity === 'high' || i.severity === 'critical') &&
            !/(update|aktualisier)/i.test(i.title || i.message || '')
        );

        if (highIssues.length > 0) {
            recommendations.push({
                type: 'security',
                severity: 'critical',
                title: `${highIssues.length} kritische Sicherheitsprobleme`,
                description: highIssues.map(i => i.title || i.message).join('; '),
                impact: 'Direkte Sicherheitslücken auf der Website',
                action: 'Sicherheitsprobleme beheben',
                actionable: false,
                estimatedTime: '15-30 Minuten'
            });
        }

        return recommendations;
    }

    analyzeUpdates(siteData) {
        const recommendations = [];

        // Core-Updates verfügbar
        if (siteData.core_update_available) {
            recommendations.push({
                type: 'updates',
                severity: 'warning',
                title: 'WordPress Core-Update verfügbar',
                description: `Eine neue WordPress-Version ist verfügbar. Aktuell: ${siteData.wordpress_version}`,
                impact: 'Sicherheitslücken, fehlende Features',
                action: 'WordPress aktualisieren',
                actionable: true,
                actionEndpoint: '/api/v1/sites/update-core',
                estimatedTime: '10 Minuten'
            });
        }

        // Plugin-Updates — immer melden wenn Updates vorhanden, konkrete Namen+Versionen
        const pluginUpdates = siteData.plugins?.filter(p => p.update_available) || [];
        if (pluginUpdates.length > 0) {
            const CRITICAL_PLUGIN_SLUGS = new Set([
                'wordfence', 'wordfence-login-security', 'sucuri-scanner',
                'ithemes-security', 'ithemes-security-pro', 'better-wp-security',
                'woocommerce', 'woocommerce-payments', 'woocommerce-gateway-stripe',
                'updraftplus', 'backwpup', 'all-in-one-wp-migration',
                'jetpack', 'wp-mail-smtp',
            ]);

            const criticalPlugins = pluginUpdates.filter(p => CRITICAL_PLUGIN_SLUGS.has(p.slug));
            const otherPlugins = pluginUpdates.filter(p => !CRITICAL_PLUGIN_SLUGS.has(p.slug));

            const formatPluginUpdate = (p) => {
                if (p.version && p.new_version) return `${p.name} (${p.version} → ${p.new_version})`;
                if (p.new_version) return `${p.name} → ${p.new_version}`;
                return p.name;
            };

            if (criticalPlugins.length > 0) {
                recommendations.push({
                    type: 'updates',
                    severity: 'critical',
                    title: `${criticalPlugins.length} kritische Plugin-Update(s) ausstehend`,
                    description: `Sicherheits- oder Shop-kritische Plugins haben Updates: ${criticalPlugins.map(formatPluginUpdate).join(', ')}`,
                    impact: 'Sicherheitslücken, Funktionsprobleme',
                    action: 'Kritische Plugins sofort aktualisieren',
                    actionable: true,
                    actionEndpoint: '/api/v1/plugins/bulk-update',
                    actionData: { plugins: criticalPlugins.map(p => p.slug) },
                    estimatedTime: '5 Minuten'
                });
            }

            if (otherPlugins.length > 0) {
                recommendations.push({
                    type: 'updates',
                    severity: 'warning',
                    title: `${otherPlugins.length} Plugin-Update(s) verfügbar`,
                    description: `Folgende Plugins haben Updates bereit: ${otherPlugins.map(formatPluginUpdate).join(', ')}`,
                    impact: 'Potenzielle Bugs, Inkompatibilitäten, fehlende Features',
                    action: 'Plugins aktualisieren',
                    actionable: true,
                    actionEndpoint: '/api/v1/plugins/bulk-update',
                    estimatedTime: '5 Minuten'
                });
            }
        }

        // Theme-Updates
        const themeUpdates = siteData.themes?.filter(t => t.update_available) || [];
        if (themeUpdates.length > 0) {
            recommendations.push({
                type: 'updates',
                severity: 'info',
                title: `${themeUpdates.length} Theme-Update(s) verfügbar`,
                description: `Themes mit Updates: ${themeUpdates.map(t => t.name).join(', ')}`,
                impact: 'Design-Bugs, fehlende Features',
                action: 'Themes aktualisieren',
                actionable: true,
                actionEndpoint: '/api/v1/themes/bulk-update',
                estimatedTime: '5 Minuten'
            });
        }

        return recommendations;
    }

    analyzePerformance(siteData) {
        const recommendations = [];
        const plugins = siteData.plugins || [];
        const activePlugins = plugins.filter(p => p.active === true);

        // Zu viele aktive Plugins (nicht total)
        if (activePlugins.length > 30) {
            recommendations.push({
                type: 'performance',
                severity: 'warning',
                title: `Viele aktive Plugins (${activePlugins.length})`,
                description: `Sie haben ${activePlugins.length} aktive Plugins. Das kann die Performance verlangsamen.`,
                impact: 'Langsame Ladezeiten, schlechte User Experience',
                action: 'Unnötige Plugins deaktivieren und deinstallieren',
                actionable: true,
                actionEndpoint: '/api/v1/plugins/cleanup',
                estimatedTime: '10 Minuten'
            });
        }

        // Kein Caching-Plugin — erweiterte Liste
        const CACHING_PLUGIN_SLUGS = new Set([
            'wp-rocket', 'w3-total-cache', 'wp-super-cache', 'wp-fastest-cache',
            'litespeed-cache', 'comet-cache', 'cache-enabler', 'sg-cachepress',
            'varnish-http-purge', 'proxy-cache-purge', 'nginx-helper',
            'perfmatters', 'autoptimize', 'performance-lab', 'flying-press',
            'breeze', 'swift-performance-lite', 'hummingbird-performance',
        ]);

        const hasCachingPlugin = activePlugins.some(p =>
            CACHING_PLUGIN_SLUGS.has(p.slug) || p.slug.includes('cache')
        );

        if (!hasCachingPlugin) {
            recommendations.push({
                type: 'performance',
                severity: 'warning',
                title: 'Kein Caching-Plugin aktiv',
                description: 'Ein Caching-Plugin kann Ihre Ladezeiten um 50-90% verbessern.',
                impact: 'Langsame Website, hohe Server-Last',
                action: 'WP Rocket oder LiteSpeed Cache installieren',
                actionable: true,
                actionEndpoint: '/api/v1/plugins/install',
                actionData: { slug: 'litespeed-cache' },
                estimatedTime: '5 Minuten'
            });
        }

        // Alte PHP-Version
        if (siteData.php_version && parseFloat(siteData.php_version) < 8.0) {
            recommendations.push({
                type: 'performance',
                severity: 'warning',
                title: 'Veraltete PHP-Version',
                description: `Sie nutzen PHP ${siteData.php_version}. PHP 8.0+ ist bis zu 30% schneller und sicherer.`,
                impact: 'Langsame Performance, Sicherheitsrisiken',
                action: 'PHP-Version upgraden',
                actionable: false,
                estimatedTime: '30 Minuten (Hosting-Support kontaktieren)'
            });
        }

        return recommendations;
    }

    analyzeContent(siteData) {
        const recommendations = [];
        const stats = siteData.stats || {};
        const plugins = siteData.plugins || [];

        // Viele Kommentare — Spam-Schutz empfehlen, aber nur wenn Akismet nicht bereits aktiv
        if (stats.comments_count > 50) {
            const hasAkismet = plugins.some(p =>
                p.active === true && (p.slug === 'akismet' || p.slug === 'akismet-anti-spam')
            );

            if (!hasAkismet) {
                recommendations.push({
                    type: 'content',
                    severity: 'info',
                    title: 'Spam-Schutz empfohlen',
                    description: `Sie haben ${stats.comments_count} Kommentare. Akismet schützt vor Spam-Kommentaren.`,
                    impact: 'Spam-Problem, schlechte User Experience',
                    action: 'Akismet aktivieren',
                    actionable: true,
                    actionEndpoint: '/api/v1/plugins/install',
                    actionData: { slug: 'akismet' },
                    estimatedTime: '3 Minuten'
                });
            }
        }

        // Wenig Content: nur melden wenn sowohl Posts ALS AUCH Pages sehr niedrig
        if (stats.posts_count < 3 && stats.pages_count < 3) {
            recommendations.push({
                type: 'content',
                severity: 'info',
                title: 'Wenig Content vorhanden',
                description: `Ihre Website hat nur ${stats.posts_count} Beiträge und ${stats.pages_count} Seiten. Mehr Content verbessert SEO und Nutzerbindung.`,
                impact: 'Schlechtes SEO-Ranking, wenig Traffic',
                action: 'Content-Strategie entwickeln',
                actionable: false,
                estimatedTime: 'Kontinuierlich'
            });
        }

        return recommendations;
    }

    async analyzePlugins(siteData) {
        const recommendations = [];
        const plugins = siteData.plugins || [];

        // Inaktive Plugins
        const inactivePlugins = plugins.filter(p => p.active === false);
        if (inactivePlugins.length > 5) {
            recommendations.push({
                type: 'maintenance',
                severity: 'info',
                title: `${inactivePlugins.length} inaktive Plugins`,
                description: 'Inaktive Plugins sollten deinstalliert werden um Sicherheitsrisiken zu vermeiden.',
                impact: 'Sicherheitslücken, unübersichtliches Backend',
                action: 'Inaktive Plugins entfernen',
                actionable: true,
                actionEndpoint: '/api/v1/plugins/cleanup-inactive',
                estimatedTime: '5 Minuten'
            });
        }

        // Premium-Plugins mit ausstehenden Updates
        const premiumWithUpdates = plugins.filter(p => p.is_premium && p.update_available);
        if (premiumWithUpdates.length > 0) {
            // Prüfe ob Envato Market vorhanden ist (kann Themeforest-Plugins updaten)
            const hasEnvatoMarket = plugins.some(p => p.slug === 'envato-market' && p.active);
            const envatoPlugins = premiumWithUpdates.filter(p =>
                THEME_BUNDLED_SLUGS.has(p.slug) || p.slug.includes('js_composer') || p.slug.includes('revslider') || p.slug.includes('wpbakery')
            );
            const directUpdatePlugins = premiumWithUpdates.filter(p => !envatoPlugins.includes(p));

            if (envatoPlugins.length > 0) {
                recommendations.push({
                    type: 'updates',
                    severity: 'warning',
                    title: `${envatoPlugins.length} theme-gebundelte Premium-Plugin-Update(s)`,
                    description: `Diese Plugins werden üblicherweise über das Theme oder Envato Market aktualisiert${hasEnvatoMarket ? ' (Envato Market Plugin aktiv)' : ''}: ${envatoPlugins.map(p => p.name).join(', ')}`,
                    impact: 'Veraltete Premium-Features, mögliche Inkompatibilitäten mit neuem Theme',
                    action: hasEnvatoMarket ? 'Über Envato Market Dashboard aktualisieren' : 'Theme-Anbieter kontaktieren oder Envato Market Plugin installieren',
                    actionable: false,
                    estimatedTime: '10-30 Minuten',
                    updateMethod: 'theme-bundled'
                });
            }

            if (directUpdatePlugins.length > 0) {
                recommendations.push({
                    type: 'updates',
                    severity: 'warning',
                    title: `${directUpdatePlugins.length} Premium-Plugin-Update(s) ausstehend`,
                    description: `Diese Premium-Plugins haben Updates die direkt über den Plugin-Anbieter eingespielt werden müssen: ${directUpdatePlugins.map(p => p.name).join(', ')}`,
                    impact: 'Sicherheitslücken, fehlende Premium-Features',
                    action: 'Beim jeweiligen Plugin-Anbieter einloggen und Update herunterladen',
                    actionable: false,
                    estimatedTime: '5-15 Minuten',
                    updateMethod: 'manual-premium'
                });
            }
        }

        // Bekannte problematische Plugins
        const problematicPlugins = plugins.filter(p => 
            this.isProblematicPlugin(p.slug)
        );

        if (problematicPlugins.length > 0) {
            recommendations.push({
                type: 'security',
                severity: 'critical',
                title: 'Problematische Plugins erkannt',
                description: `Diese Plugins haben bekannte Probleme: ${problematicPlugins.map(p => p.name).join(', ')}`,
                impact: 'Sicherheitslücken, Performance-Probleme',
                action: 'Plugins ersetzen',
                actionable: false,
                estimatedTime: '20 Minuten'
            });
        }

        return recommendations;
    }

    isProblematicPlugin(slug) {
        const problematicSlugs = [
            'really-simple-ssl', // Bekannt für Konflikte
            'all-in-one-wp-migration', // Performance-Issues bei großen Sites
            'duplicator' // Kann Server überlasten
        ];
        return problematicSlugs.includes(slug);
    }

    getPriorityScore(recommendation) {
        const severityScores = {
            critical: 100,
            warning: 50,
            info: 10
        };

        const typeScores = {
            security: 20,
            updates: 15,
            performance: 10,
            content: 5,
            maintenance: 5
        };

        return (severityScores[recommendation.severity] || 0) + 
               (typeScores[recommendation.type] || 0);
    }

    async generateDashboardInsights(userId) {
        try {
            const sitesResult = await query(
                'SELECT id FROM sites WHERE user_id = $1 AND status = $2',
                [userId, 'active']
            );

            const sites = sitesResult.rows;

            const allRecommendations = await Promise.all(
                sites.map(site => this.generateSiteRecommendations(site.id))
            );

            const successfulRecs = allRecommendations
                .filter(r => r.success)
                .map(r => r.data);

            // Aggregiere Statistiken
            const totalCritical = successfulRecs.reduce((sum, r) => sum + r.critical, 0);
            const totalWarning = successfulRecs.reduce((sum, r) => sum + r.warning, 0);
            const totalInfo = successfulRecs.reduce((sum, r) => sum + r.info, 0);

            // Top 5 wichtigste Empfehlungen über alle Sites
            const allRecs = successfulRecs
                .flatMap(r => r.recommendations)
                .sort((a, b) => this.getPriorityScore(b) - this.getPriorityScore(a))
                .slice(0, 5);

            return {
                success: true,
                data: {
                    totalSites: sites.length,
                    sitesAnalyzed: successfulRecs.length,
                    totalCritical,
                    totalWarning,
                    totalInfo,
                    topRecommendations: allRecs,
                    siteRecommendations: successfulRecs
                }
            };

        } catch (error) {
            console.error('Generate dashboard insights error:', error);
            return { success: false, error: error.message };
        }
    }
}

module.exports = new AIRecommendationsService();
