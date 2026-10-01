import type { LienWaiverCell, LienWaiverHalf } from './lienWaiverCell'
import type { LienWaiverBillPick } from '../jobsDocuments/lienWaiverRelease'

/**
 * The lien waiver row of View bill's paperwork card (v2.4299): the bill's waiver pair
 * (`lienWaiverCellForBill`) said as one headline, one line under it, a two-step track and
 * the one move owed. Pure; `BillPaperworkCard` draws it. Words follow `plainWords.ts`.
 */

export type WaiverRowTone = 'amber' | 'green' | 'plain'
export type WaiverStepState = 'due' | 'done' | 'open'
export type WaiverRowAction = 'add' | 'sign' | 'send' | 'add_unconditional' | 'open_draft' | 'view'

export type BillPaperworkWaiverRow = {
  tone: WaiverRowTone
  headline: string
  sub: string | null
  /** The line under the headline reads as a warning (amber) or as a plain note. */
  subTone: 'amber' | 'muted'
  action: { kind: WaiverRowAction; label: string; primary: boolean }
  steps: [{ text: string; state: WaiverStepState }, { text: string; state: WaiverStepState }]
  /** The waiver's recipient has no email, but the bill went to one: offer it. */
  emailFix: { email: string } | null
}

export type BillPaperworkWaiverInput = {
  cell: LienWaiverCell
  pick: LienWaiverBillPick
  /** The bill's amount, for the headline. */
  amount: number
  /** The job has a GC: the waiver goes to the GC, and a GC often waits for it before paying. */
  isGc: boolean
  /** Who the waiver goes to: the GC, else the customer. */
  recipientName: string
  /** Their email on file for the waiver, or null. */
  recipientEmail: string | null
  /** The email the bill itself went to (Stripe's copy), or null. */
  billEmail: string | null
  /** Days past the bill's due date while it is unpaid; null or ≤ 0 when not past due. */
  daysPastDue: number | null
  /** YYYY-MM-DD the bill was paid in full, when known. */
  paidYmd: string | null
}

