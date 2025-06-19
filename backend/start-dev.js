#!/usr/bin/env node

// Load environment variables first
require('dotenv').config();

// Set SSL workaround
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

console.log('🚀 Starting TrainingPulse Backend...');
console.log('Environment:', process.env.NODE_ENV || 'development');
console.log('Port:', process.env.PORT || '3001');
console.log('Database URL:', process.env.DATABASE_URL ? 'Set ✓' : 'Not set ✗');

try {
  require('./src/app.js');
} catch (error) {
  console.error('❌ Failed to start server:', error.message);
  console.error('Stack trace:', error.stack);
  process.exit(1);
}