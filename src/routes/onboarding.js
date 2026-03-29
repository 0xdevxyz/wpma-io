'use strict';

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const onboardingController = require('../controllers/onboardingController');

router.use(authenticateToken);

router.get('/:siteId', onboardingController.getStatus.bind(onboardingController));
router.post('/:siteId/retry', onboardingController.retryFlow.bind(onboardingController));
router.post('/:siteId/license', onboardingController.submitLicense.bind(onboardingController));
router.post('/:siteId/license/skip', onboardingController.skipLicense.bind(onboardingController));

module.exports = router;
