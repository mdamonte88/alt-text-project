/**
 * A deterministic stand-in for a suggested-alt-text service.
 *
 * This module deliberately does not call an AI provider. It uses the context
 * already collected by the HTML processor so the real service can be swapped
 * in later without changing the issue shape.
 */

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

module.exports = {
  suggestAltText,
  suggestAltForIssue,
  suggestAltTexts,
  createMockSuggestedAltService,
}
