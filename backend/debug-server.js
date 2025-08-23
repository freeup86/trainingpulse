require('dotenv').config();
console.log('Starting debug server...');

async function testServer() {
  try {
    console.log('Loading modules...');
    
    const { connectDB } = require('./src/config/database');
    console.log('Database module loaded');
    
    const logger = require('./src/utils/logger');
    console.log('Logger module loaded');
    
    logger.info('Testing database connection...');
    await connectDB();
    logger.info('Database connected successfully');
    
    console.log('All modules loaded successfully');
    process.exit(0);
    
  } catch (error) {
    console.error('Error during testing:', error);
    process.exit(1);
  }
}

testServer();