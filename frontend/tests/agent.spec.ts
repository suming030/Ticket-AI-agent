import { test, expect } from '@playwright/test';

const path = '/Ticket-AI-agent/';
test('버튼 클릭으로 홈·에이전트·데모·비교 화면을 전환', async ({ page }) => {
  await page.goto(path);
  await expect(page.getByRole('heading', { name: /매진된 열차/ })).toBeVisible();
  await page.getByRole('button', { name: '에이전트 시작하기' }).click();
  await expect(page.getByRole('heading', { name: /한 번 말하면/ })).toBeVisible();
  await page.getByRole('button', { name: '데모 체험' }).click();
  await expect(page.getByRole('heading', { name: /취소표 한 장의/ })).toBeVisible();
  await page.getByRole('button', { name: '버전 비교' }).click();
  await expect(page.getByText('상태 머신 + MockRailClient')).toBeVisible();
});

test('데모는 초기 7개, 재생 시작 0개, 완료 후 7개', async ({ page }) => {
  await page.goto(path + '#demo');
  await expect(page.locator('.chat-line,.system-notice')).toHaveCount(7);
  await page.getByRole('button', { name: /데모 다시 재생/ }).click();
  await expect(page.locator('.chat-line,.system-notice')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /재생 중/ })).toBeDisabled();
  await expect(page.locator('.chat-line,.system-notice')).toHaveCount(7, { timeout: 14_000 });
});

test('모션 감소 설정일 때 재생 즉시 완료', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(path + '#demo');
  await page.getByRole('button', { name: /데모 다시 재생/ }).click();
  await expect(page.locator('.chat-line,.system-notice')).toHaveCount(7);
});

test('Mock 3번 조회 후 승인, 새로고침에도 데이터 유지', async ({ page }) => {
  await page.goto(path + '#agent');
  await page.getByRole('button', { name: /예시 요청 바로 보내기/ }).click();
  await expect(page.getByText('취소표가 나왔어요!', { exact: false })).toBeVisible({ timeout: 19_000 });
  await page.getByRole('button', { name: '예매 승인' }).click();
  await expect(page.getByText('좌석을 확보했어요.', { exact: false })).toBeVisible();
  await page.reload();
  await expect(page.getByText('좌석을 확보했어요.', { exact: false })).toBeVisible();
});

test('375px 화면에서 가로 스크롤 없음', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  for (const view of ['home','agent','demo','compare']) {
    await page.goto(path + '#' + view);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), view).toBeTruthy();
  }
});

test('다크 모드 전환', async ({ page }) => {
  await page.goto(path + '#agent');
  await page.getByRole('button', { name: /다크 모드로 전환/ }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('.phone-header')).toBeVisible();
});

test('발표용 데스크톱/모바일·라이트/다크 화면 캡처', async ({ page }) => {
  for (const width of [1280, 375]) {
    await page.setViewportSize({ width, height: 850 });
    for (const dark of [false, true]) {
      await page.goto(path + '#demo');
      const theme = await page.locator('html').getAttribute('data-theme');
      if ((theme === 'dark') !== dark) {
        await page.getByRole('button', { name: dark ? '다크 모드로 전환' : '라이트 모드로 전환' }).click();
      }
      await page.screenshot({ path: `test-results/screenshot-${width}-${dark ? 'dark' : 'light'}.png`, fullPage: true });
    }
  }
});
