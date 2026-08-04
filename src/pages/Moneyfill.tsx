import { Navigate } from 'react-router-dom'
import { QuickfillNoncardAttributionSection } from '../components/quickfill/QuickfillNoncardAttributionSection'
import { useAuth } from '../hooks/useAuth'
import { useQuickfillNoncardAttribution } from '../hooks/useQuickfillNoncardAttribution'

/**
 * Moneyfill — the controller/dev counterpart to Quickfill: financial queues
 * worked to zero. First (and currently only) section is "Bank transfers
 * needing attribution", moved here from Quickfill so assistants' daily loop
 * never surfaces org-level spending.
 *
 * Page visibility is role-gated (dev + controller); the section body stays
 * capability-probed like it was on Quickfill — the count RPC only succeeds for
 * dev or `banking_attributors` grant holders, so a controller without the
 * grant sees an explanatory note instead of the queue.
 */
export default function Moneyfill() {
  const { role } = useAuth()
  const noncard = useQuickfillNoncardAttribution()

  if (role != null && role !== 'dev' && role !== 'controller') {
    return <Navigate to="/dashboard" replace />
  }
  if (role == null) return null

  return (
    <div style={{ padding: '1.5rem', maxWidth: 1200, margin: '0 auto', width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '1.5rem', textAlign: 'center' }}>Moneyfill</h1>
      <section
        aria-label="Bank transfers needing attribution"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: '1rem 1.25rem',
        }}
      >
        <h2 style={{ fontSize: '1.125rem', fontWeight: 600, margin: '0 0 0.75rem' }}>
          Bank transfers needing attribution
        </h2>
        {noncard.eligible ? (
          <QuickfillNoncardAttributionSection rows={noncard.rows} loading={noncard.loading} refetch={noncard.refetch} />
        ) : noncard.loading ? (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading…</div>
        ) : (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            This queue needs the banking-attribution grant. Ask a dev to add you to it, then reload.
          </div>
        )}
      </section>
    </div>
  )
}
