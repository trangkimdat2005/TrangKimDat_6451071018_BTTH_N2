const express = require('express');
const { body, query, validationResult } = require('express-validator');
const facebookService = require('../services/facebook');
const { authenticateToken, adminOnly } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

const router = express.Router();

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request parameters',
        statusCode: 400,
        details: errors.array(),
      },
    });
  }
  next();
};

router.get(
  '/',
  authenticateToken,
  adminOnly,
  [
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('since').optional().isISO8601(),
    query('until').optional().isISO8601(),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { limit, since, until } = req.query;
    const result = await facebookService.getPosts({ limit, since, until });

    logger.info('GET /api/posts executed', { user: req.user?.username, count: result.data.length });
    res.json(result);
  })
);

router.post(
  '/',
  authenticateToken,
  adminOnly,
  [body('message').notEmpty().withMessage('Message is required').isLength({ max: 63206 })],
  validate,
  asyncHandler(async (req, res) => {
    const { message, link, place, tags } = req.body;
    const result = await facebookService.createPost(message, { link, place, tags });

    logger.info('POST /api/posts executed', { user: req.user?.username, postId: result.data.post_id });
    res.status(201).json(result);
  })
);

module.exports = router;
