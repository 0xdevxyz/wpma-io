'use strict';

const { query } = require('../config/database');
const revenueService = require('../services/revenueService');

class RevenueController {
    async saveSnapshot(req, res) {
        try {
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
    }

    async recordEvent(req, res) {
        try {
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
    }

    async getSummary(req, res) {
        try {
            const siteId = parseInt(req.params.siteId);
            const days = parseInt(req.query.days) || 30;
            const summary = await revenueService.getSummary(siteId, days);
            res.json({ success: true, data: summary });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    }

    async getCorrelations(req, res) {
        try {
            const siteId = parseInt(req.params.siteId);
            const correlations = await revenueService.getCorrelations(siteId);
            res.json({ success: true, data: correlations });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    }

    async getRevenueImpact(req, res) {
        try {
            const siteId = parseInt(req.params.siteId);
            const impact = await revenueService.getRevenueImpact(siteId);
            res.json({ success: true, data: impact });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    }

    async resolveCorrelation(req, res) {
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
    }

    async analyzeCorrelations(req, res) {
        try {
            const siteId = parseInt(req.params.siteId);
            await revenueService.detectCorrelations(siteId);
            const correlations = await revenueService.getCorrelations(siteId, 5);
            res.json({ success: true, data: { correlations } });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    }
}

module.exports = new RevenueController();
