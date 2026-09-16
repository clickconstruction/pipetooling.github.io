/**
 * The four Submittals cards on the Dashboard's Needs You (Submittals stage 4b), as pure
 * arithmetic over rows the hook already fetched: a won bid with no submittal started, a
 * shared room nobody has opened, rows sent back with no resubmit, and a lead time that
 * runs past the job's stage window. The Needs You kernel words them; this only counts and
 * picks the one to name.
 */

export type NudgeBid = { bidId: string; bidLabel: string; outcome: string | null; outcomeAt: string | null; jobId: string | null }
export type NudgeRevision = { id: string; bidId: string; revNumber: number; sharedAt: string | null; status: string }
export type NudgeRoom = { bidId: string; sharedAt: string | null; status: string }
export type NudgeView = { bidId: string; occurredAt: string }
export type NudgePerson = { bidId: string; name: string; openCount: number; mayDecide: boolean; closed: boolean }
export type NudgeItem = { submittalId: string; tag: string; reviewDecision: string | null; leadTimeDays: number | null }
/** The earliest stage window end on the job, as a YYYY-MM-DD. */
export type NudgeWindow = { jobId: string; windowEndYmd: string; label: string | null }

export type SubmittalNudgeInput = {
  bids: NudgeBid[]
  revisions: NudgeRevision[]
  rooms: NudgeRoom[]
  views: NudgeView[]
  people: NudgePerson[]
  items: NudgeItem[]
  windows: NudgeWindow[]
}

export type SubmittalNudge = {
  notStarted: { count: number; first: { bidId: string; bidLabel: string; days: number } | null }
  unopened: { count: number; first: { bidId: string; bidLabel: string; days: number; names: string[] } | null }
  sentBack: { count: number; first: { bidId: string; bidLabel: string; revNumber: number; rows: number } | null }
  leadTime: { count: number; first: { bidId: string; bidLabel: string; tag: string; leadDays: number; landsYmd: string; windowEndYmd: string; overrunDays: number } | null }
}

export const WON_NO_SUBMITTAL_DAYS = 5
/** After this many days the moment has passed — the job is under way without one; the card lets it go. */
export const WON_NO_SUBMITTAL_MAX_DAYS = 45
export const SHARED_UNOPENED_DAYS = 3

const DAY = 86_400_000

