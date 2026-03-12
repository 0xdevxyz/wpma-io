const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { query } = require('../config/database');
const Joi = require('joi');
const { validate } = require('../middleware/validate');
const { idSchema } = require('../validators/schemas');
const axios = require('axios');

const siteIdParams = Joi.object({ siteId: idSchema });

router.use(authenticateToken);

router.get('/:siteId',
    validate(siteIdParams, 'params'),
    async (req, res) => {
        try {
            const { siteId } = req.params;

            const siteCheck = await query(
                'SELECT id FROM sites WHERE id = $1 AND user_id = $2',
                [siteId, req.user.userId]
            );

            if (siteCheck.rows.length === 0) {
                return res.status(404).json({ success: false, error: 'Site nicht gefunden' });
            }

            const result = await query(
                `SELECT name, slug, version, active, update_available, update_version as new_version, author, description, is_premium
                 FROM site_themes WHERE site_id = $1 ORDER BY active DESC, name ASC`,
                [siteId]
            );

            res.json({ success: true, data: result.rows });

        } catch (error) {
            console.error('Get themes error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
);

// Install a theme
router.post('/:siteId/install', async (req, res) => {
    try {
        const { siteId } = req.params;
        const { slug } = req.body;
        const siteResult = await query(
            'SELECT site_url, api_key FROM sites WHERE id = $1 AND user_id = $2',
            [siteId, req.user.userId]
        );
        if (siteResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Site nicht gefunden' });
        }
        const site = siteResult.rows[0];
        const wpResponse = await axios.post(
            `${site.site_url}/wp-json/wpma/v1/themes/install`,
            { slug },
            { headers: { 'X-WPMA-API-Key': site.api_key, 'User-Agent': 'WPMA-Platform/1.0' }, timeout: 30000 }
        );
        res.json({ success: true, data: wpResponse.data });
    } catch (error) {
        console.error('Install theme error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Activate a theme
router.post('/:siteId/:themeSlug/activate', async (req, res) => {
    try {
        const { siteId, themeSlug } = req.params;
        const siteResult = await query(
            'SELECT site_url, api_key FROM sites WHERE id = $1 AND user_id = $2',
            [siteId, req.user.userId]
        );
        if (siteResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Site nicht gefunden' });
        }
        const site = siteResult.rows[0];
        const wpResponse = await axios.post(
            `${site.site_url}/wp-json/wpma/v1/themes/${themeSlug}/activate`,
            {},
            { headers: { 'X-WPMA-API-Key': site.api_key, 'User-Agent': 'WPMA-Platform/1.0' }, timeout: 15000 }
        );
        res.json({ success: true, data: wpResponse.data });
    } catch (error) {
        console.error('Activate theme error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update a theme
router.put('/:siteId/:themeSlug', async (req, res) => {
    try {
        const { siteId, themeSlug } = req.params;
        const siteResult = await query(
            'SELECT site_url, api_key FROM sites WHERE id = $1 AND user_id = $2',
            [siteId, req.user.userId]
        );
        if (siteResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Site nicht gefunden' });
        }
        const site = siteResult.rows[0];
        const wpResponse = await axios.put(
            `${site.site_url}/wp-json/wpma/v1/themes/${themeSlug}/update`,
            {},
            { headers: { 'X-WPMA-API-Key': site.api_key, 'User-Agent': 'WPMA-Platform/1.0' }, timeout: 30000 }
        );
        res.json({ success: true, data: wpResponse.data });
    } catch (error) {
        console.error('Update theme error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete a theme
router.delete('/:siteId/:themeSlug', async (req, res) => {
    try {
        const { siteId, themeSlug } = req.params;
        const siteResult = await query(
            'SELECT site_url, api_key FROM sites WHERE id = $1 AND user_id = $2',
            [siteId, req.user.userId]
        );
        if (siteResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Site nicht gefunden' });
        }
        const site = siteResult.rows[0];
        const wpResponse = await axios.delete(
            `${site.site_url}/wp-json/wpma/v1/themes/${themeSlug}`,
            { headers: { 'X-WPMA-API-Key': site.api_key, 'User-Agent': 'WPMA-Platform/1.0' }, timeout: 15000 }
        );
        res.json({ success: true, data: wpResponse.data });
    } catch (error) {
        console.error('Delete theme error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
