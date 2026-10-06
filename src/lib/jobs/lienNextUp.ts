/**
 * The Lien desk's Next up list (punch list #82, PR 1): every lien paper that asks for an act,
 * as one list in deadline order, each row naming its one next move and the screen that already
 * does it. Pure: it folds the queues the desk already builds (notices, affidavits, retainage,
 * letter two, liens filed and not yet served) and reads nothing itself. Nothing here writes,
 * and nothing replaces a pane: a row only says which existing pane, pile and job to open.
 *
 * The office and the leader see different buttons on the same row, as the panes' footers do
 * (`isLienOffice` / `isLienLeader`); a role that is neither sees the list and no buttons.
 */
import { isLienLeader, isLienOffice, type LienDeskEntry, type LienDeskPile, type LienDeskSeverity } from './lienDesk'
import type { LienAffidavitEntry } from './lienDeskAffidavits'
import type { LienRetainageEntry } from './lienDeskRetainage'
import { letterTwoIsDue, type LetterTwoStatus } from './lienLetterTwo'

export type LienNextUpKind = 'notice' | 'affidavit' | 'retainage'

export type LienNextUpAction =
  | 'find_owner'
  | 'draft'
  | 'approve'
  | 'send'
  | 'send_run'
  | 'add_tracking'
  | 'review_hold'
  | 'letter_two'
  | 'note_missed'
  | 'fix_property'
  | 'send_notice'
  | 'draft_late'
  | 'file_affidavit'
  | 'record_service'

/** Where a row's button goes — always a screen that exists today. */
export type LienNextUpTarget =
  | { open: 'notices'; jobId: string; pile: LienDeskPile }
  | { open: 'affidavits'; jobId: string }
  | { open: 'retainage'; jobId: string }
  | { open: 'run'; gcId: string }
  | { open: 'lien_window'; jobId: string; tab: 'affidavit' }

export type LienNextUpGroup = 'now' | 'coming'

export type LienNextUpRow = {
  key: string
  kind: LienNextUpKind
  jobId: string | null
  gcId: string | null
  /** The job (or the GC, for a run) as the desk names it. */
  title: string
  /** What state the paper is in, in a few words. */
  sub: string
  /** The last day (YYYY-MM-DD); null when the row has no date of its own. */
  dueOn: string | null
  /** Whole days to `dueOn` (negative once past); null with no date. */
  daysLeft: number | null
  severity: LienDeskSeverity
  group: LienNextUpGroup
  action: LienNextUpAction
  /** The button's words; null when this viewer has no move on the row (it still opens on a press of the row). */
  button: string | null
  target: LienNextUpTarget
}

/** A row inside this many days, or past its day, is *Needs you now*. */
export const LIEN_NEXT_UP_NOW_DAYS = 7

const BUTTON: Record<LienNextUpAction, string> = {
  find_owner: 'Find the owner',
  draft: 'Draft notice',
  approve: 'Approve',
  send: 'Send',
  send_run: 'Send the run',
  add_tracking: 'Add tracking',
  review_hold: 'Review the hold',
  letter_two: 'Send letter two',
  note_missed: 'Note it',
  fix_property: 'Fix the property',
  send_notice: 'Send the notice first',
  draft_late: 'Draft it late',
  file_affidavit: 'File the affidavit',
  record_service: 'Record service',
}

export type LienNextUpInput = {
  notices: ReadonlyArray<LienDeskEntry>
  affidavits: ReadonlyArray<LienAffidavitEntry>
  retainage: ReadonlyArray<LienRetainageEntry>
  letterTwoByJob: Readonly<Record<string, LetterTwoStatus>>
  /** Filed affidavits not yet served (`LienWatchResult.serveDue`). */
  serveDue?: ReadonlyArray<{ jobId: string; serveDue: string }>
  role: string | null | undefined
  todayYmd: string
  jobTitle: (jobId: string) => string
  gcName: (gcId: string) => string
}

function daysBetween(fromYmd: string, toYmd: string): number {
  const d = (y: string) => Date.UTC(Number(y.slice(0, 4)), Number(y.slice(5, 7)) - 1, Number(y.slice(8, 10)))
  return Math.round((d(toYmd) - d(fromYmd)) / 86_400_000)
}

function groupOf(daysLeft: number | null, severity: LienDeskSeverity): LienNextUpGroup {
  if (daysLeft != null) return daysLeft <= LIEN_NEXT_UP_NOW_DAYS ? 'now' : 'coming'
  return severity === 'red' ? 'now' : 'coming'
}

/** Overdue first, then by the last day; a row with no day goes after the dated ones of its group. */
function compareRows(a: LienNextUpRow, b: LienNextUpRow): number {
  if (a.group !== b.group) return a.group === 'now' ? -1 : 1
  if (a.dueOn && b.dueOn && a.dueOn !== b.dueOn) return a.dueOn < b.dueOn ? -1 : 1
  if (!!a.dueOn !== !!b.dueOn) return a.dueOn ? -1 : 1
  return a.key < b.key ? -1 : a.key > b.key ? 1 : 0
}

