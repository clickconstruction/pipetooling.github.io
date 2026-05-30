/** Copy rich HTML to clipboard as text/html only (so Google Docs keeps bold/spacing),
 *  falling back to plain text if the rich write fails or is unsupported.
 *
 *  Writing both text/html and text/plain in one ClipboardItem causes Google Docs (and
 *  similar targets) to prefer text/plain, dropping all formatting. Writing text/html only,
 *  wrapped in CF_HTML fragment markers, preserves bold and paragraph spacing on paste.
 */
export async function copyRichHtmlToClipboard(html: string, plainText: string): Promise<void> {
  if (navigator.clipboard?.write) {
    const clipboardHtml =
      '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><!--StartFragment-->' +
      html +
      '<!--EndFragment--></body></html>'
    const item = new ClipboardItem({ 'text/html': new Blob([clipboardHtml], { type: 'text/html' }) })
    try {
      await navigator.clipboard.write([item])
      return
    } catch {
      // fall through to plain text
    }
  }
  await navigator.clipboard.writeText(plainText)
}
