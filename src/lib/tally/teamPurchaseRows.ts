// The team's unsorted card charges as the office reads them (`list_stale_unlinked_mercury_transactions_for_tally_staff`)
// and the two windows that act on one: Assign (MercuryTransactionAllocationsModal) and Link
// invoices (MercuryTransactionInvoiceLinkModal) both take a `mercury_transactions` row. Shared by
// Dashboard / Quickfill → Team purchases follow-up and Job Parts Tally → Transactions → Team.
// Pure.

import type { Database } from '../../types/database'
import type { SortedTeamPurchaseRow } from '../teamPurchasesSorted'

/** One row of `list_stale_unlinked_mercury_transactions_for_tally_staff`. */
export type StaleStaffRow =
  Database['public']['Functions']['list_stale_unlinked_mercury_transactions_for_tally_staff']['Returns'][number]

type MercuryTxRow = Database['public']['Tables']['mercury_transactions']['Row']

/** The charge in the shape the Assign and Link invoices windows open on. */
export function mercuryTxRowFromStaffListRow(row: StaleStaffRow): MercuryTxRow {
  const posted = row.posted_at ?? new Date().toISOString()
  return {
    id: row.mercury_transaction_id,
    amount: row.amount,
    counterparty_id: null,
    counterparty_name: row.counterparty_name ?? null,
    created_at: posted,
    currency: row.currency ?? 'USD',
    dashboard_link: null,
    external_memo: null,
    kind: '—',
    mercury_account_id: row.mercury_account_id ?? '',
    mercury_category: null,
    mercury_id: row.mercury_id ?? '',
    note: row.note ?? null,
    posted_at: row.posted_at,
    raw: row.raw ?? null,
    status: '—',
    synced_at: posted,
    source: 'mercury',
    manual_upload_id: null,
    created_by: null,
    duplicate_of_transaction_id: null,
  }
}

/** A sorted charge in the To sort row's shape, so the Assign window opens on it the same way. */
export function staffListRowFromSorted(row: SortedTeamPurchaseRow): StaleStaffRow {
  return {
    target_user_id: row.target_user_id,
    target_name: row.target_name ?? '',
    target_email: '',
    target_phone: '',
    mercury_transaction_id: row.mercury_transaction_id,
    posted_at: row.posted_at ?? '',
    amount: row.amount,
    counterparty_name: row.counterparty_name ?? '',
    note: row.note ?? '',
    mercury_account_id: row.mercury_account_id ?? '',
    currency: row.currency ?? 'USD',
    mercury_id: row.mercury_id ?? '',
    raw: row.raw,
    job_splits: row.job_splits,
  } as StaleStaffRow
}