export function buildLienNextUp(input: LienNextUpInput): LienNextUpRow[] {
  const office = isLienOffice(input.role)
  const leader = isLienLeader(input.role)
  const canAct = office || leader
  const rows: LienNextUpRow[] = []

  const push = (r: Omit<LienNextUpRow, 'group' | 'button'> & { button?: string | null }) => {
    const button = r.button !== undefined ? r.button : canAct ? BUTTON[r.action] : null
    rows.push({ ...r, button, group: groupOf(r.daysLeft, r.severity) })
  }
  /** Awaiting approval: the leader approves; the office waits, with no button. */
  const awaiting = (): { action: LienNextUpAction; button: string | null; sub: string } =>
    leader ? { action: 'approve', button: BUTTON.approve, sub: 'Waiting on your approval' } : { action: 'approve', button: null, sub: 'Waiting on the leader' }

  // ---- § 53.056 notices ----
  const readyByGc = new Map<string, LienDeskEntry[]>()
  for (const e of input.notices) {
    if (e.pile === 'ready' && e.gcCustomerId) {
      const list = readyByGc.get(e.gcCustomerId)
      if (list) list.push(e)
      else readyByGc.set(e.gcCustomerId, [e])
    }
  }
  for (const e of input.notices) {
    const base = { kind: 'notice' as const, jobId: e.jobId, gcId: e.gcCustomerId, title: input.jobTitle(e.jobId), dueOn: e.earliestDeadline, daysLeft: e.daysLeft, severity: e.severity }
    const pane = (pile: LienDeskPile): LienNextUpTarget => ({ open: 'notices', jobId: e.jobId, pile })
    switch (e.pile) {
      case 'needs_owner':
        push({ ...base, key: `notice:${e.jobId}`, sub: 'Needs the owner of record', action: 'find_owner', target: pane('needs_owner') })
        break
      case 'to_draft':
        push({ ...base, key: `notice:${e.jobId}`, sub: 'Notice to draft', action: 'draft', target: pane('to_draft') })
        break
      case 'awaiting': {
        const a = awaiting()
        push({ ...base, key: `notice:${e.jobId}`, sub: a.sub, action: a.action, button: a.button, target: pane('awaiting') })
        break
      }
      case 'ready': {
        // A GC with several ready is one row below; a single job sends from its own pane.
        if (e.gcCustomerId && (readyByGc.get(e.gcCustomerId)?.length ?? 0) > 1) break
        push({ ...base, key: `notice:${e.jobId}`, sub: 'Approved · ready to send', action: 'send', button: office ? BUTTON.send : null, target: pane('ready') })
        break
      }
      case 'printed':
        push({ ...base, key: `notice:${e.jobId}`, sub: 'In the mail · tracking owed', action: 'add_tracking', button: office ? BUTTON.add_tracking : null, target: pane('printed') })
        break
      case 'held':
        push({ ...base, key: `notice:${e.jobId}`, sub: 'Held', action: 'review_hold', target: pane('held') })
        break
      case 'sent': {
        const two = input.letterTwoByJob[e.jobId]
        if (!two || !letterTwoIsDue(two)) break
        push({ ...base, key: `letter-two:${e.jobId}`, sub: two.words || 'Letter two is due', dueOn: null, daysLeft: null, severity: two.state === 'overdue' ? 'red' : 'amber', action: 'letter_two', button: office ? BUTTON.letter_two : null, target: pane('sent') })
        break
      }
      case 'missed':
        // Months still open are drafted as on any other row; a closed window nobody wrote down is noted.
        if (e.dueMonths.length > 0) push({ ...base, key: `notice:${e.jobId}`, sub: 'Notice to draft · a window closed', action: 'draft', target: pane('missed') })
        else {
          // v2.4708: every window closed unsent, but the affidavit's own window is still open — a late notice can still carry it (the owner's reading, 2026-10-06).
          const aff = input.affidavits.find((a) => a.jobId === e.jobId)
          const lateOpen = aff && aff.pile !== 'filed' && aff.deadline && aff.deadline >= input.todayYmd && e.missedMonths.length > 0
          if (lateOpen) push({ ...base, key: `notice:${e.jobId}`, sub: 'Late notice to draft · the window closed, the affidavit is still open', dueOn: aff.deadline, daysLeft: aff.daysLeft, severity: aff.severity, action: 'draft_late', button: office ? BUTTON.draft_late : null, target: pane('missed') })
          else if (e.missedUnrecorded.length > 0) push({ ...base, key: `notice:${e.jobId}`, sub: 'A window closed with nothing recorded', dueOn: null, daysLeft: null, severity: 'red', action: 'note_missed', button: office ? BUTTON.note_missed : null, target: pane('missed') })
        }
        break
    }
  }
  for (const [gcId, list] of readyByGc) {
    if (list.length < 2) continue
    const dated = list.filter((e) => e.earliestDeadline).sort((a, b) => (a.earliestDeadline! < b.earliestDeadline! ? -1 : 1))
    const first = dated[0] ?? null
    push({
      kind: 'notice',
      key: `run:${gcId}`,
      jobId: null,
      gcId,
      title: input.gcName(gcId),
      sub: `${list.length} notices approved · ready to send`,
      dueOn: first?.earliestDeadline ?? null,
      daysLeft: first?.daysLeft ?? null,
      severity: list.some((e) => e.severity === 'red') ? 'red' : list.some((e) => e.severity === 'amber') ? 'amber' : 'quiet',
      action: 'send_run',
      button: office ? BUTTON.send_run : null,
      target: { open: 'run', gcId },
    })
  }

  // ---- § 53.052 affidavits ----
  for (const e of input.affidavits) {
    const base = { kind: 'affidavit' as const, jobId: e.jobId, gcId: e.gcCustomerId, title: input.jobTitle(e.jobId), dueOn: e.deadline || null, daysLeft: e.deadline ? e.daysLeft : null, severity: e.severity, target: { open: 'affidavits', jobId: e.jobId } as LienNextUpTarget }
    const key = `affidavit:${e.jobId}`
    switch (e.pile) {
      case 'needs_property': {
        // v2.4708: when the notice is the one gate left, the move is the late notice, not the property record.
        const failing = e.gates.filter((g) => !g.ok).map((g) => g.key)
        if (failing.length === 1 && failing[0] === 'notice') push({ ...base, key, sub: 'Affidavit · send the § 53.056 notice first — late is allowed while this window is open', action: 'send_notice', button: office ? BUTTON.send_notice : null, target: { open: 'notices', jobId: e.jobId, pile: 'missed' } })
        else push({ ...base, key, sub: 'Affidavit · the property record is not complete', action: 'fix_property' })
        break
      }
      case 'to_draft':
        push({ ...base, key, sub: 'Affidavit to draft', action: 'draft', button: canAct ? 'Draft affidavit' : null })
        break
      case 'awaiting': {
        const a = awaiting()
        push({ ...base, key, sub: `Affidavit · ${a.sub.charAt(0).toLowerCase()}${a.sub.slice(1)}`, action: a.action, button: a.button })
        break
      }
      case 'ready':
        push({ ...base, key, sub: 'Affidavit approved · ready to file', action: 'file_affidavit', button: office ? BUTTON.file_affidavit : null })
        break
      case 'held':
        push({ ...base, key, sub: 'Affidavit held', action: 'review_hold' })
        break
      case 'filed':
      case 'missed':
        break
    }
  }
  for (const s of input.serveDue ?? []) {
    const daysLeft = daysBetween(input.todayYmd, s.serveDue)
    push({ kind: 'affidavit', key: `serve:${s.jobId}`, jobId: s.jobId, gcId: null, title: input.jobTitle(s.jobId), sub: 'Lien filed · not yet served', dueOn: s.serveDue, daysLeft, severity: 'red', action: 'record_service', button: office ? BUTTON.record_service : null, target: { open: 'lien_window', jobId: s.jobId, tab: 'affidavit' } })
  }

  // ---- § 53.057 retainage ----
  for (const e of input.retainage) {
    const base = { kind: 'retainage' as const, jobId: e.jobId, gcId: e.gcCustomerId, title: input.jobTitle(e.jobId), dueOn: e.deadline, daysLeft: e.daysLeft, severity: e.severity, target: { open: 'retainage', jobId: e.jobId } as LienNextUpTarget }
    const key = `retainage:${e.jobId}`
    switch (e.pile) {
      case 'needs_owner':
        push({ ...base, key, sub: 'Retainage · needs the owner of record', action: 'find_owner' })
        break
      case 'to_draft':
        push({ ...base, key, sub: 'Retainage notice to draft', action: 'draft' })
        break
      case 'awaiting': {
        const a = awaiting()
        push({ ...base, key, sub: `Retainage · ${a.sub.charAt(0).toLowerCase()}${a.sub.slice(1)}`, action: a.action, button: a.button })
        break
      }
      case 'ready':
        push({ ...base, key, sub: 'Retainage notice approved · ready to send', action: 'send', button: office ? BUTTON.send : null })
        break
      case 'held':
        push({ ...base, key, sub: 'Retainage held', action: 'review_hold' })
        break
      case 'clock_not_started':
      case 'sent':
      case 'missed':
        break
    }
  }

  return rows.sort(compareRows)
}

/** The two groups, in order, each with its rows — what the view draws. */
export function groupLienNextUp(rows: ReadonlyArray<LienNextUpRow>): Array<{ group: LienNextUpGroup; label: string; rows: LienNextUpRow[] }> {
  const now = rows.filter((r) => r.group === 'now')
  const coming = rows.filter((r) => r.group === 'coming')
  return [
    ...(now.length ? [{ group: 'now' as const, label: 'Needs you now', rows: now }] : []),
    ...(coming.length ? [{ group: 'coming' as const, label: 'Coming up', rows: coming }] : []),
  ]
}
