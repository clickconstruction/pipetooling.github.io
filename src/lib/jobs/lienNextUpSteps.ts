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
import { lienOfferApprovedWords, type LienPayOffer } from './lienPayOffer'
import { LIEN_REMINDER_SHORT, LIEN_REMINDER_STEPS, lienReminderBrief, lienReminderLadderItems, type LienReminderBrief } from './lienReminders'

/** The three kinds of paper, and the REMINDERS ladder a sent notice walks (punch list #262). */
export type LienStepLadder = LienNextUpKind | 'reminder'
export type LienStepN = 1 | 2 | 3 | 4

export const LIEN_STEP_LADDERS: ReadonlyArray<{ key: LienStepLadder; label: string; steps: readonly [string, string, string, string] }> = [
  { key: 'notice', label: 'Notices', steps: ['Find the owner', 'Draft notice', 'Approve', 'Send the run'] },
  { key: 'reminder', label: 'Reminders', steps: LIEN_REMINDER_STEPS },
  { key: 'affidavit', label: 'Affidavits', steps: ['Fix the property', 'Draft affidavit', 'Approve', 'File it'] },
  { key: 'retainage', label: 'Retainage', steps: ['Find the owner', 'Draft notice', 'Approve', 'Send the run'] },
]

export type LienStepAt = { ladder: LienStepLadder; step: LienStepN }

