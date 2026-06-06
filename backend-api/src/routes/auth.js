const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const config = require('../config');
const db = require('../db');
const { generateToken } = require('../middleware/auth');
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

router.post(
  '/login',
  [
    body('username').notEmpty().withMessage('Username is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { username, password } = req.body;

    if (username !== config.admin.username || password !== config.admin.password) {
      logger.warn('Failed login attempt', { username, ip: req.ip });
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid username or password',
          statusCode: 401,
        },
      });
    }

    const token = generateToken({
      username: config.admin.username,
      role: 'admin',
    });

    logger.info('Admin login successful', { username, ip: req.ip });

    res.json({
      success: true,
      data: {
        token,
        username: config.admin.username,
        role: 'admin',
        expiresIn: config.jwt.expiresIn,
      },
    });
  })
);

router.post(
  '/register',
  [
    body('username').notEmpty().isLength({ min: 3, max: 50 }).withMessage('Username must be 3-50 characters'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { username, password } = req.body;

    const existing = await db.query('SELECT id FROM admin_users WHERE username = $1', [username]);
    if (existing.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'USER_EXISTS',
          message: 'Username already exists',
          statusCode: 409,
        },
      });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const result = await db.query(
      'INSERT INTO admin_users (username, password_hash) VALUES ($1, $2) RETURNING id, username, created_at',
      [username, passwordHash]
    );

    logger.info('New admin user registered', { username, id: result.rows[0].id });

    res.status(201).json({
      success: true,
      data: {
        user: result.rows[0],
      },
    });
  })
);

router.post(
  '/change-password',
  [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters'),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const { authenticateToken } = require('../middleware/auth');

    if (currentPassword !== config.admin.password) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_PASSWORD',
          message: 'Current password is incorrect',
          statusCode: 401,
        },
      });
    }

    logger.warn('Admin password changed', { username: config.admin.username });

    res.json({
      success: true,
      message: 'Password changed successfully. Note: this change is in-memory only. Update .env file for persistence.',
    });
  })
);

module.exports = router;
