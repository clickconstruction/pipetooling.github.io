/**
 * Materials on site (punch list #209): the Tally's address while a box is open. A label's scan, a box's
 * door in Go anywhere and the Job Mode card land on `/tally?tab=on-site&job=<id>&container=<id>`. The
 * address keeps both while that box's screen is open, so a reload (the update's own, a recovery's or
 * the person's), Back and a shared link come back to the same box; it drops them when the person
 * leaves the box. Before v2.6904 the page read both once and took them off, and the reload a new
 * build makes a few seconds after a scan came back to the box list.
 *
 * Since v2.7298 (punch list #329, PR 3) a blank sticker's scan lands on `&sticker=<code>`: the tab opens the
 * **Sticker is new** sheet, and the code stays on the address while the sheet is open, so a reload or another
 * job picked under it keeps the sticker in hand. It leaves with the sheet.
 *
 * Pure: `useOnSiteAddress` hands in what the address says and what the screen shows, and does the step.
 */

export type OnSiteAddress = { jobId: string | null; containerId: string | null; stickerCode: string | null }
export type OnSiteBox = { jobId: string; containerId: string }

const clean = (v: string | null): string | null => {
  const t = v?.trim() ?? ''
  return t ? t : null
}

/** What the address names: `?job=`, `?container=` and `?sticker=`. */
export function readOnSiteAddress(params: URLSearchParams): OnSiteAddress {
  return { jobId: clean(params.get('job')), containerId: clean(params.get('container')), stickerCode: clean(params.get('sticker')) }
}

/** One word for an address, to tell a moved one from the one last read or written. */
export function onSiteAddressKey(a: OnSiteAddress | null): string {
  return `${a?.jobId ?? ''}|${a?.containerId ?? ''}|${a?.stickerCode ?? ''}`
}

/** The address with the open box on it, or with none; the sticker leaves with the box; every other parameter stays. */
export function withOnSiteBox(params: URLSearchParams, box: OnSiteBox | null): URLSearchParams {
  return withOnSiteAddress(params, box ? { jobId: box.jobId, containerId: box.containerId, stickerCode: null } : { jobId: null, containerId: null, stickerCode: null })
}

/** The address with what the screen shows on it: a box, a sticker's sheet on a job, or nothing; every other parameter stays. */
export function withOnSiteAddress(params: URLSearchParams, want: OnSiteAddress): URLSearchParams {
  const next = new URLSearchParams(params)
  for (const [name, value] of [['job', want.jobId], ['container', want.containerId], ['sticker', want.stickerCode]] as const) {
    if (value) next.set(name, value)
    else next.delete(name)
  }
  return next
}

export type OnSiteAddressStep =
  /** The jobs have not loaded: the address stands as it came, unread. */
  | { kind: 'wait' }
  /** The address moved to a job or a sticker (a scan, a link, Back, the first load): the screen follows it. */
  | { kind: 'read'; jobId: string | null; containerId: string | null; stickerCode: string | null; key: string }
  /** The screen moved (a box opened or was left, a sticker's sheet closed, another tab): the address follows it. */
  | { kind: 'write'; box: OnSiteBox | null; stickerCode: string | null; key: string }
  /** The address already says what the screen shows. */
  | { kind: 'rest'; key: string }

/**
 * One step of keeping the address and the screen in step. `lastKey` is the address this page last read
 * or wrote (null before the first): an address that differs from it was moved by someone else and wins
 * when it names a job or a sticker; otherwise the screen wins, and the address is written only when it
 * says something else.
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
  /** The sticker whose sheet is open on the tab, as the tab last said. */
  openStickerCode?: string | null
}): OnSiteAddressStep {
  if (!input.jobsLoaded) return { kind: 'wait' }
  const key = onSiteAddressKey(input.address)
  if (key !== input.lastKey && (input.address.jobId || input.address.stickerCode)) {
    return { kind: 'read', jobId: input.address.jobId, containerId: input.address.containerId, stickerCode: input.address.stickerCode, key }
  }
  const box: OnSiteBox | null = input.onTab && input.selectedJobId && input.openContainerId ? { jobId: input.selectedJobId, containerId: input.openContainerId } : null
  const sticker = input.onTab && input.selectedJobId && !box && input.openStickerCode ? input.openStickerCode : null
  const want: OnSiteAddress = box ? { jobId: box.jobId, containerId: box.containerId, stickerCode: null } : { jobId: sticker ? input.selectedJobId : null, containerId: null, stickerCode: sticker }
  const wantKey = onSiteAddressKey(want)
  return wantKey === key ? { kind: 'rest', key } : { kind: 'write', box, stickerCode: sticker, key: wantKey }
}
