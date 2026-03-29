const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const Joi = require('joi');
const { validate } = require('../middleware/validate');
const { idSchema } = require('../validators/schemas');
const pluginsController = require('../controllers/pluginsController');

const siteIdParams = Joi.object({ siteId: idSchema });

router.use(authenticateToken);

router.get('/:siteId',
    validate(siteIdParams, 'params'),
    (req, res) => pluginsController.getPlugins(req, res)
);

router.post('/:siteId/install',
    validate(siteIdParams, 'params'),
    validate(Joi.object({
        slug: Joi.string().required(),
        activate: Joi.boolean().default(false)
    })),
    (req, res) => pluginsController.installPlugin(req, res)
);

router.put('/:siteId/:pluginSlug',
    validate(siteIdParams, 'params'),
    (req, res) => pluginsController.updatePlugin(req, res)
);

router.post('/:siteId/:pluginSlug/toggle',
    validate(siteIdParams, 'params'),
    validate(Joi.object({
        active: Joi.boolean().required()
    })),
    (req, res) => pluginsController.togglePlugin(req, res)
);

router.delete('/:siteId/:pluginSlug',
    validate(siteIdParams, 'params'),
    (req, res) => pluginsController.deletePlugin(req, res)
);

module.exports = router;
