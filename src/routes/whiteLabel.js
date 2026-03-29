const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const whiteLabelController = require('../controllers/whiteLabelController');

router.use(authenticateToken);

router.get('/config', whiteLabelController.getWhiteLabelConfig.bind(whiteLabelController));
router.post('/config', whiteLabelController.saveWhiteLabelConfig.bind(whiteLabelController));
router.post('/domain/verify-token', whiteLabelController.generateDomainVerificationToken.bind(whiteLabelController));
router.post('/domain/verify', whiteLabelController.verifyCustomDomain.bind(whiteLabelController));
router.get('/css', whiteLabelController.getCustomCss.bind(whiteLabelController));
router.post('/preview-email', whiteLabelController.previewEmail.bind(whiteLabelController));
router.get('/public/config/:domain', whiteLabelController.getPublicConfig.bind(whiteLabelController));

module.exports = router;
