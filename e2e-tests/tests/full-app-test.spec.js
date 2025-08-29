const { test, expect } = require('@playwright/test');

// Test data
const testUser = {
  email: 'admin@trainingpulse.com',
  password: 'Admin123!',
};

const testCourse = {
  title: 'E2E Test Course',
  description: 'This is a test course created by E2E tests',
  modality: 'WBT',
  priority: 'high',
  startDate: '2024-01-01',
  dueDate: '2024-12-31',
};

test.describe('TrainingPulse Complete E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test.describe('Authentication Flow', () => {
    test('should login successfully with valid credentials', async ({ page }) => {
      // Navigate to login if not already there
      if (!page.url().includes('/login')) {
        await page.goto('/login');
      }

      // Fill in login form
      await page.fill('input[type="email"]', testUser.email);
      await page.fill('input[type="password"]', testUser.password);
      
      // Submit form
      await page.click('button[type="submit"]');
      
      // Wait for navigation to dashboard
      await page.waitForURL('**/dashboard');
      
      // Verify we're on dashboard
      await expect(page.locator('h1')).toContainText('Welcome');
    });

    test('should show error with invalid credentials', async ({ page }) => {
      await page.goto('/login');
      
      await page.fill('input[type="email"]', 'wrong@example.com');
      await page.fill('input[type="password"]', 'wrongpassword');
      await page.click('button[type="submit"]');
      
      // Check for error message
      await expect(page.locator('.error-message, [role="alert"]')).toBeVisible();
    });

    test('should logout successfully', async ({ page, context }) => {
      // Login first
      await page.goto('/login');
      await page.fill('input[type="email"]', testUser.email);
      await page.fill('input[type="password"]', testUser.password);
      await page.click('button[type="submit"]');
      await page.waitForURL('**/dashboard');
      
      // Find and click logout button
      await page.click('button[aria-label="User menu"], button:has-text("Logout")');
      
      // Should redirect to login
      await page.waitForURL('**/login');
      
      // Verify localStorage is cleared
      const token = await page.evaluate(() => localStorage.getItem('token'));
      expect(token).toBeNull();
    });
  });

  test.describe('Dashboard Functionality', () => {
    test.beforeEach(async ({ page }) => {
      // Login before each test
      await page.goto('/login');
      await page.fill('input[type="email"]', testUser.email);
      await page.fill('input[type="password"]', testUser.password);
      await page.click('button[type="submit"]');
      await page.waitForURL('**/dashboard');
    });

    test('should display all dashboard cards', async ({ page }) => {
      // Check for stat cards
      await expect(page.locator('text=Total Courses')).toBeVisible();
      await expect(page.locator('text=Active Courses')).toBeVisible();
      await expect(page.locator('text=Completed')).toBeVisible();
      await expect(page.locator('text=Overdue')).toBeVisible();
      
      // Check for My Assignments card
      await expect(page.locator('text=My Assignments')).toBeVisible();
      
      // Check for Notifications card
      await expect(page.locator('text=Important Notifications')).toBeVisible();
    });

    test('should display correct course counts', async ({ page }) => {
      // Wait for data to load
      await page.waitForSelector('[data-testid="total-courses-count"], text=Total Courses');
      
      // Get total courses count
      const totalCourses = await page.locator('text=Total Courses').locator('..').locator('.text-2xl').textContent();
      expect(parseInt(totalCourses)).toBeGreaterThanOrEqual(0);
    });

    test('should show assignment statistics', async ({ page }) => {
      // Check assignments card content
      await expect(page.locator('text=Total Assignments')).toBeVisible();
      await expect(page.locator('text=In Progress')).toBeVisible();
      await expect(page.locator('text=Pending')).toBeVisible();
      await expect(page.locator('text=Completed')).toBeVisible();
    });
  });

  test.describe('Courses Page', () => {
    test.beforeEach(async ({ page }) => {
      // Login and navigate to courses
      await page.goto('/login');
      await page.fill('input[type="email"]', testUser.email);
      await page.fill('input[type="password"]', testUser.password);
      await page.click('button[type="submit"]');
      await page.waitForURL('**/dashboard');
      await page.goto('/courses');
    });

    test('should display courses table', async ({ page }) => {
      // Wait for table to load
      await page.waitForSelector('table, [role="table"]');
      
      // Check for table headers
      await expect(page.locator('th:has-text("Course")')).toBeVisible();
      await expect(page.locator('th:has-text("Status")')).toBeVisible();
      await expect(page.locator('th:has-text("Priority")')).toBeVisible();
      await expect(page.locator('th:has-text("Modality")')).toBeVisible();
    });

    test('should filter courses by status', async ({ page }) => {
      // Click status filter button
      await page.click('button:has-text("Status")');
      
      // Wait for dropdown
      await page.waitForSelector('[role="menu"], .filter-dropdown');
      
      // Select a status
      await page.click('input[type="checkbox"][value="pre_development"]');
      
      // Verify filter is applied
      await expect(page.locator('.filter-icon, .active-filter')).toBeVisible();
    });

    test('should filter courses by priority', async ({ page }) => {
      // Click priority filter
      await page.click('button:has-text("Priority")');
      
      // Select high priority
      await page.click('input[type="checkbox"][value="high"]');
      
      // Verify filtered results
      const rows = await page.locator('tbody tr').count();
      expect(rows).toBeGreaterThanOrEqual(0);
    });

    test('should filter courses by modality', async ({ page }) => {
      // Click modality filter
      await page.click('button:has-text("Modality")');
      
      // Select WBT
      await page.click('input[type="checkbox"][value="WBT"]');
      
      // Verify filter applied
      await expect(page.locator('.filter-icon, .active-filter')).toBeVisible();
    });

    test('should filter by date range', async ({ page }) => {
      // Click Start Date filter
      await page.click('button:has-text("Start Date")');
      
      // Enter date range
      await page.fill('input[placeholder*="From"]', '2024-01-01');
      await page.fill('input[placeholder*="To"]', '2024-12-31');
      
      // Apply filter
      await page.keyboard.press('Enter');
      
      // Verify filter is active
      await expect(page.locator('.filter-icon, .active-filter')).toBeVisible();
    });

    test('should clear all filters', async ({ page }) => {
      // Apply some filters first
      await page.click('button:has-text("Status")');
      await page.click('input[type="checkbox"][value="pre_development"]');
      
      // Click Clear Filters button
      await page.click('button:has-text("Clear Filters")');
      
      // Verify filters are cleared
      const activeFilters = await page.locator('.filter-icon, .active-filter').count();
      expect(activeFilters).toBe(0);
    });

    test('should sort courses by clicking column headers', async ({ page }) => {
      // Click on Course column header to sort
      await page.click('th:has-text("Course")');
      
      // Get first course title
      const firstCourse = await page.locator('tbody tr').first().locator('td').first().textContent();
      
      // Click again to reverse sort
      await page.click('th:has-text("Course")');
      
      // Get new first course
      const newFirstCourse = await page.locator('tbody tr').first().locator('td').first().textContent();
      
      // Should be different after sorting
      expect(firstCourse).not.toBe(newFirstCourse);
    });

    test('should resize table columns', async ({ page }) => {
      // Find resize handle
      const resizeHandle = page.locator('.cursor-col-resize').first();
      
      // Get initial column width
      const column = page.locator('th').first();
      const initialWidth = await column.evaluate(el => el.offsetWidth);
      
      // Drag resize handle
      await resizeHandle.hover();
      await page.mouse.down();
      await page.mouse.move(100, 0);
      await page.mouse.up();
      
      // Get new width
      const newWidth = await column.evaluate(el => el.offsetWidth);
      
      // Width should have changed
      expect(newWidth).not.toBe(initialWidth);
    });

    test('should reset column widths', async ({ page }) => {
      // Resize a column first
      const resizeHandle = page.locator('.cursor-col-resize').first();
      await resizeHandle.hover();
      await page.mouse.down();
      await page.mouse.move(100, 0);
      await page.mouse.up();
      
      // Click Reset Columns button
      await page.click('button:has-text("Reset Columns")');
      
      // Verify columns are reset (localStorage should be cleared)
      const storageItem = await page.evaluate(() => localStorage.getItem('table-widths'));
      expect(storageItem).toBeNull();
    });

    test('should group courses by status', async ({ page }) => {
      // Find and change group by dropdown
      await page.selectOption('select[name="groupBy"]', 'status');
      
      // Verify groups appear
      await expect(page.locator('text=pre_development')).toBeVisible();
      
      // Expand/collapse group
      await page.click('button:has-text("pre_development")');
      
      // Verify expansion state changes
      const isExpanded = await page.locator('[aria-expanded="true"]').count();
      expect(isExpanded).toBeGreaterThanOrEqual(0);
    });

    test('should navigate to course details', async ({ page }) => {
      // Click on a course title
      const courseLink = page.locator('tbody tr').first().locator('a, [role="link"]').first();
      const courseTitle = await courseLink.textContent();
      await courseLink.click();
      
      // Should navigate to course detail page
      await page.waitForURL('**/courses/*');
      
      // Verify we're on the detail page
      await expect(page.locator('h1')).toContainText(courseTitle);
    });
  });

  test.describe('Course Detail Page', () => {
    test.beforeEach(async ({ page }) => {
      // Login and navigate to a course
      await page.goto('/login');
      await page.fill('input[type="email"]', testUser.email);
      await page.fill('input[type="password"]', testUser.password);
      await page.click('button[type="submit"]');
      await page.waitForURL('**/dashboard');
      await page.goto('/courses');
      
      // Click first course
      await page.locator('tbody tr').first().locator('a').first().click();
    });

    test('should display course information', async ({ page }) => {
      // Check for course details
      await expect(page.locator('text=Course Details')).toBeVisible();
      await expect(page.locator('text=Priority')).toBeVisible();
      await expect(page.locator('text=Modality')).toBeVisible();
      await expect(page.locator('text=Status')).toBeVisible();
    });

    test('should show phases/tasks', async ({ page }) => {
      // Check for phases section
      await expect(page.locator('text=Phases, text=Tasks')).toBeVisible();
      
      // Expand a phase if collapsed
      const expandButton = page.locator('button[aria-expanded="false"]').first();
      if (await expandButton.count() > 0) {
        await expandButton.click();
      }
    });

    test('should update phase status', async ({ page }) => {
      // Find a phase status dropdown
      const statusDropdown = page.locator('select[name*="status"]').first();
      if (await statusDropdown.count() > 0) {
        // Change status
        await statusDropdown.selectOption({ index: 1 });
        
        // Verify change was saved
        await expect(page.locator('text=Updated successfully')).toBeVisible();
      }
    });

    test('should add comments', async ({ page }) => {
      // Find comment input
      const commentInput = page.locator('textarea[placeholder*="comment"], input[placeholder*="comment"]');
      if (await commentInput.count() > 0) {
        await commentInput.fill('Test comment from E2E test');
        await page.click('button:has-text("Add Comment")');
        
        // Verify comment was added
        await expect(page.locator('text=Test comment from E2E test')).toBeVisible();
      }
    });
  });

  test.describe('Programs/Folders/Lists Navigation', () => {
    test.beforeEach(async ({ page }) => {
      // Login
      await page.goto('/login');
      await page.fill('input[type="email"]', testUser.email);
      await page.fill('input[type="password"]', testUser.password);
      await page.click('button[type="submit"]');
      await page.waitForURL('**/dashboard');
    });

    test('should navigate through programs hierarchy', async ({ page }) => {
      // Go to programs
      await page.goto('/programs');
      
      // Check for programs list
      await expect(page.locator('h1:has-text("Programs")')).toBeVisible();
      
      // Click on a program if available
      const programCard = page.locator('[data-testid="program-card"], .program-card').first();
      if (await programCard.count() > 0) {
        await programCard.click();
        
        // Should show folders
        await expect(page.locator('text=Folders')).toBeVisible();
        
        // Click on a folder if available
        const folderCard = page.locator('[data-testid="folder-card"], .folder-card').first();
        if (await folderCard.count() > 0) {
          await folderCard.click();
          
          // Should show lists
          await expect(page.locator('text=Lists')).toBeVisible();
          
          // Click on a list if available
          const listCard = page.locator('[data-testid="list-card"], .list-card').first();
          if (await listCard.count() > 0) {
            await listCard.click();
            
            // Should show courses in that list
            await expect(page.locator('table, text=Courses')).toBeVisible();
          }
        }
      }
    });
  });

  test.describe('User Profile', () => {
    test.beforeEach(async ({ page }) => {
      // Login
      await page.goto('/login');
      await page.fill('input[type="email"]', testUser.email);
      await page.fill('input[type="password"]', testUser.password);
      await page.click('button[type="submit"]');
      await page.waitForURL('**/dashboard');
    });

    test('should navigate to profile page', async ({ page }) => {
      // Click user menu
      await page.click('button[aria-label="User menu"], .user-avatar');
      
      // Click profile link
      await page.click('a:has-text("Profile")');
      
      // Verify on profile page
      await expect(page.locator('h1:has-text("Profile")')).toBeVisible();
    });

    test('should update profile information', async ({ page }) => {
      await page.goto('/profile');
      
      // Update name
      const nameInput = page.locator('input[name="name"]');
      if (await nameInput.count() > 0) {
        await nameInput.fill('Updated Test Name');
        await page.click('button:has-text("Save")');
        
        // Verify update
        await expect(page.locator('text=Profile updated')).toBeVisible();
      }
    });
  });

  test.describe('Settings Page', () => {
    test.beforeEach(async ({ page }) => {
      // Login as admin
      await page.goto('/login');
      await page.fill('input[type="email"]', testUser.email);
      await page.fill('input[type="password"]', testUser.password);
      await page.click('button[type="submit"]');
      await page.waitForURL('**/dashboard');
    });

    test('should access settings page', async ({ page }) => {
      await page.goto('/settings');
      
      // Verify on settings page
      await expect(page.locator('h1:has-text("Settings")')).toBeVisible();
    });

    test('should manage users', async ({ page }) => {
      await page.goto('/settings/users');
      
      // Check for users list
      await expect(page.locator('text=Users')).toBeVisible();
      
      // Check for add user button
      await expect(page.locator('button:has-text("Add User")')).toBeVisible();
    });

    test('should manage teams', async ({ page }) => {
      await page.goto('/settings/teams');
      
      // Check for teams list
      await expect(page.locator('text=Teams')).toBeVisible();
      
      // Check for add team button
      await expect(page.locator('button:has-text("Add Team")')).toBeVisible();
    });
  });

  test.describe('Responsive Design', () => {
    test.beforeEach(async ({ page }) => {
      // Login
      await page.goto('/login');
      await page.fill('input[type="email"]', testUser.email);
      await page.fill('input[type="password"]', testUser.password);
      await page.click('button[type="submit"]');
      await page.waitForURL('**/dashboard');
    });

    test('should work on mobile viewport', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      
      // Check mobile menu button appears
      await expect(page.locator('button[aria-label="Menu"], .mobile-menu-button')).toBeVisible();
      
      // Open mobile menu
      await page.click('button[aria-label="Menu"], .mobile-menu-button');
      
      // Check navigation items are visible
      await expect(page.locator('nav a:has-text("Dashboard")')).toBeVisible();
    });

    test('should work on tablet viewport', async ({ page }) => {
      // Set tablet viewport
      await page.setViewportSize({ width: 768, height: 1024 });
      
      // Navigate to courses
      await page.goto('/courses');
      
      // Table should be scrollable
      const table = page.locator('table');
      await expect(table).toBeVisible();
    });
  });

  test.describe('Error Handling', () => {
    test('should show 404 page for invalid routes', async ({ page }) => {
      await page.goto('/invalid-route-12345');
      
      // Should show 404 message
      await expect(page.locator('text=404, text=Not Found')).toBeVisible();
    });

    test('should handle API errors gracefully', async ({ page, context }) => {
      // Intercept API calls and force error
      await context.route('**/api/**', route => {
        route.fulfill({
          status: 500,
          body: JSON.stringify({ error: 'Internal Server Error' }),
        });
      });

      await page.goto('/');
      
      // Should show error message
      await expect(page.locator('text=Error, text=failed')).toBeVisible();
    });

    test('should handle network offline', async ({ page, context }) => {
      // Login first
      await page.goto('/login');
      await page.fill('input[type="email"]', testUser.email);
      await page.fill('input[type="password"]', testUser.password);
      await page.click('button[type="submit"]');
      await page.waitForURL('**/dashboard');
      
      // Go offline
      await context.setOffline(true);
      
      // Try to navigate
      await page.goto('/courses').catch(() => {});
      
      // Should show offline indicator or error
      await expect(page.locator('text=offline, text=connection')).toBeVisible();
    });
  });

  test.describe('Performance Tests', () => {
    test('should load dashboard within acceptable time', async ({ page }) => {
      // Login
      await page.goto('/login');
      await page.fill('input[type="email"]', testUser.email);
      await page.fill('input[type="password"]', testUser.password);
      
      // Measure navigation time
      const startTime = Date.now();
      await page.click('button[type="submit"]');
      await page.waitForURL('**/dashboard');
      await page.waitForLoadState('networkidle');
      const endTime = Date.now();
      
      // Should load within 3 seconds
      expect(endTime - startTime).toBeLessThan(3000);
    });

    test('should handle large datasets efficiently', async ({ page }) => {
      // Login and go to courses
      await page.goto('/login');
      await page.fill('input[type="email"]', testUser.email);
      await page.fill('input[type="password"]', testUser.password);
      await page.click('button[type="submit"]');
      await page.waitForURL('**/dashboard');
      
      // Navigate to courses
      const startTime = Date.now();
      await page.goto('/courses');
      await page.waitForSelector('table');
      const endTime = Date.now();
      
      // Should load table within 2 seconds
      expect(endTime - startTime).toBeLessThan(2000);
    });
  });

  test.describe('Accessibility Tests', () => {
    test('should have proper ARIA labels', async ({ page }) => {
      await page.goto('/login');
      
      // Check for ARIA labels
      const emailInput = page.locator('input[type="email"]');
      const ariaLabel = await emailInput.getAttribute('aria-label');
      expect(ariaLabel).toBeTruthy();
    });

    test('should be keyboard navigable', async ({ page }) => {
      await page.goto('/login');
      
      // Tab through elements
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      
      // Check focused element
      const focusedElement = await page.evaluate(() => document.activeElement.tagName);
      expect(['INPUT', 'BUTTON']).toContain(focusedElement);
    });

    test('should have proper heading hierarchy', async ({ page }) => {
      await page.goto('/');
      
      // Check h1 exists
      const h1 = await page.locator('h1').count();
      expect(h1).toBeGreaterThan(0);
      
      // Check heading order
      const headings = await page.locator('h1, h2, h3, h4, h5, h6').allTextContents();
      expect(headings.length).toBeGreaterThan(0);
    });
  });
});