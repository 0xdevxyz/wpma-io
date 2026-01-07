const express = require('express');
const router = express.Router();
const { authenticateToken, authenticateWordPressAPI } = require('../middleware/auth');
const { validate, validateMultiple, sanitize } = require('../middleware/validate');
const { performanceSchemas, idSchema } = require('../validators/schemas');
const Joi = require('joi');
const performanceController = require('../controllers/performanceController');

// Schema für siteId Parameter
const siteIdParams = Joi.object({ siteId: idSchema });

// Public endpoint for WordPress Plugin (API-Key Auth)
router.post('/:siteId/metrics',
    sanitize,
    validateMultiple({
        params: siteIdParams,
        body: performanceSchemas.metrics
    }),
    authenticateWordPressAPI,
    performanceController.saveMetrics
);

// Authenticated routes
router.use(authenticateToken);

router.get('/:siteId/metrics',
    validateMultiple({
        params: siteIdParams,
        query: performanceSchemas.query
    }),
    performanceController.getMetrics
);

router.get('/:siteId/history',
    validateMultiple({
        params: siteIdParams,
        query: performanceSchemas.query
    }),
    performanceController.getHistory
);

router.post('/:siteId/analyze',
    validate(siteIdParams, 'params'),
    performanceController.analyze
);

router.get('/:siteId/recommendations',
    validate(siteIdParams, 'params'),
    performanceController.getRecommendations
);

router.get('/:siteId/statistics',
    validateMultiple({
        params: siteIdParams,
        query: performanceSchemas.query
    }),
    performanceController.getStatistics
);

module.exports = router; 