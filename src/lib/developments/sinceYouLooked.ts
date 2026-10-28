/**
 * *You last looked* (punch list #208, the owner's call 5): the stamp lives on the device, as
 * Messages' seven days do — no table, no write. One key per development in `localStorage`;
 * every read and write is guarded, since a private window or cleared site data can refuse it.
 */
const key = (developmentId: string) => `pt.development.${developmentId}.lastLooked`

export function readLastLooked(developmentId: string): string | null {
  try {
    const v = window.localStorage.getItem(key(developmentId))
    return v && Number.isFinite(Date.parse(v)) ? v : null
  } catch {
    return null
  }
}

export function writeLastLooked(developmentId: string, iso: string): void {
  try {
    window.localStorage.setItem(key(developmentId), iso)
  } catch {
    // The device refused; the page still draws, with no line.
  }
}

/** The spike's toggle (*show the N at this address here*), kept on the device as well. */
const includeKey = (developmentId: string) => `pt.development.${developmentId}.includeAddress`

export function readIncludeAddress(developmentId: string): boolean {
  try {
    return window.localStorage.getItem(includeKey(developmentId)) === '1'
  } catch {
    return false
  }
}

export function writeIncludeAddress(developmentId: string, on: boolean): void {
  try {
    if (on) window.localStorage.setItem(includeKey(developmentId), '1')
    else window.localStorage.removeItem(includeKey(developmentId))
  } catch {
    // ignore
  }
}
