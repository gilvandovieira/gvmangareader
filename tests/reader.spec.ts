import { expect, test, type Page } from '@playwright/test';

const FIXTURE = 'tests/fixtures/mixed.cbz';

async function openFixture(page: Page) {
  await page.goto('/');
  await page.locator('input[type=file]').setInputFiles(FIXTURE);
}

/** Waits until page `n` is fully shown and returns the MIME type of the Blob behind the `<img>`. */
async function expectShown(page: Page, n: number): Promise<string> {
  await expect(page.getByText(`${n} / 5`)).toBeVisible();
  await expect(page.locator('[aria-busy=true]')).toHaveCount(0);
  const image = page.getByRole('img', { name: `Page ${n}` });
  await expect.poll(() => image.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth)).toBe(300);
  return image.evaluate(async (el: HTMLImageElement) => (await (await fetch(el.src)).blob()).type);
}

test('discovers .jxl entries as image/jxl pages', async ({ page }) => {
  await page.goto('/');
  const pages = await page.evaluate(async () => {
    const cbzModule = '/src/cbz/cbz.ts';
    const { openCbz, readPage } = await import(cbzModule);
    const data = await (await fetch('/tests/fixtures/mixed.cbz')).blob();
    const { manga, zip } = await openCbz(new File([data], 'mixed.cbz'));
    return Promise.all(
      manga.pages.map(async (p: { path: string }) => [p.path, (await readPage(zip, p)).type]),
    );
  });
  expect(pages).toEqual([
    ['01.jxl', 'image/jxl'],
    ['02.png', 'image/png'],
    ['03.jpg', 'image/jpeg'],
    ['04.jxl', 'image/jxl'],
    ['05.jxl', 'image/jxl'],
  ]);
});

test('shows JXL, PNG and JPEG pages and keeps working after a broken JXL page', async ({ page }) => {
  const jxlShownAs = test.info().project.name === 'native-jxl' ? 'image/jxl' : 'image/png';
  const next = page.getByRole('button', { name: 'Next page' });
  const previous = page.getByRole('button', { name: 'Previous page' });
  await openFixture(page);

  expect(await expectShown(page, 1)).toBe(jxlShownAs);
  await next.click();
  expect(await expectShown(page, 2)).toBe('image/png');
  await next.click();
  expect(await expectShown(page, 3)).toBe('image/jpeg');

  await next.click();
  await expect(page.getByRole('alert')).toContainText('age 4');
  await expect(page.getByRole('img')).toHaveCount(0);

  await next.click();
  expect(await expectShown(page, 5)).toBe(jxlShownAs);
  for (let n = 4; n >= 1; n--) await previous.click();
  expect(await expectShown(page, 1)).toBe(jxlShownAs);
});

test('keeps working when the WASM decoder cannot be loaded', async ({ page }) => {
  test.skip(test.info().project.name === 'native-jxl', 'The decoder is not used with native support.');
  await page.route('**/*.wasm', (route) => route.abort());
  await openFixture(page);

  await expect(page.getByRole('alert')).toContainText('Could not load page 1');
  await page.getByRole('button', { name: 'Next page' }).click();
  expect(await expectShown(page, 2)).toBe('image/png');
});

