'use strict';

const agentService = require('../services/agentService');
const { query } = require('../config/database');

const getUserId = req => req.user?.userId;

class AgentController {
    async getTasks(req, res) {
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
    }

    async getStats(req, res) {
        try {
            const stats = await agentService.getStats(getUserId(req));
            res.json({ success: true, data: stats });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    }

    async getTask(req, res) {
        try {
            const task = await agentService.getTask(parseInt(req.params.id), getUserId(req));
            if (!task) return res.status(404).json({ success: false, error: 'Task nicht gefunden' });
            res.json({ success: true, data: task });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    }

    async approveTask(req, res) {
        try {
            const log = await agentService.executeTask(parseInt(req.params.id), getUserId(req));
            res.json({ success: true, data: { execution_log: log } });
        } catch (err) {
            res.status(400).json({ success: false, error: err.message });
        }
    }

    async rejectTask(req, res) {
        try {
            await agentService.rejectTask(parseInt(req.params.id), getUserId(req), req.body.reason);
            res.json({ success: true });
        } catch (err) {
            res.status(400).json({ success: false, error: err.message });
        }
    }

    async scanSite(req, res) {
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
    }

    async getSettings(req, res) {
        try {
            const settings = await agentService.getSettings(getUserId(req));
            res.json({ success: true, data: settings });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    }

    async saveSettings(req, res) {
        try {
            await agentService.saveSettings(getUserId(req), req.body);
            const settings = await agentService.getSettings(getUserId(req));
            res.json({ success: true, data: settings });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    }

    async setManualMode(req, res) {
        try {
            const { active } = req.body;
            if (typeof active !== 'boolean') {
                return res.status(400).json({ success: false, error: 'active muss ein Boolean sein' });
            }
            const settings = await agentService.setManualMode(getUserId(req), active);
            res.json({ success: true, data: settings });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    }

    async scanAllSites(req, res) {
        try {
            const userId = getUserId(req);

            // Block scan if manual mode is active
            const settings = await agentService.getSettings(userId);
            if (settings.manual_mode) {
                return res.status(403).json({
                    success: false,
                    error: 'Agent ist im manuellen Modus pausiert. Bitte erst reaktivieren.',
                    manual_mode: true,
                });
            }

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
    }
}

module.exports = new AgentController();
