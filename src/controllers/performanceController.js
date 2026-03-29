const performanceService = require('../services/performanceService');
const { query } = require('../config/database');
const axios = require('axios');

class PerformanceController {
    async getMetrics(req, res) {
        try {
            const { siteId } = req.params;
            const userId = req.user?.userId;
            
            const siteCheck = await query(
                'SELECT id FROM sites WHERE id = $1 AND user_id = $2',
                [siteId, userId]
            );

            if (siteCheck.rows.length === 0) {
                return res.status(404).json({ success: false, error: 'Site nicht gefunden' });
            }

            const result = await performanceService.getCurrentMetrics(siteId);
            if (!result.success) return res.status(404).json(result);
            res.json(result);
        } catch (error) {
            console.error('Error in getMetrics:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async getHistory(req, res) {
        try {
            const { siteId } = req.params;
            const userId = req.user?.userId;
            const days = parseInt(req.query.days) || 7;
            
            const siteCheck = await query(
                'SELECT id FROM sites WHERE id = $1 AND user_id = $2',
                [siteId, userId]
            );

            if (siteCheck.rows.length === 0) {
                return res.status(404).json({ success: false, error: 'Site nicht gefunden' });
            }

            const result = await performanceService.getMetricsHistory(siteId, days);
            res.json(result);
        } catch (error) {
            console.error('Error in getHistory:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async analyze(req, res) {
        try {
            const { siteId } = req.params;
            const userId = req.user?.userId;
            
            const siteCheck = await query(
                'SELECT id FROM sites WHERE id = $1 AND user_id = $2',
                [siteId, userId]
            );

            if (siteCheck.rows.length === 0) {
                return res.status(404).json({ success: false, error: 'Site nicht gefunden' });
            }

            const result = await performanceService.analyzePerformance(siteId);
            res.json(result);
        } catch (error) {
            console.error('Error in analyze:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async getRecommendations(req, res) {
        try {
            const { siteId } = req.params;
            const userId = req.user?.userId;
            
            const siteCheck = await query(
                'SELECT id FROM sites WHERE id = $1 AND user_id = $2',
                [siteId, userId]
            );

            if (siteCheck.rows.length === 0) {
                return res.status(404).json({ success: false, error: 'Site nicht gefunden' });
            }

            const result = await performanceService.analyzePerformance(siteId);
            if (!result.success) return res.status(404).json(result);

            res.json({
                success: true,
                data: {
                    recommendations: result.data.recommendations,
                    performance_score: result.data.performance_score
                }
            });
        } catch (error) {
            console.error('Error in getRecommendations:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async getStatistics(req, res) {
        try {
            const { siteId } = req.params;
            const userId = req.user?.userId;
            const days = parseInt(req.query.days) || 30;
            
            const siteCheck = await query(
                'SELECT id FROM sites WHERE id = $1 AND user_id = $2',
                [siteId, userId]
            );

            if (siteCheck.rows.length === 0) {
                return res.status(404).json({ success: false, error: 'Site nicht gefunden' });
            }

            const result = await performanceService.getStatistics(siteId, days);
            res.json(result);
        } catch (error) {
            console.error('Error in getStatistics:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async saveMetrics(req, res) {
        try {
            const { siteId } = req.params;
            const metrics = req.body;
            const siteCheck = await query('SELECT id, user_id FROM sites WHERE id = $1', [siteId]);

            if (siteCheck.rows.length === 0) {
                return res.status(404).json({ success: false, error: 'Site nicht gefunden' });
            }

            const result = await performanceService.saveMetrics(siteId, metrics);
            
            if (result.success && req.io) {
                const site = siteCheck.rows[0];
                req.io.to(`user_${site.user_id}`).emit('performance_update', {
                    siteId: siteId,
                    metrics: result.data
                });
            }

            res.json(result);
        } catch (error) {
            console.error('Error in saveMetrics:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async runLighthouse(req, res) {
        try {
            const { siteId } = req.params;
            const userId = req.user?.userId;

            const siteResult = await query(
                'SELECT id, site_url, domain FROM sites WHERE id = $1 AND user_id = $2',
                [siteId, userId]
            );
            if (!siteResult.rows.length) {
                return res.status(404).json({ success: false, error: 'Site nicht gefunden' });
            }
            const site = siteResult.rows[0];
            const url = site.site_url || `https://${site.domain}`;

            const apiKey = process.env.PAGESPEED_API_KEY || '';
            const baseUrl = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';

            async function fetchScore(strategy) {
                const params = { url, strategy, fields: 'lighthouseResult.categories,lighthouseResult.audits' };
                if (apiKey) params.key = apiKey;
                const r = await axios.get(baseUrl, { params, timeout: 60000 });
                return r.data;
            }

            let mobile, desktop;
            try {
                [mobile, desktop] = await Promise.all([fetchScore('mobile'), fetchScore('desktop')]);
            } catch (e) {
                return res.status(502).json({ success: false, error: `PageSpeed API Fehler: ${e.message}` });
            }

            function parseResult(data) {
                const cats = data?.lighthouseResult?.categories || {};
                const audits = data?.lighthouseResult?.audits || {};
                return {
                    score: Math.round((cats.performance?.score || 0) * 100),
                    lcp: audits['largest-contentful-paint']?.numericValue || null,
                    cls: audits['cumulative-layout-shift']?.numericValue || null,
                    fid: audits['total-blocking-time']?.numericValue || null,
                    fcp: audits['first-contentful-paint']?.numericValue || null,
                    ttfb: audits['server-response-time']?.numericValue || null,
                    load_time: audits['interactive']?.numericValue || null,
                    opportunities: Object.values(audits)
                        .filter(a => a.score !== null && a.score < 0.9 && a.details?.type === 'opportunity')
                        .slice(0, 5)
                        .map(a => ({ id: a.id, title: a.title, savings: a.details?.overallSavingsMs || 0 })),
                };
            }

            const mob = parseResult(mobile);
            const desk = parseResult(desktop);

            const saved = await query(
                `INSERT INTO performance_metrics
                    (site_id, load_time, ttfb, fcp, lcp, cls, fid,
                     page_speed_score, mobile_score, desktop_score, raw_data)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
                 RETURNING id, measured_at`,
                [
                    siteId,
                    mob.load_time,
                    mob.ttfb,
                    mob.fcp,
                    mob.lcp,
                    mob.cls,
                    mob.fid,
                    mob.score,
                    mob.score,
                    desk.score,
                    JSON.stringify({ mobile: mob, desktop: desk }),
                ]
            );

            res.json({
                success: true,
                data: {
                    id: saved.rows[0].id,
                    measuredAt: saved.rows[0].measured_at,
                    mobile: mob,
                    desktop: desk,
                    url,
                }
            });
        } catch (error) {
            console.error('Lighthouse error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async getLighthouse(req, res) {
        try {
            const { siteId } = req.params;
            const userId = req.user?.userId;

            const siteCheck = await query('SELECT id FROM sites WHERE id = $1 AND user_id = $2', [siteId, userId]);
            if (!siteCheck.rows.length) return res.status(404).json({ success: false, error: 'Site nicht gefunden' });

            const latest = await query(
                `SELECT * FROM performance_metrics WHERE site_id = $1 ORDER BY measured_at DESC LIMIT 1`,
                [siteId]
            );

            const history = await query(
                `SELECT id, mobile_score, desktop_score, page_speed_score, lcp, cls, fid, fcp, ttfb, load_time, measured_at
                 FROM performance_metrics
                 WHERE site_id = $1 AND measured_at > NOW() - INTERVAL '30 days'
                 ORDER BY measured_at ASC`,
                [siteId]
            );

            res.json({
                success: true,
                data: {
                    latest: latest.rows[0] || null,
                    history: history.rows,
                }
            });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
}

module.exports = new PerformanceController();

