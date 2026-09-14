const assert = require('node:assert/strict')
const fs = require('node:fs')
const http = require('node:http')
const path = require('node:path')
const test = require('node:test')

const { getImageData } = require('../imageData')
const { suggestAltForUrl } = require('../suggestAltForUrl')

function response(headers, body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => headers[name.toLowerCase()] || null },
    arrayBuffer: async () => body,
  }
}

test('acquires image bytes and normalizes MIME', async () => {
  const bytes = Buffer.from('RIFF-test-image')
  const result = await getImageData('http://fixture/image.webp', {
    fetchImpl: async () => response({ 'content-type': 'image/webp; charset=binary' }, bytes),
  })

  assert.equal(result.mimeType, 'image/webp')
  assert.deepEqual(result.buffer, bytes)
  assert.equal(result.buffer.toString('base64').startsWith('data:'), false)
})

test('sends original image bytes as base64 and does not mutate analysis or DOM', async () => {
  const originalBytes = fs.readFileSync(path.join(__dirname, '..', 'source', 'test-image.webp'))
  const analysis = {
    requestedUrl: 'http://fixture/articles/developer/',
    finalUrl: 'http://fixture/articles/developer/',
    title: 'Local developer fixture',
    missingAltCount: 1,
    issues: [{
      rule: 'image-alt',
      type: 'missing-alt',
      message: 'Image is missing an alt attribute.',
      element: 'img',
      html: '<img src="../images/test-image.webp">',
      context: { pageTitle: 'Local developer fixture', src: 'http://fixture/images/test-image.webp', caption: null, surroundingText: '' },
    }],
  }
  const seen = []
  const result = await suggestAltForUrl('http://fixture/articles/developer/', {
    analyze: async () => analysis,
    suggestionService: {
      suggestAltText: async (issue, { image }) => {
        seen.push({ issue, image })
        return 'A developer at a laptop.'
      },
    },
    getImageData: async (url) => {
      assert.equal(url, 'http://fixture/images/test-image.webp')
      return { buffer: originalBytes, mimeType: 'image/webp' }
    },
  })

  assert.equal(result.issues[0].suggestedAlt, 'A developer at a laptop.')
  assert.equal(result.issues[0].context.src, 'http://fixture/images/test-image.webp')
  assert.equal(seen[0].image.type, 'base64')
  assert.equal(seen[0].image.mimeType, 'image/webp')
  assert.deepEqual(Buffer.from(seen[0].image.value, 'base64'), originalBytes)
  assert.equal(seen[0].image.value.includes('data:image/'), false)
  assert.equal(analysis.issues[0].suggestedAlt, undefined)
})

test('keeps null suggestions and isolates image/backend failures', async () => {
  const issues = [
    { context: { src: 'http://fixture/ok.webp' }, html: '<img src="ok.webp">' },
    { context: { src: 'http://fixture/broken.webp' }, html: '<img src="broken.webp">' },
    { context: { src: 'http://fixture/null.webp' }, html: '<img src="null.webp">' },
  ]
  const result = await suggestAltForUrl('http://fixture/page', {
    analyze: async () => ({ issues, missingAltCount: issues.length }),
    getImageData: async (url) => {
      if (url.endsWith('broken.webp')) throw Object.assign(new Error('unsupported image'), { code: 'UNSUPPORTED_MIME_TYPE' })
      return { buffer: Buffer.from('image'), mimeType: 'image/webp' }
    },
    suggestionService: {
      suggestAltText: async (issue) => (issue.context.src.endsWith('null.webp') ? null : 'Success'),
    },
  })

  assert.equal(result.issues[0].suggestedAlt, 'Success')
  assert.equal(result.issues[1].suggestedAlt, null)
  assert.deepEqual(result.issues[1].suggestionError, { code: 'UNSUPPORTED_MIME_TYPE', message: 'unsupported image' })
  assert.equal(result.issues[2].suggestedAlt, null)
})

test('retrieves a local fixture image over HTTP', async (t) => {
  const bytes = fs.readFileSync(path.join(__dirname, '..', 'source', 'test-image.webp'))
  const server = http.createServer((request, reply) => {
    reply.writeHead(200, { 'Content-Type': 'image/webp' })
    reply.end(bytes)
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  t.after(() => server.close())
  const { port } = server.address()
  const result = await getImageData(`http://127.0.0.1:${port}/test-image.webp`)
  assert.equal(result.mimeType, 'image/webp')
  assert.deepEqual(result.buffer, bytes)
})
