/** Deterministic local fallback used by the unit tests and offline callers. */

const fs = require('node:fs')
const path = require('node:path')

const IMAGE_MIME_TYPES = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
}

function cleanText(value) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
}

function filenameFallback(src) {
  const filename = cleanText(src)
    .split(/[?#]/)[0]
    .split('/')
    .pop()
    .replace(/\.[^.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return filename ? filename.charAt(0).toUpperCase() + filename.slice(1) : ''
}

/**
 * Return a deterministic alt-text suggestion for one missing-alt issue.
 * Captions are the strongest available signal, followed by nearby text and
 * finally the image filename.
 */
function suggestAltText(issue) {
  if (!issue || typeof issue !== 'object') {
    throw new TypeError('An image issue is required.')
  }

  const context = issue.context || {}
  return (
    cleanText(context.caption) ||
    cleanText(context.surroundingText) ||
    filenameFallback(context.src) ||
    'Image'
  )
}

/**
 * Add a suggestion to an issue without mutating the original issue.
 */
function suggestAltForIssue(issue) {
  return {
    ...issue,
    suggestedAlt: suggestAltText(issue),
  }
}

/**
 * Add suggestions to every issue without mutating the input array or issues.
 */
function suggestAltTexts(issues) {
  if (!Array.isArray(issues)) {
    throw new TypeError('An array of image issues is required.')
  }

  return issues.map(suggestAltForIssue)
}

// This factory gives callers a service-shaped API while keeping the mock
// implementation easy to replace with an asynchronous service later.
function createMockSuggestedAltService() {
  return {
    suggestAltText,
    suggestAltForIssue,
    suggestAltTexts,
  }
}

/**
 * Create a client for the real suggested-alt backend.
 *
 * The backend expects an absolute image URL because it resolves the image
 * bytes itself before sending them to the vision model.
 */
function createBackendSuggestedAltService({
  baseUrl = process.env.ALT_BACKEND_URL || 'http://localhost:3001',
  fetchImpl = globalThis.fetch,
  imageBaseDir,
} = {}) {
  if (typeof fetchImpl !== 'function') {
    throw new Error('The backend service requires a fetch implementation.')
  }

  const endpoint = `${baseUrl.replace(/\/$/, '')}/api/suggest-alt`

  async function suggestAltTextFromBackend(issue) {
    if (!issue || typeof issue !== 'object') {
      throw new TypeError('An image issue is required.')
    }

    const src = issue.context?.src
    let image
    try {
      image = { type: 'url', value: new URL(src).toString() }
    } catch {
      if (!imageBaseDir || typeof src !== 'string' || !src.trim()) {
        throw new Error(`The image source must be an absolute URL: ${src || '(missing)'}`)
      }

      const relativePath = src.split(/[?#]/, 1)[0]
      const resolvedPath = path.resolve(imageBaseDir, relativePath)
      const resolvedBaseDir = path.resolve(imageBaseDir)
      if (resolvedPath !== resolvedBaseDir && !resolvedPath.startsWith(`${resolvedBaseDir}${path.sep}`)) {
        throw new Error(`The local image path is outside the source directory: ${src}`)
      }

      const mimeType = IMAGE_MIME_TYPES[path.extname(resolvedPath).toLowerCase()]
      if (!mimeType) {
        throw new Error(`Unsupported local image type: ${src}`)
      }

      image = {
        type: 'base64',
        mimeType,
        value: fs.readFileSync(resolvedPath).toString('base64'),
      }
    }

    const response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'missing-alt',
        context: issue.context || {},
        image,
      }),
    })

    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(payload.error?.message || `Alt-text backend returned HTTP ${response.status}`)
    }

    return typeof payload.suggestedAlt === 'string' ? payload.suggestedAlt : null
  }

  async function suggestAltForIssueFromBackend(issue) {
    return { ...issue, suggestedAlt: await suggestAltTextFromBackend(issue) }
  }

  async function suggestAltTextsFromBackend(issues) {
    if (!Array.isArray(issues)) {
      throw new TypeError('An array of image issues is required.')
    }

    return Promise.all(issues.map(suggestAltForIssueFromBackend))
  }

  return {
    suggestAltText: suggestAltTextFromBackend,
    suggestAltForIssue: suggestAltForIssueFromBackend,
    suggestAltTexts: suggestAltTextsFromBackend,
  }
}

module.exports = {
  suggestAltText,
  suggestAltForIssue,
  suggestAltTexts,
  createMockSuggestedAltService,
  createBackendSuggestedAltService,
}