export function waiverMoneyWords(n: number): string {
  const whole = Math.abs(n - Math.round(n)) < 0.005
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2 })}`
}

function shortDate(ymd: string | null): string {
  if (!ymd) return ''
  const d = new Date(`${ymd}T12:00:00Z`)
  return Number.isNaN(d.getTime()) ? ymd : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

/**
 * The leader's first name: who actually signed (`signer_printed_name`), else the leader the
 * field snapshot names. The snapshot alone is not enough — rows from before v2.4285 carry the
 * signed-in user there (job 650 reads "Robert" though Malachi drew the signature).
 */
function signerOf(half: LienWaiverHalf): string | null {
  const printed = (half.release?.signer_printed_name ?? '').trim()
  const fields = half.release?.fields
  const snap = fields && typeof fields === 'object' && !Array.isArray(fields) ? (fields as Record<string, unknown>).signerName : null
  const name = printed || (typeof snap === 'string' ? snap.trim() : '')
  return name ? (name.split(/\s+/)[0] ?? null) : null
}

function stepFor(half: 'conditional' | 'unconditional', h: LienWaiverHalf, settled: boolean, clearing = false): { text: string; state: WaiverStepState } {
  const label = half === 'conditional' ? 'Conditional' : 'Unconditional'
  switch (h.state) {
    case 'sent':
      return { text: `${label} sent`, state: 'done' }
    case 'signed':
      return { text: `${label}, signed`, state: 'due' }
    case 'awaiting':
      return { text: `${label}, signing`, state: 'due' }
    case 'draft':
      return { text: `${label}, draft`, state: 'due' }
    case 'none':
      if (half === 'unconditional') return clearing ? { text: 'Unconditional, once it clears', state: 'open' } : settled ? { text: 'Unconditional, now', state: 'due' } : { text: 'Unconditional, when paid', state: 'open' }
      return settled ? { text: 'No conditional', state: 'open' } : { text: 'Conditional, with this bill', state: 'due' }
  }
}

export function billPaperworkWaiverRow(input: BillPaperworkWaiverInput): BillPaperworkWaiverRow {
  const { cell, pick, amount, isGc, recipientName, recipientEmail, billEmail, daysPastDue, paidYmd } = input
  const settled = cell.settled
  const clearing = settled && cell.clearsYmd != null
  const steps: BillPaperworkWaiverRow['steps'] = [stepFor('conditional', cell.conditional, settled), stepFor('unconditional', cell.unconditional, settled, clearing)]
  const money = waiverMoneyWords(amount)
  const who = recipientName.trim() || (isGc ? 'the GC' : 'the customer')
  const finalWord = pick.final ? ' final' : ''
  const pastDue = daysPastDue != null && daysPastDue > 0 && !settled ? daysPastDue : null

  const bothSent = cell.conditional.state === 'sent' && cell.unconditional.state === 'sent'
  const emailFix = isGc && !recipientEmail?.trim() && billEmail?.trim() && !bothSent ? { email: billEmail.trim() } : null

  const row = (r: Omit<BillPaperworkWaiverRow, 'steps' | 'emailFix'>): BillPaperworkWaiverRow => ({ ...r, steps, emailFix })

  if (cell.next === 'sign') {
    const half = cell.unconditional.state === 'awaiting' ? cell.unconditional : cell.conditional
    const signer = signerOf(half)
    return row({
      tone: 'amber',
      headline: `Waiting for ${signer ?? 'the leader'} to sign`,
      sub: `Asked ${shortDate(half.ymd)}. It waits on the Dashboard under Waivers to sign.`,
      subTone: 'muted',
      action: { kind: 'sign', label: 'Sign it', primary: true },
    })
  }
  if (cell.next === 'send') {
    const half = cell.unconditional.state === 'signed' ? cell.unconditional : cell.conditional
    const signer = signerOf(half)
    const email = recipientEmail?.trim()
    return row({
      tone: 'amber',
      headline: signer ? `Signed by ${signer}. Not sent yet.` : 'Signed. Not sent yet.',
      sub: email ? `It goes to ${email}.` : null,
      subTone: 'muted',
      action: { kind: 'send', label: `Send to ${who}`, primary: true },
    })
  }
  if (cell.next === 'add_unconditional') {
    return row({
      tone: 'amber',
      headline: paidYmd ? `Paid ${shortDate(paidYmd)}. Unconditional owed.` : 'Paid. Unconditional owed.',
      sub: `The money is in. ${isGc ? 'The GC' : 'The customer'} is owed the unconditional waiver now.`,
      subTone: 'amber',
      action: { kind: 'add_unconditional', label: 'Add the unconditional', primary: true },
    })
  }
  // v2.4330: paid by a check still clearing — the unconditional waits, and says until when.
  if (clearing && cell.unconditional.state === 'none' && cell.next == null) {
    return row({
      tone: 'plain',
      headline: paidYmd ? `Paid ${shortDate(paidYmd)} by check. The unconditional waits for it to clear.` : 'Paid by check. The unconditional waits for it to clear.',
      sub: `It clears about ${shortDate(cell.clearsYmd)}. An unconditional waiver holds even if the check comes back.`,
      subTone: 'muted',
      action: { kind: 'add_unconditional', label: 'Add the unconditional', primary: false },
    })
  }
  if (cell.next === 'add_conditional') {
    const lines = [pastDue ? `This bill is ${pastDue} ${pastDue === 1 ? 'day' : 'days'} past due.` : null, isGc ? 'A GC often waits for this waiver before it pays.' : null].filter(Boolean)
    return row({
      tone: 'amber',
      headline: `Conditional${finalWord} for ${money} not sent`,
      sub: lines.length ? lines.join(' ') : null,
      subTone: 'amber',
      action: { kind: 'add', label: 'Add waiver', primary: true },
    })
  }
  // Nothing owed by the cell's reading: a draft in progress, or work done.
  const draft = cell.unconditional.state === 'draft' ? 'Unconditional' : cell.conditional.state === 'draft' ? 'Conditional' : null
  if (draft) {
    return row({
      tone: 'amber',
      headline: `${draft} draft started`,
      sub: 'Open it to finish it and ask for the signature.',
      subTone: 'muted',
      action: { kind: 'open_draft', label: 'Open draft', primary: true },
    })
  }
  if (bothSent) {
    return row({
      tone: 'green',
      headline: 'Both waivers sent',
      sub: `Conditional ${shortDate(cell.conditional.ymd)}. Unconditional ${shortDate(cell.unconditional.ymd)}.`,
      subTone: 'muted',
      action: { kind: 'view', label: 'View', primary: false },
    })
  }
  if (cell.unconditional.state === 'sent') {
    return row({
      tone: 'green',
      headline: `Unconditional for ${money} sent ${shortDate(cell.unconditional.ymd)}`,
      sub: null,
      subTone: 'muted',
      action: { kind: 'view', label: 'View', primary: false },
    })
  }
  if (cell.conditional.state === 'sent') {
    return row({
      tone: 'plain',
      headline: `Conditional for ${money} sent ${shortDate(cell.conditional.ymd)}`,
      sub: 'Nothing to do until the bill is paid.',
      subTone: 'muted',
      action: { kind: 'view', label: 'View', primary: false },
    })
  }
  return row({ tone: 'plain', headline: 'No waiver for this bill', sub: null, subTone: 'muted', action: { kind: 'view', label: 'Waivers', primary: false } })
}
