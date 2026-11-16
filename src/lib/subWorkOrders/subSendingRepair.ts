/**
 * Two repairs to money already recorded (punch list #347's residue), both shown before anything is saved:
 *
 *  1. `overToCreditPlan`: a sheet paid past its total becomes a credit. The payment that went over reads the part
 *     the sheet needed, and the rest is kept as the sub's credit with that same payment, so what left the bank is
 *     the figure it always was. (`convert_sub_overpayment_to_credit`, migration `…_sub_overpayment_to_credit.sql`.)
 *  2. `proposeSendingGroups`: payments typed one per sheet before sendings existed are gathered into the sendings
 *     they were. Rows of one person, one day and one way of paying are offered as one. A group whose day is only
 *     the day it was typed is held with that reason: it may be several checks typed in one sitting.
 *     (`gather_sub_payments_into_sending`, migration `…_sub_gather_sendings.sql`.)
 *
 * Neither changes what a sheet owes or what a sub was paid. Pure: no React, no Supabase.
 */
import { SUB_PAYMENT_TOLERANCE } from './subPaymentWindow'

const cents = (n: number): number => Math.round(n * 100) / 100
const usd = (n: number): string => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

// ── 1. A sheet paid past its total ───────────────────────────────────────────────────────────────────────────

export type OverPayment = { id: string; amount: number; dayWords: string; fromCredit: boolean; carriesCredit: boolean; at: string }

export type OverToCreditPlan =
  | {
      ok: true
      over: number
      /** The payment that changes: what it reads on the sheet after, and the credit kept with it. */
      paymentId: string
      before: number
      after: number
      words: string[]
      confirmLabel: string
    }
  | { ok: false; reason: 'not_over' | 'no_person' | 'no_payment'; error: string }

/**
 * `sheet.over` is what was paid past the sheet's total. The newest payment that can carry it does: money that left
 * the bank (not a payment made from a credit), with no credit kept on it yet, and more on it than the overage, so
 * the row never drops to zero.
 */
export function overToCreditPlan(sheet: { label: string; total: number; paid: number; over: number }, payments: readonly OverPayment[], sub: { personId: string | null; name: string }): OverToCreditPlan {
  const over = cents(sheet.over)
  if (over <= SUB_PAYMENT_TOLERANCE) return { ok: false, reason: 'not_over', error: 'This sheet is not paid past its total.' }
  if (!sub.personId) return { ok: false, reason: 'no_person', error: 'A credit needs the sub on the roster as one person. Link the sheet to one sub first.' }
  const carrier = payments
    .filter((p) => p.amount > over + SUB_PAYMENT_TOLERANCE && !p.fromCredit && !p.carriesCredit)
    .slice()
    .sort((a, b) => (a.at < b.at ? 1 : -1))[0]
  if (!carrier) return { ok: false, reason: 'no_payment', error: `No single payment on this sheet is larger than the ${usd(over)} over. Edit the payments on the sheet instead.` }
  const after = cents(carrier.amount - over)
  const name = sub.name.trim() || 'the sub'
  return {
    ok: true,
    over,
    paymentId: carrier.id,
    before: carrier.amount,
    after,
    words: [
      `${sheet.label} comes to ${usd(sheet.total)} and ${usd(sheet.paid)} was paid on it: ${usd(over)} over.`,
      `The payment of ${carrier.dayWords} reads ${usd(after)} on this sheet and ${usd(over)} kept as ${name}'s credit.`,
      `${usd(carrier.amount)} left the bank, as before. The sheet reads paid in full, and the next payment to ${name} offers the credit first.`,
    ],
    confirmLabel: `Keep ${usd(over)} as their credit`,
  }
}

// ── 2. Old payments, gathered into the sendings they were ────────────────────────────────────────────────────

export type GatherLine = {
  id: string
  sheetId: string
  /** `id:<people id>` for one roster person; anything else cannot be gathered. */
  paidToKey: string
  paidTo: string
  job: string
  /** `YYYY-MM-DD`: the Date sent, else the day it was typed. */
  ymd: string
  recorded: boolean
  method: string
  methodRef: string
  amount: number
  hasSending: boolean
  fromCredit: boolean
}

export type SendingGroup = {
  key: string
  personId: string
  paidTo: string
  ymd: string
  how: string
  amount: number
  lines: GatherLine[]
  /** Offered ticked, or held until someone says it was one payment. */
  ready: boolean
  /** Why it is held; '' when it is ready. */
  held: string
}

/**
 * Rows with no sending, grouped by person, day and way of paying. Only groups of two or more: a lone row is already
 * one payment. Newest first.
 */
export function proposeSendingGroups(lines: readonly GatherLine[]): SendingGroup[] {
  const byKey = new Map<string, SendingGroup>()
  for (const l of lines) {
    if (l.hasSending || l.fromCredit || l.amount <= 0 || !l.ymd || !l.paidToKey.startsWith('id:')) continue
    const how = [l.method, l.methodRef].filter(Boolean).join(' ')
    const key = `${l.paidToKey}|${l.ymd}|${l.recorded ? 'typed' : 'sent'}|${how.toLowerCase()}`
    const g = byKey.get(key) ?? { key, personId: l.paidToKey.slice(3), paidTo: l.paidTo, ymd: l.ymd, how, amount: 0, lines: [], ready: false, held: '' }
    g.lines.push(l)
    g.amount = cents(g.amount + l.amount)
    byKey.set(key, g)
  }
  const out: SendingGroup[] = []
  for (const g of byKey.values()) {
    if (g.lines.length < 2) continue
    const sheets = new Set(g.lines.map((l) => l.sheetId))
    const typed = g.lines.some((l) => l.recorded)
    g.held = typed ? 'No Date sent on these: they are grouped by the day they were typed, which may hold several payments.' : sheets.size < g.lines.length ? 'Two of these are on one sheet, so they may be two payments made the same day.' : ''
    g.ready = g.held === ''
    out.push(g)
  }
  return out.sort((a, b) => b.ymd.localeCompare(a.ymd) || a.paidTo.localeCompare(b.paidTo) || a.key.localeCompare(b.key))
}

export type GatherPlan = { groups: SendingGroup[]; payments: number; amount: number; confirmLabel: string | null; heldWords: string }

/** What the press will do with the groups ticked: its label with both counts, and what stays held. */
export function gatherPlan(groups: readonly SendingGroup[], picked: ReadonlySet<string>): GatherPlan {
  const chosen = groups.filter((g) => picked.has(g.key))
  const payments = chosen.reduce((n, g) => n + g.lines.length, 0)
  const held = groups.filter((g) => !picked.has(g.key))
  return {
    groups: chosen,
    payments,
    amount: cents(chosen.reduce((n, g) => n + g.amount, 0)),
    confirmLabel: chosen.length > 0 ? `Gather ${payments} payments into ${chosen.length} ${chosen.length === 1 ? 'sending' : 'sendings'}` : null,
    heldWords: held.length > 0 ? `${held.length} ${held.length === 1 ? 'group is left as it is' : 'groups are left as they are'}. Tick one to gather it too.` : '',
  }
}
