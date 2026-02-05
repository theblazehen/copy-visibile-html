# Copy Visible HTML

A Firefox extension that lets you pick any element on a page and copy its **visible HTML** (or text), stripped and optimized for LLM ingestion.

## Features

- **Visual Element Picker** - Click any element to select it (like uBlock Origin's picker)
- **Interactive HTML Tree** - Preview shows clickable HTML; hover to highlight, click to drill down
- **Auto-select from Selection** - If you have text selected, automatically picks the containing element
- **Visibility Filtering** - Hidden elements (`display:none`, `opacity:0`, etc.) are excluded
- **Clean Output** - Strips scripts, styles, SVGs, classes, and noise - keeps only semantic attributes
- **Two Modes**:
  - **HTML** - Cleaned markup with structure preserved
  - **Text** - Plain text with proper spacing between elements

## Installation

### From Firefox Add-ons (AMO)

Install from [addons.mozilla.org](https://addons.mozilla.org/firefox/addon/copy-visible-html/)

### Manual / Development

1. Open Firefox and go to `about:debugging#/runtime/this-firefox`
2. Click "Load Temporary Add-on"
3. Select `manifest.json` from this folder

## Usage

1. **Right-click** anywhere on a page
2. Select **"Copy Visible HTML"** from the context menu
3. **Hover** over elements to highlight them
4. **Click** to select an element
5. In the panel:
   - **↑ Parent** - Select parent element
   - **HTML / Text** - Toggle output format
   - **Hover tags** in preview to highlight on page
   - **Click tags** to drill down into children
   - **▼** - Collapse/expand sections
6. Click **Copy** to copy to clipboard
7. **Esc** to cancel

### Pro tip

Select some text first, then right-click → "Copy Visible HTML" - it will automatically select the element containing your selection!

## What Gets Stripped

- `style`, `class`, `id`, `data-*` attributes
- `<script>`, `<style>`, `<svg>`, `<canvas>`, `<iframe>` elements
- HTML comments
- Hidden elements (CSS `display:none`, `visibility:hidden`, `opacity:0`, zero dimensions)

## What Gets Kept

- Semantic attributes: `href`, `src`, `alt`, `title`, `type`, `name`, `value`, `placeholder`, etc.
- Document structure
- Visible text content

## Privacy

This extension:
- Runs entirely locally
- Makes no network requests
- Collects no data
- Only writes to clipboard when you click Copy

## License

MIT
