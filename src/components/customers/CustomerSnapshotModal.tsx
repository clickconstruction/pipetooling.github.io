import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import type { Database } from '../../types/database'
import { useEditCustomerModal } from '../../contexts/EditCustomerModalContext'
import { useAuth } from '../../hooks/useAuth'
import { extractContactFromCustomer } from '../../lib/customerContactDisplay'
import { isPathAllowedForRole } from '../../lib/layoutRouteAccess'
import { formatErrorMessage, withRetry, withSupabaseRetry } from '../../utils/errorHandling'

type Customer = Database['public']['Tables']['customers']['Row']
type BidRow = Database['public']['Tables']['bids']['Row']
type GcBuilder = Database['public']['Tables']['bids_gc_builders']['Row']
type EstimateStatus = Database['public']['Enums']['estimate_status']
type EstimateSnapshotRow = Pick<
  Database['public']['Tables']['estimates']['Row'],
  'id' | 'estimate_number' | 'title' | 'status' | 'total_cents' | 'updated_at'
>

type Props = {
  open: boolean
  onClose: () => void
  /** Canonical customer row when the bid is linked to `customers`. */
  customerId: string | null
  /** Legacy GC row when there is no customer record. */
  gcBuilder: GcBuilder | null
}

function getBidStatus(bid: BidRow): string {
  if (!bid.bid_date_sent) return 'Unsent'
  if (bid.outcome === 'won') return 'Won'
  if (bid.outcome === 'lost') return 'Lost'
  if (bid.outcome === 'started_or_complete') return 'Started or Complete'
  return 'Pending'
}

function estimateSnapshotStatusLabel(s: EstimateStatus): string {
  switch (s) {
    case 'draft':
      return 'Draft'
    case 'sent':
      return 'Sent'
    case 'customer_accepted':
      return 'Accepted'
    case 'declined':
      return 'Declined'
    case 'superseded':
      return 'Superseded'
    default:
      return String(s)
  }
}

function formatUsdFromCents(cents: number): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(cents / 100)
}

