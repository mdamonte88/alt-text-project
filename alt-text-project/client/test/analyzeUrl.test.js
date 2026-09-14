const assert = require('node:assert/strict')
const http = require('node:http')
const test = require('node:test')

const { analyzeUrl } = require('../analyzeUrl')

function startFixtureServer() {
  const server = http.createServer((request, response) => {
    if (request.url === '/articles/developer/') {
      response.writeHead(200, { 'Content-Type': 'text/html' })
      response.end(`
        <!doctype html>
        <html><head><title>Local developer fixture</title></head>
        <body>
          <main>
            <img src="/missing.jpg">
            <img src="/existing.jpg" alt="Developer">
            <img src="/decorative.jpg" alt="">
            <picture>
              <source srcset="/missing-large.jpg 2x">
              <img src="../fallback.jpg">
            </picture>
          </main>
        </body></html>
      `)
      return
    }

    response.writeHead(204)
    response.end()
  })

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server))
  })
}

test('analyzes rendered HTML from a local fixture', async (t) => {
  const server = await startFixtureServer()
  t.after(() => server.close())

  const { port } = server.address()
  const result = await analyzeUrl(`http://127.0.0.1:${port}/articles/developer/`)

  assert.equal(result.title, 'Local developer fixture')
  assert.equal(result.missingAltCount, 2)
  assert.equal(result.detectorMissingAltCount, 2)
  assert.equal(result.liveDomMissingAltCount, 2)
  assert.equal(result.countsMatch, true)
  assert.equal(result.issues[0].context.src, `http://127.0.0.1:${port}/missing.jpg`)
  assert.equal(result.issues[1].context.src, `http://127.0.0.1:${port}/missing-large.jpg`)
  assert.equal(result.issues.some((issue) => issue.html.includes('existing.jpg')), false)
  assert.equal(result.issues.some((issue) => issue.html.includes('decorative.jpg')), false)
  assert.equal(result.liveDomMissingAlt[0].src, '/missing.jpg')
})

test('rejects invalid and unsupported URLs before navigation', async () => {
  await assert.rejects(() => analyzeUrl('not-a-url'), /Invalid URL/)
  await assert.rejects(() => analyzeUrl('file:///tmp/page.html'), /Unsupported URL protocol/)
})
