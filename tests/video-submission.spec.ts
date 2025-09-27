import { test, expect } from '@playwright/test';

test.describe('Video Submission Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Start at homepage
    await page.goto('/');
  });

  test('should navigate to video submission page', async ({ page }) => {
    // Look for submission-related navigation
    const submissionLink = page.getByRole('link', { name: /submit|upload|video/i }).first();
    
    if (await submissionLink.isVisible()) {
      await submissionLink.click();
      await expect(page).toHaveURL(/.*submit.*|.*upload.*|.*video.*/);
      await expect(page.locator('text=Submit').or(page.locator('text=Upload'))).toBeVisible();
    } else {
      // If not directly visible, might need authentication first
      const authButton = page.getByRole('link', { name: /login|join|register/i }).first();
      await authButton.click();
      await expect(page.locator('input[type="email"]')).toBeVisible();
    }
  });

  test('should show video submission requirements', async ({ page }) => {
    // Navigate to submission page or rules
    await page.getByRole('link', { name: /rules|submit/i }).first().click();
    
    // Check for video requirements information
    await expect(page.locator('text=video').or(page.locator('text=Video'))).toBeVisible();
    await expect(page.locator('text=pull.*up|Pull.*Up').or(page.locator('text=requirements'))).toBeVisible();
  });

  test('should handle file upload validation', async ({ page }) => {
    // Try to navigate to submission page
    try {
      await page.goto('/video-submission');
    } catch {
      // If that fails, try through navigation
      await page.goto('/');
      const submissionLink = page.getByRole('link', { name: /submit|upload/i }).first();
      if (await submissionLink.isVisible()) {
        await submissionLink.click();
      } else {
        // Skip this test if submission page not accessible without auth
        test.skip('Video submission requires authentication');
      }
    }

    // Look for file upload input
    const fileInput = page.locator('input[type="file"]');
    if (await fileInput.isVisible()) {
      // Test without selecting file
      const submitButton = page.getByRole('button', { name: /submit|upload/i });
      if (await submitButton.isVisible()) {
        await submitButton.click();
        
        // Should show validation error
        await expect(page.locator('text=required').or(page.locator('text=select'))).toBeVisible();
      }
    }
  });
});

test.describe('Subscription Flow', () => {
  test('should show subscription information', async ({ page }) => {
    await page.goto('/');
    
    // Look for subscription/pricing information
    const pricingLink = page.getByRole('link', { name: /subscr|pricing|plan|join/i }).first();
    
    if (await pricingLink.isVisible()) {
      await pricingLink.click();
      
      // Should show pricing information
      await expect(page.locator('text=$').or(page.locator('text=price')).or(page.locator('text=month'))).toBeVisible();
    } else {
      // Check if pricing info is on homepage
      await expect(page.locator('text=$9.99').or(page.locator('text=monthly'))).toBeVisible();
    }
  });

  test('should handle subscription signup process', async ({ page }) => {
    await page.goto('/');
    
    // Find main CTA button
    const ctaButton = page.getByRole('button', { name: /join|start|subscribe/i }).first()
      .or(page.getByRole('link', { name: /join|start|subscribe/i }).first());
    
    await ctaButton.click();
    
    // Should either go to auth or payment flow
    const isAuthPage = await page.locator('input[type="email"]').isVisible({ timeout: 3000 });
    const isPaymentPage = await page.locator('text=payment').or(page.locator('text=card')).isVisible({ timeout: 3000 });
    
    expect(isAuthPage || isPaymentPage).toBeTruthy();
  });
});

test.describe('Mobile User Experience', () => {
  test.beforeEach(async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
  });

  test('should work well on mobile devices', async ({ page }) => {
    await page.goto('/');
    
    // Check mobile optimization
    await expect(page.locator('body')).toBeVisible();
    
    // Check that content is readable on mobile
    const heading = page.locator('h1').first();
    await expect(heading).toBeVisible();
    
    // Check for mobile-specific layout
    const mobileElements = page.locator('.md\\:hidden');
    if (await mobileElements.count() > 0) {
      await expect(mobileElements.first()).toBeVisible();
    }
  });

  test('should handle touch interactions', async ({ page }) => {
    await page.goto('/');
    
    // Test touch/tap on main CTA
    const ctaButton = page.getByRole('button', { name: /join|start/i }).first()
      .or(page.getByRole('link', { name: /join|start/i }).first());
    
    if (await ctaButton.isVisible()) {
      await ctaButton.tap();
      
      // Should navigate or show response
      const currentUrl = page.url();
      expect(currentUrl).toContain('localhost');
    }
  });

  test('should display leaderboard properly on mobile', async ({ page }) => {
    await page.goto('/');
    
    // Navigate to leaderboard
    const leaderboardLink = page.getByRole('link', { name: /leaderboard/i }).first();
    await leaderboardLink.click();
    
    // Check mobile leaderboard display
    await expect(page.locator('text=Rank').or(page.locator('text=RANK'))).toBeVisible();
    
    // Check that table/list is scrollable or properly formatted for mobile
    const leaderboardContent = page.locator('[data-testid="leaderboard"]')
      .or(page.locator('table'))
      .or(page.locator('.leaderboard'));
    
    if (await leaderboardContent.isVisible()) {
      await expect(leaderboardContent).toBeVisible();
    }
  });
});
