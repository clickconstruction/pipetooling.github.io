import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { withSupabaseRetry, formatErrorMessage } from '../../utils/errorHandling'

type CustomerRow = {
  id: string
  name: string
  address: string | null
}

/**
 * Dispatch Mode → Customers tab: searchable customer list with each customer's
 * assigned-job count (jobs_ledger.customer_id). Tapping a customer opens the
 * full Customers page focused on them (existing edit flow).
 */
export default function DispatchModeCustomers() {
  const navigate = useNavigate()
  const [customers, setCustomers] = useState<CustomerRow[]>([])
  const [jobCounts, setJobCounts] = useState<Map<string, number>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError(null)
      try {
        const [customersRaw, jobsRaw] = await Promise.all([
          withSupabaseRetry(
            async () =>
              supabase
                .from('customers')
                .select('id, name, address')
                .is('archived_at', null)
                .order('name', { ascending: true }),
            'dispatch mode customers',
          ),
          withSupabaseRetry(
            async () => supabase.from('jobs_ledger').select('customer_id'),
            'dispatch mode customer job counts',
          ),
        ])
        if (cancelled) return
        setCustomers(((customersRaw ?? []) as CustomerRow[]).filter((c) => c?.id))
        const counts = new Map<string, number>()
        for (const r of (jobsRaw ?? []) as Array<{ customer_id: string | null }>) {
          if (!r?.customer_id) continue
          counts.set(r.customer_id, (counts.get(r.customer_id) ?? 0) + 1)
        }
        setJobCounts(counts)
      } catch (e) {
        if (!cancelled) setError(formatErrorMessage(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return customers
    return customers.filter(
      (c) => c.name.toLowerCase().includes(q) || (c.address ?? '').toLowerCase().includes(q),
    )
  }, [customers, search])

  return (
    <div style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
      <h1 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-strong)', textAlign: 'center' }}>
        Customers
      </h1>
      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search customers…"
        aria-label="Search customers by name or address"
        style={{
          padding: '0.5rem 0.65rem',
          fontSize: '0.9375rem',
          border: '1px solid var(--border-strong)',
          borderRadius: 8,
        }}
      />
      {loading ? (
        <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>Loading customers…</p>
      ) : error ? (
        <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-red-700)' }}>{error}</p>
      ) : filtered.length === 0 ? (
        <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>No customers match.</p>
      ) : (
        <ul
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            border: '1px solid var(--border)',
            borderRadius: 10,
            overflow: 'hidden',
          }}
        >
          {filtered.map((c, idx) => {
            const count = jobCounts.get(c.id) ?? 0
            return (
              <li key={c.id} style={{ borderTop: idx === 0 ? 'none' : '1px solid var(--border)' }}>
                <button
                  type="button"
                  onClick={() => navigate('/customers', { state: { openEditCustomer: c.id } })}
                  aria-label={`Open customer ${c.name}, ${count} ${count === 1 ? 'job' : 'jobs'}`}
                  style={{
                    display: 'flex',
                    width: '100%',
                    alignItems: 'center',
                    gap: '0.6rem',
                    padding: '0.65rem 0.75rem',
                    border: 'none',
                    background: 'var(--surface)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    minWidth: 0,
                  }}
                >
                  <span style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span
                      style={{
                        fontSize: '0.9375rem',
                        fontWeight: 600,
                        color: 'var(--text-strong)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {c.name}
                    </span>
                    {c.address ? (
                      <span
                        style={{
                          fontSize: '0.8125rem',
                          color: 'var(--text-muted)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {c.address}
                      </span>
                    ) : null}
                  </span>
                  <span
                    style={{
                      flexShrink: 0,
                      fontSize: '0.8125rem',
                      fontWeight: 600,
                      color: count > 0 ? 'var(--text-blue-700)' : 'var(--text-faint)',
                      background: count > 0 ? 'var(--bg-blue-tint)' : 'var(--bg-subtle)',
                      borderRadius: 999,
                      padding: '0.15rem 0.55rem',
                    }}
                  >
                    {count} {count === 1 ? 'job' : 'jobs'}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
