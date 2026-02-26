
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const paymentController = require('../controllers/paymentController');

/**
 * @swagger
 * /api/payment/event:
 *   get:
 *     summary: Get transaction event from Paypack
 *     description: Queries Paypack for transaction event details using ref, kind, client, and status. Credentials are loaded from environment.
 *     tags:
 *       - Payment
 *     parameters:
 *       - in: query
 *         name: ref
 *         required: true
 *         schema:
 *           type: string
 *         description: Transaction reference
 *       - in: query
 *         name: kind
 *         required: true
 *         schema:
 *           type: string
 *         description: Transaction kind (e.g. CASHIN)
 *       - in: query
 *         name: client
 *         required: true
 *         schema:
 *           type: string
 *         description: Client phone number
 *       - in: query
 *         name: status
 *         required: true
 *         schema:
 *           type: string
 *         description: Transaction status (e.g. pending)
 *     responses:
 *       200:
 *         description: Transaction event details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       400:
 *         description: Bad request
 *       502:
 *         description: Bad response from payment provider
 */
router.get('/event', paymentController.getTransactionEvent);

/**
 * @swagger
 * /api/payment/initiate:
 *   post:
 *     summary: Initiate a payment (cashin)
 *     description: Initiates a payment using Paypack API. Only amount and number are required; credentials are loaded from environment.
 *     tags:
 *       - Payment
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               amount:
 *                 type: number
 *                 example: 100
 *               number:
 *                 type: string
 *                 example: '078xxxxxxx'
 *     responses:
 *       200:
 *         description: Payment initiated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 amount:
 *                   type: number
 *                 created_at:
 *                   type: string
 *                 kind:
 *                   type: string
 *                 ref:
 *                   type: string
 *                 status:
 *                   type: string
 *       400:
 *         description: Bad request
 *       502:
 *         description: Bad response from payment provider
 */
router.post('/initiate', paymentController.initiatePayment);

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
