const express = require('express');
const router = express.Router();
const { body, param, validationResult } = require('express-validator');
const notificationController = require('../controllers/notificationController');

/**
 * @swagger
 * /api/notifications:
 *   post:
 *     summary: Create a notification and persist it
 *     tags:
 *       - Notifications
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               to_user_id:
 *                 type: string
 *               title:
 *                 type: string
 *               message:
 *                 type: string
 *               meta:
 *                 type: object
 *             required:
 *               - to_user_id
 *               - title
 *               - message
 *     responses:
 *       201:
 *         description: Notification created
 */
const validateCreate = [
  body('to_user_id').isString().notEmpty().withMessage('to_user_id is required'),
  body('title').isString().notEmpty().withMessage('title is required'),
  body('message').isString().notEmpty().withMessage('message is required'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    next();
  }
];

router.post('/', validateCreate, notificationController.createNotification);

/**
 * POST /api/notifications/broadcast
 * Body: { to_user_ids?: string[], to_role?: string, title, message, meta? }
 */
const validateBroadcast = [
  body('to_user_ids').optional().isArray().withMessage('to_user_ids must be an array'),
  body('to_role').optional().isString().withMessage('to_role must be a string'),
  body('title').isString().notEmpty().withMessage('title is required'),
  body('message').isString().notEmpty().withMessage('message is required'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    next();
  }
];

router.post('/broadcast', validateBroadcast, notificationController.broadcastNotification);

/**
 * @swagger
 * /api/notifications/user/{userId}:
 *   get:
 *     summary: Get notifications for a user
 *     tags:
 *       - Notifications
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of notifications
 */
const validateGetByUser = [
  param('userId').isString().notEmpty().withMessage('userId is required'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    next();
  }
];

router.get('/user/:userId', validateGetByUser, notificationController.getNotificationsForUser);

module.exports = router;
