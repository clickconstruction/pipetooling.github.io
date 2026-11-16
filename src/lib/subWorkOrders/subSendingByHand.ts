/**
 * Placing one sending by hand (punch list #347's residue, asked for by card #350's call 2): the office says how much
 * of a payment went to each of the sub's open sheets. Oldest first fills the boxes as a start, and every box can be
 * changed. Nothing is applied silently: a sub reads the payment record and must find their own arithmetic on it.
 *
 * The plan it returns is the same `SendingPlan` the window already records (`record_sub_sending` takes a line per
 * sheet), so this needs no migration. The press is dead until the parts sum to the amount, and it names its act.
 *
 * Pure: no React, no Supabase.
 */
import { parseSubPaymentAmount, SUB_PAYMENT_TOLERANCE } from './subPaymentWindow'
import { planSubSending, type SendingContext, type SendingLine, type SendingPlan } from './subSending'

const cents = (n: number): number => Math.round(n * 100) / 100
const usd = (n: number): string => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export const HAND_CREDIT_BOX = 'credit'

export type HandSheet = { id: string; label: string; remaining: number }

/** The sheets a payment can be placed on: the window's own first, then the sub's other open sheets, oldest first. */
export function handSheets(sheet: HandSheet, ctx: SendingContext | null): HandSheet[] {
  return [sheet, ...(ctx?.others ?? []).map((o) => ({ id: o.id, label: o.label, remaining: cents(o.remaining) }))]
}

/** The boxes as Oldest first would fill them: the start a person changes. Empty when the amount is not one yet. */
export function handBoxesFromFill(amountText: string, sheet: HandSheet, ctx: SendingContext | null): Record<string, string> {
  const fill = planSubSending(amountText, sheet, ctx, { spill: true })
  if (!fill.ok) return {}
  const boxes: Record<string, string> = {}
  for (const l of fill.lines) boxes[l.jobId] = l.amount.toFixed(2)
  if (fill.credit > 0) boxes[HAND_CREDIT_BOX] = fill.credit.toFixed(2)
  return boxes
}

export type HandRow = { id: string; label: string; open: number; placed: number; staysOpen: number; error: string | null }

export type HandPlan = {
  plan: SendingPlan
  rows: HandRow[]
  /** What is in the credit box. */
  credit: number
  placed: number
  /** `$2,200.00 of $2,200.00 placed` · `$1,700.00 of $2,200.00 placed · $500.00 still to place`. */
  placedWords: string
  /** `Part payment on 2041 Cedar Hollow · 2057 Ridgeway paid in full`. */
  effectWords: string
}

/**
 * The boxes read as a sending. Refused, with the reason, while a box is past what its sheet needs, while the parts
 * do not sum to the amount, or when a credit has no roster person to hold it.
 */
export function planSubSendingByHand(amountText: string, sheet: HandSheet, ctx: SendingContext | null, boxes: Readonly<Record<string, string>>): HandPlan {
  const sheets = handSheets(sheet, ctx)
  const typed = parseSubPaymentAmount(amountText)
  const sent = cents(typed)
  const amountOk = !!amountText.trim() && Number.isFinite(typed) && sent > 0
  const read = (id: string): number => {
    const raw = (boxes[id] ?? '').trim()
    if (!raw) return 0
    const n = parseSubPaymentAmount(raw)
    return Number.isFinite(n) ? cents(n) : Number.NaN
  }
  const rows: HandRow[] = sheets.map((s) => {
    const placed = read(s.id)
    const open = cents(Math.max(0, s.remaining))
    const error = Number.isNaN(placed) || placed < 0 ? 'Type an amount in dollars and cents.' : placed > open + SUB_PAYMENT_TOLERANCE ? `${usd(placed)} is more than the ${usd(open)} this sheet needs.` : null
    return { id: s.id, label: s.label, open, placed: Number.isNaN(placed) ? 0 : placed, staysOpen: Math.max(0, cents(open - (Number.isNaN(placed) ? 0 : placed))), error }
  })
  const creditRaw = read(HAND_CREDIT_BOX)
  const credit = Number.isNaN(creditRaw) || creditRaw < 0 ? 0 : creditRaw
  const placed = cents(rows.reduce((n, r) => n + r.placed, 0) + credit)
  const lines: SendingLine[] = rows.filter((r) => r.placed > SUB_PAYMENT_TOLERANCE).map((r) => ({ jobId: r.id, label: r.label, amount: r.placed, settles: r.staysOpen <= SUB_PAYMENT_TOLERANCE }))
  const left = amountOk ? cents(sent - placed) : 0
  const placedWords = !amountOk ? '' : Math.abs(left) <= SUB_PAYMENT_TOLERANCE ? `${usd(placed)} of ${usd(sent)} placed` : left > 0 ? `${usd(placed)} of ${usd(sent)} placed · ${usd(left)} still to place` : `${usd(placed)} placed · ${usd(-left)} more than the ${usd(sent)} sent`
  const effectWords = [...lines.map((l) => (l.settles ? `${l.label} paid in full` : `part payment on ${l.label}`)), ...(credit > 0 ? [`${usd(credit)} kept as their credit`] : [])].join(' · ')

  let plan: SendingPlan
  const boxError = rows.find((r) => r.error)
  if (!amountText.trim()) plan = { ok: false, reason: 'blank', error: 'Type the amount that was paid.' }
  else if (!amountOk) plan = { ok: false, reason: 'invalid', error: 'Type an amount above zero, in dollars and cents.' }
  else if (boxError) plan = { ok: false, reason: 'over', error: `${boxError.label}: ${boxError.error}` }
  else if (credit > SUB_PAYMENT_TOLERANCE && !ctx?.personId) plan = { ok: false, reason: 'over', error: 'A credit needs the sub on the roster as one person. Place the whole amount on sheets.' }
  else if (Math.abs(left) > SUB_PAYMENT_TOLERANCE) plan = { ok: false, reason: 'over', error: left > 0 ? `${usd(left)} of the ${usd(sent)} is not placed yet. Put it on a sheet${ctx?.personId ? ', or keep it as their credit' : ''}.` : `The boxes add to ${usd(placed)}, which is ${usd(-left)} more than the ${usd(sent)} sent.` }
  else if (lines.length === 0) plan = { ok: false, reason: 'over', error: 'Place some of the payment on a sheet. A payment that is all credit is recorded from a sheet it pays.' }
  else {
    const own = rows[0]!
    // The window's own sheet leads when it took money; a sending that skips it leads with its first line.
    const ordered = [...lines.filter((l) => l.jobId === sheet.id), ...lines.filter((l) => l.jobId !== sheet.id)]
    plan = { ok: true, sent, lines: ordered, credit: credit > SUB_PAYMENT_TOLERANCE ? credit : 0, leaves: own.staysOpen, spills: ordered.length > 1 || credit > SUB_PAYMENT_TOLERANCE || ordered[0]!.jobId !== sheet.id }
  }
  return { plan, rows, credit, placed, placedWords, effectWords }
}

/** The press, naming its act: `Record $2,200.00 on 2 sheets`. `Record payment` until there is a plan to name. */
export function sendingConfirmLabel(plan: SendingPlan): string {
  if (!plan.ok) return 'Record payment'
  const n = plan.lines.length
  return `Record ${usd(plan.sent)} on ${n} ${n === 1 ? 'sheet' : 'sheets'}${plan.credit > 0 ? ' and their credit' : ''}`
}
