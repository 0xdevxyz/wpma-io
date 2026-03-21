'use strict';

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const revenueService = require('../services/revenueService');

const getUserId = req => req.user?.userId || req.user?.id;

// POST /api/v1/revenue/:siteId/snapshot — WP-Plugin sendet WooCommerce-Snapshot
// Öffentlich mit API-Key (kein JWT nötig, da vom WP-Server gesendet)
router.post('/:siteId/snapshot', async (req, res) => {
    try {
        const { query } = require('../config/database');
        const siteId = parseInt(req.params.siteId);
        const apiKey = req.headers['x-api-key'] || req.body.api_key;

        const siteCheck = await query(
            `SELECT id FROM sites WHERE id = $1 AND api_key = $2 AND status = 'active'`,
            [siteId, apiKey]
        );
        if (!siteCheck.rows.length) {
            return res.status(401).json({ success: false, error: 'Ungültiger API-Key' });
        }

        const snapshot = await revenueService.saveSnapshot(siteId, req.body);
        res.json({ success: true, data: snapshot });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST /api/v1/revenue/:siteId/event — einzelnes WooCommerce-Event
router.post('/:siteId/event', async (req, res) => {
    try {
        const { query } = require('../config/database');
        const siteId = parseInt(req.params.siteId);
        const apiKey = req.headers['x-api-key'] || req.body.api_key;

        const siteCheck = await query(
            `SELECT id FROM sites WHERE id = $1 AND api_key = $2 AND status = 'active'`,
            [siteId, apiKey]
        );
        if (!siteCheck.rows.length) {
            return res.status(401).json({ success: false, error: 'Ungültiger API-Key' });
        }

        await revenueService.recordEvent(siteId, req.body.event_type, req.body.amount, req.body.metadata);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/v1/revenue/:siteId/summary — Revenue Summary für Dashboard
router.get('/:siteId/summary', authenticateToken, async (req, res) => {
    try {
        const siteId = parseInt(req.params.siteId);
        const days = parseInt(req.query.days) || 30;
        const summary = await revenueService.getSummary(siteId, days);
        res.json({ success: true, data: summary });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/v1/revenue/:siteId/correlations — Korrelationen (Revenue-Impact-Events)
router.get('/:siteId/correlations', authenticateToken, async (req, res) => {
    try {
        const siteId = parseInt(req.params.siteId);
        const correlations = await revenueService.getCorrelations(siteId);
        res.json({ success: true, data: correlations });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/v1/revenue/:siteId/impact — kurzer Revenue-Impact (für USP-Widget)
router.get('/:siteId/impact', authenticateToken, async (req, res) => {
    try {
        const siteId = parseInt(req.params.siteId);
        const impact = await revenueService.getRevenueImpact(siteId);
        res.json({ success: true, data: impact });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST /api/v1/revenue/:siteId/correlations/:corrId/resolve — als gelöst markieren
router.post('/:siteId/correlations/:corrId/resolve', authenticateToken, async (req, res) => {
    try {
        await revenueService.markCorrelationResolved(
            parseInt(req.params.corrId),
            parseInt(req.params.siteId),
            req.body.action
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST /api/v1/revenue/:siteId/analyze — manuelle Korrelations-Analyse auslösen
router.post('/:siteId/analyze', authenticateToken, async (req, res) => {
    try {
        const siteId = parseInt(req.params.siteId);
        await revenueService.detectCorrelations(siteId);
        const correlations = await revenueService.getCorrelations(siteId, 5);
        res.json({ success: true, data: { correlations } });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
