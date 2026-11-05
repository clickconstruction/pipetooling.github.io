/**
 * What the material location report (punch list #268) remembers on the device: the grouping last
 * printed with, by job or by location, so the reader's pick holds from one print to the next. One
 * key in `localStorage`, nothing in the database.
 */
import type { ReportView } from './siteMaterialsReport'

const VIEW_KEY = 'pt.materialLocationReport.view'

/** The grouping the device last printed with; by job until a pick is made. */
export function readReportView(): ReportView {
  try {
    return window.localStorage.getItem(VIEW_KEY) === 'location' ? 'location' : 'job'
  } catch {
    return 'job'
  }
}

export function writeReportView(view: ReportView): void {
  try {
    window.localStorage.setItem(VIEW_KEY, view)
  } catch {
    /* the window works without the memory */
  }
}
