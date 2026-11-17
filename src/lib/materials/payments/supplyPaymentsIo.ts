/**
 * Supply house payments: the reads and the one write the screens make.
 *
 * A house may hold thousands of bills paid before payments were rows, each with one payment "from before" that says
 * nothing a row did not already say. So a house's read leaves those out and takes two small sets:
 *   - every payment that is not from before, with its lines (what the paid rows name, what waits on account, how
 *     the house was paid last);
 *   - every line on a bill that is still open, with its payment (what a part-paid bill has had put on it, whatever
 *     made the line).
 *
 * The screens take a `SupplyPaymentsIo`, so a test hands them a fake.
 */

import { supabase } from '../../supabase'
import { withSupabaseRetry } from '../../../utils/errorHandling'
import type { SupplyPayment, SupplyPaymentLine } from './supplyPayment'
import type { MoveReason, SupplyPaymentEvent } from './supplyPaymentMove'

/** `events` is what happened to the house's payments since: each move, removal and putting back. */
export type HousePayments = { payments: SupplyPayment[]; lines: SupplyPaymentLine[]; events?: SupplyPaymentEvent[] }

export type MoveSupplyPaymentInput = { paymentId: string; fromInvoiceId: string | null; toInvoiceId: string | null; amount: number; reason: MoveReason; note?: string | null }

export type RecordSupplyPaymentInput = {
  supplyHouseId: string
  paidOn: string
  amount: number
  lines: { invoice_id: string; amount: number }[]
  fromAccount: { payment_id: string; invoice_id: string; amount: number }[]
  keepOnAccount: boolean
  method: string | null
  methodRef: string | null
  receiptLink: string | null
  memo: string | null
  /** The house added interest or a late fee: made as a bill of its own, tied to the late bill, and paid by this payment. */
  interest?: { amount: number; lateInvoiceId: string | null } | null
}

export type RecordSupplyPaymentResult = { payment_id: string | null; lines: number; placed: number; on_account: number; placed_from_account: number }

export interface SupplyPaymentsIo {
  loadHouse(supplyHouseId: string): Promise<HousePayments>
  record(input: RecordSupplyPaymentInput): Promise<RecordSupplyPaymentResult>
  /** Takes a payment off the books, with why: it counts for nothing and its bills are read again. */
  remove(paymentId: string, reason: string | null): Promise<void>
  /** Puts a removed payment back, whole, within 30 days. */
  restore(paymentId: string): Promise<void>
  /** Moves an amount of one payment from one bill to another; null on either side is "on account". */
  move(input: MoveSupplyPaymentInput): Promise<void>
  /** Takes a move back. */
  undoMove(eventId: string): Promise<void>
}

const PAYMENT_COLUMNS = 'id, supply_house_id, paid_on, amount, method, method_ref, receipt_link, memo, source, removed_at, removed_by_name, removed_reason, created_by_name'
const EVENT_COLUMNS = 'id, payment_id, kind, from_invoice_id, to_invoice_id, from_invoice_number, to_invoice_number, amount, reason, note, undoes_event_id, undone_by_event_id, actor_name, created_at'
const PAGE = 1000

type PaymentRow = Omit<SupplyPayment, 'amount'> & { amount: number | string }
type LineRow = { id: string; payment_id: string; invoice_id: string; amount: number | string }

const paymentOf = (r: PaymentRow): SupplyPayment => ({ ...r, amount: Number(r.amount) })
const lineOf = (r: LineRow): SupplyPaymentLine => ({ id: r.id, payment_id: r.payment_id, invoice_id: r.invoice_id, amount: Number(r.amount) })

/** Every page of a read, so a busy house is never cut at the API's row cap. */
async function everyPage<T>(label: string, page: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += PAGE) {
    const rows = ((await withSupabaseRetry(() => page(from, from + PAGE - 1) as never, label)) ?? []) as T[]
    out.push(...rows)
    if (rows.length < PAGE) return out
  }
}

/** Two reads folded into one set, each payment and each line once. */
export function foldHousePayments(typed: ReadonlyArray<PaymentRow & { supply_house_payment_lines?: LineRow[] | null }>, openLines: ReadonlyArray<LineRow & { supply_house_payments?: PaymentRow | null }>): HousePayments {
  const payments = new Map<string, SupplyPayment>()
  const lines = new Map<string, SupplyPaymentLine>()
  for (const p of typed) {
    const { supply_house_payment_lines: own, ...row } = p
    payments.set(row.id, paymentOf(row))
    for (const l of own ?? []) lines.set(l.id, lineOf(l))
  }
  for (const l of openLines) {
    lines.set(l.id, lineOf(l))
    if (l.supply_house_payments && !payments.has(l.supply_house_payments.id)) payments.set(l.supply_house_payments.id, paymentOf(l.supply_house_payments))
  }
  return { payments: [...payments.values()], lines: [...lines.values()] }
}

