/**
 * Optional binary framing for large host -> client messages: one tag byte followed by deflate-raw(JSON).
 * Snapshots are repetitive JSON, so this cuts host upload 3-7x, which matters most on slow or lossy links
 * where congestion control, not latency alone, limits how many snapshots reach a player.
 */
export const FRAME_DEFLATE = 1;
/** Smaller messages are sent as text: compression would save little and add a frame of latency. */
export const COMPRESS_MIN_CHARS = 1024;
export const MAX_COMPRESSED_BYTES = 128 * 1024;

export function compressionSupported(): boolean {
  return typeof CompressionStream === 'function' && typeof ReadableStream === 'function' && typeof TextEncoder === 'function';
}

export function decompressionSupported(): boolean {
  return typeof DecompressionStream === 'function' && typeof ReadableStream === 'function' && typeof TextDecoder === 'function';
}

function streamOf(bytes: Uint8Array<ArrayBuffer>): ReadableStream<BufferSource> {
  return new ReadableStream<BufferSource>({ start(controller) { controller.enqueue(bytes); controller.close(); } });
}

/** Reads a byte stream completely, or returns null once it exceeds maxBytes. */
async function readAll(stream: ReadableStream<Uint8Array>, maxBytes: number, offset = 0): Promise<Uint8Array | null> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) { void reader.cancel().catch(() => undefined); return null; }
    chunks.push(value);
  }
  const out = new Uint8Array(offset + total);
  let position = offset;
  for (const chunk of chunks) { out.set(chunk, position); position += chunk.byteLength; }
  return out;
}

export async function encodeDeflateFrame(text: string): Promise<Uint8Array> {
  const compressed = streamOf(new TextEncoder().encode(text)).pipeThrough(new CompressionStream('deflate-raw'));
  const frame = await readAll(compressed, MAX_COMPRESSED_BYTES, 1);
  if (!frame) throw new RangeError('Compressed frame too large');
  frame[0] = FRAME_DEFLATE;
  return frame;
}

export function binaryView(raw: unknown): Uint8Array | null {
  if (raw instanceof ArrayBuffer) return new Uint8Array(raw);
  if (ArrayBuffer.isView(raw)) return new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength);
  return null;
}

/** Inflates with a hard output limit so a small frame cannot expand into an unbounded string. */
export async function decodeDeflateFrame(frame: Uint8Array, maxBytes: number): Promise<string | null> {
  if (frame.byteLength < 2 || frame.byteLength > MAX_COMPRESSED_BYTES || frame[0] !== FRAME_DEFLATE) return null;
  try {
    const inflated = streamOf(frame.slice(1)).pipeThrough(new DecompressionStream('deflate-raw'));
    const bytes = await readAll(inflated, maxBytes);
    return bytes ? new TextDecoder('utf-8', { fatal: true }).decode(bytes) : null;
  } catch {
    return null;
  }
}