test.describe('reading progress', () => {
  const progressKeys = (page: Page) =>
    page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith('gvmangareader.progress:')));

  test('resumes a reopened file at the last page read', async ({ page }) => {
    await openFixture(page);
    await page.getByRole('button', { name: 'Next page' }).click();
    await page.getByRole('button', { name: 'Next page' }).click();
    await expectShown(page, 3);

    await openFixture(page);
    await expectShown(page, 3);
    expect(await progressKeys(page)).toHaveLength(1);
  });

  test('clamps out-of-range and ignores invalid saved pages', async ({ page }) => {
    await openFixture(page);
    await expectShown(page, 1);
    const [key] = await progressKeys(page);

    await page.evaluate((key) => localStorage.setItem(key, '99'), key);
    await openFixture(page);
    await expectShown(page, 5);

    await page.evaluate((key) => localStorage.setItem(key, 'not a number'), key);
    await openFixture(page);
    await expectShown(page, 1);
  });

  test('reads normally when storage throws', async ({ page }) => {
    await page.addInitScript(() => {
      const fail = () => {
        throw new DOMException('Storage disabled', 'SecurityError');
      };
      Storage.prototype.getItem = fail;
      Storage.prototype.setItem = fail;
    });
    await openFixture(page);
    await expectShown(page, 1);
    await page.getByRole('button', { name: 'Next page' }).click();
    await expectShown(page, 2);
  });
});

test.describe('double-page mode', () => {
  /** Names of the page images on screen, from left to right, once all have loaded. */
  async function shownLeftToRight(page: Page): Promise<string[]> {
    await expect(page.locator('[aria-busy=true]')).toHaveCount(0);
    const images = await page.getByRole('img', { name: /^Page \d+$/ }).all();
    const placed = await Promise.all(
      images.map(async (image) => ({ name: await image.getAttribute('alt'), x: (await image.boundingBox())!.x })),
    );
    return placed.sort((a, b) => a.x - b.x).map(({ name }) => name!);
  }

  test('shows page 1 alone, then pairs, in reading-direction order', async ({ page }) => {
    const next = page.getByRole('button', { name: 'Next page' });
    const previous = page.getByRole('button', { name: 'Previous page' });
    await openFixture(page);
    await page.getByRole('button', { name: 'Double' }).click();

    await expect(page.getByText('1 / 5')).toBeVisible();
    expect(await shownLeftToRight(page)).toEqual(['Page 1']);

    await next.click();
    await expect(page.getByText('2–3 / 5')).toBeVisible();
    expect(await shownLeftToRight(page)).toEqual(['Page 3', 'Page 2']);
    // The two pages meet at the spine: each is pushed toward the other.
    const positions = await page
      .getByRole('img', { name: /^Page \d+$/ })
      .evaluateAll((images) => images.map((image) => getComputedStyle(image).objectPosition));
    expect(positions).toEqual(['100% 50%', '0% 50%']);

    await next.click();
    await expect(page.getByText('4–5 / 5')).toBeVisible();
    await expect(page.getByRole('alert')).toContainText(/page 4/i);
    expect(await shownLeftToRight(page)).toEqual(['Page 5']);
    await expect(next).toBeDisabled();

    await page.getByRole('button', { name: 'LTR' }).click();
    await previous.click();
    await expect(page.getByText('2–3 / 5')).toBeVisible();
    expect(await shownLeftToRight(page)).toEqual(['Page 2', 'Page 3']);
    await previous.click();
    await expect(page.getByText('1 / 5')).toBeVisible();
  });

  test('pairs page 1 with page 2 when the cover is paired', async ({ page }) => {
    await openFixture(page);
    await page.getByRole('button', { name: 'Double' }).click();
    await page.getByRole('button', { name: 'Cover paired' }).click();
    await expect(page.getByText('1–2 / 5')).toBeVisible();
    await page.getByRole('button', { name: 'Next page' }).click();
    await expect(page.getByText('3–4 / 5')).toBeVisible();
  });

  test('remembers the layout and resumes at the same spread', async ({ page }) => {
    await openFixture(page);
    await page.getByRole('button', { name: 'LTR' }).click();
    await page.getByRole('button', { name: 'Double' }).click();
    await page.getByRole('button', { name: 'Next page' }).click();
    await page.getByRole('button', { name: 'Next page' }).click();
    await expect(page.getByText('4–5 / 5')).toBeVisible();

    await openFixture(page);
    await expect(page.getByText('4–5 / 5')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Double' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: 'LTR' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: 'Cover alone' })).toHaveAttribute('aria-pressed', 'true');
  });
});
