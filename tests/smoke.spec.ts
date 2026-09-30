import { test, expect } from '@playwright/test';
import { awaitingStart, collectProblems, expectRealRobot, holdStickForward, isPhone, robotXYZ } from './helpers';

// Every level loads its robot's real model and clips, starts from the
// briefing, and moves the robot — with no page errors, console errors or
// failed requests along the way. Runs on both projects in
// playwright.config.ts; the phone project also drives the on-screen stick.

const LEVELS = [
  { level: 1, path: '/', robot: 'voxxy' },
  { level: 2, path: '/?level=2', robot: 'droid' },
  { level: 3, path: '/?level=3', robot: 'biggy' },
];

for (const { level, path, robot } of LEVELS) {
  test(`level ${level}: ${robot} loads, starts and moves`, async ({ page }, testInfo) => {
    const problems = collectProblems(page);
    const phone = isPhone(testInfo.project.name);
    await page.goto(path);
    await expectRealRobot(page, robot);

    // Frozen behind the briefing panel until the first control input. The
    // panel only fades out (opacity), so the game's own flag says whether
    // the level has started.
    await expect(page.getByText(`Level ${level} —`).first()).toBeVisible();
    expect(await awaitingStart(page)).toBe(true);
    await expect(page.getByRole('button', { name: 'JUMP' })).toBeVisible({ visible: phone });

    const [x0, , z0] = await robotXYZ(page);
    if (phone) {
      await holdStickForward(page, 1500);
    } else {
      await page.keyboard.down('w');
      await page.waitForTimeout(1500);
      await page.keyboard.up('w');
    }
    expect(await awaitingStart(page)).toBe(false);
    const [x1, , z1] = await robotXYZ(page);
    expect(Math.hypot(x1 - x0, z1 - z0), 'robot should have moved').toBeGreaterThan(0.5);

    expect(problems).toEqual([]);
  });
}
