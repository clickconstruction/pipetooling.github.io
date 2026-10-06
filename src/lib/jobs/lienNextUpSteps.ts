/**
 * The steps behind the Lien desk's Do now rows (v2.4631, the owner's ask): each kind of paper
 * walks a ladder of four, and a row stands on one rung of it. `lienStepOfRow` says which;
 * `countLienSteps` adds the rows up per rung for the rail above the list; `lienStepCard`
 * writes one row's ladder out for the card that opens on its dots — what is done, what is
 * being done now, what is still to come, the deadline and what blocks it. Pure: every word
 * comes from the row and the facts the desk already holds. Nothing here reads or writes.
 */
import { formatYmdMonthDay } from './billedExpectedPay'
import type { LienNextUpKind, LienNextUpRow } from './lienNextUp'

export type LienStepLadder = LienNextUpKind
export type LienStepN = 1 | 2 | 3 | 4

export const LIEN_STEP_LADDERS: ReadonlyArray<{ key: LienStepLadder; label: string; steps: readonly [string, string, string, string] }> = [
  { key: 'notice', label: 'Notices', steps: ['Find the owner', 'Draft notice', 'Approve', 'Send the run'] },
  { key: 'affidavit', label: 'Affidavits', steps: ['Fix the property', 'Draft affidavit', 'Approve', 'File it'] },
  { key: 'retainage', label: 'Retainage', steps: ['Find the owner', 'Draft notice', 'Approve', 'Send the run'] },
]

export type LienStepAt = { ladder: LienStepLadder; step: LienStepN }

/** The rung a row stands on; null for a row past the ladder or beside it (in the mail, letter two, held, missed, to serve). */
export function lienStepOfRow(row: Pick<LienNextUpRow, 'kind' | 'action'>): LienStepAt | null {
  const ladder = row.kind
  switch (row.action) {
    case 'find_owner':
    case 'fix_property':
      return { ladder, step: 1 }
    case 'draft':
      return { ladder, step: 2 }
    case 'approve':
      return { ladder, step: 3 }
    case 'send':
    case 'send_run':
    case 'file_affidavit':
      return { ladder, step: 4 }
    default:
      return null
  }
}

export type LienStepCounts = Record<LienStepLadder, [number, number, number, number]>

/**
 * Rows per rung. The notice and retainage ladders' fourth rung is how many notices are
 * approved and waiting for the run, which the desk counts itself (a GC with several ready
 * is one row that names them all), so it is handed in; a ladder with no such count takes
 * its rows.
 */
export function countLienSteps(rows: ReadonlyArray<Pick<LienNextUpRow, 'kind' | 'action'>>, ready: Partial<Record<LienStepLadder, number>> = {}): LienStepCounts {
  const counts: LienStepCounts = { notice: [0, 0, 0, 0], affidavit: [0, 0, 0, 0], retainage: [0, 0, 0, 0] }
  for (const r of rows) {
    const at = lienStepOfRow(r)
    if (at) counts[at.ladder][at.step - 1] = (counts[at.ladder][at.step - 1] ?? 0) + 1
  }
  for (const key of ['notice', 'retainage'] as const) {
    const n = ready[key]
    if (n != null) counts[key][3] = n
  }
  return counts
}

/** Notices always; the other ladders only when something stands on them. */
export function lienLaddersShown(counts: LienStepCounts): LienStepLadder[] {
  return LIEN_STEP_LADDERS.filter((l) => l.key === 'notice' || counts[l.key].some((n) => n > 0)).map((l) => l.key)
}

/** What the desk already knows about the row's job, for the card. Every field is optional: the card says less, never wrong. */
export type LienStepFacts = {
  ownerName?: string | null
  /** "June and July 2026" — the months the notice names. */
  months?: string | null
  draftedOn?: string | null
  approvedOn?: string | null
  coverNote?: boolean
  /** The affidavit's gates not yet passed, by their labels. */
  gatesMissing?: ReadonlyArray<string>
  /** Notices approved and waiting for the run. */
  readyToSend?: number
  viewerIsLeader?: boolean
}

