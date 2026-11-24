import { useState } from 'react'
import { billDateWords } from '../../lib/materials/supplyBillGroups'
import { supplyPayMethodLabel, usd } from '../../lib/materials/payments/supplyPayment'
import { unclaimedHeading, type UnclaimedHouseLine } from '../../lib/materials/payments/supplyPaymentBank'
import { MoneyText } from '../Money'

/**
 * Bank lines to a supply house that no payment claims, under Accounts payable (the owner's ask of 2026-11-16, the
 * other direction of the bank match). The day, the amount and card or ACH are already on the line, so **Say what it
 * paid** opens Record a payment with them filled and only the bills are left to tick.
 *
 * It is not drawn while there are none, which is the good state. It draws only; the host opens the window.
 */
export function SupplyBankUnclaimed({ lines, todayYmd, onSay }: { lines: ReadonlyArray<UnclaimedHouseLine>; todayYmd: string; onSay: (line: UnclaimedHouseLine) => void }) {
  const [open, setOpen] = useState(false)
  if (lines.length === 0) return null
  const total = lines.reduce((s, u) => s + u.line.amount, 0)
  return (
    <div data-testid="supply-bank-unclaimed" style={{ margin: '0.5rem 0', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)' }}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, width: '100%', padding: '0.5rem 0.75rem', font: 'inherit', fontSize: '0.875rem', fontWeight: 600, textAlign: 'left', background: 'none', border: 'none', color: 'var(--text-amber-800)', cursor: 'pointer' }}
      >
        <span>
          {unclaimedHeading(lines.length)} {open ? '▾' : '▸'}
        </span>
        <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}><MoneyText text={usd(total)} /></span>
      </button>
      {open ? (
        <div>
          <p style={{ margin: 0, padding: '0 0.75rem 0.4rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>The bank shows money out to these houses. Say which bills each one paid. A purchase the Tally already sorted is not listed.</p>
          {lines.map((u) => (
            <div key={u.line.id} data-testid="supply-bank-unclaimed-line" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '2px 12px', padding: '0.45rem 0.75rem', borderTop: '1px solid var(--border)' }}>
              <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-strong)', overflowWrap: 'anywhere' }}>
                  {u.houseName} · {supplyPayMethodLabel(u.line.method)} · {billDateWords(u.line.ymd, todayYmd)}
                </div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', overflowWrap: 'anywhere' }}>{u.line.payee || 'no payee named'}</div>
              </div>
              <div style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}><MoneyText text={usd(u.line.amount)} /></div>
              <button type="button" onClick={() => onSay(u)} aria-label={`Say what the ${usd(u.line.amount)} to ${u.houseName} paid`} style={{ font: 'inherit', fontSize: '0.8125rem', fontWeight: 600, padding: '0.25rem 0.7rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-link)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                Say what it paid
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
