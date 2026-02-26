const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const paymentController = require('../controllers/paymentController');

/**
 * POST /api/payment/auth
 * Body: { client_id, client_secret }
 */
const validateAuth = [
	body('client_id').isString().notEmpty().withMessage('client_id is required'),
	body('client_secret').isString().notEmpty().withMessage('client_secret is required'),
	(req, res, next) => {
		const errors = validationResult(req);
		if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
		next();
	}
];

router.post('/auth', validateAuth, paymentController.authorize);

module.exports = router;
