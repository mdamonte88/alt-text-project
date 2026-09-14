const { analyzeUrl } = require('./analyzeUrl')
const { getImageData } = require('./imageData')
const { createBackendSuggestedAltService } = require('./suggestedAltService')

function errorForIssue(error) {
  return {
    code: error?.code || 'SUGGESTION_FAILED',
    message: error?.message || 'Unable to generate an alt-text suggestion.',
  }
}

async function suggestAltForUrl(url, options = {}) {
  const analysis = await (options.analyze || analyzeUrl)(url)
  const service = options.suggestionService || createBackendSuggestedAltService({
    baseUrl: options.backendUrl,
    fetchImpl: options.backendFetchImpl,
  })
  const acquireImage = options.getImageData || getImageData

  const issues = await Promise.all(analysis.issues.map(async (issue) => {
    const enriched = { ...issue, suggestedAlt: null }
    try {
      const imageData = await acquireImage(issue.context?.src, options.imageOptions)
      const image = {
        type: 'base64',
        mimeType: imageData.mimeType,
        value: imageData.buffer.toString('base64'),
      }
      enriched.suggestedAlt = await service.suggestAltText(issue, { image })
    } catch (error) {
      enriched.suggestionError = errorForIssue(error)
    }
    return enriched
  }))

  return { ...analysis, issues }
}

function printReport(result) {
  const suggestionsGenerated = result.issues.filter((issue) => issue.suggestedAlt !== null && !issue.suggestionError).length
  console.log('ALT Suggested Alt Analysis\n')
  console.log(`URL:\n${result.requestedUrl}\n`)
  console.log(`Missing alt:\n${result.missingAltCount}\n`)
  console.log(`Suggestions generated:\n${suggestionsGenerated}\n`)
  console.log('Issues:')
  result.issues.forEach((issue, index) => {
    console.log(`\n[${index + 1}]\n`)
    console.log(`src:\n${issue.context?.src || '(missing)'}\n`)
    console.log(`html:\n${issue.html}\n`)
    console.log(`suggestedAlt:\n${issue.suggestedAlt}`)
    if (issue.suggestionError) console.log(`\nsuggestionError:\n${issue.suggestionError.code}: ${issue.suggestionError.message}`)
  })
}

async function main() {
  const [url, ...args] = process.argv.slice(2)
  if (!url) {
    console.error('Usage: node suggestAltForUrl.js <url> [--json]')
    process.exitCode = 1
    return
  }
  try {
    const result = await suggestAltForUrl(url)
    if (args.includes('--json')) console.log(JSON.stringify(result, null, 2))
    else printReport(result)
  } catch (error) {
    console.error(`Unable to suggest alt text for URL: ${error.message}`)
    process.exitCode = 1
  }
}

if (require.main === module) main()

module.exports = { suggestAltForUrl, printReport, errorForIssue }
