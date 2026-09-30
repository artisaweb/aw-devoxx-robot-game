import { test, expect, type Page } from '@playwright/test';

// Every level loads its robot's real model and clips, starts from the
// briefing, and moves the robot — with no page errors, console errors or
// failed requests along the way. Runs on both projects in
// playwright.config.ts; the phone project also drives the on-screen stick.

const LEVELS = [
  { level: 1, path: '/', robot: 'voxxy' },
  { level: 2, path: '/?level=2', robot: 'droid' },
  { level: 3, path: '/?level=3', robot: 'biggy' },
];

type GameWindow = Window & { __game: any };

function collectProblems(page: Page): string[] {
  const problems: string[] = [];
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') problems.push(`console.error: ${m.text()}`);
  });
  page.on('response', (r) => {
    if (r.status() >= 400) problems.push(`HTTP ${r.status()} ${r.url()}`);
    // vite preview answers a missing file with index.html and a 200 (SPA
    // fallback), where the hosted build returns a 404 — so a file request
    // that comes back as HTML is a missing file too.
    const path = new URL(r.url()).pathname;
    const isFile = /\.[a-z0-9]+$/i.test(path) && !path.endsWith('.html');
    if (isFile && (r.headers()['content-type'] ?? '').includes('text/html')) problems.push(`missing file (got index.html): ${path}`);
  });
  return problems;
}

async function robotXZ(page: Page): Promise<[number, number]> {
  return page.evaluate(() => {
    const p = (window as unknown as GameWindow).__game.robot.position;
    return [p.x, p.z] as [number, number];
  });
}

// Holds the stick forward with a real touch, the way a phone player does.
async function holdStickForward(page: Page, ms: number): Promise<void> {
  const stick = page.locator('div[style*="touch-action: none"]').first();
  const box = (await stick.boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  const cdp = await page.context().newCDPSession(page);
  const point = (py: number) => [{ x, y: py, id: 1, radiusX: 8, radiusY: 8, force: 1 }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: point(y) });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: point(y - box.height * 0.2) });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: point(y - box.height * 0.45) });
  await page.waitForTimeout(ms);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

for (const { level, path, robot } of LEVELS) {
  test(`level ${level}: ${robot} loads, starts and moves`, async ({ page }, testInfo) => {
    const problems = collectProblems(page);
    const phone = testInfo.project.name === 'phone';
    await page.goto(path);

    // The real GLTF with all four clips — not the primitives stand-in it
    // shows while loading (or instead, if a model file is missing).
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const r = (window as unknown as GameWindow).__game.robot;
            if (!r.usingRealModel || r.isLoadingModel) return 'loading';
            const clips = Object.keys(r.actions).filter((k) => r.actions[k]);
            return `${r.currentRobotId}:${clips.sort().join(',')}`;
          }),
        { timeout: 45_000 },
      )
      .toBe(`${robot}:jump,run,stun,walk`);

    // Frozen behind the briefing panel until the first control input. The
    // panel only fades out (opacity), so the game's own flag says whether
    // the level has started.
    const awaitingStart = () => page.evaluate(() => (window as unknown as GameWindow).__game.awaitingStart as boolean);
    await expect(page.getByText(`Level ${level} —`).first()).toBeVisible();
    expect(await awaitingStart()).toBe(true);
    await expect(page.getByRole('button', { name: 'JUMP' })).toBeVisible({ visible: phone });

    const [x0, z0] = await robotXZ(page);
    if (phone) {
      await holdStickForward(page, 1500);
    } else {
      await page.keyboard.down('w');
      await page.waitForTimeout(1500);
      await page.keyboard.up('w');
    }
    expect(await awaitingStart()).toBe(false);
    const [x1, z1] = await robotXZ(page);
    expect(Math.hypot(x1 - x0, z1 - z0), 'robot should have moved').toBeGreaterThan(0.5);

    expect(problems).toEqual([]);
  });
}
