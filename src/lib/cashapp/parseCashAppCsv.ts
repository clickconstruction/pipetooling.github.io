/**
 * Cash App activity export → typed rows. The export (Cash App → Statements → CSV) has these
 * columns, in this order, quoted: Date, Transaction ID, Transaction Type, Currency, Amount, Fee,
 * Net Amount, Asset Type, Asset Price, Asset Amount, Status, Notes, Name of sender/receiver,
 * Account. Dates are local wall-clock with a zone suffix ("2026-09-11 11:50:56 CDT"); money is
 * "$1,200.00" / "-$300.00". Amount is signed as exported: negative = money left the account.
 *
 * Pure. The importer keeps every row (so a re-upload is idempotent by Transaction ID); the
 * reconcile only looks at `isStaffOutflow` rows.
 */

import { parseCsv } from '../parseCsv'

export type CashAppCsvRow = {
  /** Cash App "Transaction ID", e.g. "#D-3V3MVPKVP" — the stable key across exports. */
  id: string
  /** Wall-clock timestamp as exported, e.g. "2026-09-11 11:50:56 CDT". */
  occurredAtText: string
  /** YYYY-MM-DD, the export's local day (Cash App exports in the account's zone). */
  occurredDate: string
  txType: string
  status: string
  currency: string
  /** Signed: negative = sent. */
  amount: number
  fee: number
  netAmount: number
  note: string
  counterparty: string
  account: string
}

export type CashAppCsvParseResult = {
  rows: CashAppCsvRow[]
  /** Rows dropped for having no Transaction ID or an unparsable amount / date. */
  skipped: number
  warnings: string[]
}

const REQUIRED = ['Date', 'Transaction ID', 'Transaction Type', 'Amount', 'Status', 'Notes', 'Name of sender/receiver'] as const

export function parseCashAppMoney(raw: string | undefined): number | null {
  if (raw == null) return null
  const s = raw.replace(/[$,\s]/g, '')
  if (s === '') return 0
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

export function parseCashAppCsv(text: string): CashAppCsvParseResult {
  const table = parseCsv(text.replace(/^﻿/, ''))
  const warnings: string[] = []
  if (table.length === 0) return { rows: [], skipped: 0, warnings: ['Empty file'] }
  const header = (table[0] ?? []).map((h) => h.trim())
  const col = (name: string) => header.indexOf(name)
  const missing = REQUIRED.filter((c) => col(c) < 0)
  if (missing.length) return { rows: [], skipped: 0, warnings: [`Not a Cash App export — missing column(s): ${missing.join(', ')}`] }

  const idx = {
    date: col('Date'),
    id: col('Transaction ID'),
    type: col('Transaction Type'),
    currency: col('Currency'),
    amount: col('Amount'),
    fee: col('Fee'),
    net: col('Net Amount'),
    status: col('Status'),
    notes: col('Notes'),
    name: col('Name of sender/receiver'),
    account: col('Account'),
  }
  const cell = (r: string[], i: number) => (i >= 0 ? (r[i] ?? '').trim() : '')

  const rows: CashAppCsvRow[] = []
  const seen = new Set<string>()
  let skipped = 0
  for (const r of table.slice(1)) {
    if (r.every((c) => c.trim() === '')) continue
    const id = cell(r, idx.id)
    const dateText = cell(r, idx.date)
    const amount = parseCashAppMoney(cell(r, idx.amount))
    const date = dateText.slice(0, 10)
    if (!id || amount === null || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      skipped++
      continue
    }
    if (seen.has(id)) {
      skipped++
      continue
    }
    seen.add(id)
    const fee = parseCashAppMoney(cell(r, idx.fee)) ?? 0
    const net = parseCashAppMoney(cell(r, idx.net)) ?? amount
    rows.push({
      id,
      occurredAtText: dateText,
      occurredDate: date,
      txType: cell(r, idx.type),
      status: cell(r, idx.status),
      currency: cell(r, idx.currency) || 'USD',
      amount,
      fee,
      netAmount: net,
      note: cell(r, idx.notes),
      counterparty: cell(r, idx.name),
      account: cell(r, idx.account),
    })
  }
  if (skipped) warnings.push(`${skipped} row${skipped === 1 ? '' : 's'} skipped (no Transaction ID, bad amount or date, or duplicate ID)`)
  return { rows, skipped, warnings }
}

/** Money sent to a person: a completed peer-to-peer payment out of the account. */
export function isStaffOutflow(row: Pick<CashAppCsvRow, 'txType' | 'status' | 'amount'>): boolean {
  return row.txType === 'P2P' && row.status === 'COMPLETE' && row.amount < 0
}
