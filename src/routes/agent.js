'use strict';

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const agentService = require('../services/agentService');

const getUserId = req => req.user?.userId || req.user?.id;

// GET /api/v1/agent/tasks — alle Tasks des Users
router.get('/tasks', authenticateToken, async (req, res) => {
    try {
        const { siteId, status, limit = 50, offset = 0 } = req.query;
        const tasks = await agentService.getTasks(getUserId(req), {
            siteId: siteId ? parseInt(siteId) : undefined,
            status,
            limit: parseInt(limit),
            offset: parseInt(offset),
        });
        res.json({ success: true, data: tasks });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/v1/agent/stats — Statistiken für Dashboard
router.get('/stats', authenticateToken, async (req, res) => {
    try {
        const stats = await agentService.getStats(getUserId(req));
        res.json({ success: true, data: stats });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/v1/agent/tasks/:id — einzelner Task
router.get('/tasks/:id', authenticateToken, async (req, res) => {
    try {
        const task = await agentService.getTask(parseInt(req.params.id), getUserId(req));
        if (!task) return res.status(404).json({ success: false, error: 'Task nicht gefunden' });
        res.json({ success: true, data: task });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST /api/v1/agent/tasks/:id/approve — Task genehmigen
router.post('/tasks/:id/approve', authenticateToken, async (req, res) => {
    try {
        const log = await agentService.executeTask(parseInt(req.params.id), getUserId(req));
        res.json({ success: true, data: { execution_log: log } });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// POST /api/v1/agent/tasks/:id/reject — Task ablehnen
router.post('/tasks/:id/reject', authenticateToken, async (req, res) => {
    try {
        await agentService.rejectTask(parseInt(req.params.id), getUserId(req), req.body.reason);
        res.json({ success: true });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// POST /api/v1/agent/scan/:siteId — manuellen Scan auslösen
router.post('/scan/:siteId', authenticateToken, async (req, res) => {
    try {
        const siteId = parseInt(req.params.siteId);
        const userId = getUserId(req);
        const issues = await agentService.detectIssues(siteId);

        const created = [];
        for (const issue of issues) {
            const task = await agentService.createTask(siteId, userId, issue);
            created.push(task);
        }

        res.json({ success: true, data: { issues_found: issues.length, tasks: created } });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/v1/agent/settings — Agent-Einstellungen
router.get('/settings', authenticateToken, async (req, res) => {
    try {
        const settings = await agentService.getSettings(getUserId(req));
        res.json({ success: true, data: settings });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// PUT /api/v1/agent/settings — Agent-Einstellungen speichern
router.put('/settings', authenticateToken, async (req, res) => {
    try {
        await agentService.saveSettings(getUserId(req), req.body);
        const settings = await agentService.getSettings(getUserId(req));
        res.json({ success: true, data: settings });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST /api/v1/agent/scan-all — alle Sites des Users scannen
router.post('/scan-all', authenticateToken, async (req, res) => {
    try {
        const userId = getUserId(req);
        const { query } = require('../config/database');
        const sitesResult = await query(
            `SELECT id FROM sites WHERE user_id = $1 AND status = 'active' AND last_plugin_connection IS NOT NULL`,
            [userId]
        );
        const sites = sitesResult.rows;
        let totalIssues = 0;
        const results = [];
        for (const site of sites) {
            try {
                const issues = await agentService.detectIssues(site.id);
                for (const issue of issues) {
                    await agentService.createTask(site.id, userId, issue);
                }
                totalIssues += issues.length;
                results.push({ siteId: site.id, issues: issues.length });
            } catch (e) {
                results.push({ siteId: site.id, error: e.message });
            }
        }
        res.json({ success: true, data: { sites_scanned: sites.length, total_issues: totalIssues, results } });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
