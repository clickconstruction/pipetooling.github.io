import type { CSSProperties } from 'react'
import type { BalanceSheet, ProfitAndLoss, TypedCategoryEntry } from '../../lib/bankingMercuryCategoryReview'

function usd(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}
function amountColor(n: number): string {
  if (n > 0) return '#047857'
  if (n < 0) return '#b91c1c'
  return '#374151'
}

const wrap: CSSProperties = { border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden', maxWidth: 620 }
const sectionHead: CSSProperties = { padding: '0.5rem 0.75rem', background: '#f9fafb', borderBottom: '1px solid #e5e7eb', fontWeight: 700, fontSize: '0.85rem', color: '#111827' }
const rowStyle: CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', padding: '0.4rem 0.75rem', borderBottom: '1px solid #f3f4f6', fontSize: '0.85rem' }
const subtotal: CSSProperties = { ...rowStyle, fontWeight: 700, background: '#fcfcfd' }
const numCell: CSSProperties = { fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }

function nameButton(label: string, labelId: string | null, onOpen: (id: string | null) => void, muted = false) {
  if (!labelId) return <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>{label}</span>
  return (
    <button
      type="button"
      onClick={() => onOpen(labelId)}
      title="Open category detail"
      style={{ all: 'unset', cursor: 'pointer', color: muted ? '#6b7280' : '#1d4ed8', textDecoration: 'underline', textUnderlineOffset: 2 }}
    >
      {label}
    </button>
  )
}

function Lines({ entries, onOpen }: { entries: TypedCategoryEntry[]; onOpen: (id: string | null) => void }) {
  if (entries.length === 0) return <div style={{ ...rowStyle, color: '#9ca3af' }}>—</div>
  return (
    <>
      {entries.map((e) => (
        <div key={e.colKey} style={rowStyle}>
          <span>{nameButton(e.displayName, e.labelId, onOpen)}</span>
          <span style={{ ...numCell, color: amountColor(e.totalAmount) }}>{usd(e.totalAmount)}</span>
        </div>
      ))}
    </>
  )
}

export type BankingFinancialStatementsProps = {
  mode: 'pnl' | 'balance_sheet'
  pnl: ProfitAndLoss
  balanceSheet: BalanceSheet
  periodLabel: string | null
  cashBalance: number | null
  balancesLoading: boolean
  balancesError: string | null
  onOpenCategory: (labelId: string | null) => void
}

export function BankingFinancialStatements({
  mode,
  pnl,
  balanceSheet,
  periodLabel,
  cashBalance,
  balancesLoading,
  balancesError,
  onOpenCategory,
}: BankingFinancialStatementsProps) {
  if (mode === 'pnl') {
    return (
      <div style={wrap}>
        <div style={sectionHead}>Profit &amp; Loss · {periodLabel ?? 'All time'} · cash basis</div>

        <div style={{ ...rowStyle, fontWeight: 600, color: '#374151', background: '#fff' }}>Income</div>
        <Lines entries={pnl.income.entries} onOpen={onOpenCategory} />
        <div style={subtotal}>
          <span>Total income</span>
          <span style={{ ...numCell, color: amountColor(pnl.income.total) }}>{usd(pnl.income.total)}</span>
        </div>

        <div style={{ ...rowStyle, fontWeight: 600, color: '#374151', background: '#fff' }}>Expenses</div>
        <Lines entries={pnl.expense.entries} onOpen={onOpenCategory} />
        <div style={subtotal}>
          <span>Total expenses</span>
          <span style={{ ...numCell, color: amountColor(pnl.expense.total) }}>{usd(pnl.expense.total)}</span>
        </div>

        <div style={{ ...subtotal, fontSize: '0.95rem', background: '#eff6ff' }}>
          <span>Net income</span>
          <span style={{ ...numCell, color: amountColor(pnl.netIncome) }}>{usd(pnl.netIncome)}</span>
        </div>

        {pnl.uncategorized.entries.length > 0 ? (
          <>
            <div style={{ ...rowStyle, fontWeight: 600, color: '#b45309', background: '#fffbeb' }}>
              Uncategorized — give these an account type to include them
            </div>
            <Lines entries={pnl.uncategorized.entries} onOpen={onOpenCategory} />
          </>
        ) : null}
      </div>
    )
  }

  const bs = balanceSheet
  return (
    <div style={wrap}>
      <div style={sectionHead}>Balance Sheet · as of today · cash basis</div>

      <div style={{ ...rowStyle, fontWeight: 600, color: '#374151', background: '#fff' }}>Assets</div>
      <div style={rowStyle}>
        <span>Cash (bank balance)</span>
        <span style={numCell}>
          {balancesLoading ? '…' : balancesError ? <span style={{ color: '#b91c1c' }} title={balancesError}>unavailable</span> : usd(cashBalance ?? 0)}
        </span>
      </div>
      <Lines entries={bs.otherAssets.entries} onOpen={onOpenCategory} />
      <div style={subtotal}>
        <span>Total assets</span>
        <span style={numCell}>{usd(bs.assetsTotal)}</span>
      </div>

      <div style={{ ...rowStyle, fontWeight: 600, color: '#374151', background: '#fff' }}>Liabilities</div>
      <Lines entries={bs.liabilities.entries} onOpen={onOpenCategory} />
      <div style={subtotal}>
        <span>Total liabilities</span>
        <span style={numCell}>{usd(bs.liabilitiesTotal)}</span>
      </div>

      <div style={{ ...rowStyle, fontWeight: 600, color: '#374151', background: '#fff' }}>Equity</div>
      <Lines entries={bs.ownersEquity.entries} onOpen={onOpenCategory} />
      <div style={rowStyle}>
        <span>Retained earnings (accumulated net income)</span>
        <span style={{ ...numCell, color: amountColor(bs.retainedEarnings) }}>{usd(bs.retainedEarnings)}</span>
      </div>
      <div style={subtotal}>
        <span>Total equity</span>
        <span style={numCell}>{usd(bs.equityTotal)}</span>
      </div>

      <div style={{ ...subtotal, fontSize: '0.95rem', background: '#eff6ff' }}>
        <span>Liabilities + Equity</span>
        <span style={numCell}>{usd(bs.liabilitiesPlusEquity)}</span>
      </div>

      {Math.abs(bs.unreconciled) >= 0.005 ? (
        <div style={{ ...rowStyle, color: '#b45309', background: '#fffbeb' }}>
          <span>Unreconciled (uncategorized / partial history)</span>
          <span style={{ ...numCell }}>{usd(bs.unreconciled)}</span>
        </div>
      ) : null}
      <div style={{ padding: '0.5rem 0.75rem', fontSize: '0.7rem', color: '#94a3b8' }}>
        Cash basis from categorized bank activity; Assets cash is the live Mercury balance. Approximate — classify
        every category to shrink the unreconciled line.
      </div>
    </div>
  )
}
