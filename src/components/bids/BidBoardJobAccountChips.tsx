import { useState, type CSSProperties } from 'react'
import { useJobFormModal } from '../../contexts/JobFormModalContext'
import type { BidJobAccountRow } from '../../hooks/useBidJobAccountStrip'
import { chipStateOf, houseChipLabel, housesOnJob, stripJob, type JobAccountChipState } from '../../lib/bids/bidBoardJobAccounts'
import { effectiveJobLedgerNumber } from '../../lib/ledgerDisplayPrefixes'
import { MarkJobAccountOpenedModal } from '../materials/MarkJobAccountOpenedModal'

const TEAL = '#0f766e'
const TEAL_SOFT = '#ccfbf1'
const PURPLE = '#6d28d9'
const PURPLE_SOFT = '#f5f3ff'

function chipStyle(state: JobAccountChipState): CSSProperties {
  const base: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: '0.25rem', borderRadius: 6, padding: '0 0.4rem', fontSize: '0.66rem', fontWeight: 600, lineHeight: 1.5, borderWidth: 1, borderStyle: 'solid', borderColor: 'transparent', fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' }
  if (state === 'open') return { ...base, background: TEAL_SOFT, color: TEAL, cursor: 'default' }
  if (state === 'requested') return { ...base, background: PURPLE_SOFT, color: PURPLE }
  if (state === 'not_needed') return { ...base, background: 'var(--bg-muted)', color: 'var(--text-muted)', fontWeight: 500 }
  return { ...base, background: 'transparent', color: 'var(--text-muted)', borderColor: 'var(--border-strong)', borderStyle: 'dashed', fontWeight: 500 }
}

export type BidBoardJobAccountsProps = {
  /** Whether the page-wide read has answered; before that nothing draws. */
  loaded: boolean
  /** This bid's share of `list_bid_job_account_strip` (empty = no job yet). */
  rows: BidJobAccountRow[]
  /** After Mark opened: the page re-reads the strips. */
  onChanged: () => void
}

/**
 * Job accounts on the won row (v2.3520): the compact twin of Edit Bid's
 * `BidJobAccountsRow`, drawn under the won GC line from the page-wide read.
 * One chip per house on the job — a chip that is not open opens Mark opened
 * for that house — and a "…" door to the Job accounts question. A won bid
 * with no job yet says so instead of drawing chips.
 */
export function BidBoardJobAccountChips({ bidId, loaded, rows, onChanged }: BidBoardJobAccountsProps & { bidId: string }) {
  const jobFormModal = useJobFormModal()
  const [sheet, setSheet] = useState<BidJobAccountRow | null>(null)
  if (!loaded) return null
  const job = stripJob(rows)
  const label = <span style={{ fontSize: '0.62rem', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>Job accounts</span>
  if (!job) {
    return (
      <div data-bid-board-job-accounts={bidId} data-bid-board-job-accounts-state="no-job" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.68rem', color: 'var(--text-faint)', marginTop: '0.1rem' }}>
        {label}
        <span>after the job is opened</span>
      </div>
    )
  }
  const houses = housesOnJob(rows)
  if (houses.length === 0) return null
  const jobLabel = `${effectiveJobLedgerNumber(job.hcpNumber, job.clickNumber) || '—'} · ${(job.name ?? '').trim() || '—'}`
  return (
    <div data-bid-board-job-accounts={bidId} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.3rem', marginTop: '0.1rem' }} onClick={(e) => e.stopPropagation()}>
      {label}
      {houses.map((h) => {
        const state = chipStateOf(h)
        const text = houseChipLabel(h)
        const title =
          state === 'open'
            ? `${h.house_name} job account open${h.account_ref ? ` · ref ${h.account_ref}` : ''}`
            : state === 'requested'
              ? `Asked${h.rep_name ? ` — ${h.rep_name} opens them` : ''} · click to mark it opened`
              : state === 'not_needed'
                ? 'Marked not needed · click to mark it opened after all'
                : `${h.quoted ? `${h.house_name} quoted this bid` : `${h.house_name} expects a job account per property`} — none yet · click to mark it opened`
        return state === 'open' ? (
          <span key={h.supply_house_id} style={chipStyle(state)} title={title} data-bid-board-job-account-state="open">
            {text}
          </span>
        ) : (
          <button key={h.supply_house_id} type="button" onClick={() => setSheet(h)} style={chipStyle(state)} title={title} data-bid-board-job-account-state={state}>
            {text}
          </button>
        )
      })}
      {jobFormModal ? (
        <button
          type="button"
          onClick={() => jobFormModal.openJobAccountsPrompt(job.id)}
          aria-label={`Job accounts for ${jobLabel}`}
          title="Ask the house's rep by email, send the ask to Dispatch, or mark them not needed"
          style={{ background: 'none', border: 'none', padding: '0 0.2rem', fontFamily: 'inherit', fontSize: '0.75rem', lineHeight: 1, color: 'var(--text-muted)', cursor: 'pointer' }}
        >
          …
        </button>
      ) : null}
      {sheet ? (
        <MarkJobAccountOpenedModal
          jobId={job.id}
          jobLabel={jobLabel}
          house={{ id: sheet.supply_house_id, name: sheet.house_name }}
          existing={null}
          reps={sheet.rep_contact_id && sheet.rep_name ? [{ id: sheet.rep_contact_id, name: sheet.rep_name, email: sheet.rep_email ?? '', phone: sheet.rep_phone }] : []}
          initialMode="open"
          onClose={() => setSheet(null)}
          onSaved={() => {
            setSheet(null)
            onChanged()
          }}
        />
      ) : null}
    </div>
  )
}
