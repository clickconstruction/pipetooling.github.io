/**
 * GC mode, the trade partner portal (P5b-1): printing one list from the portal on its own (Your papers), apart from the
 * page around it. From the design spike's `gcPortalPrint.ts`, word for word.
 */

/** Text made safe to write into the printed page. */
export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/**
 * Prints one paper or list on its own (Your papers): written into a hidden frame so the rest of the page stays out of
 * the print. `body` is HTML whose text went through `escapeHtml`.
 */
export function printPortalHtml(title: string, body: string): void {
  const frame = document.createElement('iframe')
  frame.setAttribute('aria-hidden', 'true')
  Object.assign(frame.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' })
  document.body.appendChild(frame)
  const doc = frame.contentDocument
  const win = frame.contentWindow
  if (!doc || !win) {
    frame.remove()
    return
  }
  doc.open()
  doc.write(
    `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>` +
      '<style>body{font:14px/1.45 system-ui,sans-serif;color:#111;margin:32px}h1{font-size:20px;margin:0 0 4px}h2{font-size:15px;margin:20px 0 6px}' +
      'table{border-collapse:collapse;width:100%}td{padding:4px 6px;border-bottom:1px solid #ccc;vertical-align:top}.muted{color:#555}</style>' +
      `</head><body>${body}</body></html>`,
  )
  doc.close()
  win.focus()
  win.print()
  // The frame stays until the print dialog has its copy.
  window.setTimeout(() => frame.remove(), 1000)
}
