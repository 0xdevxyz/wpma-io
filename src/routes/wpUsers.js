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
            const siteResult = await query(
                'SELECT site_url, api_key FROM sites WHERE id = $1 AND user_id = $2',
                [siteId, req.user.userId]
            );

            if (siteResult.rows.length === 0) {
                return res.status(404).json({ success: false, error: 'Site nicht gefunden' });
            }

            const site = siteResult.rows[0];
            const wpResponse = await axios.get(
                `${site.site_url}/wp-json/wpma/v1/users`,
                { headers: { 'X-WPMA-API-Key': site.api_key, 'User-Agent': 'WPMA-Platform/1.0' }, timeout: 10000 }
            );

            res.json({ success: true, data: wpResponse.data });
        } catch (error) {
            console.error('Get users error:', error);
            if (error.code === 'ECONNREFUSED' || error.response?.status === 404) {
                return res.status(503).json({ success: false, error: 'WordPress-Site nicht erreichbar' });
            }
            res.status(500).json({ success: false, error: error.message });
        }
    }
);

module.exports = router;