/** The rung a row stands on; null for a row past the ladder or beside it (in the mail, held, missed, to serve). A courtesy or letter-two row stands on the REMINDERS ladder when the desk read its rung (punch list #262). */
export function lienStepOfRow(row: Pick<LienNextUpRow, 'kind' | 'action' | 'reminder'>): LienStepAt | null {
  const ladder = row.kind
  switch (row.action) {
    case 'courtesy':
    case 'letter_two':
      return row.reminder ? { ladder: 'reminder', step: row.reminder.step } : null
    case 'find_owner':
    case 'fix_property':
      return { ladder, step: 1 }
    case 'draft':
      return { ladder, step: 2 }
    case 'approve':
    case 'sign':
      return { ladder, step: 3 }
    case 'send':
    case 'send_run':
    case 'record_mailing':
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
 * its rows. The REMINDERS ladder's four counts come whole from `buildLienReminders` when the
 * desk hands them in (punch list #262) — its rungs count sent notices that have no row here.
 */
export function countLienSteps(rows: ReadonlyArray<Pick<LienNextUpRow, 'kind' | 'action' | 'reminder'>>, ready: Partial<Record<LienStepLadder, number>> = {}, reminders?: readonly [number, number, number, number]): LienStepCounts {
  const counts: LienStepCounts = { notice: [0, 0, 0, 0], reminder: [0, 0, 0, 0], affidavit: [0, 0, 0, 0], retainage: [0, 0, 0, 0] }
  for (const r of rows) {
    const at = lienStepOfRow(r)
    if (at) counts[at.ladder][at.step - 1] = (counts[at.ladder][at.step - 1] ?? 0) + 1
  }
  for (const key of ['notice', 'retainage'] as const) {
    const n = ready[key]
    if (n != null) counts[key][3] = n
  }
  if (reminders) counts.reminder = [...reminders]
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
  /** The pay offer on an approved notice (v2.4713); null or absent = none. */
  offer?: LienPayOffer | null
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
      detail: s(3) === 'done' ? `Approved${f.approvedOn ? ` ${dayWords(f.approvedOn)}` : ''}${f.offer ? ` ${lienOfferApprovedWords(f.offer)}` : ''}.` : s(3) === 'now' ? leaderNow : 'The leader approves it, once per notice or once per GC.',
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
    case 'courtesy':
      return {
        items: [
          { state: 'done', title: 'Notice sent', detail: 'The packet went out and nothing has come since.' },
          { state: 'now', title: 'Send a courtesy notice', detail: `${row.sub}. A plain reminder by email and text: the notice stands, the day the lien goes on unless it is paid, the pay link, your number.` },
        ],
        foot: 'After step 4 · courtesy notice',
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
  const base = { ladder: at?.ladder ?? row.kind, kindWords: KIND_WORDS[row.kind], title: row.title, deadline: lienStepDueWords(row), tone, button: row.button }
  if (!at) {
    const beside = besideItems(row)
    return { ...base, items: beside.items, blocked: null, foot: beside.foot }
  }
  // The REMINDERS ladder's words come from its own kernel (punch list #262): the rung, the courtesy's words, letter two's, the closer's.
  const items = at.ladder === 'reminder' && row.reminder ? lienReminderLadderItems(row.reminder) : ladderItems(at.ladder, at.step, facts)
  // The printed run (punch list #101): step 4 is half done — it printed — and the app cannot tell whether it was mailed.
  if (row.action === 'record_mailing') items[3] = { state: 'now', title: 'Record the mailing', detail: `${row.title.replace(/^\d+ notices printed/, 'Printed')}. Mailed? Type each envelope’s number in the run. Not mailing them? Take the run back.` }
  const done = items.filter((i) => i.state === 'done').length
  const blocked = at.step === 1 && at.ladder !== 'reminder' ? (at.ladder === 'affidavit' ? 'the property record' : 'the owner of record') : null
  return { ...base, items, blocked, foot: `Step ${at.step} of 4 · ${done} done · ${4 - done} to go` }
}

/** The short names of the four steps, for a phone's row of tiles (v2.4881). */
export const LIEN_STEP_SHORT: Record<LienStepLadder, readonly [string, string, string, string]> = {
  notice: ['Owner', 'Drafted', 'Approve', 'Mail'],
  reminder: LIEN_REMINDER_SHORT,
  affidavit: ['Property', 'Drafted', 'Approve', 'File'],
  retainage: ['Owner', 'Drafted', 'Approve', 'Mail'],
}

export type LienStepTile = { n: LienStepN; label: string; state: 'done' | 'now' | 'todo'; who: 'you' | 'office' | 'leader' | null }

/**
 * The four dots as four named tiles (v2.4881): done steps ticked, the one the row stands on lit and
 * naming whose it is — "you" when it is the viewer's, else the other side. Step 3 is the leader's;
 * the rest are the office's. A row past the ladder (in the mail, held, letter two) gets no tiles.
 */
export function lienStepTiles(at: LienStepAt | null, ladder: LienStepLadder, viewerIsLeader: boolean): LienStepTile[] | null {
  if (!at) return null
  const names = LIEN_STEP_SHORT[ladder]
  return ([1, 2, 3, 4] as const).map((n) => {
    const state: LienStepTile['state'] = n < at.step ? 'done' : n === at.step ? 'now' : 'todo'
    const leaders = n === 3
    const who: LienStepTile['who'] = state !== 'now' ? null : leaders === viewerIsLeader ? 'you' : leaders ? 'leader' : 'office'
    return { n, label: names[n - 1]!, state, who }
  })
}

/** The run rung's word after its count (punch list #101): " ready", " printed", or " · 19 printed" when both wait. */
export function lienRunRungWords(n: number, printed: number): string {
  if (printed <= 0) return ' ready'
  if (printed >= n) return ' printed'
  return ` · ${printed} printed`
}

/**
 * The list under a pressed rung (v2.6574): the rows on the rung first under *On this step*, the rest
 * at full strength under *On other steps*, each in the order the list already had. Until v2.6574 a
 * pressed rung faded the rows off it to a third (v2.4631), and the pale rows were read as blocked;
 * the sort says the same thing with nothing greyed, so every row keeps its button and its look.
 */
export function lienStepGroups(rows: ReadonlyArray<LienNextUpRow>, on: LienStepAt): Array<{ group: 'step_on' | 'step_other'; label: string; rows: LienNextUpRow[] }> {
  const isOn = (r: LienNextUpRow) => {
    const at = lienStepOfRow(r)
    return !!at && at.ladder === on.ladder && at.step === on.step
  }
  const here = rows.filter(isOn)
  const other = rows.filter((r) => !isOn(r))
  return [
    { group: 'step_on', label: 'On this step', rows: here },
    ...(other.length ? [{ group: 'step_other' as const, label: 'On other steps', rows: other }] : []),
  ]
}

/** A pressed rung's name, *3 · Letter two*, for the brief's head on any rail. */
export function lienStepName(on: LienStepAt): string {
  const ladder = LIEN_STEP_LADDERS.find((l) => l.key === on.ladder)!
  return `${on.step} · ${ladder.steps[on.step - 1]}`
}

const HOLDS = ['Hold — they promised…', 'Hold — I’ll call first']

/**
 * The step brief for any rail (v2.6577; the REMINDERS rail's came with v2.6574): what the step is,
 * why a row is here, the usual press and whose it is, the other presses the row or the paper's pane
 * already offers (named, never invented: the panes' own buttons), and what moves a paper on with
 * no press. The words agree with the row's card (`ladderItems`) and the row's button (`BUTTON`).
 */
export function lienStepBrief(on: LienStepAt): LienReminderBrief {
  if (on.ladder === 'reminder') return lienReminderBrief(on.step)
  const ladder = LIEN_STEP_LADDERS.find((l) => l.key === on.ladder)!
  const title = ladder.steps[on.step - 1]
  const paid = 'the bill is paid'
  if (on.ladder === 'affidavit') {
    switch (on.step) {
      case 1:
        return { title, who: 'office', what: 'The affidavit names the property by its legal description and its owner. The property record must be complete first.', why: 'The property record is missing the owner, the legal description or the county.', usual: 'Fix the property', instead: ['Fill in the record ›', 'Send the notice first ›, when the month’s notice never went', 'Refer to the Legal desk ›'], closes: `${paid}, or the filing window closes` }
      case 2:
        return { title, who: 'office', what: 'The office drafts the affidavit from the notice already sent: the months, the money, the property.', why: 'The property record is complete and the affidavit’s day is coming.', usual: 'Draft affidavit', instead: ['The leader said to file it ▸', ...HOLDS, 'Refer to the Legal desk ›'], closes: paid }
      case 3:
        return { title, who: 'leader', what: 'The leader signs the affidavit before a notary, then approves it for filing.', why: 'The affidavit is drafted and waits on the leader.', usual: 'Approve — file it ▸', instead: ['Hold', 'Pull back to draft', 'Back to the office'], closes: paid }
      default:
        return { title, who: 'office', what: 'The affidavit is filed with the county clerk by its day, then served on the owner within five days.', why: 'The affidavit is approved and its day is coming, or it is filed and waits on service.', usual: 'File the affidavit', instead: ['Record service ›, once the copies went', 'Open the affidavit tab ›', 'The Legal desk ›'], closes: paid }
    }
  }
  const retainage = on.ladder === 'retainage'
  switch (on.step) {
    case 1:
      return { title, who: 'office', what: retainage ? 'The § 53.057 retainage notice goes to the owner and the GC within 30 days of our contract’s end. The owner must be named first.' : 'The notice goes to the owner of record and the GC. The owner must be named first, from the property record or the GC’s contract.', why: 'Nobody is named as the owner of record on the property yet.', usual: 'Find the owner', instead: retainage ? ['Property record ›', 'Set the day our contract ended ›'] : ['Property record ›', ...HOLDS], closes: `the owner is named on the property record, or ${paid}` }
    case 2:
      return { title, who: 'office', what: retainage ? 'The office drafts the retainage notice once our contract on the job has ended: the retainage held, the owner, the GC.' : 'The office drafts the § 53.056 notice from the job: the unpaid months, the money, the owner and the GC.', why: retainage ? 'Our contract on the job ended and the retainage is unpaid.' : 'The owner is named and a work month is unpaid with its window still open.', usual: 'Draft notice', instead: retainage ? ['The leader said to send it ▸', ...HOLDS, 'The monthly notices on this job ›'] : ['The leader said to send it ▸', ...HOLDS], closes: retainage ? paid : `${paid}, or the month’s window closes and the notice is noted missed` }
    case 3:
      return { title, who: 'leader', what: retainage ? 'The leader approves and signs the retainage notice as he does a monthly notice.' : 'The leader approves a notice once per notice or once per GC, and signs it with his code or by pen.', why: `The ${retainage ? 'retainage notice' : 'notice'} is drafted and waits on the leader’s approval.`, usual: 'Sign and approve ▸', instead: retainage ? ['Hold', 'Pull back to draft', 'Back to the office'] : ['Not yet, with the hold’s reason', 'Pull back to draft', 'Ask counsel to sign off…', 'Send notices without asking, the GC’s standing rule'], closes: paid }
    default:
      return { title, who: 'office', what: retainage ? 'The retainage notice goes out in the same packet as the monthly notices, by certified mail.' : 'Every approved notice goes out in one packet by certified mail, one tracking number per envelope, and the run records the mailing.', why: `The ${retainage ? 'retainage notice' : 'notice'} is approved and waits for the run, or is printed and waits on its tracking number.`, usual: 'Send the run', instead: ['Record the mailing, once the envelopes are in the mail', 'Back to the office'], closes: paid }
  }
}
