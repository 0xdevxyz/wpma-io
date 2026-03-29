const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const Joi = require('joi');
const { validate } = require('../middleware/validate');
const { idSchema } = require('../validators/schemas');
const themesController = require('../controllers/themesController');

const siteIdParams = Joi.object({ siteId: idSchema });

router.use(authenticateToken);

router.get('/:siteId', validate(siteIdParams, 'params'), themesController.getThemes.bind(themesController));
router.post('/:siteId/install', themesController.installTheme.bind(themesController));
router.post('/:siteId/:themeSlug/activate', themesController.activateTheme.bind(themesController));
router.put('/:siteId/:themeSlug', themesController.updateTheme.bind(themesController));
router.delete('/:siteId/:themeSlug', themesController.deleteTheme.bind(themesController));

module.exports = router;
