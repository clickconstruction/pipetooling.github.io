/**
 * Materials on site (punch list #209): the Tally's address while a box is open. A label's scan, a box's
 * door in Go anywhere and the Job Mode card land on `/tally?tab=on-site&job=<id>&container=<id>`. The
 * address keeps both while that box's screen is open, so a reload (the update's own, a recovery's or
 * the person's), Back and a shared link come back to the same box; it drops them when the person
 * leaves the box. Before v2.6904 the page read both once and took them off, and the reload a new
 * build makes a few seconds after a scan came back to the box list.
 *
 * Pure: `useOnSiteAddress` hands in what the address says and what the screen shows, and does the step.
 */

export type OnSiteAddress = { jobId: string | null; containerId: string | null }
export type OnSiteBox = { jobId: string; containerId: string }

const clean = (v: string | null): string | null => {
  const t = v?.trim() ?? ''
  return t ? t : null
}

/** What the address names: `?job=` and `?container=`. */
export function readOnSiteAddress(params: URLSearchParams): OnSiteAddress {
  return { jobId: clean(params.get('job')), containerId: clean(params.get('container')) }
}

/** One word for an address, to tell a moved one from the one last read or written. */
export function onSiteAddressKey(a: OnSiteAddress | null): string {
  return `${a?.jobId ?? ''}|${a?.containerId ?? ''}`
}

/** The address with the open box on it, or with none; every other parameter stays. */
export function withOnSiteBox(params: URLSearchParams, box: OnSiteBox | null): URLSearchParams {
  const next = new URLSearchParams(params)
  if (box) {
    next.set('job', box.jobId)
    next.set('container', box.containerId)
  } else {
    next.delete('job')
    next.delete('container')
  }
  return next
}

export type OnSiteAddressStep =
  /** The jobs have not loaded: the address stands as it came, unread. */
  | { kind: 'wait' }
  /** The address moved to a job (a scan, a link, Back, the first load): the screen follows it. */
  | { kind: 'read'; jobId: string; containerId: string | null; key: string }
  /** The screen moved (a box opened or was left, another tab): the address follows it. */
  | { kind: 'write'; box: OnSiteBox | null; key: string }
  /** The address already says what the screen shows. */
  | { kind: 'rest'; key: string }

/**
 * One step of keeping the address and the screen in step. `lastKey` is the address this page last read
 * or wrote (null before the first): an address that differs from it was moved by someone else and wins
 * when it names a job; otherwise the screen wins, and the address is written only when it says
 * something else.
 */
export function onSiteAddressStep(input: {
  address: OnSiteAddress
  lastKey: string | null
  jobsLoaded: boolean
  /** The On site tab is the one drawn: a box is open on no other tab. */
  onTab: boolean
  selectedJobId: string | null
  /** The box whose screen is open on the tab, as the tab last said. */
  openContainerId: string | null
}): OnSiteAddressStep {
  if (!input.jobsLoaded) return { kind: 'wait' }
  const key = onSiteAddressKey(input.address)
  if (key !== input.lastKey && input.address.jobId) {
    return { kind: 'read', jobId: input.address.jobId, containerId: input.address.containerId, key }
  }
  const box: OnSiteBox | null = input.onTab && input.selectedJobId && input.openContainerId ? { jobId: input.selectedJobId, containerId: input.openContainerId } : null
  const wantKey = onSiteAddressKey(box)
  return wantKey === key ? { kind: 'rest', key } : { kind: 'write', box, key: wantKey }
}
