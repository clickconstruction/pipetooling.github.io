/**
 * Shared primitives for the Bids document builders (cover letter, RFI, PO, etc.).
 *
 * Canonical home for `escapeHtml` / `addressLines` (previously inlined in
 * `src/pages/Bids.tsx`) plus the `printHtmlInNewWindow` side-effect helper that wraps the
 * repeated "open a blank window, write HTML, print, close" boilerplate.
 *
 * NOTE: `src/lib/buildBidPricingPackageHtml.ts` keeps its own `escapeHtml` on purpose — that
 * file is mirrored 1:1 with the Deno Edge copy (`supabase/functions/_shared/bidPricingPackage.ts`)
 * and must stay self-contained, so it is intentionally not consolidated here.
 *
 * Pure except for `printHtmlInNewWindow`, which touches `window`.
 */

export function escapeHtml(s: string): string {
  return (s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Split address on first comma into [street, city/state/zip] for combined documents. */
export function addressLines(addr: string): string[] {
  const trimmed = (addr ?? '').trim()
  if (!trimmed) return ['']
  const commaIdx = trimmed.indexOf(',')
  if (commaIdx < 0) return [trimmed]
  return [trimmed.slice(0, commaIdx).trim(), trimmed.slice(commaIdx + 1).trim()]
}

/** Open a blank window, write the HTML document, trigger print, and close after printing. */
export function printHtmlInNewWindow(html: string): void {
  const win = window.open('', '_blank')
  if (!win) return
  win.document.write(html)
  win.document.close()
  win.focus()
  win.print()
  win.onafterprint = () => win.close()
}
