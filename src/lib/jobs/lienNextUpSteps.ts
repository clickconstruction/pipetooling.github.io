/**
 * The steps behind the Lien desk's To do rows (v2.4631, the owner's ask): each kind of paper
 * walks a ladder of four, and a row stands on one rung of it. `lienStepOfRow` says which;
 * `countLienSteps` adds the rows up per rung for the rail above the list; `lienStepCard`
 * writes one row's ladder out for the card that opens on its dots — what is done, what is
 * being done now, what is still to come, the deadline and what blocks it. Pure: every word
 * comes from the row and the facts the desk already holds. Nothing here reads or writes.
 */
import { formatYmdMonthDay } from './billedExpectedPay'
import type { LienNextUpKind, LienNextUpRow } from './lienNextUp'
import { lienOfferApprovedWords, type LienPayOffer } from './lienPayOffer'
import { LIEN_REMINDER_SHORT, LIEN_REMINDER_STEPS, lienReminderBrief, lienReminderLadderItems, type LienBriefMove, type LienReminderBrief, type LienReminderState } from './lienReminders'

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
    case 'promise':
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
          { state: 'now', title: 'Send the attorney’s letter', detail: row.sub },
        ],
        foot: 'After step 4 · the attorney’s letter',
      }
    case 'courtesy':
      return {
        items: [
          { state: 'done', title: 'Notice sent', detail: 'The packet went out and nothing has come since.' },
          { state: 'now', title: 'Send a courtesy notice', detail: `${row.sub}. A plain reminder by email and text: the notice stands, the day the lien goes on unless it is paid, the pay link, your number.` },
        ],
        foot: 'After step 4 · courtesy notice',
      }
    case 'promise':
      return {
        items: [
          { state: 'done', title: 'Notice sent', detail: 'The packet went out and a payment came in after it.' },
          { state: 'now', title: 'Record what they promised', detail: `${row.sub}. The date and the amount they gave for the rest; the desk asks again on that date. The lien’s day does not move.` },
        ],
        foot: 'After step 4 · paying it down',
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

const HOLDS: LienBriefMove[] = [
  { press: 'Hold — they promised…', means: 'they gave a date; the desk waits for it and asks again' },
  { press: 'Hold — I’ll call first', means: 'you want to phone before anything goes out' },
]
const PAID = 'the bill is paid first'

/**
 * The step brief for any rail (v2.6577; rewritten v2.6594 for a first-week employee, punch list #274):
 * in plain words, why a row is here, the usual press and what it does, the other presses the paper's
 * own pane offers with what each means, what ends the step on its own, and what happens if nobody acts.
 * The words agree with the row's card (`ladderItems`) and the row's button (`BUTTON`). `state` (PR 3 of
 * #274) is the picked notice's rung state on the REMINDERS rail, so a paying notice reads its own brief.
 */
export function lienStepBrief(on: LienStepAt, state?: LienReminderState | null): LienReminderBrief {
  if (on.ladder === 'reminder') return lienReminderBrief(on.step, state)
  const ladder = LIEN_STEP_LADDERS.find((l) => l.key === on.ladder)!
  const title = ladder.steps[on.step - 1] ?? ''
  if (on.ladder === 'affidavit') {
    switch (on.step) {
      case 1:
        return { title, who: 'office', plain: 'An affidavit is the lien itself, filed at the county. It must say exactly which property and who owns it. This property record is missing part of that, so the affidavit cannot be written yet.', why: 'The property record is missing the owner, the legal description or the county.', usual: { press: 'Fix the property', means: 'opens the property record with the missing lines marked; fill them and the affidavit moves to Draft by itself' }, instead: [{ press: 'Fill in the record ›', means: 'the same record, opened in full' }, { press: 'Send the notice first ›', means: 'when no lien notice ever went for this month; the affidavit needs one before it' }], closes: `${PAID}, or the filing window closes`, ifNobody: 'On the lien’s day the window closes and the lien is gone for good. The money becomes a collections matter.' }
      case 2:
        return { title, who: 'office', plain: 'The property record is complete and the lien’s last day is coming. The desk can write the affidavit from the notice we already mailed.', why: 'The property record is complete and the affidavit’s day is coming.', usual: { press: 'Draft affidavit', means: 'writes it from the notice; the leader must sign it in front of a notary, so send it to him early' }, instead: [{ press: 'The leader said to file it ▸', means: 'he already told you to; it goes straight to Ready' }, ...HOLDS], closes: PAID, ifNobody: 'The affidavit is not written. On the lien’s day the window closes and the lien is gone for good.' }
      case 3:
        return { title, who: 'leader', plain: 'The affidavit is written. The leader signs it in front of a notary and says it may be filed.', why: 'The affidavit is drafted and waits on the leader.', usual: { press: 'Approve — file it ▸', means: 'marks it signed and ready for the county' }, instead: [{ press: 'Hold', means: 'keeps it with a reason; the desk asks again' }, { press: 'Pull back to draft', means: 'the office changes something first' }, { press: 'Back to the office', means: 'hands it back without a change' }], closes: PAID, ifNobody: 'Nothing is filed. On the lien’s day the window closes and the lien is gone for good.' }
      default:
        return { title, who: 'office', plain: 'Take or send the signed affidavit to the county clerk before its last day. Then mail a copy to the owner within five days, which the law requires.', why: 'The affidavit is approved and its day is coming, or it is filed and waits on service.', usual: { press: 'File the affidavit', means: 'records the filing with the county’s stamp' }, instead: [{ press: 'Record service ›', means: 'records the copy you mailed to the owner' }, { press: 'Open the affidavit tab ›', means: 'the paper and its record on the job' }], closes: PAID, ifNobody: 'Unfiled on the lien’s day, the lien is gone for good. Filed but not served within five days, it can be challenged.' }
    }
  }
  const retainage = on.ladder === 'retainage'
  const paper = retainage ? 'retainage notice' : 'notice'
  switch (on.step) {
    case 1:
      return { title, who: 'office', plain: retainage ? 'Retainage is the part of our money a GC holds back until the end. A separate notice protects it, and it must reach the owner. We do not know the owner yet.' : 'A lien notice has to reach the person who owns the land, not only the GC we worked for. We do not know who that is yet for these jobs.', why: 'Nobody is named as the owner of record on the property yet.', usual: { press: 'Find the owner', means: 'opens the property record with the owner line empty; type the name from the county’s record or the GC’s contract' }, instead: retainage ? [{ press: 'Property record ›', means: 'the record in full' }, { press: 'Set the day our contract ended ›', means: 'starts the 30-day clock the retainage notice runs on' }] : [{ press: 'Property record ›', means: 'the record in full' }, ...HOLDS], closes: `the owner is named on the property record, or ${PAID}`, ifNobody: `The ${paper} cannot be written, and its day keeps coming. After it the lien right for that month is lost.` }
    case 2:
      return { title, who: 'office', plain: retainage ? 'Our work on the job is finished and the held-back money is unpaid. The notice must go within 30 days of the finish.' : 'The owner is known and a month of our work is unpaid. The desk can write the notice from the job. Each month gets its own notice.', why: retainage ? 'Our contract on the job ended and the retainage is unpaid.' : 'The owner is named and a work month is unpaid with its window still open.', usual: { press: 'Draft notice', means: 'fills the state’s form from the job; read it once, then send it to the leader' }, instead: retainage ? [{ press: 'The leader said to send it ▸', means: 'he already told you to; it goes straight to Ready' }, ...HOLDS, { press: 'The monthly notices on this job ›', means: 'the month notices this one sits beside' }] : [{ press: 'The leader said to send it ▸', means: 'he already told you to; it goes straight to Ready' }, ...HOLDS], closes: retainage ? PAID : `${PAID}, or the month’s window closes and the notice is noted missed`, ifNobody: retainage ? 'After 30 days from the finish the retainage notice is late, and the lien right on the retainage weakens.' : 'Nothing is mailed. After the notice’s day the lien right for that month is lost.' }
    case 3:
      return { title, who: 'leader', plain: retainage ? 'Written and waiting for the leader, who signs it as he signs any notice.' : 'A lien notice is the letter the law makes us send to the owner before we can ever lien their property. The office has written it. Only the leader may approve one, because it is sent in his name.', why: `The ${paper} is drafted and waits on the leader’s approval.`, usual: { press: 'Sign and approve ▸', means: 'signs it with the leader’s code and puts it in the next certified run; one press per notice' }, instead: retainage ? [{ press: 'Hold', means: 'keeps it with a reason; the desk asks again' }, { press: 'Pull back to draft', means: 'the office changes something first' }, { press: 'Back to the office', means: 'hands it back without a change' }] : [{ press: 'Not yet', means: 'holds it with a reason, they promised or I’ll call first; the desk asks again' }, { press: 'Pull back to draft', means: 'the office changes something first' }, { press: 'Ask counsel to sign off…', means: 'the attorney reads it before it goes' }, { press: 'Send notices without asking', means: 'the GC’s standing rule; every future month approves itself' }], closes: PAID, ifNobody: 'Nothing is mailed. A late notice still goes, but every day past its day weakens the claim, and after the month’s window the lien right is lost.' }
    default:
      return { title, who: 'office', plain: retainage ? 'It mails with the other notices, by certified mail.' : 'Approved notices wait to be printed and mailed together, by certified mail so we can prove they arrived.', why: `The ${paper} is approved and waits for the run, or is printed and waits on its tracking number.`, usual: { press: 'Send the run', means: 'prints every approved notice and its envelope; Record the mailing then takes each tracking number' }, instead: [{ press: 'Record the mailing', means: 'once the envelopes are at the post office, type in each tracking number' }, { press: 'Back to the office', means: 'takes a notice out of the run' }], closes: PAID, ifNobody: 'The notices sit printed and unmailed; each day past a notice’s day weakens its claim.' }
  }
}
