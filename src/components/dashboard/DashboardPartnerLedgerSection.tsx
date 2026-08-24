import { Link } from 'react-router-dom'
import { usePartnerLedger } from '../../hooks/usePartnerLedger'
import { balanceWords, weekOfLabel } from '../../lib/partnerLedger/partnerLedgerFormat'
import { DashboardGroupCard } from './DashboardGroupCard'

/**
 * "Your statement" — the partner's Dashboard entry card (v2.2157). The week
 * cards, Full ledger, acknowledge and print that lived here (v2.2009–2125)
 * moved to the partner statement page (/my-statement, the customer portal's
 * sibling on paper); this card is the quiet door to it: balance in words,
 * which week is open, and whether a statement is waiting on a sign-off.
 * Self-gating + fail-soft exactly as before — renders nothing for
 * non-partners. Lens mode is gone from here: Partnerships → "View as …"
 * embeds the statement page itself.
 */

const money = (n: number) => `$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const signedMoney = (n: number) => (n > 0 ? `+${money(n)}` : n < 0 ? `−${money(n)}` : money(0))
const balanceColor = (n: number) => (n > 0 ? '#16a34a' : n < 0 ? 'var(--text-red-600)' : 'var(--text-muted)')

export function DashboardPartnerLedgerSection() {
  const { summary, loaded } = usePartnerLedger(undefined, { ledger: false })
  const nowYear = new Date().getFullYear()

  if (!loaded || !summary || !summary.modules.weekly_statement) return null

  // Settle-up position: posted balance plus charges still waiting for a
  // statement (owner call, v2.2009) — the same number the statement headlines.
  const position = summary.balance + summary.pending_offsets.net
  const words = balanceWords(position) || 'even'

  return (
    <DashboardGroupCard title="Your statement">
      <Link
        to="/my-statement"
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', textDecoration: 'none', color: 'inherit', padding: '0.15rem 0 0.1rem' }}
      >
        <span style={{ minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: '0.85rem', fontWeight: 650 }}>{weekOfLabel(summary.current_week.week_start, nowYear)} · in progress</span>
          <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
            {`${summary.current_week.pending_sessions > 0 ? `${summary.current_week.pending_sessions} session${summary.current_week.pending_sessions === 1 ? '' : 's'} pending approval · ` : ''}updates as hours approve`}
          </span>
        </span>
        <span style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
          <span style={{ display: 'block', fontSize: '1.2rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: balanceColor(position) }}>{signedMoney(position)}</span>
          <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: 650, color: 'var(--text-link)' }}>{words} · Open ›</span>
        </span>
      </Link>
    </DashboardGroupCard>
  )
}
