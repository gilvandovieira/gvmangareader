import { expect, test, type Page } from '@playwright/test';

const FIXTURE = 'tests/fixtures/mixed.cbz';

async function openFixture(page: Page) {
  await page.goto('/');
  await page.locator('input[type=file]').setInputFiles(FIXTURE);
}

/** Waits until page `n` is fully shown and returns the MIME type of the Blob behind the `<img>`. */
async function expectShown(page: Page, n: number, total = 5): Promise<string> {
  await expect(page.getByText(`${n} / ${total}`)).toBeVisible();
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

test.describe('page sidebar', () => {
  const sidebar = (page: Page) => page.getByRole('navigation', { name: 'Page thumbnails' });
  const thumbnail = (page: Page, n: number) => sidebar(page).getByRole('button', { name: `Page ${n}`, exact: true });

  test('lists every page, highlights the current spread and jumps to a clicked page', async ({ page }) => {
    await openFixture(page);
    await expect(sidebar(page).getByRole('button', { name: /^Page \d+$/ })).toHaveCount(5);
    await expect(thumbnail(page, 1)).toHaveAttribute('aria-current', 'page');
    await expect(thumbnail(page, 1).locator('img')).toBeVisible();

    await thumbnail(page, 3).click();
    await expectShown(page, 3);
    await expect(thumbnail(page, 3)).toHaveAttribute('aria-current', 'page');
    await expect(thumbnail(page, 1)).not.toHaveAttribute('aria-current');

    await page.getByRole('button', { name: 'Double' }).click();
    await thumbnail(page, 5).click();
    await expect(page.getByText('4–5 / 5')).toBeVisible();
    await expect(thumbnail(page, 4)).toHaveAttribute('aria-current', 'page');
    await expect(thumbnail(page, 5)).toHaveAttribute('aria-current', 'page');
    await expect(thumbnail(page, 3)).not.toHaveAttribute('aria-current');
  });

  test('collapses and moves to either side, and remembers both', async ({ page }) => {
    const toggle = page.getByRole('button', { name: 'Thumbnails' });
    await openFixture(page);
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');

    await toggle.click();
    await expect(sidebar(page)).toBeHidden();
    await openFixture(page);
    await expect(sidebar(page)).toBeHidden();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await toggle.click();
    await expect(sidebar(page)).toBeVisible();
    expect((await sidebar(page).boundingBox())!.x).toBe(0);
    await sidebar(page).getByRole('button', { name: 'Move to right' }).click();
    const width = page.viewportSize()!.width;
    await expect.poll(async () => { const box = (await sidebar(page).boundingBox())!; return box.x + box.width; }).toBe(width);

    await openFixture(page);
    await expect(sidebar(page)).toBeVisible();
    await expect(sidebar(page).getByRole('button', { name: 'Move to left' })).toBeVisible();
  });

  test('loads thumbnails lazily and releases their Blob URLs when the book closes', async ({ page }) => {
    await page.addInitScript(() => {
      const live = new Set<string>();
      Object.assign(window, { liveUrls: live });
      const create = URL.createObjectURL.bind(URL);
      const revoke = URL.revokeObjectURL.bind(URL);
      URL.createObjectURL = (object) => {
        const url = create(object);
        live.add(url);
        return url;
      };
      URL.revokeObjectURL = (url) => {
        live.delete(url);
        revoke(url);
      };
    });
    const liveUrls = () => page.evaluate(() => [...(window as unknown as { liveUrls: Set<string> }).liveUrls]);
    const loadedThumbnails = sidebar(page).locator('img');

    await openGeneratedBook(page, 60);
    await expectShown(page, 1, 60);
    await expect.poll(() => loadedThumbnails.count()).toBeGreaterThan(2);
    await page.waitForTimeout(300);
    expect(await loadedThumbnails.count()).toBeLessThan(15);
    await expect(thumbnail(page, 60).locator('img')).toHaveCount(0);

    await thumbnail(page, 60).scrollIntoViewIfNeeded();
    await expect(thumbnail(page, 60).locator('img')).toBeVisible();
    // Only the small thumbnails and the page on screen hold a Blob URL, never a full-size decode.
    expect(await liveUrls()).toHaveLength((await loadedThumbnails.count()) + 1);

    const bookUrls = await liveUrls();
    await page.locator('input[type=file]').setInputFiles(FIXTURE);
    await expectShown(page, 1);
    expect((await liveUrls()).filter((url) => bookUrls.includes(url))).toEqual([]);
  });
});

/** Builds a CBZ of solid-color PNG pages in the browser and opens it. */
async function openGeneratedBook(page: Page, pageCount: number) {
  await page.goto('/');
  await page.addScriptTag({ url: '/node_modules/jszip/dist/jszip.min.js' });
  await page.evaluate(async (pageCount) => {
    type Zip = { file: (name: string, data: Blob) => void; generateAsync: (options: object) => Promise<Blob> };
    const zip: Zip = new (window as unknown as { JSZip: new () => Zip }).JSZip();
    const canvas = new OffscreenCanvas(300, 420);
    const context = canvas.getContext('2d')!;
    for (let i = 1; i <= pageCount; i++) {
      context.fillStyle = `hsl(${i * 37} 70% 70%)`;
      context.fillRect(0, 0, canvas.width, canvas.height);
      zip.file(`${String(i).padStart(3, '0')}.png`, await canvas.convertToBlob());
    }
    const file = new File([await zip.generateAsync({ type: 'blob' })], 'generated.cbz');
    const input = document.querySelector<HTMLInputElement>('input[type=file]')!;
    const transfer = new DataTransfer();
    transfer.items.add(file);
    input.files = transfer.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, pageCount);
}