export type LienStepCardItem = { state: 'done' | 'now' | 'todo'; title: string; detail: string }

export type LienStepCard = {
  ladder: LienStepLadder
  kindWords: string
  title: string
  deadline: string
  tone: 'red' | 'amber' | 'quiet'
  items: LienStepCardItem[]
  /** What stands in the way of the current rung, or null. */
  blocked: string | null
  /** "Step 2 of 4 · 1 done · 3 to go", or the state word for a row beside the ladder. */
  foot: string
  button: string | null
}

const KIND_WORDS: Record<LienNextUpKind, string> = { notice: 'Notice', affidavit: 'Affidavit', retainage: 'Retainage notice' }

/** "In the mail by Oct 15 · 10 days left", "File by Oct 1 · 4 days late"; the paper preview's banner reads it too (v2.4632). */
export function lienStepDueWords(row: Pick<LienNextUpRow, 'kind' | 'dueOn' | 'daysLeft'>): string {
  if (!row.dueOn || row.daysLeft == null) return 'No day of its own'
  const verb = row.kind === 'affidavit' ? 'File by' : 'In the mail by'
  const day = formatYmdMonthDay(row.dueOn)
  if (row.daysLeft < 0) return `${verb} ${day} · ${-row.daysLeft} ${row.daysLeft === -1 ? 'day' : 'days'} late`
  if (row.daysLeft === 0) return `${verb} ${day} · today`
  return `${verb} ${day} · ${row.daysLeft} ${row.daysLeft === 1 ? 'day' : 'days'} left`
}

function dayWords(ymd: string | null | undefined): string {
  return ymd ? formatYmdMonthDay(ymd.slice(0, 10)) : ''
}

function state(step: LienStepN, at: LienStepN): LienStepCardItem['state'] {
  return step < at ? 'done' : step === at ? 'now' : 'todo'
}

function ladderItems(ladder: LienStepLadder, at: LienStepN, f: LienStepFacts): LienStepCardItem[] {
  const leaderNow = f.viewerIsLeader ? 'Waiting on you. One press, or hold it.' : 'Waiting on the leader.'
  const ready = f.readyToSend && f.readyToSend > 0 ? ` with the ${f.readyToSend} that are ready` : ''
  if (ladder === 'affidavit') {
    const s = (n: LienStepN) => state(n, at)
    return [
      {
        state: s(1),
        title: s(1) === 'done' ? 'Property record complete' : 'Fix the property',
        detail: s(1) === 'done' ? 'The record names the owner and the legal description.' : f.gatesMissing && f.gatesMissing.length ? `Missing: ${f.gatesMissing.join(', ')}. The affidavit cannot be drafted without them.` : 'The property record is not complete. The affidavit cannot be drafted until it is.',
      },
      { state: s(2), title: s(2) === 'done' ? 'Drafted' : 'Draft affidavit', detail: s(2) === 'done' ? `Drafted${f.draftedOn ? ` ${dayWords(f.draftedOn)}` : ''}.` : 'The office drafts it from the notice already sent.' },
      { state: s(3), title: s(3) === 'done' ? 'Approved' : 'Approve', detail: s(3) === 'done' ? `Approved${f.approvedOn ? ` ${dayWords(f.approvedOn)}` : ''}.` : s(3) === 'now' ? leaderNow : 'The leader signs it before a notary.' },
      { state: s(4), title: 'File it', detail: 'Filed with the county clerk, then served on the owner within five days.' },
    ]
  }
  const s = (n: LienStepN) => state(n, at)
  const paper = ladder === 'retainage' ? 'retainage notice' : 'notice'
  return [
    {
      state: s(1),
      title: s(1) === 'done' ? 'Owner found' : 'Find the owner',
      detail: s(1) === 'done' ? `${f.ownerName ? `${f.ownerName}, from` : 'From'} the property record.` : "Nobody is named as the owner of record yet. The property record or the GC's contract names them.",
    },
    {
      state: s(2),
      title: s(2) === 'done' ? 'Drafted' : `Draft ${paper}`,
      detail: s(2) === 'done' ? `Drafted${f.draftedOn ? ` ${dayWords(f.draftedOn)}` : ''}${f.coverNote ? ', with a cover note' : ''}.` : s(2) === 'now' ? `The office drafts it.${f.months ? ` It names ${f.months}.` : ''}` : 'The office drafts it once the owner is named.',
    },
    {
      state: s(3),
      title: s(3) === 'done' ? 'Approved' : 'Approve',
      detail: s(3) === 'done' ? `Approved${f.approvedOn ? ` ${dayWords(f.approvedOn)}` : ''}.` : s(3) === 'now' ? leaderNow : 'The leader approves it, once per notice or once per GC.',
    },
    { state: s(4), title: 'Send the run', detail: `Goes out in the next packet${ready}. Certified mail, one tracking number per envelope.` },
  ]
}

