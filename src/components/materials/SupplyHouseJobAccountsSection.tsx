import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useJobDetailModal } from '../../contexts/JobDetailModalContext'
import { effectiveJobLedgerNumber } from '../../lib/ledgerDisplayPrefixes'
import { stripTrailingZip } from '../../lib/displayAddress'
import {
  groupJobAccountLedger,
  type JobAccountShareRow,
} from '../../lib/supplyHouseJobAccountsLedger'

type JobIdentity = { hcp_number: string | null; click_number: string | null; job_name: string | null; job_address: string | null }

const shortDate = (iso: string): string => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(2)}`
}

/**
 * Materials → Supply Houses "Job accounts" (v2.1606, mockup-approved): every
 * job shared with a supply house via Job Detail's share flow (v2.1605), one
 * row per job with contact chips and the last send. Collapsed by default so
 * the AP workflow stays untouched; rows come from supply_house_job_accounts
 * (written by the send edge function). Click a job → Job Detail (resend
 * lives there).
 */
export function SupplyHouseJobAccountsSection() {
  const jobDetailModal = useJobDetailModal()
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<JobAccountShareRow[]>([])
  const [jobsById, setJobsById] = useState<Map<string, JobIdentity>>(() => new Map())
  const [loaded, setLoaded] = useState(false)
  const [query, setQuery] = useState('')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const { data } = await supabase
        .from('supply_house_job_accounts')
        .select('job_id, contact_label, contact_email, sent_by_name, sent_at')
        .order('sent_at', { ascending: false })
        .limit(1000)
      if (cancelled) return
      const shareRows = (data ?? []) as JobAccountShareRow[]
      setRows(shareRows)
      const jobIds = Array.from(new Set(shareRows.map((r) => r.job_id)))
      if (jobIds.length > 0) {
        const { data: jobs } = await supabase
          .from('jobs_ledger')
          .select('id, hcp_number, click_number, job_name, job_address')
          .in('id', jobIds)
        if (cancelled) return
        setJobsById(new Map(((jobs ?? []) as Array<JobIdentity & { id: string }>).map((j) => [j.id, j])))
      }
      setLoaded(true)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const ledger = useMemo(() => groupJobAccountLedger(rows), [rows])
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return ledger
    return ledger.filter((l) => {
      const j = jobsById.get(l.jobId)
      const label = j ? `${effectiveJobLedgerNumber(j.hcp_number, j.click_number) ?? ''} ${j.job_name ?? ''} ${j.job_address ?? ''}` : ''
      return label.toLowerCase().includes(q) || l.contacts.some((c) => c.toLowerCase().includes(q))
    })
  }, [ledger, jobsById, query])

  // Nothing shared yet: stay invisible rather than advertising an empty ledger.
  if (loaded && ledger.length === 0) return null

  return (
    <section style={{ marginBottom: '2rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', borderTop: '1px solid var(--border)', borderBottom: open ? 'none' : '1px solid var(--border)', padding: '0.5rem 0' }}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', border: 'none', background: 'none', cursor: 'pointer', font: 'inherit', fontWeight: 600, padding: 0 }}
        >
          <span aria-hidden style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{open ? '▼' : '▶'}</span>
          Job accounts
        </button>
        <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          {loaded ? `${ledger.length} ${ledger.length === 1 ? 'job' : 'jobs'} shared with supply houses` : '…'}
        </span>
        {open ? (
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search jobs…"
            aria-label="Search job accounts"
            style={{ marginLeft: 'auto', padding: '0.3rem 0.6rem', border: '1px solid var(--border-strong)', borderRadius: 6, fontSize: '0.8125rem' }}
          />
        ) : null}
      </div>
      {open ? (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
              <th style={{ textAlign: 'left', padding: '0.4rem 0.5rem 0.4rem 0', fontWeight: 500 }}>Job</th>
              <th style={{ textAlign: 'left', padding: '0.4rem 0.5rem', fontWeight: 500 }}>Shared with</th>
              <th style={{ textAlign: 'right', padding: '0.4rem 0', fontWeight: 500, whiteSpace: 'nowrap' }}>Last sent</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((l) => {
              const j = jobsById.get(l.jobId)
              const label = j
                ? `${effectiveJobLedgerNumber(j.hcp_number, j.click_number) || '—'} · ${(j.job_name ?? '').trim() || '—'}`
                : l.jobId.slice(0, 8)
              return (
                <tr key={l.jobId} style={{ borderBottom: '1px solid var(--border)', verticalAlign: 'top' }}>
                  <td style={{ padding: '0.5rem 0.5rem 0.5rem 0' }}>
                    <button
                      type="button"
                      onClick={() => jobDetailModal?.openJobDetail({ jobId: l.jobId, prefillRowLabel: label })}
                      title="Open this job"
                      style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'var(--text-link)', textDecoration: 'underline dotted', textUnderlineOffset: '2px', cursor: 'pointer', textAlign: 'left' }}
                    >
                      {label}
                    </button>
                    {j?.job_address ? (
                      <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 2 }}>{stripTrailingZip(j.job_address)}</div>
                    ) : null}
                  </td>
                  <td style={{ padding: '0.5rem' }}>
                    <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 4 }}>
                      {l.contacts.map((c) => (
                        <span key={c} style={{ background: 'var(--bg-subtle)', borderRadius: 999, padding: '0.05rem 0.55rem', fontSize: '0.6875rem', whiteSpace: 'nowrap' }}>
                          {c}
                        </span>
                      ))}
                    </span>
                  </td>
                  <td style={{ padding: '0.5rem 0', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {shortDate(l.lastSentAt)}
                    {l.lastSentByName ? <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}> · {l.lastSentByName}</span> : null}
                  </td>
                </tr>
              )
            })}
            {shown.length === 0 ? (
              <tr>
                <td colSpan={3} style={{ padding: '0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                  No matches.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      ) : null}
    </section>
  )
}
