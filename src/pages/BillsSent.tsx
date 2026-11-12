/**
 * Bills sent, the page (punch list #327, PR 1): `/bills-sent`. The master asked for one place, open at any time, that
 * says which bills have gone out, to whom, and when exactly. The address is the door: it can be bookmarked or put on
 * a phone's home screen. The list is `components/billing/BillsSentLedger.tsx`; the rules are `lib/billing/billsSent.ts`.
 *
 * The gate is the one the sent copies themselves have (`canOpenBillsSent`: dev, master, assistant, controller), since
 * every line is a sent copy. Anyone else lands on the Dashboard once their role is known (`pageGate`).
 */
import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { pageGate } from '../lib/roleGate'
import { canOpenBillsSent } from '../lib/billing/billsSent'
import { BillsSentLedger } from '../components/billing/BillsSentLedger'

export default function BillsSent() {
  const { user, role, loading } = useAuth()
  const gate = pageGate({ loading, user, role }, (r) => canOpenBillsSent(r))
  if (gate === 'wait') return null
  if (gate === 'away') return <Navigate to="/dashboard" replace />
  return (
    <div style={{ padding: '0.35rem 1.25rem 1.5rem', maxWidth: 1000, margin: '0 auto', width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
      <h1 style={{ margin: '0.25rem 0 0.1rem', fontSize: '1.25rem', color: 'var(--text-strong)' }}>Bills sent</h1>
      <p style={{ margin: '0 0 0.75rem', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>Every bill that left, who it went to, and the minute it went. Newest first.</p>
      <BillsSentLedger />
    </div>
  )
}
