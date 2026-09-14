const assert = require('node:assert/strict')
const path = require('node:path')
const test = require('node:test')

const { applySuggestedAlt, detectMissingAlt } = require('../modifyDom')
const {
  suggestAltText,
  suggestAltForIssue,
  suggestAltTexts,
  createBackendSuggestedAltService,
} = require('../suggestedAltService')

test('uses the image caption as the suggestion', () => {
  const issue = detectMissingAlt(
    '<figure><img src="developer.jpg"><figcaption> Developer   at work </figcaption></figure>',
  )[0]

  assert.equal(suggestAltText(issue), 'Developer at work')
})

test('falls back to surrounding text, filename, and a generic label', () => {
  assert.equal(
    suggestAltText({ context: { surroundingText: 'A team meeting' } }),
    'A team meeting',
  )
  assert.equal(
    suggestAltText({ context: { src: '/images/team-photo_2.png?size=large' } }),
    'Team photo 2',
  )
  assert.equal(suggestAltText({ context: {} }), 'Image')
})

test('augments issues without mutating them', () => {
  const issue = { rule: 'image-alt', context: { caption: 'A developer' } }
  const result = suggestAltForIssue(issue)
  const batch = suggestAltTexts([issue])

  assert.equal(result.suggestedAlt, 'A developer')
  assert.equal(batch[0].suggestedAlt, 'A developer')
  assert.equal(issue.suggestedAlt, undefined)
})

test('applies suggested alt text to missing images in document order', () => {
  const html = `
    <main>
      <img src="first.jpg">
      <img src="decorative.svg" alt="">
      <img src="second.jpg">
    </main>
  `
  const issues = suggestAltTexts(detectMissingAlt(html))
  const processed = applySuggestedAlt(html, issues)

  assert.ok(processed.includes('<img src="first.jpg" alt="First">'))
  assert.ok(processed.includes('<img src="decorative.svg" alt="">'))
  assert.ok(processed.includes('<img src="second.jpg" alt="Second">'))
})

test('sends relative local images as base64 to the backend', async () => {
  let request
  const service = createBackendSuggestedAltService({
    imageBaseDir: path.join(__dirname, '..', 'source'),
    fetchImpl: async (url, options) => {
      request = { url, body: JSON.parse(options.body) }
      return { ok: true, status: 200, json: async () => ({ suggestedAlt: 'A test image' }) }
    },
  })

  const suggested = await service.suggestAltText({ context: { src: 'test-image.webp' } })

  assert.equal(suggested, 'A test image')
  assert.equal(request.body.image.type, 'base64')
  assert.equal(request.body.image.mimeType, 'image/webp')
  assert.ok(request.body.image.value.length > 0)
})
