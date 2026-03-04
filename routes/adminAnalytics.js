const express = require('express');
const router = express.Router();
const verifyJwt = require('../middlewares/verifyJwt');
const requireAdmin = require('../middlewares/requireAdmin');
const adminAnalyticsController = require('../controllers/adminAnalyticsController');

/**
 * @swagger
 * /api/admin/analytics/graphs:
 *   get:
 *     summary: Admin analytics graphs data
 *     tags: [AdminAnalytics]
 *     parameters:
 *       - in: query
 *         name: rangeDays
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 365
 *         description: Number of days to include (default 7)
 *     responses:
 *       200:
 *         description: Analytics payload
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 meta:
 *                   type: object
 *                   properties:
 *                     rangeDays:
 *                       type: integer
 *                 timeseries:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       day:
 *                         type: string
 *                         example: '2026-03-01'
 *                       count:
 *                         type: integer
 *                         example: 12
 *                 breakdowns:
 *                   type: object
 *                   properties:
 *                     byStatus:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           status:
 *                             type: string
 *                           count:
 *                             type: integer
 *       401:
 *         description: Missing or invalid token
 *       403:
 *         description: Admin role required
 *       500:
 *         description: Server error
 */
/**
 * @swagger
 * /api/admin/analytics/graphs:
 *   get:
 *     summary: Admin analytics graphs data
 *     tags: [AdminAnalytics]
 *     parameters:
 *       - in: query
 *         name: rangeDays
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 365
 *         description: Number of days to include (default 7)
 *     responses:
 *       200:
 *         description: Analytics payload
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 meta:
 *                   type: object
 *                   properties:
 *                     rangeDays:
 *                       type: integer
 *                 timeseries:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       day:
 *                         type: string
 *                         example: '2026-03-01'
 *                       count:
 *                         type: integer
 *                         example: 12
 *                 breakdowns:
 *                   type: object
 *                   properties:
 *                     byStatus:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           status:
 *                             type: string
 *                           count:
 *                             type: integer
 *       401:
 *         description: Missing or invalid token
 *       403:
 *         description: Admin role required
 *       500:
 *         description: Server error
 */

// NOTE: This file contains only OpenAPI JSDoc for the analytics endpoint.
// The actual runtime route has been intentionally removed; the endpoint
// is documented for Swagger UI but will not be registered by the server.
module.exports = router;
