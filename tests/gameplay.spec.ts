import { test, expect } from '@playwright/test';
import { collectProblems, expectRealRobot, game, isPhone, pressJump, robotXYZ, tapButton } from './helpers';

// Gameplay beyond "it loads": the whole day's level chain through the real
// transitions, scoring, jumping, and the phone-only behaviour (framing,
// resolution cap, the touch-controls switch). Timers and hunger are wound
// down through window.__game rather than waited out, so a full day takes
// seconds, but every transition itself is the game's own code path.

test('a full day: Level 1 → 2 → 3 → day end → new day', async ({ page }, testInfo) => {
  const problems = collectProblems(page);
  const phone = isPhone(testInfo.project.name);
  await page.goto('/');

  const steps = [
    { level: 1, robot: 'voxxy', run: 'swagRun', floor: 'ground' },
    { level: 2, robot: 'droid', run: 'knowledgeRun', floor: 'first' },
    { level: 3, robot: 'biggy', run: 'lunchRun', floor: 'ground' },
  ];
  for (const { level, robot, run, floor } of steps) {
    await expectRealRobot(page, robot);
    expect(await game(page, (g) => [g.level, g.robot.mapMode, g.awaitingStart])).toEqual([level, floor, true]);
    await pressJump(page, phone);
    expect(await game(page, (g) => g.awaitingStart)).toBe(false);

    // End the level the way it really ends: the clock runs out (1, 2), or
    // Biggy's hunger hits zero (3).
    await game(page, (g, r) => {
      if (r === 'lunchRun') g.lunchRun.hunger = 0;
      else g[r].timeRemaining = 0.05;
    }, run);
    await expect.poll(() => game(page, (g, r) => g[r].finished, run)).toBe(true);

    if (level < 3) {
      await expect(page.getByText('Time\'s up!').first()).toBeVisible();
      await pressJump(page, phone);
      await expect.poll(() => game(page, (g) => g.level)).toBe(level + 1);
    }
  }

  // The day-end screen restarts on R only — NEW DAY is its touch equivalent.
  await expect(page.getByRole('button', { name: 'NEW DAY' })).toBeVisible({ visible: phone });
  expect(await page.evaluate(() => localStorage.getItem('dayAtDevoxx.bestScore'))).not.toBeNull();
  await pressJump(page, phone);
  expect(await game(page, (g) => g.level), 'jump must not restart the day').toBe(3);
  if (phone) {
    await tapButton(page, 'NEW DAY');
  } else {
    // Held across a frame, like pressJump(): the game reads keys once per frame.
    await page.keyboard.down('KeyR');
    await page.waitForTimeout(150);
    await page.keyboard.up('KeyR');
  }
  await expect.poll(() => game(page, (g) => g.level)).toBe(1);
  await expectRealRobot(page, 'voxxy');
  expect(await game(page, (g) => [g.robot.mapMode, g.awaitingStart])).toEqual(['ground', true]);

  expect(problems).toEqual([]);
});

test('walking onto swag picks it up and scores', async ({ page }, testInfo) => {
  const phone = isPhone(testInfo.project.name);
  await page.goto('/');
  await expectRealRobot(page, 'voxxy');
  await pressJump(page, phone);
  await page.waitForTimeout(1500); // land from the start jump

  // Drop Voxxy on the nearest ground-level pickup — a real pickup check,
  // just without the walk there.
  const target = await game(page, (g) => {
    const p = g.swagRun.pickups.find((q: any) => !q.collected && q.groundY === 0);
    g.robot.setMap('ground', { x: p.x, y: 0, z: p.z, heading: 0 });
    return { x: p.x, z: p.z };
  });
  await expect.poll(() => game(page, (g) => g.swagRun.score)).toBeGreaterThan(0);
  expect(await game(page, (g, t) => g.swagRun.pickups.find((q: any) => q.x === t.x && q.z === t.z).collected, target)).toBe(true);
});

test('jumping leaves the ground and lands again', async ({ page }, testInfo) => {
  const phone = isPhone(testInfo.project.name);
  await page.goto('/');
  await expectRealRobot(page, 'voxxy');
  await pressJump(page, phone); // starts the level
  await page.waitForTimeout(1500);

  const [, y0] = await robotXYZ(page);
  await pressJump(page, phone);
  let peak = y0;
  for (let i = 0; i < 12; i++) {
    peak = Math.max(peak, (await robotXYZ(page))[1]);
    await page.waitForTimeout(50);
  }
  expect(peak - y0, 'jump height').toBeGreaterThan(0.3);
  await expect.poll(async () => (await robotXYZ(page))[1], { timeout: 5_000 }).toBeCloseTo(y0, 2);
});

test('framing and resolution fit the screen', async ({ page }, testInfo) => {
  const phone = isPhone(testInfo.project.name);
  await page.goto('/');
  await expectRealRobot(page, 'voxxy');
  const [tilt, ratio] = await game(page, (g) => [g.followCamera.tilt, g.resolution.pixelRatio]);
  // A phone held sideways tilts the camera down and starts at 1.5x; a
  // desktop keeps the original framing and up to 2x.
  expect(tilt > 0).toBe(phone);
  expect(ratio).toBeLessThanOrEqual(phone ? 1.5 : 2);

  if (phone) {
    // Turned upright, the tilt goes away.
    await page.setViewportSize({ width: 390, height: 844 });
    await expect.poll(() => game(page, (g) => g.followCamera.tilt)).toBe(0);
  }
});

test('touch controls: on for touch screens, and the switch is remembered', async ({ page }, testInfo) => {
  const phone = isPhone(testInfo.project.name);
  await page.goto('/');
  const jump = page.getByRole('button', { name: 'JUMP', exact: true });
  await expect(jump).toBeVisible({ visible: phone });
  test.skip(!phone, 'the switch is exercised on the phone');

  await page.getByRole('button', { name: /Touch controls: ON/ }).tap();
  await expect(jump).toBeHidden();
  expect(await page.evaluate(() => localStorage.getItem('devoxx-touch-controls'))).toBe('off');

  await page.reload();
  await expect(page.getByRole('button', { name: /Touch controls: OFF/ })).toBeVisible();
  await expect(jump).toBeHidden();
});
