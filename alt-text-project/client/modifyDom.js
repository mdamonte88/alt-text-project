const fs = require('fs')
const path = require('path')
const { JSDOM } = require('jsdom')
const {
  suggestAltText,
  suggestAltForIssue,
  suggestAltTexts,
  createMockSuggestedAltService,
  createBackendSuggestedAltService,
} = require('./suggestedAltService')

const SOURCE_DIR = path.join(__dirname, 'source')
const DIST_DIR = path.join(__dirname, 'dist')

function modifyDom(html, issues = suggestAltTexts(detectMissingAlt(html))) {
  return applySuggestedAlt(html, issues)
}

/**
 * Extract the information around an image that can help describe its purpose.
 *
 * The image itself is excluded from the text so its attributes are not mixed
 * into the surrounding copy. Text is taken from the closest useful container
 * and collapsed to make the result suitable for a later AI prompt.
 */
function extractImageContext(img, document) {
  const figure = img.closest('figure')
  const caption = figure?.querySelector('figcaption')?.textContent || ''
  const container = figure || img.parentElement
  const imageText = img.textContent || ''
  const surroundingText = (container?.textContent || '')
    .replace(imageText, '')
    .replace(/\s+/g, ' ')
    .trim()

  return {
    pageTitle: document.title.trim(),
    src: img.getAttribute('src'),
    caption: caption.replace(/\s+/g, ' ').trim() || null,
    surroundingText,
  }
}

/**
 * Detect images that do not define an alt attribute.
 *
 * An empty alt attribute is intentional for decorative images, so it is not
 * reported here. This function only detects issues; it does not modify HTML.
 */
function detectMissingAlt(html) {
  const dom = new JSDOM(html)
  const { document } = dom.window
  const images = document.querySelectorAll('img:not([alt])')

  return Array.from(images, (img) => ({
    rule: 'image-alt',
    type: 'missing-alt',
    message: 'Image is missing an alt attribute.',
    element: 'img',
    html: img.outerHTML,
    context: extractImageContext(img, document),
  }))
}

/**
 * Apply suggested alt text to the missing-alt images in an HTML document.
 *
 * Issues are applied in the same document order used by detectMissingAlt.
 * Images with an existing alt attribute, including alt="", are never
 * changed.
 */
function applySuggestedAlt(html, issues) {
  if (!Array.isArray(issues)) {
    throw new TypeError('An array of image issues is required.')
  }

  const dom = new JSDOM(html)
  const { document } = dom.window
  const images = document.querySelectorAll('img:not([alt])')

  issues.forEach((issue, index) => {
    const image = images[index]
    if (!image || typeof issue?.suggestedAlt !== 'string') return

    image.setAttribute('alt', issue.suggestedAlt)
  })

  return dom.serialize()
}

async function processHtmlFiles({ suggestionService } = {}) {
  fs.mkdirSync(DIST_DIR, { recursive: true })
  const service = suggestionService || createBackendSuggestedAltService({ imageBaseDir: SOURCE_DIR })

  const files = fs
    .readdirSync(SOURCE_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile() && path.extname(entry.name) === '.html')
    .map((entry) => entry.name)

  const results = await Promise.all(files.map(async (file) => {
    const sourcePath = path.join(SOURCE_DIR, file)
    const destinationPath = path.join(DIST_DIR, file)

    const html = fs.readFileSync(sourcePath, 'utf8')

    const issues = await service.suggestAltTexts(detectMissingAlt(html))
    const processedHtml = applySuggestedAlt(html, issues)

    fs.writeFileSync(destinationPath, processedHtml, 'utf8')

    console.log(`✓ ${file} -> dist/${file}`)

    if (issues.length > 0) {
      console.log(`  ${issues.length} missing alt issue(s) detected`)
      console.dir(issues, { depth: null })
    }

    return {
      file,
      issues,
    }
  }))

  console.log('Finished.')

  return results
}

if (require.main === module) {
  processHtmlFiles().catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
}

module.exports = {
  modifyDom,
  applySuggestedAlt,
  detectMissingAlt,
  extractImageContext,
  processHtmlFiles,
  suggestAltText,
  suggestAltForIssue,
  suggestAltTexts,
  createMockSuggestedAltService,
  createBackendSuggestedAltService,
}
