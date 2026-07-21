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
