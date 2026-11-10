import type { CSSProperties } from 'react'
import type { CashAccounts } from '../../lib/bridge/cashAccounts'

/**
 * The bank's accounts under the cash forecast (v2.6838, punch list #303): every account by the
 * name it carries in Mercury with what it holds, and a switch on each. Switched off, an account
 * is left out of cash on hand; the row stays where it is and says so. The words under the list
 * come from `buildCashAccounts`.
 */

const usd0 = (n: number): string => `${n < 0 ? '−' : ''}$${Math.round(Math.abs(n)).toLocaleString('en-US')}`

const label: CSSProperties = { fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)' }

export function BridgeCashAccounts({ accounts, onFlip }: { accounts: CashAccounts; onFlip: (id: string) => void }) {
  return (
    <section data-testid="bridge-cash-accounts" aria-label="The bank’s accounts" style={{ marginTop: '0.6rem', borderTop: '1px solid var(--border)', paddingTop: '0.55rem' }}>
      <div style={label}>The bank’s accounts</div>
      <ul style={{ listStyle: 'none', margin: '0.35rem 0 0', padding: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(280px, 100%), 1fr))', columnGap: '1.2rem' }}>
        {accounts.rows.map((r) => (
          <li key={r.id} data-testid="bridge-cash-account" style={{ borderBottom: '1px solid var(--border)', minWidth: 0 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', minHeight: 44, cursor: 'pointer', minWidth: 0 }}>
              <input
                type="checkbox"
                checked={r.counted}
                onChange={() => onFlip(r.id)}
                aria-label={`Count ${r.name} in cash on hand`}
                style={{ width: 18, height: 18, flex: 'none', accentColor: '#2563eb', cursor: 'pointer' }}
              />
              <span style={{ flex: 1, minWidth: 0, lineHeight: 1.25 }}>
                <span style={{ display: 'block', fontSize: '0.86rem', fontWeight: 600, color: r.counted ? 'var(--text-strong)' : 'var(--text-muted)', overflowWrap: 'anywhere' }}>{r.name}</span>
                <span style={{ display: 'block', fontSize: '0.72rem', color: r.counted ? 'var(--text-muted)' : 'var(--text-amber-800)' }}>
                  {r.counted ? (r.kind ?? 'Account') : 'Left out'}
                  {r.availableUsd != null ? `, ${usd0(r.availableUsd)} free to spend` : ''}
                </span>
              </span>
              <span style={{ flex: 'none', fontSize: '0.92rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: r.counted ? 'var(--text-strong)' : 'var(--text-muted)' }}>{usd0(r.usd)}</span>
            </label>
          </li>
        ))}
      </ul>
      <p data-testid="bridge-cash-accounts-words" style={{ margin: '0.45rem 0 0', fontSize: '0.8rem', color: accounts.leftOutCount > 0 ? 'var(--text-amber-800)' : 'var(--text-muted)', lineHeight: 1.35 }}>
        {accounts.lines.join(' ')}
      </p>
    </section>
  )
}
