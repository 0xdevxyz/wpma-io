'use strict';

const BackupService = require('../services/backupService');

const getUserId = (req) => req.user?.userId;

class BackupController {
    async getQuota(req, res) {
        try {
            const userId = getUserId(req);
            const result = await BackupService.getQuota(userId);
            res.json(result);
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async upgradeQuota(req, res) {
        try {
            const userId = getUserId(req);
            const result = await BackupService.upgradeQuota(userId);
            res.json(result);
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async getSchedule(req, res) {
        try {
            const { siteId } = req.params;
            const result = await BackupService.getSchedule(siteId);
            res.json(result);
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async setSchedule(req, res) {
        try {
            const { siteId } = req.params;
            const { scheduleType, backupType, hour, dayOfWeek, dayOfMonth } = req.body;
            if (!scheduleType) return res.status(400).json({ success: false, error: 'scheduleType erforderlich' });
            const result = await BackupService.setSchedule(siteId, { scheduleType, backupType, hour, dayOfWeek, dayOfMonth });
            res.json(result);
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async getBackups(req, res) {
        try {
            const { siteId } = req.params;
            const result = await BackupService.getBackups(siteId);
            res.json(result);
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async createBackup(req, res) {
        try {
            const { siteId } = req.params;
            const { backupType, provider } = req.body;
            const userId = getUserId(req);
            const result = await BackupService.createBackup(siteId, backupType, provider, userId);
            res.json(result);
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async restoreBackup(req, res) {
        try {
            const { backupId } = req.params;
            const { targetSiteId } = req.body;
            if (!targetSiteId) return res.status(400).json({ success: false, error: 'targetSiteId erforderlich' });
            const result = await BackupService.restoreBackup(backupId, targetSiteId);
            res.json(result);
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async deleteBackup(req, res) {
        try {
            const { backupId } = req.params;
            const result = await BackupService.deleteBackup(backupId);
            res.json(result);
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async getDownloadUrl(req, res) {
        try {
            const { backupId } = req.params;
            const result = await BackupService.getDownloadUrl(backupId);
            if (!result.success) return res.status(404).json(result);
            res.json(result);
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
}

module.exports = new BackupController();
