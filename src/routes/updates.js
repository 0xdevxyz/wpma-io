const express = require('express');
const router = express.Router();
const { authenticateToken, authenticateWordPressAPI } = require('../middleware/auth');
const { query } = require('../config/database');
const AutoUpdateService = require('../services/autoUpdateService');

// Hilfsfunktion für Site-Zugriffsprüfung
async function checkSiteAccess(siteId, userId) {
    const result = await query(
        'SELECT id FROM sites WHERE id = $1 AND user_id = $2',
        [siteId, userId]
    );
    return result.rows.length > 0;
}

// ==========================================
// WORDPRESS PLUGIN ENDPOINTS (API-Key Auth)
// ==========================================

// Plugin sendet verfügbare Updates
router.post('/:siteId/available', authenticateWordPressAPI, async (req, res) => {
    try {
        const { siteId } = req.params;
        const updateData = req.body;

        // Speichere Update-Daten
        await query(
            `INSERT INTO site_updates (site_id, update_data) VALUES ($1, $2)`,
            [siteId, JSON.stringify(updateData)]
        );

        res.json({ success: true, message: 'Update-Daten empfangen' });
    } catch (error) {
        console.error('Save updates error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==========================================
// DASHBOARD ENDPOINTS (JWT Auth)
// ==========================================

router.use(authenticateToken);

// Verfügbare Updates abrufen
router.get('/:siteId/check', async (req, res) => {
    try {
        const { siteId } = req.params;
        const userId = req.user?.userId || req.user?.id;

        if (!await checkSiteAccess(siteId, userId)) {
            return res.status(404).json({ success: false, error: 'Site nicht gefunden' });
        }

        const result = await AutoUpdateService.checkForUpdates(siteId);
        res.json(result);
    } catch (error) {
        console.error('Check updates error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Auto-Update durchführen
router.post('/:siteId/auto-update', async (req, res) => {
    try {
        const { siteId } = req.params;
        const { forceUpdate, updateTypes } = req.body;
        const userId = req.user?.userId || req.user?.id;

        if (!await checkSiteAccess(siteId, userId)) {
            return res.status(404).json({ success: false, error: 'Site nicht gefunden' });
        }

        const result = await AutoUpdateService.performAutoUpdate(siteId, {
            forceUpdate,
            updateTypes
        });
        res.json(result);
    } catch (error) {
        console.error('Auto update error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Auto-Update Einstellungen abrufen
router.get('/:siteId/settings', async (req, res) => {
    try {
        const { siteId } = req.params;
        const userId = req.user?.userId || req.user?.id;

        if (!await checkSiteAccess(siteId, userId)) {
            return res.status(404).json({ success: false, error: 'Site nicht gefunden' });
        }

        const result = await AutoUpdateService.getAutoUpdateSettings(siteId);
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Auto-Update Einstellungen speichern
router.put('/:siteId/settings', async (req, res) => {
    try {
        const { siteId } = req.params;
        const settings = req.body;
        const userId = req.user?.userId || req.user?.id;

        if (!await checkSiteAccess(siteId, userId)) {
            return res.status(404).json({ success: false, error: 'Site nicht gefunden' });
        }

        const result = await AutoUpdateService.setAutoUpdateSettings(siteId, settings);
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update-History abrufen
router.get('/:siteId/history', async (req, res) => {
    try {
        const { siteId } = req.params;
        const userId = req.user?.userId || req.user?.id;
        const limit = parseInt(req.query.limit) || 20;

        if (!await checkSiteAccess(siteId, userId)) {
            return res.status(404).json({ success: false, error: 'Site nicht gefunden' });
        }

        const result = await query(
            `SELECT * FROM update_logs WHERE site_id = $1 
             ORDER BY created_at DESC LIMIT $2`,
            [siteId, limit]
        );

        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;

