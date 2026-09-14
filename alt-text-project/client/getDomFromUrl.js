const { chromium } = require('playwright')

async function getDomFromUrl(url) {
  const parsedUrl = validateUrl(url)
  let browser

  try {
    browser = await chromium.launch({ headless: true })
  } catch (error) {
    throw new Error(`Browser launch failed: ${error.message}`)
  }

  try {
    const page = await browser.newPage({
      viewport: {
        width: 1440,
        height: 900,
      },
    })

    try {
      await page.goto(parsedUrl.toString(), {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      })
    } catch (error) {
      if (error.name === 'TimeoutError') {
        throw new Error('Navigation timeout after 30000 ms')
      }

      throw new Error(`Navigation failed: ${error.message}`)
    }

    const finalUrl = page.url()
    const title = await page.title()
    const html = await page.content()

    const liveDomMissingAlt = await page.evaluate(() =>
      Array.from(document.querySelectorAll('img:not([alt])'), (img) => ({
        src: img.getAttribute('src'),
        currentSrc: img.currentSrc || '',
        outerHTML: img.outerHTML,
      })),
    )

    return {
      requestedUrl: url,
      finalUrl,
      title,
      html,
      liveDomMissingAlt,
      liveDomMissingAltCount: liveDomMissingAlt.length,
    }
  } finally {
    await browser.close()
  }
}

function validateUrl(url) {
  if (typeof url !== 'string' || !url.trim()) {
    throw new Error('A URL is required.')
  }

  let parsedUrl
  try {
    parsedUrl = new URL(url)
  } catch {
    throw new Error(`Invalid URL: ${url}`)
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new Error(`Unsupported URL protocol: ${parsedUrl.protocol}`)
  }

  return parsedUrl
}

async function main() {
  const url = process.argv[2]

  if (!url) {
    console.error('Usage: node getDomFromUrl.js https://example.com')
    process.exit(1)
  }

  try {
    const result = await getDomFromUrl(url)

    console.log('Requested URL:', result.requestedUrl)
    console.log('Final URL:', result.finalUrl)
    console.log('Title:', result.title)
  } catch (error) {
    console.error('Unable to retrieve URL DOM:')
    console.error(error.message)
    process.exit(1)
  }
}

if (require.main === module) {
  main()
}

module.exports = {
  getDomFromUrl,
  validateUrl,
}
