import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { withSupabaseRetry } from '../utils/errorHandling'
import type { Database } from '../types/database'

type MercuryTxRow = Database['public']['Tables']['mercury_transactions']['Row']

function formatCurrency(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}

export default function Banking() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [myRole, setMyRole] = useState<'dev' | 'master_technician' | 'assistant' | 'estimator' | 'primary' | 'superintendent' | 'subcontractor' | null>(
    null,
  )
  const [rows, setRows] = useState<MercuryTxRow[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [accountFilter, setAccountFilter] = useState<string>('')
  const [kindFilter, setKindFilter] = useState<string>('')

  useEffect(() => {
    if (!user?.id) return
    supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()
      .then(({ data }) => setMyRole((data?.role as typeof myRole) ?? null))
  }, [user?.id])

  useEffect(() => {
    if (myRole && myRole !== 'dev') {
      navigate('/dashboard', { replace: true })
    }
  }, [myRole, navigate])

  const loadRows = useCallback(async () => {
    if (myRole !== 'dev') return
    setError(null)
    setLoading(true)
    try {
      const data = await withSupabaseRetry(async () => {
        return supabase
          .from('mercury_transactions')
          .select('*')
          .order('posted_at', { ascending: false, nullsFirst: false })
          .limit(5000)
      }, 'load mercury_transactions')
      setRows((data as MercuryTxRow[]) ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load transactions')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [myRole])

  useEffect(() => {
    if (myRole === 'dev') void loadRows()
  }, [myRole, loadRows])

  const accountOptions = useMemo(() => {
    const set = new Set<string>()
    for (const r of rows) set.add(r.mercury_account_id)
    return Array.from(set).sort()
  }, [rows])

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (accountFilter && r.mercury_account_id !== accountFilter) return false
      if (kindFilter && r.kind !== kindFilter) return false
      return true
    })
  }, [rows, accountFilter, kindFilter])

  const kindOptions = useMemo(() => {
    const set = new Set<string>()
    for (const r of rows) set.add(r.kind)
    return Array.from(set).sort()
  }, [rows])

  const totalAmount = useMemo(() => filtered.reduce((s, r) => s + Number(r.amount), 0), [filtered])

  async function handleSync() {
    setSyncing(true)
    setError(null)
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('sync-mercury-transactions', {
        body: { lookback_days: 90 },
      })
      if (fnErr) {
        setError(fnErr.message)
        return
      }
      const body = data as { error?: string; upserted?: number } | null
      if (body && typeof body.error === 'string') {
        setError(body.error)
        return
      }
      await loadRows()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  if (myRole !== 'dev' && myRole !== null) {
    return null
  }

  if (myRole !== 'dev') {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading…</div>
  }

  return (
    <div style={{ padding: '2rem', maxWidth: 1200 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0, flex: '1 1 auto' }}>Banking</h1>
        <button
          type="button"
          onClick={() => void handleSync()}
          disabled={syncing}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: 4,
            border: '1px solid #1d4ed8',
            background: '#2563eb',
            color: 'white',
            cursor: syncing ? 'wait' : 'pointer',
          }}
        >
          {syncing ? 'Syncing from Mercury…' : 'Refresh from Mercury'}
        </button>
        <button
          type="button"
          onClick={() => void loadRows()}
          disabled={loading}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: 4,
            border: '1px solid #d1d5db',
            background: 'white',
            cursor: loading ? 'wait' : 'pointer',
          }}
        >
          Reload table
        </button>
      </div>

      <p style={{ color: '#4b5563', marginBottom: '1rem', maxWidth: 720 }}>
        Dev-only ledger of Mercury transactions. Data is stored in <code>mercury_transactions</code> (RLS: devs). Configure{' '}
        <code>MERCURY_API_KEY</code> and deploy <code>sync-mercury-transactions</code>; optional <code>mercury-webhook</code> for live
        updates — see <strong>EDGE_FUNCTIONS.md</strong>.
      </p>

      {error && (
        <div
          style={{
            marginBottom: '1rem',
            padding: '0.75rem 1rem',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: 4,
            color: '#991b1b',
          }}
        >
          {error}
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem', alignItems: 'center' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>Account ID</span>
          <select
            value={accountFilter}
            onChange={(e) => setAccountFilter(e.target.value)}
            style={{ minWidth: 280, padding: '6px 8px' }}
          >
            <option value="">All accounts</option>
            {accountOptions.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>Kind</span>
          <select value={kindFilter} onChange={(e) => setKindFilter(e.target.value)} style={{ minWidth: 200, padding: '6px 8px' }}>
            <option value="">All kinds</option>
            {kindOptions.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </label>
        <div style={{ marginLeft: 'auto', fontWeight: 600 }}>
          Filtered total: {formatCurrency(totalAmount)} ({filtered.length} of {rows.length} loaded)
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '2rem' }}>Loading…</div>
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 4 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ background: '#f9fafb', textAlign: 'left' }}>
                <th style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid #e5e7eb' }}>Posted</th>
                <th style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid #e5e7eb' }}>Amount</th>
                <th style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid #e5e7eb' }}>Status</th>
                <th style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid #e5e7eb' }}>Kind</th>
                <th style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid #e5e7eb' }}>Counterparty</th>
                <th style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid #e5e7eb' }}>Note</th>
                <th style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid #e5e7eb' }}>Account</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid #f3f4f6' }}>{formatDate(r.posted_at)}</td>
                  <td style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid #f3f4f6' }}>{formatCurrency(Number(r.amount))}</td>
                  <td style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid #f3f4f6' }}>{r.status}</td>
                  <td style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid #f3f4f6' }}>{r.kind}</td>
                  <td style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid #f3f4f6' }}>{r.counterparty_name ?? '—'}</td>
                  <td style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid #f3f4f6', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {r.note ?? '—'}
                  </td>
                  <td style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid #f3f4f6', fontFamily: 'monospace', fontSize: '0.8rem' }}>
                    {r.mercury_account_id.slice(0, 8)}…
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <div style={{ padding: '1.5rem', color: '#6b7280' }}>No rows yet. Run Refresh from Mercury.</div>}
        </div>
      )}
    </div>
  )
}
