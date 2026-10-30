/**
 * The job window's phone action bar (punch list #30, PR 2b): what the middle button says,
 * who sees Arrived / Leaving, and the three tiles under the customer. Since punch list #189,
 * PR 4, also the rows both bars draw — the tabbed window's and the crew's plain window's —
 * and which stamp the crew is due. Pure.
 */
import type { JobNextChip } from './jobNextLine'
import type { EditJobBillingBar } from './editJobBillingBar'
import { formatCurrencyNoCents } from './jobFormatting'
import type { JobThreadStampKind } from '../jobThreadNoteStampBody'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'

export type JobWindowVerbTarget = 'pct' | 'bill' | 'status'
export type JobWindowVerb = { label: string; tone: 'red' | 'blue' | 'green'; target: JobWindowVerbTarget }

/**
 * The bar's verb, from the same chip the Pipeline row shows plus the bill ledger: the gap the
 * row flagged is the thing the bar offers to fix. `null` on a Paid job (nothing is next).
 */
export function jobWindowVerb(input: { status: string | null; chip: JobNextChip | null; bar: EditJobBillingBar }): JobWindowVerb | null {
  const { status, chip, bar } = input
  if (status === 'paid') return null
  if (chip?.action === 'pct') return { label: 'Set % done', tone: 'red', target: 'pct' }
  if (chip?.action === 'bill-stage') return { label: 'Bill it', tone: 'green', target: 'bill' }
  if (bar.draft > 0) return { label: 'Send bill…', tone: 'blue', target: 'bill' }
  switch (status) {
    case 'waiting':
      return { label: 'Move to Working', tone: 'blue', target: 'status' }
    case 'working':
      return { label: 'Ready to bill', tone: chip?.action === 'advance' ? 'green' : 'blue', target: 'status' }
    case 'ready_to_bill':
      return { label: 'Bill it', tone: 'blue', target: 'bill' }
    case 'billed':
      return { label: 'Mark paid', tone: 'blue', target: 'status' }
    default:
      return null
  }
}

/** On the crew = a team member of the job, or assigned to one of its schedule blocks. */
export function viewerOnCrew(viewerId: string | null | undefined, teamMemberIds: Iterable<string>, scheduleAssigneeIds: Iterable<string>): boolean {
  if (!viewerId) return false
  for (const id of teamMemberIds) if (id === viewerId) return true
  for (const id of scheduleAssigneeIds) if (id === viewerId) return true
  return false
}

/** Job total · Billed (paid + open) · Paid, "—" for nothing. */
export function jobWindowTiles(bar: EditJobBillingBar): { total: string; billed: string; paid: string } {
  const f = (n: number) => (n > 0 ? `$${formatCurrencyNoCents(n)}` : '—')
  return { total: f(bar.total), billed: f(bar.paid + bar.billedUnpaid), paid: f(bar.paid) }
}

// ---------------------------------------------------------------------------
// The bar's rows (punch list #189, PR 4): both windows draw what these return.
// ---------------------------------------------------------------------------

/** Every button on a job window's phone bar stands at least this tall — a thumb's press. */
export const JOB_WINDOW_BAR_MIN_HEIGHT = 48

export type JobWindowBarKey = 'status' | 'verb' | 'arrived' | 'leaving' | 'report' | 'note'
export type JobWindowBarTone = 'outline' | JobWindowVerb['tone'] | 'amber'
export type JobWindowBarButton = {
  key: JobWindowBarKey
  label: string
  tone: JobWindowBarTone
  /** Takes the row's spare width: the bar's one big press. */
  grow: boolean
  /** Opens a sheet or a window rather than acting at once. */
  opensDialog: boolean
}

const STAMP_LABEL: Record<JobThreadStampKind, string> = { arrived: 'Arrived', leaving: 'Leaving' }

/** Arrived or Leaving, in the composer chips' colours: green to arrive, amber to leave. */
function stampButton(stamp: JobThreadStampKind, grow: boolean): JobWindowBarButton {
  return { key: stamp, label: STAMP_LABEL[stamp], tone: stamp === 'arrived' ? 'green' : 'amber', grow, opensDialog: false }
}

/**
 * The tabbed window's bar: Status ▾ · the job's next verb · the stamp a viewer on the crew is due ·
 * Note, which opens the note sheet. The verb takes the row's spare width (the stamp does on a Paid
 * job, which has no verb); a viewer off the crew gets no stamp.
 */
