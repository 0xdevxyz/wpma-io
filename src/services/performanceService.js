const { query } = require('../config/database');

class PerformanceService {
    constructor() {
        this.metricsRetentionDays = 90;
    }

    async saveMetrics(siteId, metrics) {
        try {
            const result = await query(
                `INSERT INTO performance_metrics (
                    site_id, 
                    page_load_time, 
                    core_web_vitals, 
                    database_queries, 
                    database_size, 
                    cache_hit_ratio,
                    created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
                RETURNING *`,
                [
                    siteId,
                    metrics.page_load_time || null,
                    JSON.stringify(metrics.core_web_vitals || {}),
                    metrics.database_queries || null,
                    metrics.database_size || null,
                    metrics.cache_hit_ratio || null
                ]
            );

            return { success: true, data: result.rows[0] };
        } catch (error) {
            console.error('Error saving performance metrics:', error);
            return { success: false, error: error.message };
        }
    }

    async getCurrentMetrics(siteId) {
        try {
            const result = await query(
                `SELECT * FROM performance_metrics 
                WHERE site_id = $1 
                ORDER BY created_at DESC 
                LIMIT 1`,
                [siteId]
            );

            if (result.rows.length === 0) {
                return { success: false, error: 'Keine Performance-Daten verfügbar' };
            }

            const metrics = result.rows[0];
            const performanceScore = this.calculatePerformanceScore(metrics);

            return {
                success: true,
                data: { ...metrics, performance_score: performanceScore }
            };
        } catch (error) {
            console.error('Error getting current metrics:', error);
            return { success: false, error: error.message };
        }
    }

    async getMetricsHistory(siteId, days = 7) {
        try {
            const result = await query(
                `SELECT 
                    id, site_id, page_load_time, core_web_vitals,
                    database_queries, database_size, cache_hit_ratio,
                    created_at, DATE_TRUNC('hour', created_at) as hour
                FROM performance_metrics 
                WHERE site_id = $1 
                AND created_at >= NOW() - INTERVAL '${days} days'
                ORDER BY created_at ASC`,
                [siteId]
            );

            const groupedData = this.groupMetricsByHour(result.rows);

            return { success: true, data: groupedData, total: result.rows.length };
        } catch (error) {
            console.error('Error getting metrics history:', error);
            return { success: false, error: error.message };
        }
    }

    groupMetricsByHour(metrics) {
        const grouped = {};

        metrics.forEach(metric => {
            const hour = new Date(metric.hour).toISOString();
            
            if (!grouped[hour]) {
                grouped[hour] = {
                    timestamp: hour,
                    page_load_times: [],
                    database_queries: [],
                    cache_hit_ratios: [],
                    core_web_vitals: []
                };
            }

            if (metric.page_load_time) grouped[hour].page_load_times.push(parseFloat(metric.page_load_time));
            if (metric.database_queries) grouped[hour].database_queries.push(metric.database_queries);
            if (metric.cache_hit_ratio) grouped[hour].cache_hit_ratios.push(parseFloat(metric.cache_hit_ratio));
            if (metric.core_web_vitals) grouped[hour].core_web_vitals.push(metric.core_web_vitals);
        });

        return Object.values(grouped).map(group => ({
            timestamp: group.timestamp,
            avg_page_load_time: this.average(group.page_load_times),
            avg_database_queries: this.average(group.database_queries),
            avg_cache_hit_ratio: this.average(group.cache_hit_ratios),
            core_web_vitals: this.averageCoreWebVitals(group.core_web_vitals)
        }));
    }

    average(arr) {
        if (arr.length === 0) return null;
        return arr.reduce((a, b) => a + b, 0) / arr.length;
    }

    averageCoreWebVitals(vitalsArray) {
        if (vitalsArray.length === 0) return null;

        const summed = vitalsArray.reduce((acc, vitals) => ({
            lcp: (acc.lcp || 0) + (vitals.lcp || 0),
            fid: (acc.fid || 0) + (vitals.fid || 0),
            cls: (acc.cls || 0) + (vitals.cls || 0)
        }), { lcp: 0, fid: 0, cls: 0 });

        return {
            lcp: summed.lcp / vitalsArray.length,
            fid: summed.fid / vitalsArray.length,
            cls: summed.cls / vitalsArray.length
        };
    }

