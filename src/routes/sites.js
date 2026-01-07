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
router.get('/plugin/download/:token', sitesController.downloadPlugin);

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

router.put('/:siteId/health',
    validateMultiple({
        params: siteIdParams,
        body: Joi.object({
            health_score: Joi.number().min(0).max(100).required()
        })
    }),
    sitesController.updateSiteHealth
);

router.post('/:siteId/health-check',
    validate(siteIdParams, 'params'),
    sitesController.runHealthCheck
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

module.exports = router; 