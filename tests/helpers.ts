import { expect, type Page } from '@playwright/test';

// Shared by the specs. Everything reaches into window.__game, which only
// exists on localhost (see src/util/env.ts) — fine for the preview server
// playwright.config.ts starts, never available on the hosted build.

export type GameWindow = Window & { __game: any };

export function collectProblems(page: Page): string[] {
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

/** Runs `fn` against window.__game in the page. */
export function game<T, A = undefined>(page: Page, fn: (g: any, arg: A) => T, arg?: A): Promise<T> {
  return page.evaluate(
    ([source, a]) => new Function('g', 'a', `return (${source})(g, a);`)((window as unknown as GameWindow).__game, a) as T,
    [fn.toString(), arg] as const,
  );
}

/** Waits for the robot's real GLTF with all four clips, not the stand-in. */
export async function expectRealRobot(page: Page, robot: string): Promise<void> {
  await expect
    .poll(
      () =>
        game(page, (g) => {
          const r = g.robot;
          if (!r.usingRealModel || r.isLoadingModel) return 'loading';
          const clips = Object.keys(r.actions).filter((k) => r.actions[k]);
          return `${r.currentRobotId}:${clips.sort().join(',')}`;
        }),
      { timeout: 45_000 },
    )
    .toBe(`${robot}:jump,run,stun,walk`);
}

export const isPhone = (projectName: string) => projectName === 'phone';

export function robotXYZ(page: Page): Promise<[number, number, number]> {
  return game(page, (g) => [g.robot.position.x, g.robot.position.y, g.robot.position.z] as [number, number, number]);
}

export const awaitingStart = (page: Page) => game(page, (g) => g.awaitingStart as boolean);

/** Holds the on-screen stick forward with real touch events, as a phone player would. */
export async function holdStickForward(page: Page, ms: number): Promise<void> {
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

/** Presses and releases an on-screen button with a real touch. */
export async function tapButton(page: Page, label: string): Promise<void> {
  const box = (await page.getByRole('button', { name: label, exact: true }).boundingBox())!;
  const cdp = await page.context().newCDPSession(page);
  const point = [{ x: box.x + box.width / 2, y: box.y + box.height / 2, id: 2, radiusX: 8, radiusY: 8, force: 1 }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: point });
  await page.waitForTimeout(150);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

/**
 * One fresh "jump" press, the way each project's player does it: Space on
 * the desktop, the JUMP button on the phone. Starts a level from its
 * briefing, continues past a level's end screen, and jumps in play.
 */
export async function pressJump(page: Page, phone: boolean): Promise<void> {
  if (phone) {
    await tapButton(page, 'JUMP');
  } else {
    await page.keyboard.down('Space');
    await page.waitForTimeout(150);
    await page.keyboard.up('Space');
  }
  // Let the game see the release, so the next press is a fresh one.
  await page.waitForTimeout(100);
}
