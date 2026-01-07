/**
 * Predictive Maintenance Service
 * KI-gestützte Vorhersage von Problemen und proaktive Wartung
 */

const { query } = require('../config/database');
const aiService = require('./aiService');
const notificationService = require('./notificationService');

class PredictiveService {
    constructor() {
        this.thresholds = {
            diskSpace: { warning: 80, critical: 90 }, // Prozent
            loadTime: { warning: 3000, critical: 5000 }, // ms
            errorRate: { warning: 5, critical: 10 }, // pro Stunde
            failedLogins: { warning: 10, critical: 50 }, // pro Tag
            uptimePercentage: { warning: 99, critical: 95 }, // Prozent
            databaseGrowth: { warning: 10, critical: 25 } // Prozent pro Woche
        };
    }

    /**
     * Führt vollständige Predictive Analyse durch
     */
    async analyzeAll(siteId) {
        try {
            const predictions = [];
            
            // Sammle alle Analysen
            const [
                performancePrediction,
                securityPrediction,
                storagePrediction,
                uptimePrediction,
                updateRisk
            ] = await Promise.all([
                this.predictPerformanceIssues(siteId),
                this.predictSecurityThreats(siteId),
                this.predictStorageIssues(siteId),
                this.predictUptimeIssues(siteId),
                this.predictUpdateRisks(siteId)
            ]);

            predictions.push(...performancePrediction);
            predictions.push(...securityPrediction);
            predictions.push(...storagePrediction);
            predictions.push(...uptimePrediction);
            predictions.push(...updateRisk);

            // Sortiere nach Priorität
            predictions.sort((a, b) => b.priority - a.priority);

            // Speichere Vorhersagen
            await this.storePredictions(siteId, predictions);

            // Sende Alerts für kritische Vorhersagen
            await this.sendAlertsIfNeeded(siteId, predictions);

            return {
                success: true,
                data: {
                    predictions,
                    overallRisk: this.calculateOverallRisk(predictions),
                    recommendations: this.generateRecommendations(predictions),
                    analyzedAt: new Date().toISOString()
                }
            };
        } catch (error) {
            console.error('Predictive analysis error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Vorhersage von Performance-Problemen
     */
    async predictPerformanceIssues(siteId) {
        const predictions = [];

        try {
            // Hole Performance-History
            const result = await query(
                `SELECT page_load_time, ttfb, performance_score, created_at
                 FROM performance_metrics
                 WHERE site_id = $1 AND created_at > NOW() - INTERVAL '14 days'
                 ORDER BY created_at ASC`,
                [siteId]
            );

            if (result.rows.length < 5) {
                return predictions; // Nicht genug Daten
            }

            const metrics = result.rows;
            
            // Berechne Trends
            const loadTimeTrend = this.calculateTrend(metrics.map(m => m.page_load_time));
            const ttfbTrend = this.calculateTrend(metrics.map(m => m.ttfb));

            // Aktuelle Werte
            const currentLoadTime = metrics[metrics.length - 1].page_load_time;
            const avgLoadTime = metrics.reduce((sum, m) => sum + m.page_load_time, 0) / metrics.length;

            // Verschlechterungstrend erkannt?
            if (loadTimeTrend > 0.1) { // 10% Verschlechterung
                const daysUntilCritical = this.predictDaysUntilThreshold(
                    currentLoadTime,
                    loadTimeTrend,
                    this.thresholds.loadTime.critical
                );

                predictions.push({
                    type: 'performance_degradation',
                    title: 'Performance-Verschlechterung erkannt',
                    description: `Die Ladezeit hat sich um ${(loadTimeTrend * 100).toFixed(1)}% verschlechtert. ` +
                                `Aktuelle Ladezeit: ${currentLoadTime}ms, Durchschnitt: ${avgLoadTime.toFixed(0)}ms`,
                    priority: loadTimeTrend > 0.2 ? 8 : 6,
                    prediction: daysUntilCritical 
                        ? `Bei diesem Trend wird die kritische Schwelle in ~${daysUntilCritical} Tagen erreicht.`
                        : 'Trend sollte beobachtet werden.',
                    recommendedActions: [
                        'Cache-System überprüfen',
                        'Datenbank optimieren',
                        'Plugin-Performance analysieren',
                        'CDN Konfiguration prüfen'
                    ],
                    metric: {
                        current: currentLoadTime,
                        average: avgLoadTime,
                        trend: loadTimeTrend,
                        unit: 'ms'
                    }
                });
            }

            // TTFB-Probleme
            if (ttfbTrend > 0.15) {
                predictions.push({
                    type: 'ttfb_degradation',
                    title: 'Server-Antwortzeit verschlechtert sich',
                    description: 'Die Time-to-First-Byte (TTFB) zeigt einen negativen Trend.',
                    priority: 7,
                    prediction: 'Mögliche Server- oder Datenbankprobleme in der Zukunft.',
                    recommendedActions: [
                        'Server-Ressourcen prüfen',
                        'Datenbank-Queries optimieren',
                        'Hosting-Upgrade in Betracht ziehen'
                    ],
                    metric: {
                        trend: ttfbTrend,
                        unit: 'ms'
                    }
                });
            }

        } catch (error) {
            console.error('Performance prediction error:', error);
        }

        return predictions;
    }

    /**
     * Vorhersage von Sicherheitsbedrohungen
     */
    async predictSecurityThreats(siteId) {
        const predictions = [];

        try {
            // Hole Security-Daten
            const [securityScans, failedLogins] = await Promise.all([
                query(
                    `SELECT security_score, issues_found, created_at
                     FROM security_scans
                     WHERE site_id = $1 AND created_at > NOW() - INTERVAL '30 days'
                     ORDER BY created_at ASC`,
                    [siteId]
                ),
                query(
                    `SELECT COUNT(*) as count, DATE(created_at) as date
                     FROM activity_logs
                     WHERE site_id = $1 AND action = 'failed_login' 
                           AND created_at > NOW() - INTERVAL '7 days'
                     GROUP BY DATE(created_at)
                     ORDER BY date ASC`,
                    [siteId]
                )
            ]);

            // Analysiere Failed Logins Trend
            if (failedLogins.rows.length >= 3) {
                const loginAttempts = failedLogins.rows.map(r => parseInt(r.count));
                const loginTrend = this.calculateTrend(loginAttempts);
                const currentDaily = loginAttempts[loginAttempts.length - 1] || 0;

                if (loginTrend > 0.3 || currentDaily > this.thresholds.failedLogins.warning) {
                    predictions.push({
                        type: 'brute_force_attack',
                        title: 'Möglicher Brute-Force-Angriff',
                        description: `Erhöhte fehlgeschlagene Login-Versuche erkannt. ` +
                                    `Aktuell: ${currentDaily} pro Tag, Trend: +${(loginTrend * 100).toFixed(0)}%`,
                        priority: currentDaily > this.thresholds.failedLogins.critical ? 10 : 8,
                        prediction: 'Ohne Gegenmaßnahmen könnte ein erfolgreicher Einbruch folgen.',
                        recommendedActions: [
                            'Zwei-Faktor-Authentifizierung aktivieren',
                            'Login-Versuche limitieren',
                            'Verdächtige IPs blockieren',
                            'Admin-URL ändern'
                        ],
                        metric: {
                            current: currentDaily,
                            trend: loginTrend,
                            unit: 'Versuche/Tag'
                        }
                    });
                }
            }

            // Analysiere Security Score Trend
            if (securityScans.rows.length >= 2) {
                const scores = securityScans.rows.map(r => r.security_score);
                const scoreTrend = this.calculateTrend(scores);
                const currentScore = scores[scores.length - 1];

                if (scoreTrend < -0.1 || currentScore < 70) {
                    predictions.push({
                        type: 'security_score_decline',
                        title: 'Sicherheitsbewertung sinkt',
                        description: `Der Security Score ist auf ${currentScore} gefallen. ` +
                                    `Trend: ${(scoreTrend * 100).toFixed(1)}%`,
                        priority: currentScore < 50 ? 9 : 6,
                        prediction: 'Erhöhtes Risiko für erfolgreiche Angriffe.',
                        recommendedActions: [
                            'Vollständigen Security-Scan durchführen',
                            'Veraltete Plugins aktualisieren',
                            'SSL-Zertifikat prüfen',
                            'Dateiberechtigungen überprüfen'
                        ],
                        metric: {
                            current: currentScore,
                            trend: scoreTrend,
                            unit: '%'
                        }
                    });
                }
            }

        } catch (error) {
            console.error('Security prediction error:', error);
        }

        return predictions;
    }

    /**
     * Vorhersage von Speicherproblemen
     */
    async predictStorageIssues(siteId) {
        const predictions = [];

        try {
            // Hole Backup-Größen als Indikator für Site-Wachstum
            const result = await query(
                `SELECT file_size, created_at
                 FROM backups
                 WHERE site_id = $1 AND status = 'completed' 
                       AND created_at > NOW() - INTERVAL '30 days'
                 ORDER BY created_at ASC`,
                [siteId]
            );

            if (result.rows.length >= 3) {
                const sizes = result.rows.map(r => r.file_size);
                const growthRate = this.calculateGrowthRate(sizes);

                if (growthRate > this.thresholds.databaseGrowth.warning / 100) {
                    predictions.push({
                        type: 'storage_growth',
                        title: 'Übermäßiges Datenwachstum',
                        description: `Die Site wächst um ${(growthRate * 100).toFixed(1)}% pro Woche. ` +
                                    `Dies könnte zu Speicherproblemen führen.`,
                        priority: growthRate > this.thresholds.databaseGrowth.critical / 100 ? 7 : 5,
                        prediction: `Bei diesem Wachstum verdoppelt sich der Speicherbedarf in ` +
                                   `~${Math.ceil(Math.log(2) / Math.log(1 + growthRate))} Wochen.`,
                        recommendedActions: [
                            'Datenbank-Cleanup durchführen (Revisionen, Spam)',
                            'Medien optimieren',
                            'Alte Backups löschen',
                            'Transient-Cache leeren'
                        ],
                        metric: {
                            growthRate: growthRate,
                            unit: 'pro Woche'
                        }
                    });
                }
            }

        } catch (error) {
            console.error('Storage prediction error:', error);
        }

        return predictions;
    }

    /**
     * Vorhersage von Uptime-Problemen
     */
    async predictUptimeIssues(siteId) {
        const predictions = [];

        try {
            const result = await query(
                `SELECT status, response_time, error_message, checked_at
                 FROM uptime_checks
                 WHERE site_id = $1 AND checked_at > NOW() - INTERVAL '7 days'
                 ORDER BY checked_at ASC`,
                [siteId]
            );

            if (result.rows.length < 10) {
                return predictions;
            }

            const checks = result.rows;
            const downChecks = checks.filter(c => c.status === 'down');
            const uptimePercentage = ((checks.length - downChecks.length) / checks.length) * 100;

            // Uptime unter Schwelle?
            if (uptimePercentage < this.thresholds.uptimePercentage.warning) {
                predictions.push({
                    type: 'uptime_issues',
                    title: 'Uptime-Probleme erkannt',
                    description: `Die Uptime liegt bei ${uptimePercentage.toFixed(2)}% ` +
                                `(${downChecks.length} Ausfälle in 7 Tagen).`,
                    priority: uptimePercentage < this.thresholds.uptimePercentage.critical ? 10 : 8,
                    prediction: 'Ohne Intervention könnten die Ausfälle zunehmen.',
                    recommendedActions: [
                        'Server-Logs prüfen',
                        'Hosting-Provider kontaktieren',
                        'Ressourcen-Limits überprüfen',
                        'CDN oder Load Balancer in Betracht ziehen'
                    ],
                    metric: {
                        uptime: uptimePercentage,
                        downtimeEvents: downChecks.length,
                        unit: '%'
                    }
                });
            }

            // Muster erkennen (z.B. täglich zur gleichen Zeit)
            const downtimePattern = this.detectUptimePattern(downChecks);
            if (downtimePattern) {
                predictions.push({
                    type: 'uptime_pattern',
                    title: 'Wiederkehrendes Ausfall-Muster',
                    description: `Ausfälle treten regelmäßig ${downtimePattern.description} auf.`,
                    priority: 7,
                    prediction: `Nächster wahrscheinlicher Ausfall: ${downtimePattern.nextPredicted}`,
                    recommendedActions: [
                        'Cron-Jobs zur fraglichen Zeit prüfen',
                        'Backup-Schedule überprüfen',
                        'Server-Last zu Spitzenzeiten analysieren'
                    ]
                });
            }

        } catch (error) {
            console.error('Uptime prediction error:', error);
        }

        return predictions;
    }

    /**
     * Vorhersage von Update-Risiken
     */
    async predictUpdateRisks(siteId) {
        const predictions = [];

        try {
            // Hole Site-Info und Update-Status
            const siteResult = await query(
                `SELECT wordpress_version, php_version FROM sites WHERE id = $1`,
                [siteId]
            );

            if (siteResult.rows.length === 0) return predictions;

            const site = siteResult.rows[0];

            // Prüfe auf veraltete PHP-Version
            const phpVersion = parseFloat(site.php_version);
            if (phpVersion && phpVersion < 8.0) {
                predictions.push({
                    type: 'php_end_of_life',
                    title: 'PHP-Version bald ohne Support',
                    description: `PHP ${site.php_version} erhält nur noch eingeschränkten Support. ` +
                                `Ein Upgrade auf PHP 8.x wird empfohlen.`,
                    priority: phpVersion < 7.4 ? 8 : 5,
                    prediction: 'Sicherheitsrisiken steigen ohne Updates.',
                    recommendedActions: [
                        'PHP-Kompatibilität testen',
                        'Backup erstellen',
                        'PHP-Upgrade planen',
                        'Plugin-Kompatibilität prüfen'
                    ]
                });
            }

            // Prüfe WordPress-Version
            if (site.wordpress_version) {
                const wpMajor = parseInt(site.wordpress_version.split('.')[0]);
                if (wpMajor < 6) {
                    predictions.push({
                        type: 'wordpress_outdated',
                        title: 'WordPress-Version veraltet',
                        description: `WordPress ${site.wordpress_version} sollte aktualisiert werden.`,
                        priority: 7,
                        prediction: 'Ältere Versionen haben bekannte Sicherheitslücken.',
                        recommendedActions: [
                            'Backup erstellen',
                            'Plugin-Kompatibilität prüfen',
                            'WordPress-Update durchführen'
                        ]
                    });
                }
            }

        } catch (error) {
            console.error('Update risk prediction error:', error);
        }

        return predictions;
    }

    // ==========================================
    // HELPER FUNCTIONS
    // ==========================================

    calculateTrend(values) {
        if (values.length < 2) return 0;
        
        const first = values.slice(0, Math.ceil(values.length / 3));
        const last = values.slice(-Math.ceil(values.length / 3));
        
        const firstAvg = first.reduce((a, b) => a + b, 0) / first.length;
        const lastAvg = last.reduce((a, b) => a + b, 0) / last.length;
        
        if (firstAvg === 0) return 0;
        return (lastAvg - firstAvg) / firstAvg;
    }

    calculateGrowthRate(values) {
        if (values.length < 2) return 0;
        const firstValue = values[0];
        const lastValue = values[values.length - 1];
        const weeks = values.length / 4; // Annahme: ~4 Backups pro Woche
        
        if (firstValue === 0 || weeks === 0) return 0;
        return Math.pow(lastValue / firstValue, 1 / weeks) - 1;
    }

    predictDaysUntilThreshold(currentValue, dailyTrend, threshold) {
        if (currentValue >= threshold || dailyTrend <= 0) return null;
        const dailyGrowth = currentValue * dailyTrend;
        return Math.ceil((threshold - currentValue) / dailyGrowth);
    }

    detectUptimePattern(downChecks) {
        if (downChecks.length < 3) return null;
        
        // Analysiere Stunden der Ausfälle
        const hours = downChecks.map(c => new Date(c.checked_at).getHours());
        const hourCounts = {};
        hours.forEach(h => hourCounts[h] = (hourCounts[h] || 0) + 1);
        
        const maxHour = Object.entries(hourCounts)
            .sort((a, b) => b[1] - a[1])[0];
        
        if (maxHour && maxHour[1] >= downChecks.length * 0.5) {
            return {
                type: 'hourly',
                hour: parseInt(maxHour[0]),
                description: `um ${maxHour[0]}:00 Uhr`,
                nextPredicted: `Heute/Morgen um ${maxHour[0]}:00 Uhr`
            };
        }
        
        return null;
    }

    calculateOverallRisk(predictions) {
        if (predictions.length === 0) return 'low';
        
        const maxPriority = Math.max(...predictions.map(p => p.priority));
        const avgPriority = predictions.reduce((sum, p) => sum + p.priority, 0) / predictions.length;
        
        if (maxPriority >= 9 || avgPriority >= 7) return 'critical';
        if (maxPriority >= 7 || avgPriority >= 5) return 'high';
        if (maxPriority >= 5 || avgPriority >= 3) return 'medium';
        return 'low';
    }

    generateRecommendations(predictions) {
        const allActions = [];
        predictions.forEach(p => {
            if (p.recommendedActions) {
                allActions.push(...p.recommendedActions.map(action => ({
                    action,
                    priority: p.priority,
                    source: p.type
                })));
            }
        });
        
        // Dedupliziere und sortiere
        const uniqueActions = [...new Map(allActions.map(a => [a.action, a])).values()];
        return uniqueActions.sort((a, b) => b.priority - a.priority).slice(0, 5);
    }

    async storePredictions(siteId, predictions) {
        try {
            await query(
                `INSERT INTO predictive_insights (site_id, predictions, overall_risk, created_at)
                 VALUES ($1, $2, $3, NOW())`,
                [siteId, JSON.stringify(predictions), this.calculateOverallRisk(predictions)]
            );
        } catch (error) {
            console.error('Store predictions error:', error);
        }
    }

    async sendAlertsIfNeeded(siteId, predictions) {
        const criticalPredictions = predictions.filter(p => p.priority >= 8);
        
        if (criticalPredictions.length === 0) return;

        try {
            // Hole User-ID für Site
            const siteResult = await query(
                'SELECT user_id, domain FROM sites WHERE id = $1',
                [siteId]
            );
            
            if (siteResult.rows.length === 0) return;

            const { user_id, domain } = siteResult.rows[0];

            // Sende Notification
            await notificationService.notify(user_id, 'predictive_alert', {
                domain,
                predictions: criticalPredictions,
                message: `${criticalPredictions.length} kritische Vorhersagen für ${domain}`
            });
        } catch (error) {
            console.error('Send predictive alert error:', error);
        }
    }

    /**
     * Holt letzte Vorhersagen für eine Site
     */
    async getLatestPredictions(siteId) {
        try {
            const result = await query(
                `SELECT * FROM predictive_insights
                 WHERE site_id = $1
                 ORDER BY created_at DESC
                 LIMIT 1`,
                [siteId]
            );

            if (result.rows.length === 0) {
                return { success: true, data: null };
            }

            const row = result.rows[0];
            return {
                success: true,
                data: {
                    predictions: typeof row.predictions === 'string' 
                        ? JSON.parse(row.predictions) 
                        : row.predictions,
                    overallRisk: row.overall_risk,
                    analyzedAt: row.created_at
                }
            };
        } catch (error) {
            console.error('Get predictions error:', error);
            return { success: false, error: error.message };
        }
    }
}

module.exports = new PredictiveService();

