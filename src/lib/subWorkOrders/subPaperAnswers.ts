/**
 * What a sub said back from their page, as the office reads it (punch list #371, step 3): the rows of
 * `sub_paper_acks` turned into the chip on a payment's line and the flag on a sheet.
 *
 *  - **Received** is a quiet chip, not a to-do: a sub who never taps Got it has done nothing wrong, so a payment
 *    that is not marked says nothing at all.
 *  - **Something is wrong** is the one answer that asks the office to act. It flags the sheet until someone marks it
 *    answered (`answer_sub_paper_ack`), and stays on the sheet afterwards as a line that says who answered and when.
 *
 * A note about a payment shows on every sheet that payment paid on, since the Pay view is read by sheet.
 *
 * The office's payment record reads the same marks (`paymentRecordReceived`), so its *Received* box says what the
 * Pay view's chip says.
 * Pure: no React, no Supabase.
 */
import { paperDay } from '../../../supabase/functions/_shared/subPapers'

/** One row of `sub_paper_acks`, as the Pay view reads it. The answered columns are absent before their migration. */
export type SubPaperAckRow = {
  id: string
  kind: string
  person_id: string | null
  labor_job_id: string | null
  sending_id: string | null
  payment_id: string | null
  note: string | null
  said_by_name: string | null
  created_at: string
  answered_at?: string | null
  answered_by_name?: string | null
  /** A confirm's own: the revision the sub saw, what the statement came to, and the address the press came from. */
  revision?: number | string | null
  amount?: number | string | null
  said_from?: string | null
}

export const SUB_PAPER_ACK_COLUMNS = 'id, kind, person_id, labor_job_id, sending_id, payment_id, note, said_by_name, created_at, answered_at, answered_by_name'
/** What the papers window reads: the marks, and the three columns a confirm is read by. All are the table's first columns. */
export const SUB_PAPER_ACK_COLUMNS_FOR_PAPERS = 'id, kind, person_id, labor_job_id, sending_id, payment_id, note, said_by_name, created_at, revision, amount, said_from'
/** The columns before `20261117190000_sub_paper_ack_answered`: a database it has not reached still shows the chips and the notes. */
export const SUB_PAPER_ACK_COLUMNS_BEFORE_ANSWERED = 'id, kind, person_id, labor_job_id, sending_id, payment_id, note, said_by_name, created_at'

export type SubPaperNote = {
  id: string
  who: string
  /** The day the sub sent it, `YYYY-MM-DD` in the app's zone. */
  day: string
  note: string
  about: 'statement' | 'payment'
  laborJobId: string | null
  sendingId: string | null
  paymentId: string | null
  /** The day the office marked it answered, and who. '' while it waits. */
  answeredOn: string
  answeredBy: string
}

export type SubPaperAnswers = {
  /** The day a sending was marked received, by sending id. */
  receivedBySending: ReadonlyMap<string, string>
  /** The day a payment from before sendings was marked received, by payment id. */
  receivedByPayment: ReadonlyMap<string, string>
  /** Every note, oldest first. */
  notes: readonly SubPaperNote[]
}

export const NO_SUB_PAPER_ANSWERS: SubPaperAnswers = { receivedBySending: new Map(), receivedByPayment: new Map(), notes: [] }

/** `dayOf` turns an instant into the app's calendar day. The first *received* on a payment stands. */
export function subPaperAnswers(rows: readonly SubPaperAckRow[], dayOf: (iso: string) => string): SubPaperAnswers {
  const receivedBySending = new Map<string, string>()
  const receivedByPayment = new Map<string, string>()
  const notes: SubPaperNote[] = []
  const sorted = rows.slice().sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? '') || a.id.localeCompare(b.id))
  for (const r of sorted) {
    const day = r.created_at ? dayOf(r.created_at).slice(0, 10) : ''
    if (r.kind === 'received') {
      if (r.sending_id && !receivedBySending.has(r.sending_id)) receivedBySending.set(r.sending_id, day)
      else if (!r.sending_id && r.payment_id && !receivedByPayment.has(r.payment_id)) receivedByPayment.set(r.payment_id, day)
    } else if (r.kind === 'something_wrong') {
      notes.push({
        id: r.id,
        who: (r.said_by_name ?? '').trim() || 'The sub',
        day,
        note: (r.note ?? '').trim(),
        about: r.labor_job_id ? 'statement' : 'payment',
        laborJobId: r.labor_job_id,
        sendingId: r.sending_id,
        paymentId: r.payment_id,
        answeredOn: r.answered_at ? dayOf(r.answered_at).slice(0, 10) : '',
        answeredBy: (r.answered_by_name ?? '').trim(),
      })
    }
  }
  return { receivedBySending, receivedByPayment, notes }
}

