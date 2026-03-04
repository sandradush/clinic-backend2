const express = require('express');
const router = express.Router();
const { body, param, validationResult } = require('express-validator');
const appointmentController = require('../controllers/appointmentController');
const requireAdmin = require('../middlewares/requireAdmin');

/**
 * PATCH /api/appointments/:appointmentId/assign
 * Body: { doctor_id, note? }
 */
const validateAssign = [
  param('appointmentId').notEmpty().withMessage('appointmentId is required'),
  body('doctor_id').isString().notEmpty().withMessage('doctor_id is required'),
  body('note').optional().isString(),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    next();
  }
];

router.patch('/:appointmentId/assign', requireAdmin, validateAssign, appointmentController.assignDoctor);

module.exports = router;
