const express = require('express');
const router = express.Router();
const axios = require('axios');
const { authenticateToken, authenticateWordPressAPI } = require('../middleware/auth');
const { validate, validateMultiple, sanitize } = require('../middleware/validate');
const { performanceSchemas, idSchema } = require('../validators/schemas');
const Joi = require('joi');
const performanceController = require('../controllers/performanceController');
const { query } = require('../config/database');

// Schema für siteId Parameter
const siteIdParams = Joi.object({ siteId: idSchema });

// Public endpoint for WordPress Plugin (API-Key Auth)
router.post('/:siteId/metrics',
    sanitize,
    validateMultiple({
        params: siteIdParams,
        body: performanceSchemas.metrics
    }),
    authenticateWordPressAPI,
    performanceController.saveMetrics
);

// Authenticated routes
router.use(authenticateToken);

router.get('/:siteId/metrics',
    validateMultiple({
        params: siteIdParams,
        query: performanceSchemas.query
    }),
    performanceController.getMetrics
);

router.get('/:siteId/history',
    validateMultiple({
        params: siteIdParams,
        query: performanceSchemas.query
    }),
    performanceController.getHistory
);

router.post('/:siteId/analyze',
    validate(siteIdParams, 'params'),
    performanceController.analyze
);

router.get('/:siteId/recommendations',
    validate(siteIdParams, 'params'),
    performanceController.getRecommendations
);

router.get('/:siteId/statistics',
    validateMultiple({
        params: siteIdParams,
        query: performanceSchemas.query
    }),
    performanceController.getStatistics
);

// ─── Lighthouse / PageSpeed Insights ─────────────────────────────────────────

/**
 * POST /api/v1/performance/:siteId/lighthouse
 * Ruft Google PageSpeed Insights API auf und speichert Ergebnis
 */
router.post('/:siteId/lighthouse', authenticateToken, async (req, res) => {
    try {
        const { siteId } = req.params;
        const userId = req.user?.userId || req.user?.id;

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

        // Mobile + Desktop parallel
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
                fid: audits['total-blocking-time']?.numericValue || null,  // TBT as FID proxy
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

        // Speichere in DB
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
});

/**
 * GET /api/v1/performance/:siteId/lighthouse
 * Letztes Ergebnis + History (letzten 30 Tage)
 */
router.get('/:siteId/lighthouse', authenticateToken, async (req, res) => {
    try {
        const { siteId } = req.params;
        const userId = req.user?.userId || req.user?.id;

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
});

module.exports = router; 