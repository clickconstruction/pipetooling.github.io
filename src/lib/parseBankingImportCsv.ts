import { parseCsv } from './parseCsv'

/** One transaction destined for the `import-manual-transactions` edge function. */
export type BankingImportRow = {
  postedDate: string // YYYY-MM-DD
  amount: number // signed; negative = money out
  payee: string | null
  memo: string | null
  category: string | null
  type: string | null
  refNo: string | null
  reconciliationStatus: string | null
}

export type BankingImportParseResult = {
  /** Account name parsed from the export's title row (editable by the user). */
  accountName: string
  /** Ending balance parsed from the title row, if present. */
  endingBalance: number | null
  rows: BankingImportRow[]
  /** Sum of all parsed row amounts (should match endingBalance for a from-zero register). */
  totalAmount: number
  /** Non-fatal notes (skipped rows, missing columns, etc.). */
  warnings: string[]
}

/** Parse "$1,234.56" / "-$1,234.56" / "1,234.56" / "" → number | null. */
function parseMoney(raw: string | undefined): number | null {
  if (raw == null) return null
  const s = raw.replace(/[$,\s]/g, '').trim()
  if (s === '') return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

/** MM/DD/YYYY → YYYY-MM-DD (or null if not a recognizable date). */
function toYmd(raw: string | undefined): string | null {
  if (!raw) return null
  const s = raw.trim()
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (m) return `${m[3]}-${(m[1] ?? '').padStart(2, '0')}-${(m[2] ?? '').padStart(2, '0')}`
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  return null
}

function norm(s: string | undefined): string {
  return (s ?? '').trim().toLowerCase()
}

function cell(row: string[], idx: number): string {
  return idx >= 0 && idx < row.length ? (row[idx] ?? '').trim() : ''
}

/**
 * Parse a QuickBooks-style account register CSV export into transactions for the
 * manual-import flow. Detects the header row by column names (Date + Payment/Deposit
 * or Amount), reads the account name + ending balance from the title row, and skips
 * non-data rows (title, blanks, totals). Money-out becomes a negative amount.
 */
export function parseBankingImportCsv(text: string): BankingImportParseResult {
  const grid = parseCsv(text)
  const warnings: string[] = []

  // Header row = the first row that has a "date" column and an amount-ish column.
  let headerIdx = -1
  for (let i = 0; i < Math.min(grid.length, 15); i++) {
    const lowered = (grid[i] ?? []).map(norm)
    const hasDate = lowered.includes('date')
    const hasAmount = lowered.some((c) => ['payment', 'deposit', 'amount', 'credit', 'debit'].includes(c))
    if (hasDate && hasAmount) {
      headerIdx = i
      break
    }
  }
  if (headerIdx === -1) {
    return { accountName: '', endingBalance: null, rows: [], totalAmount: 0, warnings: ['Could not find a header row with Date + Payment/Deposit (or Amount) columns.'] }
  }

  const header = (grid[headerIdx] ?? []).map(norm)
  const col = (name: string) => header.indexOf(name)
  const idx = {
    date: col('date'),
    refNo: col('ref no.') >= 0 ? col('ref no.') : col('ref no'),
    payee: col('payee'),
    memo: col('memo') >= 0 ? col('memo') : col('description'),
    payment: col('payment') >= 0 ? col('payment') : col('debit'),
    deposit: col('deposit') >= 0 ? col('deposit') : col('credit'),
    amount: col('amount'),
    recon: col('reconciliation status'),
    type: col('type'),
    account: col('account'),
  }

  // Title row (anything above the header): "<name> ... Ending Balance: -$15,970.50"
  let accountName = ''
  let endingBalance: number | null = null
  for (let i = 0; i < headerIdx; i++) {
    const g = grid[i]
    if (!g) continue
    const joined = g.join(' ')
    const m = joined.match(/^(.*?)\s*Ending Balance:\s*(-?\$?[\d,]+\.\d{2})/i)
    if (m) {
      accountName = (m[1] ?? '').replace(/\s+/g, ' ').trim()
      endingBalance = parseMoney(m[2] ?? '')
      break
    }
    if (!accountName && g.some((c) => c.trim() !== '')) {
      accountName = g.map((c) => c.trim()).filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()
    }
  }

  const rows: BankingImportRow[] = []
  let skipped = 0
  for (let i = headerIdx + 1; i < grid.length; i++) {
    const r = grid[i]
    if (!r) continue
    const postedDate = toYmd(cell(r, idx.date))
    if (!postedDate) {
      if (r.some((c) => c.trim() !== '')) skipped++ // non-empty, non-date → likely a totals row
      continue
    }
    let amount: number | null
    if (idx.amount >= 0) {
      amount = parseMoney(cell(r, idx.amount))
    } else {
      const pay = parseMoney(cell(r, idx.payment)) // money out
      const dep = parseMoney(cell(r, idx.deposit)) // money in
      amount = pay == null && dep == null ? null : (dep ?? 0) - (pay ?? 0)
    }
    if (amount == null) {
      skipped++
      continue
    }
    rows.push({
      postedDate,
      amount,
      payee: cell(r, idx.payee) || null,
      memo: cell(r, idx.memo) || null,
      category: cell(r, idx.account) || null,
      type: cell(r, idx.type) || null,
      refNo: cell(r, idx.refNo) || null,
      reconciliationStatus: cell(r, idx.recon) || null,
    })
  }

  if (skipped > 0) warnings.push(`Skipped ${skipped} row(s) without a valid date/amount (title, totals, or blank lines).`)
  if (rows.length === 0) warnings.push('No transaction rows were found.')

  const totalAmount = rows.reduce((s, r) => s + r.amount, 0)
  return { accountName, endingBalance, rows, totalAmount, warnings }
}
