/**
 * An email's HTML made ready for an in-app preview frame (v2.4250 — GC Review's
 * previews stopped opening a browser window; see `EmailPreviewOverlay`).
 *
 * The frame is sandboxed, so a plain link would load its page inside the frame
 * with scripts off — the GC's portal would come up blank. `<base target="_blank">`
 * sends every link to a tab of its own instead, as it opened from the old window.
 */
const BASE_TAG = '<base target="_blank">'

export function previewFrameHtml(html: string): string {
  if (/<base\b/i.test(html)) return html
  const head = /<head\b[^>]*>/i.exec(html)
  if (head) {
    const at = head.index + head[0].length
    return html.slice(0, at) + BASE_TAG + html.slice(at)
  }
  // A fragment, or a document with no <head>: a leading <base> is hoisted into the head by the parser.
  return BASE_TAG + html
}
