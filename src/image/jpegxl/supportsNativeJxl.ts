// A 1×1 lossless JPEG XL image (21 bytes, made with `cjxl -d 0`).
const PROBE = 'data:image/jxl;base64,/woAEAwExY0IAAEAHABLGIsVwhAO';

let support: Promise<boolean> | undefined;

/** Whether `<img>` can decode JPEG XL here. Tested by decoding a real image once per page load. */
export function supportsNativeJxl(): Promise<boolean> {
  support ??= (async () => {
    const image = new Image();
    image.src = PROBE;
    try {
      await image.decode();
      return image.naturalWidth === 1;
    } catch {
      return false;
    }
  })();
  return support;
}
