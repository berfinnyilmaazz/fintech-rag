import 'dotenv/config';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium, type Page } from 'playwright-core';

/**
 * Screenshots the app at the three required widths, signed in as a real user.
 *
 * Uses the system Chrome rather than a downloaded browser: playwright-core ships no
 * binaries, so this adds about 5 MB to devDependencies instead of 150.
 *
 *   pnpm shots                       # all pages, all widths, as admin
 *   pnpm shots -- --role user
 */

const BASE = process.env.AUTH_URL ?? 'http://localhost:3000';
const OUT = resolve(process.cwd(), 'screenshots');

const WIDTHS = [
  { name: '375', width: 375, height: 900 },
  { name: '768', width: 768, height: 1000 },
  { name: '1440', width: 1440, height: 1000 },
];

const PAGES = [
  { name: 'signin', path: '/signin', auth: false },
  { name: 'chat', path: '/chat', auth: true },
  { name: 'search', path: '/search', auth: true },
  { name: 'dashboard', path: '/dashboard', auth: true },
];

/**
 * The same question on both pages, so the README can show one retrieval two ways: the raw
 * ranks on /search and the grounded answer built from them on /chat. It is also trap 1 —
 * the deprecated Payments API v1 has to appear, below v2.
 */
const SEARCH_QUERY =
  'How do I create a payment with the current Payments API, and what happened to /v1/charges?';

const CREDENTIALS: Record<string, { email: string; password: string }> = {
  admin: { email: 'admin@demo.local', password: 'admin1234' },
  user: { email: 'user@demo.local', password: 'user1234' },
};

function parseRole(argv: string[]): string {
  const index = argv.indexOf('--role');
  return index === -1 ? 'admin' : (argv[index + 1] ?? 'admin');
}

/**
 * Next's dev-tools badge is a 36x36 circle fixed at bottom-left, and it lands squarely on
 * the user card in the sidebar — including the sign-out button. It is development-only
 * (verified: `nextjs-portal` exists under `next dev` and not under `next start`), so it is
 * not part of the product and should not be in the README's images.
 *
 * Hidden here rather than by setting `devIndicators: false` in next.config.ts, because the
 * badge is a useful thing to have while developing; only the camera needs it out of frame.
 * The host element sits in the light DOM, so an ordinary stylesheet reaches it.
 */
async function shoot(page: Page, file: string): Promise<void> {
  await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
  await page.screenshot({ path: file, fullPage: true });
}

async function main(): Promise<void> {
  const role = parseRole(process.argv.slice(2));
  const credentials = CREDENTIALS[role];
  if (!credentials) throw new Error(`Unknown role "${role}". Use admin or user.`);

  await mkdir(OUT, { recursive: true });

  const browser = await chromium.launch({ channel: 'chrome' });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Sign in once; the cookie is reused for every page and width below.
  await page.goto(`${BASE}/signin`, { waitUntil: 'networkidle' });
  await page.fill('#email', credentials.email);
  await page.fill('#password', credentials.password);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.startsWith('/signin'), { timeout: 30_000 });
  console.log(`signed in as ${credentials.email}`);

  for (const viewport of WIDTHS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });

    for (const target of PAGES) {
      await page.goto(`${BASE}${target.path}`, { waitUntil: 'networkidle' });
      const file = resolve(OUT, `${target.name}-${viewport.name}.png`);
      await shoot(page, file);
      console.log(
        `  ${target.name.padEnd(14)} ${String(viewport.width).padStart(4)}px  ->  ${file}`,
      );
    }

    // Same reasoning as chat-answered below: the empty search page shows a form, not the
    // per-arm ranks that are the whole point of the page.
    await page.goto(`${BASE}/search`, { waitUntil: 'networkidle' });
    await page.fill('input[placeholder="Search the corpus…"]', SEARCH_QUERY);
    await page.keyboard.press('Enter');
    await page.waitForSelector('text=vec', { timeout: 60_000 });
    await page.waitForTimeout(400);

    const searched = resolve(OUT, `search-results-${viewport.name}.png`);
    await shoot(page, searched);
    console.log(
      `  ${'search-results'.padEnd(14)} ${String(viewport.width).padStart(4)}px  ->  ${searched}`,
    );

    // An empty chat page says nothing about how an answer, its citations and its source
    // cards actually look, which is the part worth checking at three widths.
    await page.goto(`${BASE}/chat`, { waitUntil: 'networkidle' });
    await page.fill('textarea', SEARCH_QUERY);
    await page.keyboard.press('Enter');
    // Not `text=Sources`: the model opened one answer with "Based on the provided sources:",
    // which matched mid-stream and captured a half-written answer with no source cards.
    // The attribute exists only on the completed sources box.
    await page.waitForSelector('[data-sources]', { timeout: 90_000 });
    await page.waitForTimeout(400);

    const answered = resolve(OUT, `chat-answered-${viewport.name}.png`);
    await shoot(page, answered);
    console.log(
      `  ${'chat-answered'.padEnd(14)} ${String(viewport.width).padStart(4)}px  ->  ${answered}`,
    );
  }

  await browser.close();
}

main().catch((error: unknown) => {
  console.error('\nscreenshot failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