export const supabaseSupplyPaymentsIo: SupplyPaymentsIo = {
  async loadHouse(supplyHouseId) {
    // The two tables are not in the generated types until the regeneration after the push.
    const [typed, openLines] = await Promise.all([
      everyPage<PaymentRow & { supply_house_payment_lines?: LineRow[] | null }>('read the supply house payments', (from, to) =>
        supabase
          .from('supply_house_payments' as never)
          .select(`${PAYMENT_COLUMNS}, supply_house_payment_lines(id, payment_id, invoice_id, amount)`)
          .eq('supply_house_id', supplyHouseId)
          .or('source.neq.before,method.not.is.null')
          .order('paid_on', { ascending: true })
          .order('id', { ascending: true })
          .range(from, to),
      ),
      everyPage<LineRow & { supply_house_payments?: PaymentRow | null }>('read what is on the open bills', (from, to) =>
        supabase
          .from('supply_house_payment_lines' as never)
          .select(`id, payment_id, invoice_id, amount, supply_house_payments(${PAYMENT_COLUMNS}), supply_house_invoices!inner(supply_house_id, is_paid)`)
          .eq('supply_house_invoices.supply_house_id', supplyHouseId)
          .eq('supply_house_invoices.is_paid', false)
          .order('id', { ascending: true })
          .range(from, to),
      ),
    ])
    // What happened to them since. A read that fails (the table comes with its own migration) leaves the list empty.
    const events = await everyPage<SupplyPaymentEvent & { amount: number | string | null }>('read the payments’ moves', (from, to) =>
      supabase
        .from('supply_house_payment_events' as never)
        .select(EVENT_COLUMNS)
        .eq('supply_house_id', supplyHouseId)
        .order('created_at', { ascending: false })
        .order('id', { ascending: true })
        .range(from, to),
    ).catch(() => [])
    return { ...foldHousePayments(typed, openLines), events: events.map((e) => ({ ...e, amount: e.amount == null ? null : Number(e.amount) })) }
  },

  async record(input) {
    const data = await withSupabaseRetry(
      () =>
        supabase.rpc('record_supply_house_payment' as never, {
          p_supply_house_id: input.supplyHouseId,
          p_paid_on: input.paidOn,
          p_amount: input.amount,
          p_lines: input.lines,
          p_method: input.method,
          p_method_ref: input.methodRef,
          p_receipt_link: input.receiptLink,
          p_memo: input.memo,
          p_keep_on_account: input.keepOnAccount,
          p_from_account: input.fromAccount,
          // Sent only when there is interest, so a payment without it still records before the function gains the argument.
          ...(input.interest ? { p_interest: { amount: input.interest.amount, late_invoice_id: input.interest.lateInvoiceId } } : {}),
        } as never) as never,
      'record the payment',
      // A payment is not asked for twice: a lost reply must not send the same money to the books again.
      { maxRetries: 0 },
    )
    return data as RecordSupplyPaymentResult
  },

  // The four below each change the books once: none is asked for twice on a lost reply.
  async remove(paymentId, reason) {
    await withSupabaseRetry(() => supabase.rpc('remove_supply_house_payment' as never, { p_payment_id: paymentId, p_reason: reason } as never) as never, 'remove the payment', { maxRetries: 0 })
  },

  async restore(paymentId) {
    await withSupabaseRetry(() => supabase.rpc('restore_supply_house_payment' as never, { p_payment_id: paymentId } as never) as never, 'put the payment back', { maxRetries: 0 })
  },

  async move(input) {
    await withSupabaseRetry(
      () =>
        supabase.rpc('move_supply_house_payment' as never, {
          p_payment_id: input.paymentId,
          p_from_invoice_id: input.fromInvoiceId,
          p_to_invoice_id: input.toInvoiceId,
          p_amount: input.amount,
          p_reason: input.reason,
          p_note: input.note ?? null,
        } as never) as never,
      'move the payment',
      { maxRetries: 0 },
    )
  },

  async undoMove(eventId) {
    await withSupabaseRetry(() => supabase.rpc('undo_supply_house_payment_move' as never, { p_event_id: eventId } as never) as never, 'take the move back', { maxRetries: 0 })
  },
}
