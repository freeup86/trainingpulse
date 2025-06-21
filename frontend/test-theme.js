// Simple test script to verify theme functionality
// This can be run in the browser console

console.log('Testing theme functionality...');

// Check if theme is stored in localStorage
const currentTheme = localStorage.getItem('theme');
console.log('Current theme in localStorage:', currentTheme);

// Check if dark class is applied to document
const hasDarkClass = document.documentElement.classList.contains('dark');
console.log('Has dark class:', hasDarkClass);

// Test theme switching
function testThemeSwitch(theme) {
  console.log(`Testing switch to ${theme} theme...`);
  
  // Simulate theme change
  localStorage.setItem('theme', theme);
  
  // Apply theme logic
  let shouldBeDark = false;
  if (theme === 'dark') {
    shouldBeDark = true;
  } else if (theme === 'light') {
    shouldBeDark = false;
  } else {
    // System theme
    shouldBeDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  
  if (shouldBeDark) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
  
  console.log(`Theme switched to ${theme}, dark mode: ${shouldBeDark}`);
  console.log('Document classes:', document.documentElement.className);
}

// Export test functions
window.testTheme = {
  testThemeSwitch,
  getCurrentTheme: () => localStorage.getItem('theme'),
  isDarkMode: () => document.documentElement.classList.contains('dark')
};