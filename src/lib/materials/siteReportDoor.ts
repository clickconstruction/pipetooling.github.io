/**
 * The door to a site's material location report (punch list #330): the site's materials screen links to the site's
 * page with `?report=materials`, and the page opens the paper's window by itself.
 *
 * Closing the window left the mark in the address (finding 325, a walk of 2026-11-27), so a reload drew the paper
 * again, and so did the address copied to someone. On close the page takes the mark out with a replace: Back still
 * goes to the materials screen the person came from, and every other mark in the address stays.
 */
export const SITE_REPORT_PARAM = 'report'
export const SITE_REPORT_MATERIALS = 'materials'

/** The address asks for the material location report. */
export function asksForMaterialsReport(search: URLSearchParams): boolean {
  return search.get(SITE_REPORT_PARAM) === SITE_REPORT_MATERIALS
}

/** The address with the report's mark taken out, or null when it holds none and there is nothing to change. */
export function withoutReport(search: URLSearchParams): URLSearchParams | null {
  if (!search.has(SITE_REPORT_PARAM)) return null
  const next = new URLSearchParams(search)
  next.delete(SITE_REPORT_PARAM)
  return next
}
