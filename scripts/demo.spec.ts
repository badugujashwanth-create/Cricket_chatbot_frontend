import { expect, test } from '@playwright/test';
import path from 'node:path';

const baseUrl = process.env.DEMO_BASE_URL;
if (!baseUrl) throw new Error('Set DEMO_BASE_URL to the healthy local application URL.');

const repositoryRoot = path.resolve(__dirname, '..');

test.use({
  viewport: { width: 1280, height: 720 },
  video: { mode: 'on', size: { width: 1280, height: 720 } },
});

test('Cricket Chatbot Web safe overview', async ({ page }) => {
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await expect(page.locator('body')).toBeVisible();
  await page.waitForTimeout(2500);
  await page.screenshot({
    path: path.join(repositoryRoot, 'docs/assets/screenshots/overview.png'),
    fullPage: true,
  });
  await page.screenshot({
    path: path.join(repositoryRoot, 'docs/demo/demo-thumbnail.png'),
  });

  const safeTarget = page
    .getByRole('link', { name: /demo|explore|dashboard|features|catalog|home/i })
    .or(page.getByRole('button', { name: /demo|explore|learn more|view|browse/i }))
    .first();
  if (await safeTarget.isVisible().catch(() => false)) {
    await safeTarget.click();
    await page.waitForTimeout(3500);
  }

  await page.mouse.move(960, 520, { steps: 20 });
  await page.waitForTimeout(5000);
});