/** The day the sub marked this payment received, `YYYY-MM-DD`. '' when they have not. A back-charge is never received. */
export function paymentReceivedDay(answers: SubPaperAnswers, p: { id: string; amount: number; sending_id?: string | null }): string {
  if (!(Number(p.amount) > 0)) return ''
  return (p.sending_id ? answers.receivedBySending.get(p.sending_id) : answers.receivedByPayment.get(p.id)) ?? ''
}

/**
 * What a payment record's *Received* box is built from (`buildPaymentRecord`'s last argument), by the paper's own
 * key: a sending's id, or `row:<payment id>` for a payment from before sendings. Null while the sub has not
 * pressed Got it, and the paper then reads *Not marked yet*. The day reads as the sub's own page words it.
 */
export function paymentRecordReceived(answers: SubPaperAnswers, key: string): { at: string } | null {
  const lone = key.startsWith('row:')
  const marks = lone ? answers.receivedByPayment : answers.receivedBySending
  const id = lone ? key.slice(4) : key
  if (!id || !marks.has(id)) return null
  return { at: paperDay(marks.get(id)) || 'a day not recorded' }
}

/** The notes that touch a sheet: about the sheet itself, or about a payment that paid on it. Waiting ones first, then newest. */
export function notesForSheet(answers: SubPaperAnswers, sheet: { id: string; payments?: ReadonlyArray<{ id: string; sending_id?: string | null }> | null }): SubPaperNote[] {
  const payments = sheet.payments ?? []
  const sendings = new Set(payments.map((p) => p.sending_id ?? '').filter(Boolean))
  const rows = new Set(payments.map((p) => p.id))
  return answers.notes
    .filter((n) => n.laborJobId === sheet.id || (n.sendingId != null && sendings.has(n.sendingId)) || (n.paymentId != null && rows.has(n.paymentId)))
    .slice()
    .sort((a, b) => Number(!!a.answeredOn) - Number(!!b.answeredOn) || b.day.localeCompare(a.day) || b.id.localeCompare(a.id))
}

/** How many of a sheet's notes still wait on the office. */
export function waitingNotes(notes: readonly SubPaperNote[]): number {
  return notes.filter((n) => !n.answeredOn).length
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
/** `Nov 2`, with the year only when it is not this one. '' for a day that is not one. */
export function answerDayWords(ymd: string, today: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd)
  if (!m) return ''
  const words = `${MONTHS[Number(m[2]) - 1] ?? ''} ${Number(m[3])}`
  return m[1] === today.slice(0, 4) ? words : `${words}, ${m[1]}`
}

/** `Received Nov 2 · from their page`. */
export function receivedChipWords(day: string, today: string): string {
  const on = answerDayWords(day, today)
  return on ? `Received ${on} · from their page` : 'Received · from their page'
}

/** `Harlan Mechanical says something is wrong, Nov 13: “The back-charge was never talked about with me.”` */
export function noteFlagWords(n: SubPaperNote, today: string): string {
  const on = answerDayWords(n.day, today)
  const about = n.about === 'payment' ? ' on a payment' : ''
  return `${n.who} says something is wrong${about}${on ? `, ${on}` : ''}: “${n.note}”`
}

/** `Answered Nov 14 by Rosa Office`, under a note the office has put down. */
export function noteAnsweredWords(n: SubPaperNote, today: string): string {
  if (!n.answeredOn) return ''
  const on = answerDayWords(n.answeredOn, today)
  return ['Answered', on, n.answeredBy ? `by ${n.answeredBy}` : ''].filter(Boolean).join(' ')
}
