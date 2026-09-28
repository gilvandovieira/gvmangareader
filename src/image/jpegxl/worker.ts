import decode from '@jsquash/jxl/decode';

export type DecodeResponse = { blob: Blob } | { error: string };

/** Decodes one JPEG XL Blob and re-encodes it as PNG, which every browser can show. */
onmessage = async ({ data }: MessageEvent<Blob>) => {
  let response: DecodeResponse;
  try {
    const image = await decode(await data.arrayBuffer());
    const canvas = new OffscreenCanvas(image.width, image.height);
    canvas.getContext('2d')!.putImageData(image, 0, 0);
    response = { blob: await canvas.convertToBlob({ type: 'image/png' }) };
  } catch (error) {
    response = { error: error instanceof Error ? error.message : String(error) };
  }
  postMessage(response);
};
