const express = require('express');
const { query, param } = require('express-validator');
const facebookService = require('../services/facebook');
const { authenticateToken, adminOnly } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

const router = express.Router();

const validate = (req, res, next) => {
  const { validationResult } = require('express-validator');
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
  '/:postId',
  authenticateToken,
  adminOnly,
  [
    param('postId').notEmpty().withMessage('Post ID is required'),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('order').optional().isIn(['chronological', 'reverse_chronological']),
    query('after').optional().isString(),
    query('before').optional().isString(),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { postId } = req.params;
    const { limit, order, after, before } = req.query;

    const result = await facebookService.getComments(postId, { limit, order, after, before });

    logger.info('GET /api/comments/:postId executed', {
      user: req.user?.username,
      postId,
      count: result.data.length,
    });

    res.json(result);
  })
);

module.exports = router;
