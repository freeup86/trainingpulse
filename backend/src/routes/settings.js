const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authenticate');
const { validateRequest } = require('../middleware/validateRequest');
const { body, param } = require('express-validator');
const { query: db } = require('../config/database');
const logger = require('../utils/logger');

// Get all user settings
router.get('/', 
  authenticate,
  async (req, res, next) => {
    try {
      const userId = req.user.id;

      // Get user settings
      const settingsQuery = `
        SELECT 
          name,
          email,
          role,
          daily_capacity_hours,
          timezone,
          notification_preferences,
          ui_preferences
        FROM users
        WHERE id = $1
      `;

      const result = await db(settingsQuery, [userId]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      const user = result.rows[0];

      // Transform to settings format
      const settings = {
        name: user.name,
        email: user.email,
        role: user.role,
        timezone: user.timezone || 'UTC',
        language: user.ui_preferences?.language || 'en',
        dailyCapacityHours: user.daily_capacity_hours || 8,
        theme: user.ui_preferences?.theme || 'system',
        compactMode: user.ui_preferences?.compactMode || false,
        notifications: user.notification_preferences || {},
        emailDigest: user.notification_preferences?.emailDigest || 'daily',
        twoFactorEnabled: false, // Would need to be implemented
        sessionTimeout: 480 // Default 8 hours
      };

      res.json({
        success: true,
        data: settings
      });
    } catch (error) {
      next(error);
    }
  }
);

// Update user settings
router.put('/',
  authenticate,
  [
    body('name').optional().isString().trim(),
    body('email').optional().isEmail(),
    body('timezone').optional().isString(),
    body('language').optional().isString(),
    body('dailyCapacityHours').optional().isFloat({ min: 0.5, max: 24 }),
    body('theme').optional().isIn(['light', 'dark', 'system']),
    body('compactMode').optional().isBoolean(),
    body('notifications').optional().isObject(),
    body('emailDigest').optional().isIn(['immediate', 'daily', 'weekly', 'never']),
    body('twoFactorEnabled').optional().isBoolean(),
    body('sessionTimeout').optional().isInt({ min: 60, max: 1440 })
  ],
  validateRequest,
  async (req, res, next) => {
    try {
      const userId = req.user.id;
      const updates = req.body;

      // Build update fields
      const updateFields = [];
      const updateValues = [];
      let paramCounter = 1;

      if (updates.name !== undefined) {
        updateFields.push(`name = $${paramCounter++}`);
        updateValues.push(updates.name);
      }

      if (updates.email !== undefined) {
        // Check if email is already taken
        const emailCheck = await db(
          'SELECT id FROM users WHERE email = $1 AND id != $2',
          [updates.email, userId]
        );
        if (emailCheck.rows.length > 0) {
          return res.status(400).json({
            success: false,
            error: 'Email already in use'
          });
        }
        updateFields.push(`email = $${paramCounter++}`);
        updateValues.push(updates.email);
      }

      if (updates.timezone !== undefined) {
        updateFields.push(`timezone = $${paramCounter++}`);
        updateValues.push(updates.timezone);
      }

      if (updates.dailyCapacityHours !== undefined) {
        updateFields.push(`daily_capacity_hours = $${paramCounter++}`);
        updateValues.push(updates.dailyCapacityHours);
      }

      // Handle notification preferences
      if (updates.notifications !== undefined || updates.emailDigest !== undefined) {
        const currentPrefs = await db(
          'SELECT notification_preferences FROM users WHERE id = $1',
          [userId]
        );
        const prefs = currentPrefs.rows[0]?.notification_preferences || {};
        
        if (updates.notifications) {
          Object.assign(prefs, updates.notifications);
        }
        if (updates.emailDigest) {
          prefs.emailDigest = updates.emailDigest;
        }
        
        updateFields.push(`notification_preferences = $${paramCounter++}`);
        updateValues.push(JSON.stringify(prefs));
      }

      // Handle UI preferences
      if (updates.theme !== undefined || updates.compactMode !== undefined || updates.language !== undefined) {
        const currentPrefs = await db(
          'SELECT ui_preferences FROM users WHERE id = $1',
          [userId]
        );
        const prefs = currentPrefs.rows[0]?.ui_preferences || {};
        
        if (updates.theme !== undefined) prefs.theme = updates.theme;
        if (updates.compactMode !== undefined) prefs.compactMode = updates.compactMode;
        if (updates.language !== undefined) prefs.language = updates.language;
        
        updateFields.push(`ui_preferences = $${paramCounter++}`);
        updateValues.push(JSON.stringify(prefs));
      }

      if (updateFields.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No valid update fields provided'
        });
      }

      updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
      updateValues.push(userId);

      const updateQuery = `
        UPDATE users
        SET ${updateFields.join(', ')}
        WHERE id = $${paramCounter}
        RETURNING id
      `;

      await db(updateQuery, updateValues);

      logger.info('User settings updated', {
        userId,
        updates: Object.keys(updates)
      });

      res.json({
        success: true,
        message: 'Settings updated successfully'
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get specific setting
router.get('/:key',
  authenticate,
  [
    param('key').isString()
  ],
  validateRequest,
  async (req, res, next) => {
    try {
      const { key } = req.params;
      const userId = req.user.id;

      const result = await db(
        'SELECT notification_preferences, ui_preferences FROM users WHERE id = $1',
        [userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      const user = result.rows[0];
      let value;

      // Map keys to their locations
      if (key.startsWith('notification.')) {
        const subKey = key.replace('notification.', '');
        value = user.notification_preferences?.[subKey];
      } else if (key.startsWith('ui.')) {
        const subKey = key.replace('ui.', '');
        value = user.ui_preferences?.[subKey];
      } else {
        return res.status(404).json({
          success: false,
          error: 'Setting not found'
        });
      }

      res.json({
        success: true,
        data: {
          key,
          value
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// Set specific setting
router.put('/:key',
  authenticate,
  [
    param('key').isString(),
    body('value').exists()
  ],
  validateRequest,
  async (req, res, next) => {
    try {
      const { key } = req.params;
      const { value } = req.body;
      const userId = req.user.id;

      let updateQuery;
      let updateValues;

      // Map keys to their locations
      if (key.startsWith('notification.')) {
        const subKey = key.replace('notification.', '');
        updateQuery = `
          UPDATE users
          SET notification_preferences = jsonb_set(
            COALESCE(notification_preferences, '{}'::jsonb),
            $1::text[],
            $2::jsonb
          ),
          updated_at = CURRENT_TIMESTAMP
          WHERE id = $3
        `;
        updateValues = [`{${subKey}}`, JSON.stringify(value), userId];
      } else if (key.startsWith('ui.')) {
        const subKey = key.replace('ui.', '');
        updateQuery = `
          UPDATE users
          SET ui_preferences = jsonb_set(
            COALESCE(ui_preferences, '{}'::jsonb),
            $1::text[],
            $2::jsonb
          ),
          updated_at = CURRENT_TIMESTAMP
          WHERE id = $3
        `;
        updateValues = [`{${subKey}}`, JSON.stringify(value), userId];
      } else {
        return res.status(400).json({
          success: false,
          error: 'Invalid setting key'
        });
      }

      await db(updateQuery, updateValues);

      logger.info('User setting updated', {
        userId,
        key,
        value
      });

      res.json({
        success: true,
        message: 'Setting updated successfully'
      });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;