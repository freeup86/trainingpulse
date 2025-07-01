const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const Joi = require('joi');
const { query, transaction } = require('../config/database');
const { blacklistToken, deleteSession } = require('../config/redis');
const { asyncHandler, ValidationError, AuthenticationError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

const router = express.Router();

// Debug endpoint to check if users exist (temporary for debugging)
router.get('/debug/users', asyncHandler(async (req, res) => {
  const result = await query('SELECT email, name, role, active FROM users LIMIT 5');
  res.json({
    success: true,
    data: {
      userCount: result.rows.length,
      users: result.rows.map(user => ({
        email: user.email,
        name: user.name,
        role: user.role,
        active: user.active
      }))
    }
  });
}));

// Validation schemas
const loginSchema = Joi.object({
  email: Joi.string().email().required().trim().lowercase(),
  password: Joi.string().min(6).required()
});

const registerSchema = Joi.object({
  email: Joi.string().email().required().trim().lowercase(),
  name: Joi.string().min(2).max(255).required().trim(),
  password: Joi.string().min(8).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/).required(),
  role: Joi.string().valid('admin', 'manager', 'designer', 'reviewer', 'viewer').default('viewer'),
  teamId: Joi.number().integer().positive().optional()
});

const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().required()
});

// Helper function to generate tokens
function generateTokens(user) {
  const payload = {
    userId: user.id,
    email: user.email,
    role: user.role
  };
  
  const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    issuer: 'trainingpulse',
    audience: 'trainingpulse-users'
  });
  
  const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    issuer: 'trainingpulse',
    audience: 'trainingpulse-users'
  });
  
  return { accessToken, refreshToken };
}

// POST /auth/login
router.post('/login', asyncHandler(async (req, res) => {
  logger.info('Login attempt received', { email: req.body.email, ip: req.ip });
  
  // Validate input
  const { error, value } = loginSchema.validate(req.body);
  if (error) {
    logger.warn('Login validation failed', { error: error.details });
    throw new ValidationError('Invalid login data', error.details);
  }
  
  const { email, password } = value;
  
  // Find user by email
  const userResult = await query(
    'SELECT id, email, name, role, team_id, active, password FROM users WHERE email = $1',
    [email]
  );
  
  logger.info('User query result', { email, userFound: userResult.rows.length > 0 });
  
  if (userResult.rows.length === 0) {
    logger.logSecurityEvent('LOGIN_ATTEMPT_INVALID_EMAIL', {
      email,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    throw new AuthenticationError('Invalid email or password');
  }
  
  const user = userResult.rows[0];
  
  // Check if user is active
  if (!user.active) {
    logger.logSecurityEvent('LOGIN_ATTEMPT_INACTIVE_USER', {
      userId: user.id,
      email: user.email,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    throw new AuthenticationError('Account is inactive');
  }
  
  // Verify password
  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    logger.logSecurityEvent('LOGIN_ATTEMPT_INVALID_PASSWORD', {
      userId: user.id,
      email: user.email,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    throw new AuthenticationError('Invalid email or password');
  }
  
  // Generate tokens
  const { accessToken, refreshToken } = generateTokens(user);
  
  // Update user's last login timestamp
  await query(
    'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
    [user.id]
  );
  
  // Remove password from response
  delete user.password;
  
  logger.info('User login successful', {
    userId: user.id,
    email: user.email,
    role: user.role,
    ip: req.ip
  });
  
  res.json({
    success: true,
    data: {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        teamId: user.team_id,
        active: user.active
      }
    }
  });
}));

// POST /auth/register
router.post('/register', asyncHandler(async (req, res) => {
  // Validate input
  const { error, value } = registerSchema.validate(req.body);
  if (error) {
    throw new ValidationError('Invalid registration data', error.details);
  }
  
  const { email, name, password, role, teamId } = value;
  
  // Check if user already exists
  const existingUser = await query(
    'SELECT id FROM users WHERE email = $1',
    [email]
  );
  
  if (existingUser.rows.length > 0) {
    throw new ValidationError('User already exists', [{
      field: 'email',
      message: 'Email is already registered'
    }]);
  }
  
  // Hash password
  const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
  const hashedPassword = await bcrypt.hash(password, saltRounds);
  
  // Create user
  const newUser = await transaction(async (client) => {
    const userResult = await client.query(
      `INSERT INTO users (email, name, password, role, team_id, active, daily_capacity_hours, skills, notification_preferences, ui_preferences, timezone)
       VALUES ($1, $2, $3, $4, $5, true, 8.0, ARRAY[]::text[], '{}', '{}', 'UTC')
       RETURNING id, email, name, role, team_id, active, created_at`,
      [email, name, hashedPassword, role, teamId || null]
    );
    
    return userResult.rows[0];
  });
  
  logger.info('User registration successful', {
    userId: newUser.id,
    email: newUser.email,
    role: newUser.role,
    ip: req.ip
  });
  
  res.status(201).json({
    success: true,
    data: {
      message: 'User registered successfully',
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
        teamId: newUser.team_id,
        active: newUser.active,
        createdAt: newUser.created_at
      }
    }
  });
}));

// POST /auth/refresh
router.post('/refresh', asyncHandler(async (req, res) => {
  // Validate input
  const { error, value } = refreshTokenSchema.validate(req.body);
  if (error) {
    throw new ValidationError('Invalid refresh token data', error.details);
  }
  
  const { refreshToken } = value;
  
  try {
    // Verify refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    
    // Get fresh user data
    const userResult = await query(
      'SELECT id, email, name, role, team_id, active FROM users WHERE id = $1',
      [decoded.userId]
    );
    
    if (userResult.rows.length === 0 || !userResult.rows[0].active) {
      throw new AuthenticationError('Invalid refresh token');
    }
    
    const user = userResult.rows[0];
    
    // Generate new tokens
    const { accessToken, refreshToken: newRefreshToken } = generateTokens(user);
    
    logger.debug('Token refresh successful', {
      userId: user.id,
      email: user.email,
      ip: req.ip
    });
    
    res.json({
      success: true,
      data: {
        accessToken,
        refreshToken: newRefreshToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          teamId: user.team_id,
          active: user.active
        }
      }
    });
    
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      throw new AuthenticationError('Invalid or expired refresh token');
    }
    throw error;
  }
}));

// POST /auth/logout
router.post('/logout', asyncHandler(async (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    
    try {
      // Decode token to get expiration time
      const decoded = jwt.decode(token);
      if (decoded && decoded.exp) {
        const ttl = decoded.exp - Math.floor(Date.now() / 1000);
        if (ttl > 0) {
          // Add token to blacklist
          await blacklistToken(token, ttl);
        }
      }
      
      logger.info('User logout successful', {
        userId: decoded?.userId,
        ip: req.ip
      });
      
    } catch (error) {
      logger.error('Error during logout:', error);
    }
  }
  
  res.json({
    success: true,
    data: {
      message: 'Logged out successfully'
    }
  });
}));

// GET /auth/me (get current user info)
router.get('/me', require('../middleware/authenticate').authenticate, asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: {
      user: {
        id: req.user.id,
        email: req.user.email,
        name: req.user.name,
        role: req.user.role,
        teamId: req.user.team_id,
        active: req.user.active,
        dailyCapacityHours: req.user.daily_capacity_hours,
        skills: req.user.skills,
        notificationPreferences: req.user.notification_preferences,
        uiPreferences: req.user.ui_preferences,
        timezone: req.user.timezone,
        lastLogin: req.user.last_login
      }
    }
  });
}));

module.exports = router;