/** A row beside the ladder: its state, written as two rungs so the card keeps its shape. */
function besideItems(row: Pick<LienNextUpRow, 'action' | 'sub'>): { items: LienStepCardItem[]; foot: string } {
  switch (row.action) {
    case 'note_missed':
      return {
        items: [
          { state: 'done', title: 'The window closed', detail: 'A notice for a month was never sent. The claim for that month is lost unless a later month covers it.' },
          { state: 'now', title: 'Note it', detail: 'Record it as missed, so the desk stops asking and the record says why.' },
        ],
        foot: 'Missed',
      }
    case 'add_tracking':
      return {
        items: [
          { state: 'done', title: 'Sent the run', detail: 'The packet printed and went to the post office.' },
          { state: 'now', title: 'Add tracking', detail: 'Type the tracking number from the receipt. The record is not complete without it.' },
        ],
        foot: 'After step 4 · tracking owed',
      }
    case 'letter_two':
      return {
        items: [
          { state: 'done', title: 'Notice sent', detail: 'The first letter went out and nothing has happened since.' },
          { state: 'now', title: 'Send letter two', detail: row.sub },
        ],
        foot: 'After step 4 · letter two',
      }
    case 'record_service':
      return {
        items: [
          { state: 'done', title: 'Filed', detail: 'The affidavit is on record with the county clerk.' },
          { state: 'now', title: 'Record service', detail: 'The owner must be served within five days of filing. Record when and how.' },
        ],
        foot: 'After step 4 · service owed',
      }
    default:
      return {
        items: [
          { state: 'now', title: 'Held', detail: row.sub || 'Someone asked the desk to wait. Review the hold to let it go on.' },
        ],
        foot: 'Held',
      }
  }
}

export function lienStepCard(row: LienNextUpRow, facts: LienStepFacts = {}): LienStepCard {
  const at = lienStepOfRow(row)
  const tone: LienStepCard['tone'] = row.daysLeft != null && row.daysLeft < 0 ? 'red' : row.severity === 'red' ? 'red' : row.severity === 'amber' ? 'amber' : 'quiet'
  const base = { ladder: row.kind, kindWords: KIND_WORDS[row.kind], title: row.title, deadline: lienStepDueWords(row), tone, button: row.button }
  if (!at) {
    const beside = besideItems(row)
    return { ...base, items: beside.items, blocked: null, foot: beside.foot }
  }
  const items = ladderItems(at.ladder, at.step, facts)
  const done = items.filter((i) => i.state === 'done').length
  const blocked = at.step === 1 ? (at.ladder === 'affidavit' ? 'the property record' : 'the owner of record') : null
  return { ...base, items, blocked, foot: `Step ${at.step} of 4 · ${done} done · ${4 - done} to go` }
}
