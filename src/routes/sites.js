const express = require('express');
const router = express.Router();
const sitesController = require('../controllers/sitesController');
const { authenticateToken } = require('../middleware/auth');

// Public routes (no authentication required)
router.post('/setup-token/exchange', sitesController.exchangeSetupToken);
router.get('/plugin/download/:token', sitesController.downloadPlugin);

// All other routes require authentication
router.use(authenticateToken);

// Fetch site metadata from URL
router.post('/fetch-metadata', sitesController.fetchSiteMetadata);

// Site management
router.get('/', sitesController.getSites);
router.post('/', sitesController.createSite);
router.get('/:siteId', sitesController.getSite);
router.put('/:siteId/health', sitesController.updateSiteHealth);
router.post('/:siteId/health-check', sitesController.runHealthCheck);
router.delete('/:siteId', sitesController.deleteSite);

// Setup token management
router.post('/:siteId/setup-token/regenerate', sitesController.regenerateSetupToken);

module.exports = router; 