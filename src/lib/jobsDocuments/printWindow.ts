/**
 * Shared window.open print glue for the Jobs print builders (Stage A of the
 * Jobs.tsx decomposition — see docs/JOBS_TABS_ARCHITECTURE.md).
 *
 * Returns false when the popup was blocked so callers can toast (or not — the
 * sub-sheet printers historically fail silently; keep that per call site).
 */
export function openHtmlPrintWindow(html: string): boolean {
  const win = window.open('', '_blank')
  if (!win) return false
  win.document.write(html)
  win.document.close()
  win.focus()
  win.print()
  win.onafterprint = () => win.close()
  return true
}

/**
 * Same window.open glue WITHOUT triggering print — for read-only previews
 * (e.g. GC Review's Email… Preview, v2.2061: see the statement exactly as the
 * recipient will). Same popup-blocked contract as openHtmlPrintWindow.
 */
export function openHtmlPreviewWindow(html: string): boolean {
  const win = window.open('', '_blank')
  if (!win) return false
  win.document.write(html)
  win.document.close()
  win.focus()
  return true
}
