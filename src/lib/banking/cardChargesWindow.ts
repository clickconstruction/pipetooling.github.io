// Card charges in a window — the read behind People → Spending (punch list #52) and the Tally
// team queue's history (#72): `list_card_charges_window`, one row per card charge posted in the
// company days asked for, with who it belongs to, what it is, where it went and when the card was
// used (purchasedAt, v2.4665: Mercury's createdAt; the window itself keys on posted_at). The row's
// job_splits and invoice_links carry the Sorted RPC's keys (v2.4566), so they parse with
// `parseSortedJobSplits` / `parseSortedInvoiceLinks`.

import type { Json } from '../../types/database'
import { supabase } from '../supabase'
import { fetchAllRows } from '../supabasePaging'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { parseSortedInvoiceLinks, parseSortedJobSplits, type SortedInvoiceLink, type SortedJobSplit } from '../teamPurchasesSorted'

export const CARD_CHARGES_WINDOW_RPC = 'list_card_charges_window' as const

/** The widest window the RPC answers (it refuses more). */
export const CARD_CHARGES_WINDOW_MAX_DAYS = 366

/** One row as the RPC returns it. */
export type CardChargesWindowRpcRow = {
  mercury_transaction_id: string
  posted_at: string
  /** Mercury's createdAt from `raw` (migration 20261006061356); absent from a server before that push. */
  purchased_at: string | null
  amount: number | string
  counterparty_name: string | null
  kind: string
  status: string | null
  bank_category: string | null
  debit_card_id: string | null
  card_nickname: string | null
  card_role: string | null
  holder_user_id: string | null
  holder_name: string | null
  attributed_user_id: string | null
  attributed_person_id: string | null
  label_id: string | null
  label_default_key: string | null
  payroll_marked: boolean | null
  job_splits: Json | null
  invoice_links: Json | null
  sorted_at: string | null
  sorted_by_name: string | null
  viewer_can_sort: boolean | null
}

/** One card charge, as the kernels read it. `amount` keeps the bank's sign: a purchase is negative. */
export type CardChargeWindowRow = {
  id: string
  postedAt: string
  /**
   * When the card was used: Mercury's createdAt, often hours before postedAt (when the charge
   * settled) and on another company day for many charges. Not the row's insert time. null when
   * Mercury sent none or it is not a valid timestamp. Spending and Review key on postedAt.
   */
  purchasedAt: string | null
  amount: number
  counterpartyName: string | null
  kind: string
  status: string | null
  bankCategory: string | null
  debitCardId: string | null
  cardNickname: string | null
  cardRole: string | null
  holderUserId: string | null
  holderName: string | null
  attributedUserId: string | null
  attributedPersonId: string | null
  labelId: string | null
  labelDefaultKey: string | null
  payrollMarked: boolean
  splits: SortedJobSplit[]
  invoiceLinks: SortedInvoiceLink[]
  sortedAt: string | null
  sortedByName: string | null
  /** The split write this charge goes through admits this viewer (the RPC asks the write's own check). */
  viewerCanSort: boolean
}

const text = (v: string | null | undefined): string | null => (typeof v === 'string' && v.trim() !== '' ? v : null)

export function cardChargeWindowRowFromRpc(r: CardChargesWindowRpcRow): CardChargeWindowRow {
  const amount = Number(r.amount)
  return {
    id: r.mercury_transaction_id,
    postedAt: r.posted_at,
    purchasedAt: text(r.purchased_at),
    amount: Number.isFinite(amount) ? amount : 0,
    counterpartyName: text(r.counterparty_name),
    kind: r.kind,
    status: text(r.status),
    bankCategory: text(r.bank_category),
    debitCardId: text(r.debit_card_id),
    cardNickname: text(r.card_nickname),
    cardRole: text(r.card_role),
    holderUserId: text(r.holder_user_id),
    holderName: text(r.holder_name),
    attributedUserId: text(r.attributed_user_id),
    attributedPersonId: text(r.attributed_person_id),
    labelId: text(r.label_id),
    labelDefaultKey: text(r.label_default_key),
    payrollMarked: r.payroll_marked === true,
    splits: parseSortedJobSplits(r.job_splits),
    invoiceLinks: parseSortedInvoiceLinks(r.invoice_links),
    sortedAt: text(r.sorted_at),
    sortedByName: text(r.sorted_by_name),
    viewerCanSort: r.viewer_can_sort === true,
  }
}

/** The one method the fetcher needs; tests hand in a stub. */
export type CardChargesWindowClient = Pick<typeof supabase, 'rpc'>

/**
 * Every card charge posted in `startYmd`..`endYmd` (company days, both ends included; at most
 * 366), oldest first, paged past PostgREST's silent 1,000-row cap — the RPC orders by
 * (posted_at, id), so `.range()` pages are stable. A failed page throws, never a short list.
 */
export async function fetchCardChargesWindow(
  args: { startYmd: string; endYmd: string },
  client: CardChargesWindowClient = supabase,
  label = 'list card charges window',
): Promise<CardChargeWindowRow[]> {
  const params = { p_start_ymd: args.startYmd, p_end_ymd: args.endYmd }
  const rows = await fetchAllRows<CardChargesWindowRpcRow>(
    (from, to) =>
      withSupabaseRetry(
        () => client.rpc(CARD_CHARGES_WINDOW_RPC as never, params as never).range(from, to),
        label,
      ).then((data) => ({ data: (data ?? []) as unknown as CardChargesWindowRpcRow[], error: null })),
    label,
  )
  return rows.map(cardChargeWindowRowFromRpc)
}
