import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { telHrefFor } from '../../lib/phoneContact'
import { effectiveJobLedgerNumber } from '../../lib/ledgerDisplayPrefixes'
import { useJobDetailModal } from '../../contexts/JobDetailModalContext'
import {
  PHONE_AZ_PAGE,
  azPhoneCustomers,
  matchPhoneCustomers,
  owingPhoneCustomers,
  phoneCustomerSubline,
  phoneJobSearchFilter,
  recentPhoneCustomers,
  type PhoneCustomer,
} from '../../lib/customers/customerPhoneSearch'

/**
 * Customers on a phone (v2.3886, punch list #30 PR 5a): the page is the
 * search. The box is first and stays put; matches are rows with Call and
 * Email at the thumb; jobs match too. Before anything is typed: Recent
 * (recently active), Owes, and Everyone A–Z behind a chip, fifty at a time.
 * The desktop page is not this component and is unchanged.
 */

type Lens = 'recent' | 'owes' | 'az'

type JobHit = { id: string; hcp_number: string | null; click_number: string | null; job_name: string | null; job_address: string | null; customer_id: string | null; status: string | null }

const JOB_HIT_LIMIT = 8
const JOB_SEARCH_DEBOUNCE_MS = 300

const iconBtn: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 40,
  height: 40,
  borderRadius: 8,
  border: '1px solid var(--border-strong)',
  background: 'var(--surface)',
  color: 'var(--text-link)',
  textDecoration: 'none',
  fontSize: '1rem',
  flexShrink: 0,
}

const groupLabel: CSSProperties = { margin: '0.75rem 0 0.3rem', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }

