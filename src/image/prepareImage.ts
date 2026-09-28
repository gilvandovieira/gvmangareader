import { decodeJxl } from './jpegxl/decodeJxl';
import { supportsNativeJxl } from './jpegxl/supportsNativeJxl';

/**
 * Returns a Blob an `<img>` can show: the original, or for JPEG XL in a browser without native
 * support, a copy decoded by the WASM fallback.
 */
export async function prepareImage(blob: Blob, signal?: AbortSignal): Promise<Blob> {
  if (blob.type !== 'image/jxl' || (await supportsNativeJxl())) return blob;
  return decodeJxl(blob, signal);
}
