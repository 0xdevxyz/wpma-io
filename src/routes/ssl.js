const express = require('express');
const router = express.Router();
const sslController = require('../controllers/sslController');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

router.get('/', sslController.getAll.bind(sslController));
router.get('/:siteId', sslController.getSite.bind(sslController));
router.post('/:siteId/check', sslController.checkSite.bind(sslController));
router.post('/check-all', sslController.checkAll.bind(sslController));

module.exports = router;
