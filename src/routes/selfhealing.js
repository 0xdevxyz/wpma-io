/**
 * Self-Healing API Routes
 */

const express = require('express');
const router = express.Router();
const { authenticateToken: auth, authenticateWordPressAPI } = require('../middleware/auth');
const selfHealingService = require('../services/selfHealingService');

/**
 * POST /api/v1/selfhealing/analyze
 * Analysiert ein Problem und gibt möglichen Fix zurück
 */
router.post('/analyze', auth, async (req, res) => {
    try {
        const { siteId, error, context, logs } = req.body;

        if (!siteId || !error) {
            return res.status(400).json({
                success: false,
                error: 'siteId und error sind erforderlich'
            });
        }

        const result = await selfHealingService.analyzeProblem(siteId, {
            error,
            context,
            logs
        });

        res.json(result);

    } catch (error) {
        console.error('Analyze problem error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/v1/selfhealing/apply
 * Wendet einen Fix an
 */
router.post('/apply', auth, async (req, res) => {
    try {
        const { siteId, fixId, autoApply, createSnapshot } = req.body;

        if (!siteId || !fixId) {
            return res.status(400).json({
                success: false,
                error: 'siteId und fixId sind erforderlich'
            });
        }

        const result = await selfHealingService.applyFix(
            siteId,
            req.user.userId,
            fixId,
            { autoApply, createSnapshot }
        );

        res.json(result);

    } catch (error) {
        console.error('Apply fix error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/v1/selfhealing/auto
 * Webhook vom WordPress-Plugin bei automatischer Fehler-Erkennung
 */
router.post('/auto', authenticateWordPressAPI, async (req, res) => {
    try {
        const { siteId, error, context, logs } = req.body;

        if (!siteId || !error) {
            return res.status(400).json({
                success: false,
                error: 'siteId und error sind erforderlich'
            });
        }

        const result = await selfHealingService.autoHeal(siteId, {
            error,
            context,
            logs
        });

        res.json(result);

    } catch (error) {
        console.error('Auto heal error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/v1/selfhealing/history/:siteId
 * Holt Self-Healing Historie
 */
router.get('/history/:siteId', auth, async (req, res) => {
    try {
        const { siteId } = req.params;

        // TODO: Implementiere History-Abruf
        res.json({
            success: true,
            data: []
        });

    } catch (error) {
        console.error('Get healing history error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
