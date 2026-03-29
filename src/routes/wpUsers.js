const express = require('express');
const router = express.Router();
const wpUsersController = require('../controllers/wpUsersController');
const { authenticateToken } = require('../middleware/auth');
const Joi = require('joi');
const { validate } = require('../middleware/validate');
const { idSchema } = require('../validators/schemas');

const siteIdParams = Joi.object({ siteId: idSchema });

router.use(authenticateToken);

router.get('/:siteId',
    validate(siteIdParams, 'params'),
    wpUsersController.getUsers.bind(wpUsersController)
);

module.exports = router;
