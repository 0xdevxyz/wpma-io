const express = require('express');
const router = express.Router();
const sitesController = require('../controllers/sitesController');
const { authenticateToken } = require('../middleware/auth');
const { validate, validateMultiple, sanitize } = require('../middleware/validate');
const { sitesSchemas, paginationSchema, idSchema } = require('../validators/schemas');
const Joi = require('joi');

// Schema für siteId Parameter
const siteIdParams = Joi.object({ siteId: idSchema });

// Public routes (no authentication required)
router.post('/setup-token/exchange', sanitize, sitesController.exchangeSetupToken);
router.post('/auto-connect', sanitize, sitesController.autoConnect);

// Plugin download — no CORS restriction, direct browser navigation allowed
router.get('/plugin/download/:token', (req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    next();
}, sitesController.downloadPlugin);

// WordPress Plugin health update (controller validates API key directly)
router.put('/:siteId/health',
    validate(siteIdParams, 'params'),
    sitesController.updateSiteHealth
);

// All other routes require authentication
router.use(authenticateToken);

// Fetch site metadata from URL (accepts domain with or without protocol)
router.post('/fetch-metadata',
    sanitize,
    validate(Joi.object({
        url: Joi.string().min(3).max(255).required()
            .pattern(/^(https?:\/\/)?[a-zA-Z0-9][a-zA-Z0-9-_.]*\.[a-zA-Z]{2,}/)
            .message('Bitte geben Sie eine gültige Domain ein')
    })),
    sitesController.fetchSiteMetadata
);

// Site management
router.get('/',
    validate(paginationSchema, 'query'),
    sitesController.getSites
);

router.post('/',
    sanitize,
    validate(sitesSchemas.create),
    sitesController.createSite
);

router.get('/:siteId',
    validate(siteIdParams, 'params'),
    sitesController.getSite
);

router.post('/:siteId/health-check',
    validate(siteIdParams, 'params'),
    sitesController.runHealthCheck
);

router.get('/:siteId/screenshot',
    validate(siteIdParams, 'params'),
    sitesController.getScreenshot
);

router.delete('/:siteId',
    validate(siteIdParams, 'params'),
    sitesController.deleteSite
);

// Setup token management
router.post('/:siteId/setup-token/regenerate',
    validate(siteIdParams, 'params'),
    sitesController.regenerateSetupToken
);

// Verify plugin installation on a site (pull-based, no WP auth needed)
router.post('/:siteId/verify-plugin',
    validate(siteIdParams, 'params'),
    sitesController.verifyPlugin
);

module.exports = router; 