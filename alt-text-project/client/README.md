# Alt Text Processor

A small Node.js utility for finding images that are missing alternative text and asking the real backend for alt-text suggestions.

The client calls the sibling backend at `POST http://localhost:3001/api/suggest-alt` by default. The backend resolves each image URL and sends it to the configured vision model.

## How it works

For each HTML file in `source/`, the processor:

1. Detects `<img>` elements without an `alt` attribute.
2. Collects the page title, image source, figure caption, and nearby text as context.
3. Sends each missing image and its page context to the backend.
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

Set `ALT_BACKEND_URL` to use another backend URL.

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

Suggestion helpers are also available from `suggestedAltService.js`. The deterministic implementation remains available for offline use:

```js
const { createMockSuggestedAltService } = require('./suggestedAltService')

const suggestedIssues = createMockSuggestedAltService().suggestAltTexts(issues)
```

`detectMissingAlt` only reports images that do not have an `alt` attribute. It does not modify the input HTML. `applySuggestedAlt` applies suggestions by matching issues and missing images in document order.

## Project structure

```text
source/                 Input HTML files
modifyDom.js            HTML detection, context extraction, and file processing
suggestedAltService.js  Backend and deterministic suggestion services
test/                   Node.js tests
dist/                   Generated output (created when processing)
```

## Limitations

Remote images must use absolute `http(s)` URLs. Images referenced by relative paths under `source/` are read locally and sent to the backend as base64. Generated suggestions are not a substitute for human accessibility review. Alt text should describe an image's purpose in its specific context, and decorative images should generally use `alt=""`.
