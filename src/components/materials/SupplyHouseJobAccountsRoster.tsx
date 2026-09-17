import { useCallback, useEffect, useMemo, useState } from 'react'

import { supabase } from '../../lib/supabase'
import { useJobDetailModal } from '../../contexts/JobDetailModalContext'
import { effectiveJobLedgerNumber } from '../../lib/ledgerDisplayPrefixes'
import { formatCurrency } from '../../lib/format'
import {
  buildHouseJobAccountRoster,
  countHouseRoster,
  houseRosterSummary,
  jobAccountPolicyOf,
  openedViaPhrase,
  repDisplayName,
  type HouseRosterRow,
  type JobAccountRep,
  type JobSupplyHouseAccountRow,
  type RosterInvoiceInput,
} from '../../lib/materials/jobSupplyHouseAccounts'
import { MarkJobAccountOpenedModal } from './MarkJobAccountOpenedModal'
import { telHrefFor } from '../../lib/phoneContact'

type JobDetails = Record<string, { hcp_number: string; click_number?: string; job_name: string }>

const shortDate = (iso: string | null): string => {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(2)}`
}

const TEAL = '#0f766e'
const TEAL_SOFT = '#ccfbf1'

function kindChip(kind: HouseRosterRow['kind']) {
  const base = { display: 'inline-block', borderRadius: 5, padding: '0 0.4rem', fontSize: '0.6875rem', fontWeight: 600, lineHeight: '18px', whiteSpace: 'nowrap' as const }
  switch (kind) {
    case 'open': return <span style={{ ...base, background: TEAL_SOFT, color: TEAL }}>open</span>
    case 'requested': return <span style={{ ...base, background: 'var(--bg-purple-100, #efe8ff)', color: '#6027c4' }}>requested</span>
    case 'bought_no_account': return <span style={{ ...base, background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)' }}>bought, no account</span>
    case 'not_needed': return <span style={{ ...base, background: 'var(--bg-muted)', color: 'var(--text-muted)' }}>not needed</span>
  }
}

/**
 * Materials → Supply houses → a house's expanded card: the roster of its job
 * accounts (v2.3423). Every job with an account row, plus every job that
 * bought here (invoices allocated to it) with no account on record — the
 * amber rows are where the back-fill happens, one job at a time with the
 * facts beside it. Mark opened / Not needed open the shared sheet.
 *
 * Reads tolerate the pre-push window: a missing table or column reads as
 * "no accounts yet" rather than blanking the house.
 */
export function SupplyHouseJobAccountsRoster({
  house,
  invoices,
  jobDetails,
}: {
  house: { id: string; name: string; job_accounts?: string | null }
  invoices: RosterInvoiceInput[]
  jobDetails: JobDetails
}) {
  const jobDetailModal = useJobDetailModal()
  const [accounts, setAccounts] = useState<JobSupplyHouseAccountRow[]>([])
  const [reps, setReps] = useState<JobAccountRep[]>([])
  const [loaded, setLoaded] = useState(false)
  const [sheet, setSheet] = useState<{ jobId: string; existing: JobSupplyHouseAccountRow | null; mode: 'open' | 'not_needed' } | null>(null)

  const load = useCallback(async () => {
    const [accRes, repRes] = await Promise.all([
      supabase
        .from('job_supply_house_accounts')
        .select('id, job_id, supply_house_id, status, account_ref, opened_via, rep_contact_id, requested_by, requested_at, requested_from_counter, opened_by, opened_at, note')
        .eq('supply_house_id', house.id),
      supabase
        .from('supply_house_contacts')
        .select('id, name, email, phone, label, role, archived_at')
        .eq('supply_house_id', house.id)
        .eq('role', 'job_accounts')
        .is('archived_at', null),
    ])
    setAccounts(accRes.error ? [] : ((accRes.data ?? []) as JobSupplyHouseAccountRow[]))
    setReps(repRes.error ? [] : ((repRes.data ?? []) as JobAccountRep[]))
    setLoaded(true)
  }, [house.id])

  useEffect(() => {
    setLoaded(false)
    void load()
  }, [load])

  const rows = useMemo(() => buildHouseJobAccountRoster(house.id, accounts, invoices), [house.id, accounts, invoices])
  const counts = useMemo(() => countHouseRoster(rows), [rows])
  const policy = jobAccountPolicyOf(house)

  // v2.3430: an account row for a job with no invoices here has no entry in the
  // host's label map (built from allocations) — fetch those identities ourselves.
  const [extraJobs, setExtraJobs] = useState<JobDetails>({})
  const missingLabelIds = useMemo(
    () => rows.map((r) => r.jobId).filter((id) => !jobDetails[id] && !extraJobs[id]),
    [rows, jobDetails, extraJobs],
  )
  useEffect(() => {
    if (missingLabelIds.length === 0) return
    let cancelled = false
    void supabase
      .from('jobs_ledger')
      .select('id, hcp_number, click_number, job_name')
      .in('id', missingLabelIds)
      .then(({ data }) => {
        if (cancelled || !data) return
        setExtraJobs((prev) => {
          const next = { ...prev }
          for (const j of data as Array<{ id: string; hcp_number: string | null; click_number: string | null; job_name: string | null }>) {
            next[j.id] = { hcp_number: j.hcp_number ?? '', click_number: j.click_number ?? undefined, job_name: j.job_name ?? '' }
          }
          return next
        })
      })
    return () => {
      cancelled = true
    }
  }, [missingLabelIds])

  // A house that never opens job accounts stays quiet unless something was recorded anyway.
  if (policy === 'none' && rows.length === 0) return null

  const jobLabel = (jobId: string): string => {
    const d = jobDetails[jobId] ?? extraJobs[jobId]
    if (!d) return jobId.slice(0, 8)
    const num = effectiveJobLedgerNumber(d.hcp_number, d.click_number) || '—'
    return `${num} · ${(d.job_name ?? '').trim() || '—'}`
  }

  const smallBtn = (accent: boolean) => ({
    padding: '0.2rem 0.55rem',
    fontSize: '0.75rem',
    background: accent ? TEAL : 'var(--surface)',
    color: accent ? 'white' : 'var(--text-700)',
    border: `1px solid ${accent ? TEAL : 'var(--border-strong)'}`,
    borderRadius: 4,
    cursor: 'pointer',
    font: 'inherit',
    whiteSpace: 'nowrap' as const,
  })

  return (
    <section style={{ marginBottom: '1.5rem' }} data-job-accounts-roster={house.id}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
        <h3 style={{ margin: 0, fontSize: '1rem' }}>Job accounts</h3>
        <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{loaded ? houseRosterSummary(counts) : '…'}</span>
        {policy === 'expects' ? (
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>· {house.name} expects one per property</span>
        ) : policy === 'optional' ? (
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>· optional at this house</span>
        ) : null}
        {reps.length > 0 ? (
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
            Opens them: <strong style={{ color: 'var(--text-strong)' }}>{repDisplayName(reps[0]!)}</strong>
            {reps[0]!.phone ? <> · <a href={telHrefFor(reps[0]!.phone)} style={{ color: 'var(--text-link)' }}>{reps[0]!.phone}</a></> : null}
          </span>
        ) : loaded ? (
          <span style={{ fontSize: '0.75rem', color: 'var(--text-amber-800)', marginLeft: 'auto' }}>No job-accounts rep on file — Edit the house and give a contact the Job accounts role.</span>
        ) : null}
      </div>
      {loaded && rows.length === 0 ? (
        <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          No job accounts recorded at {house.name} yet, and no invoices allocated to a job here. Mark one opened from the job window, the PO code, or here once a job buys.
        </p>
      ) : (
        <div style={{ border: '1px solid var(--border)', borderRadius: 4, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead style={{ background: 'var(--bg-subtle)' }}>
              <tr>
                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Job</th>
                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Status</th>
                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Reference</th>
                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Opened</th>
                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>Invoices here</th>
                <th style={{ padding: '0.5rem 0.75rem' }}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const a = r.account
                const opened = a?.status === 'open'
                  ? `${shortDate(a.opened_at)} · ${openedViaPhrase(a.opened_via)}`
                  : a?.status === 'requested'
                    ? `asked ${shortDate(a.requested_at)}${a.requested_from_counter ? ' · from the counter' : ''}`
                    : a?.status === 'not_needed'
                      ? (a.note || '—')
                      : '—'
                return (
                  <tr key={r.jobId} style={{ borderTop: '1px solid var(--border)', background: r.kind === 'bought_no_account' ? 'var(--bg-amber-tint)' : undefined }}>
                    <td style={{ padding: '0.5rem 0.75rem' }}>
                      <button
                        type="button"
                        onClick={() => jobDetailModal?.openJobDetail({ jobId: r.jobId, prefillRowLabel: jobLabel(r.jobId) })}
                        title="Open this job"
                        style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'var(--text-link)', textDecoration: 'underline dotted', textUnderlineOffset: '2px', cursor: 'pointer', textAlign: 'left' }}
                      >
                        {jobLabel(r.jobId)}
                      </button>
                    </td>
                    <td style={{ padding: '0.5rem 0.75rem' }}>{kindChip(r.kind)}</td>
                    <td style={{ padding: '0.5rem 0.75rem', fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '0.8125rem' }}>{a?.account_ref || '—'}</td>
                    <td style={{ padding: '0.5rem 0.75rem', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>{opened}</td>
                    <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                      {r.invoiceCount > 0 ? (
                        <>
                          {r.invoiceCount} · ${formatCurrency(r.allocatedTotal)}
                          {r.unpaidTotal > 0 ? <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}> · ${formatCurrency(r.unpaidTotal)} unpaid</span> : null}
                        </>
                      ) : '—'}
                    </td>
                    <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {r.kind === 'open' ? (
                        <button type="button" onClick={() => setSheet({ jobId: r.jobId, existing: a, mode: 'open' })} style={smallBtn(false)}>Edit</button>
                      ) : (
                        <span style={{ display: 'inline-flex', gap: '0.35rem' }}>
                          <button type="button" onClick={() => setSheet({ jobId: r.jobId, existing: a, mode: 'open' })} style={smallBtn(true)}>Mark opened…</button>
                          {r.kind !== 'not_needed' ? (
                            <button type="button" onClick={() => setSheet({ jobId: r.jobId, existing: a, mode: 'not_needed' })} style={smallBtn(false)}>Not needed</button>
                          ) : null}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {sheet ? (
        <MarkJobAccountOpenedModal
          jobId={sheet.jobId}
          jobLabel={jobLabel(sheet.jobId)}
          house={house}
          existing={sheet.existing}
          reps={reps}
          initialMode={sheet.mode}
          onClose={() => setSheet(null)}
          onSaved={() => {
            setSheet(null)
            void load()
          }}
        />
      ) : null}
    </section>
  )
}
