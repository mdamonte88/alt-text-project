const SUPPORTED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const DEFAULT_MAX_IMAGE_BYTES = 10 * 1024 * 1024
const DEFAULT_TIMEOUT_MS = 15000

function normalizeMimeType(contentType) {
  return typeof contentType === 'string' ? contentType.split(';', 1)[0].trim().toLowerCase() : ''
}

async function getImageData(url, {
  fetchImpl = globalThis.fetch,
  maxBytes = DEFAULT_MAX_IMAGE_BYTES,
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  if (typeof fetchImpl !== 'function') throw new Error('Image acquisition requires a fetch implementation.')

  let response
  let controller
  let timeout
  try {
    controller = typeof AbortController === 'function' ? new AbortController() : undefined
    timeout = controller ? setTimeout(() => controller.abort(), timeoutMs) : undefined
    response = await fetchImpl(url, { signal: controller?.signal })
  } catch (error) {
    if (error?.name === 'AbortError') throw Object.assign(new Error(`Image request timed out after ${timeoutMs} ms`), { code: 'IMAGE_TIMEOUT' })
    throw Object.assign(new Error(`Image request failed: ${error.message}`), { code: 'IMAGE_REQUEST_FAILED' })
  } finally {
    if (timeout) clearTimeout(timeout)
  }

  if (!response.ok) throw Object.assign(new Error(`Image request returned HTTP ${response.status}`), { code: 'IMAGE_HTTP_ERROR' })

  const mimeType = normalizeMimeType(response.headers?.get?.('content-type') || response.headers?.['content-type'])
  if (!SUPPORTED_MIME_TYPES.has(mimeType)) {
    throw Object.assign(new Error(`Unsupported image MIME type: ${mimeType || '(missing)'}`), { code: 'UNSUPPORTED_MIME_TYPE' })
  }

  const contentLength = Number(response.headers?.get?.('content-length') || response.headers?.['content-length'] || 0)
  if (contentLength > maxBytes) throw Object.assign(new Error(`Image exceeds the ${maxBytes}-byte limit`), { code: 'IMAGE_TOO_LARGE' })

  let buffer
  if (response.body && Symbol.asyncIterator in response.body) {
    const chunks = []
    let size = 0
    for await (const chunk of response.body) {
      size += chunk.length
      if (size > maxBytes) throw Object.assign(new Error(`Image exceeds the ${maxBytes}-byte limit`), { code: 'IMAGE_TOO_LARGE' })
      chunks.push(Buffer.from(chunk))
    }
    buffer = Buffer.concat(chunks)
  } else {
    buffer = Buffer.from(await response.arrayBuffer())
    if (buffer.length > maxBytes) throw Object.assign(new Error(`Image exceeds the ${maxBytes}-byte limit`), { code: 'IMAGE_TOO_LARGE' })
  }

  if (buffer.length === 0) throw Object.assign(new Error('Image response was empty'), { code: 'EMPTY_IMAGE' })
  return { buffer, mimeType }
}

module.exports = { getImageData, normalizeMimeType, SUPPORTED_MIME_TYPES }
