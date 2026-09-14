const { getDomFromUrl } = require('./getDomFromUrl')
const { detectMissingAlt } = require('./modifyDom')

function resolveImageSource(src, finalUrl) {
  if (typeof src !== 'string' || !src.trim()) return src

  try {
    return new URL(src, finalUrl).toString()
  } catch {
    return src
  }
}

function preferredImageSource(liveImage, finalUrl) {
  return (
    liveImage?.currentSrc ||
    resolveImageSource(liveImage?.src, finalUrl) ||
    liveImage?.src
  )
}

async function analyzeUrl(url) {
  const page = await getDomFromUrl(url)
  const issues = detectMissingAlt(page.html)
  const liveDomMissingAlt = page.liveDomMissingAlt || []

  // Both lists are document-ordered, so index matching is sufficient for this POC.
  const normalizedIssues = issues.map((issue, index) => {
    const liveImage = liveDomMissingAlt[index]
    const src = preferredImageSource(liveImage, page.finalUrl)

    return {
      ...issue,
      context: {
        ...issue.context,
        src: src || resolveImageSource(issue.context?.src, page.finalUrl),
      },
    }
  })

  return {
    requestedUrl: page.requestedUrl,
    finalUrl: page.finalUrl,
    title: page.title,
    htmlLength: page.html.length,
    missingAltCount: normalizedIssues.length,
    issues: normalizedIssues,
    liveDomMissingAlt,
    liveDomMissingAltCount: liveDomMissingAlt.length,
    detectorMissingAltCount: normalizedIssues.length,
    countsMatch: normalizedIssues.length === liveDomMissingAlt.length,
  }
}

function printReport(result) {
  console.log('ALT URL Analysis')
  console.log('')
  console.log(`Requested URL:\n${result.requestedUrl}`)
  console.log('')
  console.log(`Final URL:\n${result.finalUrl}`)
  console.log('')
  console.log(`Title:\n${result.title}`)
  console.log('')
  console.log(`HTML length:\n${result.htmlLength}`)
  console.log('')
  console.log(`Missing alt — detector:\n${result.detectorMissingAltCount}`)
  console.log('')
  console.log(`Missing alt — live DOM:\n${result.liveDomMissingAltCount}`)
  console.log('')
  console.log(`Counts match:\n${result.countsMatch ? 'yes' : 'no'}`)
  console.log('')
  console.log('Issues:')

  result.issues.forEach((issue, index) => {
    console.log(`\n[${index + 1}]`)
    console.log(`src: ${issue.context?.src || '(missing)'}`)
    console.log(`html: ${issue.html}`)
  })
}

async function main() {
  const [url, ...args] = process.argv.slice(2)
  if (!url) {
    console.error('Usage: node analyzeUrl.js <url> [--json]')
    process.exitCode = 1
    return
  }

  try {
    const result = await analyzeUrl(url)
    if (args.includes('--json')) console.log(JSON.stringify(result, null, 2))
    else printReport(result)
  } catch (error) {
    console.error('Unable to analyze URL:')
    console.error(error.message)
    process.exitCode = 1
  }
}

if (require.main === module) main()

module.exports = {
  analyzeUrl,
  resolveImageSource,
  printReport,
}
