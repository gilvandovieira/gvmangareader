import type { DecodeResponse } from './worker';

type Job = {
  blob: Blob;
  signal?: AbortSignal;
  resolve: (blob: Blob) => void;
  reject: (error: Error) => void;
};

// One worker decodes one image at a time. Jobs wait here rather than in the worker's message
// queue, so pages skipped during fast page turns are dropped before they are decoded.
let worker: Worker | undefined;
let current: Job | undefined;
const queue: Job[] = [];

/** Decodes JPEG XL to a PNG Blob in a Web Worker, loading the WASM decoder on first use. */
export function decodeJxl(blob: Blob, signal?: AbortSignal): Promise<Blob> {
  return new Promise((resolve, reject) => {
    queue.push({ blob, signal, resolve, reject });
    next();
  });
}

function next(): void {
  while (!current && queue.length > 0) {
    const job = queue.shift()!;
    if (job.signal?.aborted) {
      job.reject(job.signal.reason);
    } else {
      current = job;
      getWorker().postMessage(job.blob);
    }
  }
}

function finish(settle: (job: Job) => void): void {
  const job = current;
  current = undefined;
  if (job) settle(job);
  next();
}

function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = ({ data }: MessageEvent<DecodeResponse>) => {
    finish((job) => ('blob' in data ? job.resolve(data.blob) : job.reject(new Error(`JPEG XL decoding failed: ${data.error}`))));
  };
  // Fires when the worker or its WASM module fails to load. Start a fresh worker for the next job.
  worker.onerror = (event) => {
    event.preventDefault();
    worker?.terminate();
    worker = undefined;
    finish((job) => job.reject(new Error('The JPEG XL decoder could not be loaded.')));
  };
  return worker;
}
