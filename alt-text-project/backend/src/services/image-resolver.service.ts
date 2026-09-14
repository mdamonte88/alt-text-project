import dns from 'node:dns/promises';
import net from 'node:net';
import { env } from '../config/env';
import { AppError, ImageInput, ResolvedImage, SUPPORTED_IMAGE_MIME_TYPES, SupportedImageMimeType } from '../types/alt.types';

const MAX_REDIRECTS = 3;
const isPrivateAddress = (a: string) => {
  if (net.isIPv4(a)) { const p = a.split('.').map(Number); return p[0] === 10 || p[0] === 127 || p[0] === 0 || (p[0] === 169 && p[1] === 254) || (p[0] === 172 && p[1] >= 16 && p[1] <= 31) || (p[0] === 192 && p[1] === 168); }
  const n = a.toLowerCase(); return n === '::1' || n === '::' || n.startsWith('fc') || n.startsWith('fd') || /^fe[89ab]/.test(n);
};
async function safeUrl(value: string): Promise<URL> {
  let url: URL; try { url = new URL(value); } catch { throw new AppError(400, 'INVALID_IMAGE_URL', 'The image URL is invalid.'); }
  if (!['http:', 'https:'].includes(url.protocol)) throw new AppError(400, 'INVALID_IMAGE_URL', 'Only http and https image URLs are allowed.');
  const host = url.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host === 'metadata.google.internal') throw new AppError(400, 'UNSAFE_IMAGE_URL', 'The image URL points to a forbidden host.');
  let addresses: string[];
  try { addresses = net.isIP(host) ? [host] : (await dns.lookup(host, { all: true })).map(r => r.address); }
  catch { throw new AppError(502, 'IMAGE_FETCH_FAILED', 'The image could not be retrieved.'); }
  if (!addresses.length || addresses.some(isPrivateAddress)) throw new AppError(400, 'UNSAFE_IMAGE_URL', 'The image URL points to a private or internal address.');
  return url;
}
const responseMime = (value: string | null): SupportedImageMimeType | null => {
  const mime = value?.split(';', 1)[0].trim().toLowerCase();
  return mime && (SUPPORTED_IMAGE_MIME_TYPES as readonly string[]).includes(mime) ? mime as SupportedImageMimeType : null;
};
async function readLimited(response: Response): Promise<Buffer> {
  const max = env.MAX_IMAGE_SIZE_MB * 1024 * 1024;
  if (Number(response.headers.get('content-length')) > max) throw new AppError(413, 'IMAGE_TOO_LARGE', 'The image exceeds the maximum allowed size.');
  if (!response.body) throw new AppError(502, 'IMAGE_FETCH_FAILED', 'The image could not be retrieved.');
  const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let total = 0;
  try { while (true) { const { done, value } = await reader.read(); if (done) break; total += value.byteLength; if (total > max) throw new AppError(413, 'IMAGE_TOO_LARGE', 'The image exceeds the maximum allowed size.'); chunks.push(value); } }
  finally { reader.releaseLock(); }
  return Buffer.concat(chunks.map(c => Buffer.from(c)));
}
export class ImageResolver {
  async resolve(image: ImageInput): Promise<ResolvedImage> {
    const max = env.MAX_IMAGE_SIZE_MB * 1024 * 1024;
    if (image.type === 'base64') {
      const raw = image.value.replace(/^data:[^;]+;base64,/, '');
      const buffer = Buffer.from(raw, 'base64');
      if (!buffer.length || buffer.toString('base64').replace(/=+$/, '') !== raw.replace(/=+$/, '')) throw new AppError(400, 'INVALID_BASE64', 'The image content is not valid base64.');
      if (buffer.length > max) throw new AppError(413, 'IMAGE_TOO_LARGE', 'The image exceeds the maximum allowed size.');
      return { buffer, mimeType: image.mimeType };
    }
    let url = await safeUrl(image.value);
    for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect++) {
      let response: Response;
      try { response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(env.IMAGE_FETCH_TIMEOUT_MS) }); }
      catch (error) { if (error instanceof Error && error.name === 'TimeoutError') throw new AppError(504, 'IMAGE_FETCH_TIMEOUT', 'The image request timed out.'); throw new AppError(502, 'IMAGE_FETCH_FAILED', 'The image could not be retrieved.'); }
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location');
        if (!location || redirect === MAX_REDIRECTS) throw new AppError(502, 'IMAGE_FETCH_FAILED', 'The image could not be retrieved.');
        url = await safeUrl(new URL(location, url).toString()); continue;
      }
      if (!response.ok) throw new AppError(502, 'IMAGE_FETCH_FAILED', 'The image could not be retrieved.');
      const mimeType = responseMime(response.headers.get('content-type'));
      if (!mimeType) throw new AppError(415, 'UNSUPPORTED_IMAGE_TYPE', 'The image type is not supported.');
      return { buffer: await readLimited(response), mimeType };
    }
    throw new AppError(502, 'IMAGE_FETCH_FAILED', 'The image could not be retrieved.');
  }
}
export const imageResolver = new ImageResolver();
