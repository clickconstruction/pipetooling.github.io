/**
 * The bands page's switch (design spike, 2026-11-20). The page is a candidate, so nobody gets it by a rule yet:
 * a device is on it when its address said `?bands=1` once, and off again after `?bands=0`. The dev server draws a
 * Before and After strip over Job Mode that presses the same switch, so the two pages can be read side by side
 * on real data. Nothing here is stored on the server.
 */
const KEY = 'job_mode_bands_spike'

/** Whether this device is on the bands page: the address's word, kept, else what was kept. */
export function readBandsSpike(search: string = typeof window === 'undefined' ? '' : window.location.search): boolean {
  if (typeof window === 'undefined') return false
  try {
    const asked = new URLSearchParams(search).get('bands')
    if (asked === '1' || asked === '0') localStorage.setItem(KEY, asked)
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

export function writeBandsSpike(on: boolean): void {
  try {
    localStorage.setItem(KEY, on ? '1' : '0')
  } catch {
    // The switch is a convenience: a device that keeps nothing stays on the page it has.
  }
}