export function CustomersPhoneView({
  customers,
  detailsLoading,
  moneyHidden,
  todayYmd,
  onAddCustomer,
}: {
  customers: ReadonlyArray<PhoneCustomer>
  /** The counts and money behind the rows are still on their way; the names are already here. */
  detailsLoading: boolean
  moneyHidden: boolean
  todayYmd: string
  onAddCustomer: () => void
}) {
  const navigate = useNavigate()
  const jobDetailModal = useJobDetailModal()
  const [query, setQuery] = useState('')
  const [lens, setLens] = useState<Lens>('recent')
  const [azShown, setAzShown] = useState(PHONE_AZ_PAGE)
  const [jobHits, setJobHits] = useState<JobHit[]>([])

  const searching = query.trim() !== ''
  const matches = useMemo(() => matchPhoneCustomers(customers, query), [customers, query])
  const recent = useMemo(() => recentPhoneCustomers(customers), [customers])
  const owing = useMemo(() => owingPhoneCustomers(customers), [customers])
  const az = useMemo(() => azPhoneCustomers(customers, azShown), [customers, azShown])
  const nameById = useMemo(() => new Map(customers.map((c) => [c.id, c.name])), [customers])

  // The job half of the search: one small read, after the typing settles.
  const jobFilter = phoneJobSearchFilter(query)
  useEffect(() => {
    if (!jobFilter) {
      setJobHits([])
      return
    }
    let cancelled = false
    const t = setTimeout(() => {
      void (async () => {
        try {
          const { data } = await supabase.from('jobs_ledger').select('id, hcp_number, click_number, job_name, job_address, customer_id, status').or(jobFilter).order('created_at', { ascending: false }).limit(JOB_HIT_LIMIT)
          if (!cancelled) setJobHits((data ?? []) as JobHit[])
        } catch {
          if (!cancelled) setJobHits([])
        }
      })()
    }, JOB_SEARCH_DEBOUNCE_MS)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [jobFilter])

  const formatMoney = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`

  const row = (c: PhoneCustomer) => (
    <li key={c.id} data-phone-customer={c.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.55rem 0.75rem', borderBottom: '1px solid var(--border)', opacity: c.archived ? 0.7 : 1 }}>
      <button
        type="button"
        onClick={() => navigate(`/customers/${c.id}`)}
        style={{ flex: 1, minWidth: 0, minHeight: 44, display: 'grid', gap: '0.1rem', textAlign: 'left', padding: 0, border: 'none', background: 'none', color: 'inherit', font: 'inherit', cursor: 'pointer' }}
      >
        <strong style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name || 'Unnamed customer'}</strong>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {phoneCustomerSubline(c, { todayYmd, moneyHidden, formatMoney }) || (detailsLoading ? '…' : 'nothing on record yet')}
        </span>
      </button>
      {c.phone.trim() ? (
        <a href={telHrefFor(c.phone)} aria-label={`Call ${c.name}`} title={c.phone} style={iconBtn}>
          ☎
        </a>
      ) : null}
      {c.email.trim() ? (
        <a href={`mailto:${c.email.trim()}`} aria-label={`Email ${c.name}`} title={c.email} style={iconBtn}>
          ✉
        </a>
      ) : null}
    </li>
  )

  const list = (rows: ReadonlyArray<PhoneCustomer>) => (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>{rows.map(row)}</ul>
  )

  const chip = (key: Lens, label: string, dashed = false) => {
    const active = lens === key
    return (
      <button
        key={key}
        type="button"
        data-phone-customers-lens={key}
        aria-pressed={active}
        onClick={() => setLens(key)}
        style={{ minHeight: 36, padding: '0 0.8rem', borderRadius: 999, border: `1px ${dashed && !active ? 'dashed' : 'solid'} ${active ? 'var(--border-blue)' : 'var(--border-strong)'}`, background: active ? 'var(--bg-blue-tint)' : 'var(--surface)', color: active ? 'var(--text-blue-700)' : 'var(--text-700)', font: 'inherit', fontSize: '0.875rem', fontWeight: active ? 700 : 500, cursor: 'pointer' }}
      >
        {label}
      </button>
    )
  }

  const empty = (words: string) => <p style={{ margin: '0.75rem 0', color: 'var(--text-muted)', fontSize: '0.875rem' }}>{words}</p>

  return (
    <div data-customers-phone>
      <div style={{ position: 'sticky', top: 0, zIndex: 5, background: 'var(--bg-page)', padding: '0.35rem 0 0.5rem', display: 'grid', gap: '0.5rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Name, address, phone or job…"
            aria-label="Search customers and jobs"
            autoFocus
            style={{ flex: 1, minWidth: 0, minHeight: 44, padding: '0 0.75rem', fontSize: '1rem', border: '1px solid var(--border-strong)', borderRadius: 10, background: 'var(--surface)', color: 'var(--text)', boxSizing: 'border-box' }}
          />
          <button type="button" onClick={onAddCustomer} aria-label="Add customer" title="Add customer" style={{ ...iconBtn, width: 44, height: 44, fontSize: '1.25rem', fontWeight: 700 }}>
            +
          </button>
        </div>
        {searching ? null : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            {chip('recent', 'Recent')}
            {moneyHidden ? null : chip('owes', `Owes${detailsLoading ? '' : ` ${owing.length}`}`)}
            {chip('az', `Everyone A–Z · ${az.total}`, true)}
          </div>
        )}
      </div>

      {searching ? (
        <>
          <p data-phone-customers-count style={{ margin: '0 0 0.4rem', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
            {matches.length} {matches.length === 1 ? 'customer' : 'customers'}
            {jobHits.length ? ` · ${jobHits.length} ${jobHits.length === 1 ? 'job' : 'jobs'}` : ''}
          </p>
          {matches.length ? list(matches) : jobHits.length ? null : empty('Nobody matches. Check the spelling, or add them with +.')}
          {jobHits.length ? (
            <>
              <p style={groupLabel}>Jobs</p>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                {jobHits.map((j) => {
                  const number = effectiveJobLedgerNumber(j.hcp_number ?? '', j.click_number) || '—'
                  const who = j.customer_id ? nameById.get(j.customer_id) ?? '' : ''
                  return (
                    <li key={j.id} data-phone-job={j.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <button
                        type="button"
                        onClick={() => jobDetailModal?.openJobDetail({ jobId: j.id })}
                        style={{ width: '100%', minHeight: 48, display: 'grid', gap: '0.1rem', textAlign: 'left', padding: '0.5rem 0.75rem', border: 'none', background: 'none', color: 'inherit', font: 'inherit', cursor: 'pointer' }}
                      >
                        <strong style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {number}
                          {(j.job_name ?? '').trim() ? ` · ${(j.job_name ?? '').trim()}` : ''}
                        </strong>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{[who, (j.job_address ?? '').trim(), (j.status ?? '').replace(/_/g, ' ')].filter(Boolean).join(' · ')}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </>
          ) : null}
        </>
      ) : lens === 'recent' ? (
        recent.length ? list(recent) : empty(detailsLoading ? 'Reading who was active…' : 'Nobody has been active yet. Everyone A–Z lists every customer.')
      ) : lens === 'owes' ? (
        owing.length ? list(owing) : empty(detailsLoading ? 'Reading the balances…' : 'Nobody owes anything.')
      ) : (
        <>
          {az.rows.length ? list(az.rows) : empty('No customers yet.')}
          {az.more ? (
            <button type="button" data-phone-customers-more onClick={() => setAzShown((n) => n + PHONE_AZ_PAGE)} style={{ width: '100%', minHeight: 44, marginTop: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 10, background: 'var(--surface)', color: 'var(--text-link)', font: 'inherit', fontWeight: 600, cursor: 'pointer' }}>
              Show {Math.min(PHONE_AZ_PAGE, az.total - az.rows.length)} more · {az.rows.length} of {az.total}
            </button>
          ) : null}
        </>
      )}
    </div>
  )
}
