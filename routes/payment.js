
const express = require('express');
const router = express.Router();
const { body, validationResult, param } = require('express-validator');
const paymentController = require('../controllers/paymentController');
const requireAdmin = require('../middlewares/requireAdmin');

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
 *               patient_id:
 *                 type: string
 *                 example: 'patient_12345'
 *               appointment_id:
 *                 type: string
 *                 example: 'appt_98765'
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
const validateInitiate = [
	body('amount').isNumeric().withMessage('amount must be a number'),
	body('number').isString().notEmpty().withMessage('number is required'),
	body('patient_id').optional().isString().withMessage('patient_id must be a string'),
	(req, res, next) => {
		const errors = validationResult(req);
		if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
		next();
	}
];

router.post('/initiate', validateInitiate, paymentController.initiatePayment);

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

/**
 * @swagger
 * /api/payment/{id}/status:
 *   put:
 *     summary: Update payment status
 *     description: Update the status of a payment record and optionally set the provider reference.
 *     tags:
 *       - Payment
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Payment record ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 example: completed
 *               provider_ref:
 *                 type: string
 *                 example: PAYPACK_REF_ABC
 *     responses:
 *       200:
 *         description: Updated payment object
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       400:
 *         description: Bad request
 *       404:
 *         description: Payment not found
 *       500:
 *         description: Server error
 */
const validateStatus = [
	param('id').notEmpty().withMessage('id is required'),
	body('status').isString().notEmpty().withMessage('status is required'),
	body('provider_ref').optional().isString().withMessage('provider_ref must be a string'),
	(req, res, next) => {
		const errors = validationResult(req);
		if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
		next();
	}
];

router.put('/:id/status', validateStatus, paymentController.updatePaymentStatus);

/**
 * GET /api/payments/:id
 * Debug endpoint to fetch payment by id
 */
router.get('/:id', async (req, res) => {
	try {
		const { id } = req.params || {};
		if (!id) return res.status(400).json({ error: 'id is required' });
		const result = await require('../config/db').query('SELECT * FROM payments WHERE id = $1', [id]);
		if (result.rowCount === 0) return res.status(404).json({ error: 'Payment not found' });
		res.json(result.rows[0]);
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

/**
 * GET /api/payments
 * Admin: list payments with optional filters
 */
// NOTE: Admin payments listing endpoint removed.

/**
 * @swagger
 * /api/payments/{paymentId}/approve:
 *   patch:
 *     summary: Approve a payment (admin only)
 *     description: Set payment.status='approved', update related appointment.payment_status, record admin_id and timestamp.
 *     tags:
 *       - Payment
 *     parameters:
 *       - in: path
 *         name: paymentId
 *         required: true
 *         schema:
 *           type: string
 *         description: Payment ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               admin_id:
 *                 type: string
 *               note:
 *                 type: string
 *             required:
 *               - admin_id
 *     responses:
 *       200:
 *         description: Approval result
 *       400:
 *         description: Bad request
 *       404:
 *         description: Payment not found
 *       500:
 *         description: Server error
 */
const validateApprove = [
	param('paymentId').notEmpty().withMessage('paymentId is required'),
	body('note').optional().isString().withMessage('note must be a string'),
	(req, res, next) => {
		const errors = validationResult(req);
		if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
		next();
	}
];

// Admin middleware enforces role; it will set req.admin_id from req.user or headers/body
router.patch('/:paymentId/approve', requireAdmin, validateApprove, paymentController.approvePayment);

module.exports = router;