function daysBetween(fromIso: string, now: Date): number {
  const d = new Date(fromIso)
  if (Number.isNaN(d.getTime())) return 0
  return Math.floor((now.getTime() - d.getTime()) / DAY)
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function addDays(ymdStr: string, days: number): string {
  const d = new Date(`${ymdStr}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return ymd(d)
}

function daysApart(aYmd: string, bYmd: string): number {
  return Math.round((new Date(`${aYmd}T00:00:00Z`).getTime() - new Date(`${bYmd}T00:00:00Z`).getTime()) / DAY)
}

/** The newest shared revision per bid, and the newest revision of any status. */
function newestByBid(revisions: ReadonlyArray<NudgeRevision>): { shared: Map<string, NudgeRevision>; any: Map<string, NudgeRevision> } {
  const shared = new Map<string, NudgeRevision>()
  const any = new Map<string, NudgeRevision>()
  for (const r of revisions) {
    const a = any.get(r.bidId)
    if (!a || r.revNumber > a.revNumber) any.set(r.bidId, r)
    if (r.sharedAt) {
      const s = shared.get(r.bidId)
      if (!s || r.revNumber > s.revNumber) shared.set(r.bidId, r)
    }
  }
  return { shared, any }
}

export function summarizeSubmittalNudge(input: SubmittalNudgeInput, now: Date, opts: { wonDays?: number; sharedDays?: number; todayYmd?: string } = {}): SubmittalNudge {
  const wonDays = opts.wonDays ?? WON_NO_SUBMITTAL_DAYS
  const sharedDays = opts.sharedDays ?? SHARED_UNOPENED_DAYS
  const today = opts.todayYmd ?? ymd(now)
  const labelOf = new Map(input.bids.map((b) => [b.bidId, b.bidLabel]))
  const { shared, any } = newestByBid(input.revisions)
  const bidsWithRevision = new Set(input.revisions.map((r) => r.bidId))

  // 1 · won N days, no submittal started
  const notStartedList = input.bids
    // started_or_complete is a won bid whose job exists — the one the GC asks about first.
    .filter((b) => (b.outcome === 'won' || b.outcome === 'started_or_complete') && b.outcomeAt && !bidsWithRevision.has(b.bidId))
    .map((b) => ({ bidId: b.bidId, bidLabel: b.bidLabel, days: daysBetween(b.outcomeAt as string, now) }))
    .filter((x) => x.days >= wonDays && x.days <= WON_NO_SUBMITTAL_MAX_DAYS)
    .sort((a, b) => b.days - a.days)

  // 2 · shared N days, nobody opened the room since the share
  const unopenedList = input.rooms
    .filter((r) => r.status === 'open' && r.sharedAt)
    .map((r) => {
      const sharedAt = r.sharedAt as string
      const opened = input.views.some((v) => v.bidId === r.bidId && v.occurredAt >= sharedAt)
      const names = input.people.filter((p) => p.bidId === r.bidId && !p.closed && p.openCount === 0).map((p) => p.name).slice(0, 3)
      return { bidId: r.bidId, bidLabel: labelOf.get(r.bidId) ?? 'a bid', days: daysBetween(sharedAt, now), opened, names }
    })
    .filter((x) => !x.opened && x.days >= sharedDays)
    .sort((a, b) => b.days - a.days)

  // 3 · rows sent back on the newest shared revision, no newer revision yet
  const sentBackList: Array<{ bidId: string; bidLabel: string; revNumber: number; rows: number }> = []
  for (const [bidId, rev] of shared) {
    const newer = any.get(bidId)
    if (newer && newer.revNumber > rev.revNumber) continue
    const rows = input.items.filter((it) => it.submittalId === rev.id && (it.reviewDecision === 'revise' || it.reviewDecision === 'rejected')).length
    if (rows > 0) sentBackList.push({ bidId, bidLabel: labelOf.get(bidId) ?? 'a bid', revNumber: rev.revNumber, rows })
  }
  sentBackList.sort((a, b) => b.rows - a.rows)

  // 4 · a lead time on the newest revision lands after the job's earliest stage window ends
  const windowByJob = new Map<string, NudgeWindow>()
  for (const w of input.windows) {
    const cur = windowByJob.get(w.jobId)
    if (!cur || w.windowEndYmd < cur.windowEndYmd) windowByJob.set(w.jobId, w)
  }
  const leadList: NonNullable<SubmittalNudge['leadTime']['first']>[] = []
  for (const b of input.bids) {
    if (!b.jobId) continue
    const w = windowByJob.get(b.jobId)
    const rev = any.get(b.bidId)
    if (!w || !rev) continue
    for (const it of input.items) {
      if (it.submittalId !== rev.id || it.leadTimeDays == null || it.leadTimeDays <= 0) continue
      const lands = addDays(today, it.leadTimeDays)
      const overrun = daysApart(lands, w.windowEndYmd)
      if (overrun > 0) leadList.push({ bidId: b.bidId, bidLabel: b.bidLabel, tag: it.tag.trim() || 'accessory', leadDays: it.leadTimeDays, landsYmd: lands, windowEndYmd: w.windowEndYmd, overrunDays: overrun })
    }
  }
  leadList.sort((a, b) => b.overrunDays - a.overrunDays)

  return {
    notStarted: { count: notStartedList.length, first: notStartedList[0] ?? null },
    unopened: { count: unopenedList.length, first: unopenedList[0] ? { bidId: unopenedList[0].bidId, bidLabel: unopenedList[0].bidLabel, days: unopenedList[0].days, names: unopenedList[0].names } : null },
    sentBack: { count: sentBackList.length, first: sentBackList[0] ?? null },
    leadTime: { count: leadList.length, first: leadList[0] ?? null },
  }
}

export function submittalNudgeIsEmpty(n: SubmittalNudge | null): boolean {
  return !n || (n.notStarted.count === 0 && n.unopened.count === 0 && n.sentBack.count === 0 && n.leadTime.count === 0)
}
