require('dotenv').config();

console.log('=== DEBUG: Starting full server test ===');
console.log('require.main === module:', require.main === module);

// Test the same condition as in app.js
if (require.main === module) {
  console.log('This would run the server...');
  
  async function testStartServer() {
    try {
      console.log('Loading app.js...');
      require('./src/app.js');
      console.log('App.js loaded successfully');
      
      // Keep the process alive to see if server starts
      setTimeout(() => {
        console.log('Server test timeout - exiting');
        process.exit(0);
      }, 5000);
      
    } catch (error) {
      console.error('Error loading app:', error);
      process.exit(1);
    }
  }
  
  testStartServer();
} else {
  console.log('Would NOT run the server (module not main)');
}