export function tabbedJobWindowBar(verb: JobWindowVerb | null, stamp: JobThreadStampKind | null = null): JobWindowBarButton[] {
  const row: JobWindowBarButton[] = [{ key: 'status', label: 'Status ▾', tone: 'outline', grow: false, opensDialog: true }]
  // Only a status move opens a sheet: Set % done opens the composer's inline editor, Bill it a tab.
  if (verb) row.push({ key: 'verb', label: verb.label, tone: verb.tone, grow: true, opensDialog: verb.target === 'status' })
  if (stamp) row.push(stampButton(stamp, !verb))
  row.push({ key: 'note', label: 'Note', tone: 'outline', grow: false, opensDialog: true })
  return row
}

/**
 * The crew's plain window's bar: Arrived or Leaving (the stamp the viewer is due) · Leave report ·
 * Note. Each button is there only while its press can land; an empty row draws no bar.
 */
export function crewJobWindowBar(input: { stamp: JobThreadStampKind | null; canLeaveReport: boolean; canNote: boolean }): JobWindowBarButton[] {
  const row: JobWindowBarButton[] = []
  if (input.stamp) row.push(stampButton(input.stamp, true))
  if (input.canLeaveReport) row.push({ key: 'report', label: 'Leave report', tone: 'blue', grow: false, opensDialog: true })
  if (input.canNote) row.push({ key: 'note', label: 'Note', tone: 'outline', grow: false, opensDialog: true })
  return row
}

/** What a press on Leaving opens after the stamp (punch list #189, decision 6, answered 2026-10-29). */
export type LeavingOpens = 'on-my-way' | 'update-focus'

/**
 * Leaving stamps the note, then opens the On my way sheet for the next job when the day has one, since the sheet
 * clocks the drive and texts the customer in one press; with no next job, Update Focus as before (v2.1640), where a
 * job can be searched for. The window and the card agree (the mock-up's flow 8).
 */
export function leavingOpens(input: { dayHasNextJob: boolean }): LeavingOpens {
  return input.dayHasNextJob ? 'on-my-way' : 'update-focus'
}

/** A thread note as the stamp read needs it: the body, when, and who. */
export type CrewStampNote = { body: string; created_at: string; authorName: string | null }
/** A clock session on the job as the stamp read needs it: whose, and when it opened and closed. */
export type CrewClockSession = { personName: string; clockedInAt: string | null; clockedOutAt: string | null }

/** The shape `buildJobThreadStampBody` writes: `Name · <when> — Arrived at job` / `— Leaving job`. */
const STAMP_BODY = /^(.+?) · .+ — (Arrived at job|Leaving job)$/

/**
 * Which stamp the bar offers: Leaving while the viewer's latest mark on this job today says they
 * are there, otherwise Arrived. An Arrived stamp and a clock-in say there; a Leaving stamp and a
 * clock-out say gone. So a tech who clocked in through Job Mode and never pressed Arrived is
 * offered Leaving, and one back from lunch is offered Arrived again. A stamp is the viewer's by
 * its author or by the name its body starts with (the stamp carries it), a clock session by its
 * person's name; `Someone` stands in for a viewer with no name, as the stamp body does.
 */
export function crewStampOffer(input: {
  viewerName: string | null | undefined
  notes: readonly CrewStampNote[]
  clockSessions?: readonly CrewClockSession[]
  todayYmd: string
}): JobThreadStampKind {
  const me = input.viewerName?.trim() || 'Someone'
  const marks: Array<{ iso: string | null; here: boolean }> = []
  for (const n of input.notes) {
    const m = STAMP_BODY.exec(n.body.trim())
    if (!m) continue
    if ((n.authorName?.trim() || '') !== me && m[1] !== me) continue
    marks.push({ iso: n.created_at, here: m[2] === 'Arrived at job' })
  }
  for (const c of input.clockSessions ?? []) {
    if (c.personName.trim() !== me) continue
    marks.push({ iso: c.clockedInAt, here: true }, { iso: c.clockedOutAt, here: false })
  }
  let latest: { at: number; here: boolean } | null = null
  for (const mark of marks) {
    if (!mark.iso || calendarYmdInAppTzFromIso(mark.iso) !== input.todayYmd) continue
    const at = new Date(mark.iso).getTime()
    if (Number.isNaN(at)) continue
    if (!latest || at >= latest.at) latest = { at, here: mark.here }
  }
  return latest?.here ? 'leaving' : 'arrived'
}
