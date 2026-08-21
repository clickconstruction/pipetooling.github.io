import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useJobFormModal } from '../../contexts/JobFormModalContext'
import { buildServiceTypeTradePill } from '../../lib/serviceTypeTradePill'
import {
  isConfirmedForPartner,
  parseReviewQueue,
  shareOfHours,
  sortReviewRows,
  type PartnerJobReviewQueue,
} from '../../lib/partnerLedger/jobReviewQueue'

/**
 * Partnerships → Job review tab (PARTNERSHIPS_PLAN.md PR 2): the gate.
 *
 * Jobs the partner clocked approved hours on queue here. The hours share is a
 * suggestion; the toggle is the dev's §3 "majority of the work" decision,
 * stamped who/when via set_job_partner_majority. Until a job is toggled on,
 * the partner's app shows nothing about it; toggling off hides it again but
 * never touches ledger postings.
 *
 * Fail-soft: if the PR 2 migration isn't pushed yet the RPC is missing — the
 * tab shows a "run db push" note instead of erroring.
 */

export function PartnershipJobReviewTab({
  partnershipId,
  partnerName,
}: {
  partnershipId: string
  partnerName: string
}) {
  const [queue, setQueue] = useState<PartnerJobReviewQueue | null>(null)
  const [rpcMissing, setRpcMissing] = useState(false)
  const [busyJobId, setBusyJobId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [tradeByJobId, setTradeByJobId] = useState<Record<string, string>>({})
  const jobFormModal = useJobFormModal()

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('get_partner_job_review_queue', {
      p_partnership_id: partnershipId,
    })
    if (error) {
      setRpcMissing(true)
      setQueue(null)
      return
    }
    setRpcMissing(false)
    const parsed = parseReviewQueue(data)
    setQueue(parsed)
    // Trade pills (PLUM / ELEC) beside the job number — the queue RPC doesn't
    // carry service types, so resolve them office-side. Fail-soft: no map, no
    // pill, the row falls back to the plain #number.
    const ids = (parsed?.rows ?? []).map((r) => r.job_id)
    if (ids.length > 0) {
      const stRes = await supabase.from('jobs_ledger').select('id, service_types(name)').in('id', ids)
      const map: Record<string, string> = {}
      for (const j of (stRes.data ?? []) as { id: string; service_types: { name: string } | null }[]) {
        if (j.service_types?.name) map[j.id] = j.service_types.name
      }
      setTradeByJobId(map)
    } else {
      setTradeByJobId({})
    }
  }, [partnershipId])

  useEffect(() => {
    setQueue(null)
    void load()
  }, [load])

  async function toggle(jobId: string, currentlyConfirmed: boolean) {
    if (!queue) return
    setBusyJobId(jobId)
    setActionError(null)
    const { error } = await supabase.rpc('set_job_partner_majority', {
      p_job_id: jobId,
      p_person_id: currentlyConfirmed ? undefined : (queue.partner_person_id ?? undefined),
    })
    if (error) setActionError(error.message)
    await load()
    setBusyJobId(null)
  }

  if (rpcMissing) {
    return (
      <p style={{ fontSize: '0.875rem', color: 'var(--text-700)', margin: '0.5rem 0 0' }}>
        The job-review RPCs aren’t in the database yet — run <code>supabase db push</code> for migration
        <code> 20260820150000_partner_majority_anchors.sql</code>, then reload.
      </p>
    )
  }
  if (!queue) {
    return <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: '0.5rem 0 0' }}>Loading…</p>
  }
  if (!queue.linked) {
    return (
      <p style={{ fontSize: '0.875rem', color: 'var(--text-700)', margin: '0.5rem 0 0' }}>
        {partnerName} isn’t linked to an app user yet (People → roster → account link), so there are no clocked hours
        to review. Link the person, then reload.
      </p>
    )
  }

  const rows = sortReviewRows(queue.rows, queue.partner_person_id)
  const waiting = rows.filter((r) => !isConfirmedForPartner(r, queue.partner_person_id) && r.partner_person_id == null).length

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap', margin: '0.25rem 0 0.5rem' }}>
        <span style={{ fontSize: '0.8rem', fontWeight: 650 }}>Jobs {partnerName} worked</span>
        <span style={{ fontSize: '0.72rem', color: waiting > 0 ? 'var(--text-amber-700)' : 'var(--text-muted)', fontWeight: 650 }}>
          {waiting > 0 ? `${waiting} awaiting review` : rows.length > 0 ? 'all reviewed' : ''}
        </span>
      </div>
      {rows.length === 0 ? (
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: 0 }}>
          No jobs with approved clocked hours yet.
        </p>
      ) : (
        rows.map((r) => {
          const confirmed = isConfirmedForPartner(r, queue.partner_person_id)
          const otherPartner = !confirmed && r.partner_person_id != null
          const pct = shareOfHours(r.partner_hours, r.total_hours)
          const pill = buildServiceTypeTradePill(tradeByJobId[r.job_id])
          return (
            <div
              key={r.job_id}
              style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem 0.75rem', padding: '0.6rem 0', borderBottom: '1px solid var(--border)' }}
            >
              <div
                role={jobFormModal ? 'button' : undefined}
                tabIndex={jobFormModal ? 0 : undefined}
                aria-label={jobFormModal ? `Open job ${r.label}` : undefined}
                onClick={jobFormModal ? () => jobFormModal.openEditJob(r.job_id, { onSaved: () => void load() }) : undefined}
                onKeyDown={
                  jobFormModal
                    ? (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          jobFormModal.openEditJob(r.job_id, { onSaved: () => void load() })
                        }
                      }
                    : undefined
                }
                style={{ flex: '1 1 240px', minWidth: 0, cursor: jobFormModal ? 'pointer' : undefined }}
              >
                <div style={{ fontWeight: 600, fontSize: '0.875rem', color: jobFormModal ? 'var(--text-link)' : undefined }}>
                  {pill ? (
                    <span style={{ ...pill.style, marginTop: 0, marginRight: '0.4rem', verticalAlign: '1px' }}>{pill.label}</span>
                  ) : null}
                  {pill ? r.label : `#${r.label}`}
                  {r.job_name && r.job_name.trim() !== '' && r.job_name !== r.label ? ` — ${r.job_name}` : ''}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {partnerName} {r.partner_hours.toFixed(1)} of {r.total_hours.toFixed(1)} labor hours · {pct}%
                </div>
                <div style={{ height: 6, borderRadius: 3, background: 'var(--bg-muted)', marginTop: 5, maxWidth: 180, overflow: 'hidden' }}>
                  <span style={{ display: 'block', height: '100%', width: `${pct}%`, background: '#2a78d6', borderRadius: 3 }} />
                </div>
              </div>
              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: confirmed ? '#16a34a' : 'var(--text-muted)' }}>
                {confirmed
                  ? `confirmed ${r.confirmed_at ? new Date(r.confirmed_at).toLocaleDateString() : ''}${r.confirmed_by_name ? ` by ${r.confirmed_by_name}` : ''} · visible`
                  : otherPartner
                    ? 'assigned to another partner'
                    : 'not visible yet'}
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={confirmed}
                aria-label={`${confirmed ? 'Clear' : 'Confirm'} ${partnerName} majority on job ${r.label}`}
                disabled={busyJobId === r.job_id || otherPartner}
                onClick={() => void toggle(r.job_id, confirmed)}
                style={{
                  width: 38,
                  height: 22,
                  borderRadius: 11,
                  border: '1px solid',
                  borderColor: confirmed ? '#16a34a' : 'var(--border-strong)',
                  background: confirmed ? '#16a34a' : 'var(--bg-muted)',
                  position: 'relative',
                  cursor: busyJobId === r.job_id || otherPartner ? 'default' : 'pointer',
                  opacity: busyJobId === r.job_id || otherPartner ? 0.55 : 1,
                  padding: 0,
                  flex: 'none',
                }}
              >
                <span
                  style={{
                    position: 'absolute',
                    top: 2,
                    left: confirmed ? 18 : 2,
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    background: confirmed ? 'var(--surface)' : 'var(--text-muted)',
                  }}
                />
              </button>
            </div>
          )
        })
      )}
      {actionError ? <p style={{ fontSize: '0.8rem', color: 'var(--text-red-600)', margin: '0.5rem 0 0' }}>{actionError}</p> : null}
      <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '0.6rem 0 0' }}>
        The toggle is the §3 “majority of the work” decision, stamped with who and when. Hours share is a suggestion —
        there is no automatic threshold. Turning a job off hides it from {partnerName} but never touches postings
        already on the ledger.
      </p>
    </div>
  )
}
