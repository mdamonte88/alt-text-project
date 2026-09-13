# Alt Text Processor

A small Node.js utility for finding images that are missing alternative text and adding deterministic alt-text suggestions to HTML files.

The project is intentionally self-contained: it does not call an AI provider. The suggestion service is shaped so that a real asynchronous provider can be added later without changing the issue format used by the HTML processor.

## How it works

For each HTML file in `source/`, the processor:

1. Detects `<img>` elements without an `alt` attribute.
2. Collects the page title, image source, figure caption, and nearby text as context.
3. Suggests alt text using this order of preference:
   - the image's `<figcaption>`;
   - surrounding text;
   - a cleaned-up image filename;
   - the generic label `Image`.
4. Adds the suggestion to the missing images and writes the result to `dist/`.

An existing `alt` attribute is never changed. In particular, `alt=""` is treated as intentional decorative-image markup and is not reported.

## Requirements

- Node.js
- npm

## Installation

```sh
npm install
```

## Usage

Place source HTML files in `source/`, then run:

```sh
node modifyDom.js
```

Processed files are created in `dist/` with the same filenames. The command also logs detected issues and their generated suggestions.

The included example is [source/missingAlt.html](source/missingAlt.html). It contains an image without an `alt` attribute and produces a corresponding file at `dist/missingAlt.html` after processing.

## Testing

Run the test suite with:

```sh
npm test
```

The tests cover suggestion priority and fallbacks, immutability, document-order application, and preservation of decorative images.

## Using the modules

The main functions are exported from `modifyDom.js`:

```js
const {
  detectMissingAlt,
  applySuggestedAlt,
  modifyDom,
} = require('./modifyDom')

const issues = detectMissingAlt(html)
const processedHtml = modifyDom(html, issues)
```

Suggestion helpers are also available from `suggestedAltService.js`:

```js
const { suggestAltTexts } = require('./suggestedAltService')

const suggestedIssues = suggestAltTexts(issues)
```

`detectMissingAlt` only reports images that do not have an `alt` attribute. It does not modify the input HTML. `applySuggestedAlt` applies suggestions by matching issues and missing images in document order.

## Project structure

```text
source/                 Input HTML files
modifyDom.js            HTML detection, context extraction, and file processing
suggestedAltService.js  Deterministic suggestion service
test/                   Node.js tests
dist/                   Generated output (created when processing)
```

## Limitations

Generated suggestions are heuristics, not a substitute for human accessibility review. Alt text should describe an image's purpose in its specific context, and decorative images should generally use `alt=""`.
