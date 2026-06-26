import { escapeHtmlText, renderContractBodyToSafeHtml } from './renderContractBodyToSafeHtml'
import { buildContractRichTextDocument, type ContractBookExportEntry } from './contractRichTextDocument'

export type { ContractBookExportEntry }

/** Element id of the Download button in the generated preview document. */
export const CONTRACT_BOOK_DOWNLOAD_BUTTON_ID = 'contract-book-download'

/**
 * Serialize a value for safe embedding inside an inline `<script>`: JSON, with
 * every `<` escaped to its `<` form so a `</script>` (or any tag) inside
 * the data can never break out of the script element.
 */
function embedJsonForScript(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c')
}

/**
 * Build the standalone full-page preview HTML document for a Contract Book entry.
 *
 * Pure (returns a string). Renders the entry's document name as a heading plus
 * its safe body (shared with `ContractBodyDisplay` via
 * `renderContractBodyToSafeHtml`), and a fixed top-right Download button.
 *
 * The Download button is wired by a small **inline script** embedded in the
 * document itself (carrying the prebuilt rich-text `.doc` payload), so the
 * download works entirely inside the new tab — no dependency on the opener
 * window staying alive or on a cross-window event listener (which is unreliable
 * across browsers, notably Safari). The app ships no CSP, so the inline script
 * runs; the embedded payload is `<`-escaped so it cannot break out of the tag.
 */
export function buildContractBookPreviewHtml(entry: ContractBookExportEntry): string {
  const title = entry.document_name.trim() || 'Contract'
  const bodyHtml = renderContractBodyToSafeHtml(entry.book_body_html, entry.book_body_format)
  const bodySection = bodyHtml.trim()
    ? bodyHtml
    : '<p style="color:#9ca3af;font-style:italic">No library body yet.</p>'
  const doc = buildContractRichTextDocument(entry)
  const downloadScript =
    `<script>(function(){` +
    `var DOC=${embedJsonForScript({ content: doc.content, mime: doc.mime, filename: doc.filename })};` +
    `var btn=document.getElementById(${embedJsonForScript(CONTRACT_BOOK_DOWNLOAD_BUTTON_ID)});` +
    `if(!btn)return;` +
    `btn.addEventListener('click',function(){` +
    `try{` +
    `var blob=new Blob([DOC.content],{type:DOC.mime});` +
    `var url=URL.createObjectURL(blob);` +
    `var a=document.createElement('a');` +
    `a.href=url;a.download=DOC.filename;` +
    `document.body.appendChild(a);a.click();a.remove();` +
    `setTimeout(function(){URL.revokeObjectURL(url);},1000);` +
    `}catch(e){alert('Download failed: '+(e&&e.message?e.message:e));}` +
    `});` +
    `})();</script>`
  return (
    `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width, initial-scale=1">` +
    `<title>${escapeHtmlText(title)}</title><style>` +
    `:root{color-scheme:light;}` +
    `body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#111827;margin:0;background:#f3f4f6;}` +
    `.cb-toolbar{position:fixed;top:0;left:0;right:0;display:flex;justify-content:flex-end;padding:0.75rem 1rem;` +
    `background:rgba(243,244,246,0.95);border-bottom:1px solid #e5e7eb;z-index:10;}` +
    `.cb-download{padding:0.5rem 1rem;font-size:0.9rem;font-weight:600;border:none;border-radius:6px;` +
    `background:#2563eb;color:#fff;cursor:pointer;}` +
    `.cb-download:hover{background:#1d4ed8;}` +
    `.cb-page{max-width:800px;margin:4.5rem auto 3rem;background:#fff;border:1px solid #e5e7eb;border-radius:8px;` +
    `padding:2.5rem 3rem;box-shadow:0 1px 3px rgba(0,0,0,0.08);}` +
    `.cb-title{margin:0 0 1.5rem;font-size:1.6rem;}` +
    `.cb-body{font-size:1rem;line-height:1.6;word-break:break-word;}` +
    `.cb-body table{border-collapse:collapse;}` +
    `.cb-body th,.cb-body td{border:1px solid #d1d5db;padding:0.4rem 0.6rem;}` +
    `.cb-body h1,.cb-body h2,.cb-body h3,.cb-body h4{line-height:1.3;}` +
    `.cb-body a{color:#2563eb;}` +
    `@media print{body{background:#fff;}.cb-toolbar{display:none;}` +
    `.cb-page{max-width:none;margin:0;border:none;border-radius:0;box-shadow:none;padding:0;}}` +
    `</style></head><body>` +
    `<div class="cb-toolbar"><button type="button" id="${CONTRACT_BOOK_DOWNLOAD_BUTTON_ID}" class="cb-download">Download</button></div>` +
    `<main class="cb-page"><h1 class="cb-title">${escapeHtmlText(title)}</h1>` +
    `<div class="cb-body">${bodySection}</div></main>` +
    downloadScript +
    `</body></html>`
  )
}

/**
 * Open a Contract Book entry as a full-page preview in a new browser tab.
 *
 * Navigates the new tab to a `blob:` URL of the self-contained preview document
 * rather than `window.open('') + document.write`. The latter leaves the tab on
 * the special `about:blank` "initial empty document", and Chromium-based
 * browsers (Chrome, Brave) restrict downloads — and sometimes inline-script
 * execution — initiated from it, which broke the Download button for some
 * users. A `blob:` document loads as a real, same-origin navigation, so the
 * address bar shows a real URL, the embedded inline script runs, and the
 * Download button works. The document is self-contained (it carries the
 * rich-text payload inline), so nothing depends on the opener afterward.
 *
 * No-op if the popup is blocked. Mirrors the `openPayStubWindow` pattern.
 */
export function openContractBookEntryPreview(entry: ContractBookExportEntry): void {
  const html = buildContractBookPreviewHtml(entry)
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }))
  const win = window.open(url, '_blank')
  if (!win) {
    // Popup blocked — free the object URL we won't use.
    URL.revokeObjectURL(url)
    return
  }
  win.focus()
  // The tab has the document loaded well before this fires; revoke then so a
  // reload still works in the meantime and we don't leak the object URL.
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