    calculatePerformanceScore(metrics) {
        let score = 100;

        if (metrics.page_load_time) {
            const loadTime = parseFloat(metrics.page_load_time);
            if (loadTime > 3000) score -= 30;
            else if (loadTime > 2000) score -= 20;
            else if (loadTime > 1000) score -= 10;
        }

        if (metrics.core_web_vitals) {
            const vitals = typeof metrics.core_web_vitals === 'string' 
                ? JSON.parse(metrics.core_web_vitals) 
                : metrics.core_web_vitals;

            if (vitals.lcp) {
                if (vitals.lcp > 4000) score -= 10;
                else if (vitals.lcp > 2500) score -= 5;
            }

            if (vitals.fid) {
                if (vitals.fid > 300) score -= 10;
                else if (vitals.fid > 100) score -= 5;
            }

            if (vitals.cls) {
                if (vitals.cls > 0.25) score -= 10;
                else if (vitals.cls > 0.1) score -= 5;
            }
        }

        if (metrics.database_queries) {
            if (metrics.database_queries > 100) score -= 20;
            else if (metrics.database_queries > 50) score -= 10;
        }

        if (metrics.cache_hit_ratio) {
            const ratio = parseFloat(metrics.cache_hit_ratio);
            if (ratio < 50) score -= 20;
            else if (ratio < 70) score -= 10;
        }

        return Math.max(0, Math.min(100, score));
    }

    async analyzePerformance(siteId) {
        try {
            const currentResult = await this.getCurrentMetrics(siteId);
            if (!currentResult.success) return currentResult;

            const metrics = currentResult.data;
            const recommendations = [];

            if (metrics.page_load_time && metrics.page_load_time > 2000) {
                recommendations.push({
                    category: 'performance',
                    priority: metrics.page_load_time > 3000 ? 'high' : 'medium',
                    title: 'Langsame Ladezeit',
                    description: `Die Seitenladezeit beträgt ${(metrics.page_load_time / 1000).toFixed(2)}s. Empfohlen sind unter 2s.`,
                    actions: ['Bilder optimieren', 'Caching aktivieren', 'CSS/JS minimieren', 'CDN verwenden']
                });
            }

            if (metrics.database_queries && metrics.database_queries > 50) {
                recommendations.push({
                    category: 'database',
                    priority: metrics.database_queries > 100 ? 'high' : 'medium',
                    title: 'Zu viele Datenbankabfragen',
                    description: `${metrics.database_queries} Queries pro Seite. Empfohlen: unter 50`,
                    actions: ['Object Caching aktivieren', 'Queries optimieren', 'Plugin-Anzahl reduzieren']
                });
            }

            return {
                success: true,
                data: { metrics, recommendations, performance_score: metrics.performance_score }
            };
        } catch (error) {
            console.error('Error analyzing performance:', error);
            return { success: false, error: error.message };
        }
    }

    async cleanupOldMetrics() {
        try {
            const result = await query(
                `DELETE FROM performance_metrics 
                WHERE created_at < NOW() - INTERVAL '${this.metricsRetentionDays} days'`
            );
            console.log(`Cleaned up ${result.rowCount} old performance metrics`);
            return { success: true, deleted: result.rowCount };
        } catch (error) {
            console.error('Error cleaning up metrics:', error);
            return { success: false, error: error.message };
        }
    }

    async getStatistics(siteId, days = 30) {
        try {
            const result = await query(
                `SELECT 
                    COUNT(*) as total_checks,
                    AVG(page_load_time) as avg_load_time,
                    MIN(page_load_time) as min_load_time,
                    MAX(page_load_time) as max_load_time,
                    AVG(database_queries) as avg_db_queries,
                    AVG(cache_hit_ratio) as avg_cache_ratio
                FROM performance_metrics 
                WHERE site_id = $1 
                AND created_at >= NOW() - INTERVAL '${days} days'`,
                [siteId]
            );

            return { success: true, data: result.rows[0] };
        } catch (error) {
            console.error('Error getting statistics:', error);
            return { success: false, error: error.message };
        }
    }
}

module.exports = new PerformanceService();

