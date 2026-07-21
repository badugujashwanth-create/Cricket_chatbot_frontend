import { expect, test } from '@playwright/test';

const statusPayload = {
  status: 'missing',
  counts: { documents: 0, players: 0, teams: 0, matches: 0 },
  runtime: {
    mode: 'deterministic_local',
    dataset_boundary: 'repository_curated_snapshot',
    live_scores_guaranteed: false,
    provider_calls_opt_in: true,
    providers: {
      cricapi: false,
      cricbuzz: false,
      espn: false,
      profile_enrichment: false,
      local_llm: false,
      openai: false,
      daily_ingestor: false
    }
  }
};

const lbwPayload = {
  type: 'record',
  title: 'LBW',
  image: '',
  summary:
    'LBW means Leg Before Wicket. A batter can be out if the ball hits the pad or body first and the ball would have hit the stumps.',
  stats: {},
  extra: {
    action: 'general_knowledge',
    evidence_state: 'available',
    archive_evidence: false,
    sources: ['Local Knowledge'],
    suggestions: ['Who won the 2011 World Cup?'],
    detected_entities: ['Leg Before Wicket']
  },
  detected_entities: ['Leg Before Wicket']
};

const unavailablePayload = {
  type: 'team',
  title: 'India',
  image: '',
  summary: 'I could not find archived matches or win statistics for India in the verified dataset.',
  stats: { matches: 0, wins: 0, win_rate: 0, average_score: 0 },
  extra: {
    action: 'team_stats',
    evidence_state: 'unavailable',
    archive_evidence: false,
    suggestions: ['What is LBW?'],
    entities: { team: { name: 'India' } }
  },
  detected_entities: ['India']
};

const liveUnavailablePayload = {
  type: 'match',
  title: 'Match Center',
  image: '',
  summary: 'Live match and schedule updates are unavailable because the CricAPI key is not configured.',
  stats: { feed_status: 'Live feed not configured', upcoming_matches: 0, recent_matches: 0 },
  extra: {
    action: 'live_update',
    evidence_state: 'unavailable',
    archive_evidence: false,
    suggestions: ['What is LBW?'],
    provider_status: {
      state: 'not_configured',
      title: 'Live feed not configured'
    }
  },
  detected_entities: []
};

async function installApiMocks(page) {
  await page.route('**/api/status', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(statusPayload) })
  );
  await page.route('**/api/query', async (route) => {
    const request = route.request();
    const payload = request.postDataJSON();
    const question = String(payload?.question || '');
    const response = /live scores?/i.test(question)
      ? liveUnavailablePayload
      : /india team summary/i.test(question)
        ? unavailablePayload
        : lbwPayload;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(response) });
  });
}

test('guided evidence workflow and unavailable state', async ({ page }) => {
  await installApiMocks(page);
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Cricket Intelligence' })).toBeVisible();
  await expect(page.getByText('API ready')).toBeVisible();
  await expect(page.getByLabel('Runtime status').getByText('Archive not loaded')).toBeVisible();

  await page.getByRole('button', { name: 'What is LBW?' }).click();
  await expect(page.getByText(/LBW means Leg Before Wicket/i)).toBeVisible();
  await expect(page.getByText('Local Knowledge')).toBeVisible();
  await expect(page.getByText('Evidence unavailable')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Leg Before Wicket' })).toHaveCount(0);

  const composer = page.getByRole('textbox', { name: 'Ask a cricket question' });
  await composer.fill('India team summary');
  await page.getByRole('button', { name: 'Ask' }).click();
  await expect(page.getByText('Evidence unavailable')).toBeVisible();
  await expect(page.getByText(/no verified archive statistics/i)).toBeVisible();
  await expect(page.getByText('Matches', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Wins', { exact: true })).toHaveCount(0);

  await page.getByRole('button', { name: 'Clear' }).click();
  await expect(page.getByText('Try a verified path')).toBeVisible();
  await page.getByRole('button', { name: 'Check live-score availability' }).click();
  await expect(page.getByText(/CricAPI key is not configured/i)).toBeVisible();
  await expect(page.getByText('Evidence unavailable')).toBeVisible();
});

test('mobile flow reflows without horizontal overflow and keeps status visible', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installApiMocks(page);
  await page.goto('/');

  await expect(page.getByText('API ready')).toBeVisible();
  await expect(page.getByLabel('Runtime status').getByText('Archive not loaded')).toBeVisible();
  await page.getByRole('button', { name: 'What is LBW?' }).click();
  await expect(page.getByText(/LBW means Leg Before Wicket/i)).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);

  await page.keyboard.press('Tab');
  const focused = page.locator(':focus');
  await expect(focused).toBeVisible();
  const outlineStyle = await focused.evaluate((element) => getComputedStyle(element).outlineStyle);
  expect(outlineStyle).not.toBe('none');
});

test('production surface does not require runtime font or Tailwind CDNs', async ({ page }) => {
  await installApiMocks(page);
  const externalRuntimeRequests = [];
  page.on('request', (request) => {
    const url = request.url();
    if (/fonts\.googleapis|fonts\.gstatic|cdn\.tailwindcss/i.test(url)) {
      externalRuntimeRequests.push(url);
    }
  });

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Cricket Intelligence' })).toBeVisible();
  expect(externalRuntimeRequests).toEqual([]);
});
