/**
 * Folds on the office person's phone (punch list #30, PR 4a-2): a section is
 * one line — its name and its headline count — until it is opened, and the
 * device remembers which ones are open. Pure, but for the two storage doors.
 */

export type PhoneFoldTone = 'quiet' | 'amber' | 'red'

export interface PhoneFoldHeadline {
  /** `due today 2 · overdue 1` — what the line says after the section's name. */
  words: string
  tone: PhoneFoldTone
}

/** My Inbox: what is still open today and what is overdue, from the instances the card shows. */
export function myInboxFoldHeadline(instances: ReadonlyArray<{ scheduled_date: string; completed_at: string | null }>, todayYmd: string): PhoneFoldHeadline {
  let today = 0
  let overdue = 0
  for (const i of instances) {
    if (i.completed_at) continue
    const day = (i.scheduled_date ?? '').slice(0, 10)
    if (day && day < todayYmd) overdue += 1
    else if (day === todayYmd) today += 1
  }
  if (!today && !overdue) return { words: 'nothing due', tone: 'quiet' }
  const parts: string[] = []
  if (today) parts.push(`due today ${today}`)
  if (overdue) parts.push(`overdue ${overdue}`)
  return { words: parts.join(' · '), tone: overdue ? 'red' : 'amber' }
}

/** `5 open · oldest 4 d` for one request inbox; `none open` when it is clear. Closed rows are not counted. */
export function requestInboxFoldWords(requests: ReadonlyArray<{ status: string; created_at: string | null }>, nowMs: number): string {
  const open = requests.filter((r) => r.status === 'open')
  if (open.length === 0) return 'none open'
  let oldest = 0
  for (const r of open) {
    const at = r.created_at ? Date.parse(r.created_at) : NaN
    if (!Number.isNaN(at)) oldest = Math.max(oldest, Math.floor((nowMs - at) / 86_400_000))
  }
  return oldest >= 1 ? `${open.length} open · oldest ${oldest} d` : `${open.length} open`
}

/** The team inboxes on one line: each inbox the role can see, by name. */
export function teamsInboxFoldHeadline(
  input: {
    dispatch: ReadonlyArray<{ status: string; created_at: string | null }> | null
    estimator: ReadonlyArray<{ status: string; created_at: string | null }> | null
  },
  nowMs: number,
): PhoneFoldHeadline {
  const parts: string[] = []
  let open = 0
  if (input.dispatch) {
    parts.push(`Dispatch ${requestInboxFoldWords(input.dispatch, nowMs)}`)
    open += input.dispatch.filter((r) => r.status === 'open').length
  }
  if (input.estimator) {
    parts.push(`Estimator ${requestInboxFoldWords(input.estimator, nowMs)}`)
    open += input.estimator.filter((r) => r.status === 'open').length
  }
  return { words: parts.join(' · '), tone: open ? 'amber' : 'quiet' }
}

export function phoneFoldStorageKey(userId: string, section: string): string {
  return `pipetooling_phone_fold_${section}_${userId}`
}

/** Closed unless this device opened it. */
export function readPhoneFoldOpen(userId: string | null | undefined, section: string): boolean {
  if (!userId || typeof window === 'undefined') return false
  try {
    return localStorage.getItem(phoneFoldStorageKey(userId, section)) === 'open'
  } catch {
    return false
  }
}

export function writePhoneFoldOpen(userId: string | null | undefined, section: string, open: boolean): void {
  if (!userId || typeof window === 'undefined') return
  try {
    if (open) localStorage.setItem(phoneFoldStorageKey(userId, section), 'open')
    else localStorage.removeItem(phoneFoldStorageKey(userId, section))
  } catch {
    /* per-device nicety only */
  }
}

/** `7 in` for the clock strip's fold: who is clocked in now; `nobody in` when the strip only lists people who left. */
export function whosInFoldHeadline(openSessionCount: number): PhoneFoldHeadline {
  return openSessionCount > 0 ? { words: `${openSessionCount} in`, tone: 'quiet' } : { words: 'nobody in', tone: 'quiet' }
}

/** `2 ready · 71 billed` for the billing pipeline's fold; the ready ones are the work, so they set the tone. */
export function billingPipelineFoldHeadline(input: { ready: number; billed: number; loading: boolean }): PhoneFoldHeadline | null {
  if (input.loading) return null
  if (!input.ready && !input.billed) return { words: 'nothing waiting', tone: 'quiet' }
  return { words: `${input.ready} ready · ${input.billed} billed`, tone: input.ready ? 'amber' : 'quiet' }
}

/** The one-line door to the Inbox deck: `Needs you · 10 · <the first item>`; null when the list is empty. */
export function needsYouDoorWords(items: ReadonlyArray<{ title: string }>): { count: number; first: string } | null {
  if (items.length === 0) return null
  return { count: items.length, first: items[0]!.title }
}

/** My Schedule is hidden on the office person's phone only when both days are empty and nothing is loading. */
export function hideEmptyMySchedule(input: { fold: boolean; loading: boolean; todayCount: number; tomorrowCount: number }): boolean {
  return input.fold && !input.loading && input.todayCount === 0 && input.tomorrowCount === 0
}
