import type { CSSProperties } from 'react'

import { useJobFormModal } from '../../contexts/JobFormModalContext'
import { useBidJobAccountStrip } from '../../hooks/useBidJobAccountStrip'

const TEAL = '#0f766e'
const TEAL_SOFT = '#ccfbf1'
const PURPLE = '#6d28d9'
const PURPLE_SOFT = '#f5f3ff'

function chip(status: string | null): CSSProperties {
  const base: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: '0.3rem', borderRadius: 6, padding: '0.05rem 0.5rem', fontSize: '0.72rem', fontWeight: 600, borderWidth: 1, borderStyle: 'solid', borderColor: 'transparent', whiteSpace: 'nowrap', lineHeight: 1.5 }
  if (status === 'open') return { ...base, background: TEAL_SOFT, color: TEAL }
  if (status === 'requested') return { ...base, background: PURPLE_SOFT, color: PURPLE }
  if (status === 'not_needed') return { ...base, background: 'var(--bg-muted)', color: 'var(--text-muted)', fontWeight: 500 }
  return { ...base, background: 'transparent', color: 'var(--text-muted)', borderColor: 'var(--border-strong)', borderStyle: 'dashed', fontWeight: 500 }
}

function word(status: string | null): string {
  if (status === 'open') return '✓'
  if (status === 'requested') return '· requested'
  if (status === 'not_needed') return '· not needed'
  return '· none yet'
}

/**
 * Job accounts from the bid (v2.3451): under the Job block of a won bid, once
 * a job exists — one chip per house that expects a job account or quoted the
 * bid, read through the bid-gated RPC, and a "Job accounts…" door that
 * reopens the Job accounts question for that job. The estimator's view of the
 * record; the office sees the same row.
 */
export function BidJobAccountsRow({ bidId }: { bidId: string }) {
  const jobFormModal = useJobFormModal()
  const { rows, job, loaded } = useBidJobAccountStrip(bidId)
  if (!loaded || !job || rows.length === 0) return null
  const houses = rows.filter((r) => r.job_id === job.id)
  if (houses.length === 0) return null
  return (
    <div data-bid-job-accounts={bidId} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.4rem', width: '100%', marginTop: '0.2rem' }}>
      <span style={{ fontSize: '0.68rem', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Job accounts</span>
      {houses.map((h) => (
        <span
          key={h.supply_house_id}
          style={chip(h.status)}
          title={
            h.status === 'open'
              ? `${h.house_name} job account open${h.account_ref ? ` · ref ${h.account_ref}` : ''}`
              : h.status === 'requested'
                ? `Asked${h.rep_name ? ` — ${h.rep_name} opens them` : ''}`
                : h.quoted
                  ? `${h.house_name} quoted this bid — no job account yet`
                  : `${h.house_name} expects a job account per property — none yet`
          }
          data-bid-job-account-state={h.status ?? 'none'}
        >
          {h.house_name} {word(h.status)}
          {h.quoted && !h.status ? <span style={{ fontWeight: 500, opacity: 0.8 }}>· quoted</span> : null}
        </span>
      ))}
      {jobFormModal ? (
        <button
          type="button"
          onClick={() => jobFormModal.openJobAccountsPrompt(job.id)}
          style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', fontSize: '0.75rem', color: 'var(--text-muted)', cursor: 'pointer', textDecoration: 'underline dotted', textUnderlineOffset: 3 }}
          title="Ask the house's rep by email, send the ask to Dispatch, mark one opened, or mark them not needed"
        >
          Job accounts…
        </button>
      ) : null}
    </div>
  )
}