export function CustomerSnapshotModal({ open, onClose, customerId, gcBuilder }: Props) {
  const editCustomerModal = useEditCustomerModal()
  const { role, estimatorProspectsAccess } = useAuth()
  const [refreshKey, setRefreshKey] = useState(0)
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [loadingCustomer, setLoadingCustomer] = useState(false)
  const [counts, setCounts] = useState<{ projects: number; jobs: number; bids: number; estimates: number } | null>(null)
  const [bids, setBids] = useState<BidRow[] | null>(null)
  const [loadingBids, setLoadingBids] = useState(false)
  const [estimates, setEstimates] = useState<EstimateSnapshotRow[] | null>(null)
  const [loadingEstimates, setLoadingEstimates] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setCustomer(null)
      setCounts(null)
      setBids(null)
      setEstimates(null)
      setError(null)
      setLoadingCustomer(false)
      setLoadingBids(false)
      setLoadingEstimates(false)
      setRefreshKey(0)
      return
    }

    if (!customerId) {
      setCustomer(null)
      setCounts(null)
      setBids(null)
      setEstimates(null)
      return
    }

    let cancelled = false
    ;(async () => {
      setLoadingCustomer(true)
      setError(null)
      try {
        const row = await withSupabaseRetry(
          async () => supabase.from('customers').select('*').eq('id', customerId).maybeSingle(),
          'customer snapshot',
        )
        if (cancelled) return
        setCustomer(row)

        const [pc, jc, bc, ec] = await Promise.all([
          withRetry(async () => {
            const r = await supabase.from('projects').select('id', { count: 'exact', head: true }).eq('customer_id', customerId)
            if (r.error) throw new Error(r.error.message)
            return r.count ?? 0
          }),
          withRetry(async () => {
            const r = await supabase
              .from('jobs_ledger')
              .select('id', { count: 'exact', head: true })
              .eq('customer_id', customerId)
            if (r.error) throw new Error(r.error.message)
            return r.count ?? 0
          }),
          withRetry(async () => {
            const r = await supabase.from('bids').select('id', { count: 'exact', head: true }).eq('customer_id', customerId)
            if (r.error) throw new Error(r.error.message)
            return r.count ?? 0
          }),
          withRetry(async () => {
            const r = await supabase.from('estimates').select('id', { count: 'exact', head: true }).eq('customer_id', customerId)
            if (r.error) throw new Error(r.error.message)
            return r.count ?? 0
          }),
        ])
        if (cancelled) return
        setCounts({ projects: pc, jobs: jc, bids: bc, estimates: ec })
      } catch (e: unknown) {
        if (!cancelled) setError(formatErrorMessage(e, 'Failed to load customer'))
      } finally {
        if (!cancelled) setLoadingCustomer(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [open, customerId, refreshKey])

  useEffect(() => {
    if (!open || !customerId) return
    let cancelled = false
    ;(async () => {
      setLoadingBids(true)
      try {
        const data = await withSupabaseRetry(
          async () =>
            supabase
              .from('bids')
              .select('*')
              .eq('customer_id', customerId)
              .order('created_at', { ascending: false })
              .limit(100),
          'customer snapshot bids',
        )
        if (cancelled) return
        setBids((data as BidRow[] | null) ?? [])
      } catch {
        if (!cancelled) setBids([])
      } finally {
        if (!cancelled) setLoadingBids(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, customerId, refreshKey])

  useEffect(() => {
    if (!open || !customerId) return
    let cancelled = false
    ;(async () => {
      setLoadingEstimates(true)
      try {
        const data = await withSupabaseRetry(
          async () =>
            supabase
              .from('estimates')
              .select('id, estimate_number, title, status, total_cents, updated_at')
              .eq('customer_id', customerId)
              .order('updated_at', { ascending: false })
              .limit(100),
          'customer snapshot estimates',
        )
        if (cancelled) return
        setEstimates((data as EstimateSnapshotRow[] | null) ?? [])
      } catch {
        if (!cancelled) setEstimates([])
      } finally {
        if (!cancelled) setLoadingEstimates(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, customerId, refreshKey])

  if (!open) return null

  const overlayStyle: CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1100,
    padding: '1rem',
    boxSizing: 'border-box',
  }

  const panelStyle: CSSProperties = {
    background: 'var(--surface)',
    borderRadius: 8,
    padding: '1.25rem 1.5rem',
    maxWidth: 720,
    width: '100%',
    maxHeight: '90vh',
    overflow: 'auto',
    boxSizing: 'border-box',
    boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
  }

  if (customerId) {
    const { phone, email } = customer ? extractContactFromCustomer(customer) : { phone: '', email: '' }
    const c = counts ?? { projects: 0, jobs: 0, bids: 0, estimates: 0 }
    const showProjects = isPathAllowedForRole(role, '/projects', estimatorProspectsAccess)
    const showJobs = isPathAllowedForRole(role, '/jobs', estimatorProspectsAccess)
    const showEstimates = isPathAllowedForRole(role, '/estimates', estimatorProspectsAccess)
    const showCustomers = isPathAllowedForRole(role, '/customers', estimatorProspectsAccess)
    const navLinks: ReactNode[] = []
    if (showProjects) {
      navLinks.push(
        <Link
          key="projects"
          to={`/projects?customer=${customerId}`}
          onClick={onClose}
          style={{ color: 'var(--text-link)', fontWeight: 500 }}
        >
          Projects ({c.projects})
        </Link>,
      )
    }
    if (showJobs) {
      navLinks.push(
        <Link key="jobs" to={`/jobs?customer=${customerId}`} onClick={onClose} style={{ color: 'var(--text-link)', fontWeight: 500 }}>
          Jobs ({c.jobs})
        </Link>,
      )
    }
    if (showEstimates) {
      navLinks.push(
        <Link
          key="estimates"
          to={`/estimates?customer=${customerId}`}
          onClick={onClose}
          style={{ color: 'var(--text-link)', fontWeight: 500 }}
        >
          Estimates ({c.estimates})
        </Link>,
      )
    }
    if (showCustomers) {
      navLinks.push(
        <Link key="customers" to="/customers" onClick={onClose} style={{ color: 'var(--text-link)', fontWeight: 500 }}>
          Customers page
        </Link>,
      )
    }

    return (
      <div style={overlayStyle} role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
        <div role="dialog" aria-modal="true" aria-labelledby="customer-snapshot-title" style={panelStyle} onMouseDown={(e) => e.stopPropagation()}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '1rem' }}>
            <h2 id="customer-snapshot-title" style={{ margin: 0, fontSize: '1.15rem' }}>
              {loadingCustomer ? 'Loading…' : customer?.name?.trim() || 'Customer'}
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
              {editCustomerModal ? (
                <button
                  type="button"
                  onClick={() =>
                    editCustomerModal.openEditCustomerModal(customerId, {
                      onSaved: () => setRefreshKey((k) => k + 1),
                      onDeleted: () => onClose(),
                      onMerged: ({ removedId }) => {
                        if (removedId === customerId) onClose()
                      },
                    })
                  }
                  style={{
                    padding: '0.35rem 0.65rem',
                    background: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: 4,
                    cursor: 'pointer',
                    fontWeight: 500,
                  }}
                >
                  Edit customer
                </button>
              ) : null}
              <button
                type="button"
                onClick={onClose}
                style={{ padding: '0.35rem 0.65rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }}
              >
                Close
              </button>
            </div>
          </div>

          {error ? <div style={{ padding: '0.75rem', background: 'var(--bg-red-100)', color: 'var(--text-red-800)', borderRadius: 4, marginBottom: '1rem' }}>{error}</div> : null}

          {customer ? (
            <>
              {customer.address?.trim() ? (
                <div style={{ fontSize: '0.875rem', color: 'var(--text-700)', marginBottom: '0.5rem' }}>{customer.address}</div>
              ) : null}
              <div style={{ fontSize: '0.875rem', color: 'var(--text-700)', marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                {phone.trim() ? <div>Phone: {phone}</div> : null}
                {email.trim() ? <div>Email: {email}</div> : null}
                {!phone.trim() && !email.trim() ? <div style={{ color: 'var(--text-muted)' }}>No phone or email on file</div> : null}
              </div>

              {navLinks.length > 0 ? (
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '0.75rem',
                    alignItems: 'center',
                    marginBottom: '1rem',
                  }}
                >
                  {navLinks.flatMap((el, i) =>
                    i === 0 ? [el] : [<span key={`sep-${i}`} style={{ color: 'var(--text-faint-300)' }}>|</span>, el],
                  )}
                </div>
              ) : null}

              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Estimates ({c.estimates})</div>
              {loadingEstimates ? (
                <p style={{ margin: '0 0 1rem', color: 'var(--text-muted)' }}>Loading estimates…</p>
              ) : !estimates || estimates.length === 0 ? (
                <p style={{ margin: '0 0 1rem', color: 'var(--text-muted)' }}>No estimates for this customer.</p>
              ) : (
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: '0.8125rem',
                    marginBottom: '1rem',
                  }}
                >
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border)' }}>
                      <th style={{ textAlign: 'left', padding: '0.5rem' }}>#</th>
                      <th style={{ textAlign: 'left', padding: '0.5rem' }}>Title</th>
                      <th style={{ textAlign: 'left', padding: '0.5rem' }}>Status</th>
                      <th style={{ textAlign: 'right', padding: '0.5rem' }}>Total</th>
                      <th style={{ textAlign: 'left', padding: '0.5rem' }}>Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {estimates.map((est) => (
                      <tr key={est.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '0.5rem', fontVariantNumeric: 'tabular-nums' }}>
                          <Link
                            to={`/estimates/${est.estimate_number}`}
                            onClick={onClose}
                            style={{ color: 'var(--text-link)', fontWeight: 500 }}
                          >
                            {est.estimate_number}
                          </Link>
                        </td>
                        <td style={{ padding: '0.5rem', minWidth: 0, maxWidth: 220 }}>
                          <Link
                            to={`/estimates/${est.estimate_number}`}
                            onClick={onClose}
                            style={{ color: 'var(--text-strong)', wordBreak: 'break-word' }}
                          >
                            {est.title?.trim() || '—'}
                          </Link>
                        </td>
                        <td style={{ padding: '0.5rem', whiteSpace: 'nowrap' }}>{estimateSnapshotStatusLabel(est.status)}</td>
                        <td style={{ padding: '0.5rem', textAlign: 'right' }}>{formatUsdFromCents(est.total_cents)}</td>
                        <td style={{ padding: '0.5rem', color: 'var(--text-muted)' }}>
                          {est.updated_at ? String(est.updated_at).slice(0, 10) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Bids ({c.bids})</div>
              {loadingBids ? (
                <p style={{ margin: 0, color: 'var(--text-muted)' }}>Loading bids…</p>
              ) : !bids || bids.length === 0 ? (
                <p style={{ margin: 0, color: 'var(--text-muted)' }}>No bids for this customer.</p>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border)' }}>
                      <th style={{ textAlign: 'left', padding: '0.5rem' }}>Project</th>
                      <th style={{ textAlign: 'left', padding: '0.5rem' }}>Status</th>
                      <th style={{ textAlign: 'left', padding: '0.5rem' }}>Due</th>
                      <th style={{ textAlign: 'right', padding: '0.5rem' }}>Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bids.map((bid) => (
                      <tr key={bid.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '0.5rem' }}>{bid.project_name || '—'}</td>
                        <td style={{ padding: '0.5rem' }}>{getBidStatus(bid)}</td>
                        <td style={{ padding: '0.5rem' }}>
                          {bid.bid_due_date ? String(bid.bid_due_date).slice(0, 10) : '—'}
                        </td>
                        <td style={{ padding: '0.5rem', textAlign: 'right' }}>
                          {bid.bid_value != null
                            ? new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(bid.bid_value)
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          ) : !loadingCustomer ? (
            <p style={{ color: 'var(--text-muted)' }}>Customer not found.</p>
          ) : null}
        </div>
      </div>
    )
  }

  if (gcBuilder) {
    return (
      <div style={overlayStyle} role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
        <div role="dialog" aria-modal="true" aria-labelledby="gc-builder-snapshot-title" style={panelStyle} onMouseDown={(e) => e.stopPropagation()}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '1rem' }}>
            <h2 id="gc-builder-snapshot-title" style={{ margin: 0, fontSize: '1.15rem' }}>
              {gcBuilder.name}
            </h2>
            <button
              type="button"
              onClick={onClose}
              style={{ padding: '0.35rem 0.65rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }}
            >
              Close
            </button>
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: 0, marginBottom: '1rem' }}>
            This builder is stored on the bid only (not linked to a company customer). Projects and jobs are tied to customer
            records, so there is no account-wide list here.
          </p>
          {gcBuilder.address?.trim() ? (
            <div style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>{gcBuilder.address}</div>
          ) : null}
          {gcBuilder.contact_number?.trim() ? (
            <div style={{ fontSize: '0.875rem', marginBottom: '0.35rem' }}>Phone: {gcBuilder.contact_number}</div>
          ) : null}
          {gcBuilder.email?.trim() ? <div style={{ fontSize: '0.875rem' }}>Email: {gcBuilder.email}</div> : null}
          {gcBuilder.notes?.trim() ? (
            <div style={{ marginTop: '1rem', fontSize: '0.875rem', whiteSpace: 'pre-wrap' }}>{gcBuilder.notes}</div>
          ) : null}
        </div>
      </div>
    )
  }

  return null
}
