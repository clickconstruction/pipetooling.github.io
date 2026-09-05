/**
 * The sub work-order strip (Work Orders tab, PR 3 — v2.2829): one line under
 * a job saying whether a sub work order exists and where it stands, with the
 * door into the assembler — draft one for the sub the master plans to
 * subcontract to, open the draft to price it, or view the signed record.
 * Self-contained I/O (useJobWorkOrderCoverage) so the Job window's fact row
 * and the View bill panel only mount it. Mirrors JobContractStrip.
 */
import { useState } from 'react'
import type { JobWithDetails } from '../../types/jobWithDetails'
import { useJobWorkOrderCoverage } from '../../hooks/useJobWorkOrderCoverage'
import { workOrderChipTitle } from '../../lib/subWorkOrders/workOrderCoverage'
import { JobWorkOrderChip } from './JobWorkOrderChip'
import { WorkOrderAssemblerModal, type WorkOrderAssemblerInitial } from './WorkOrderAssemblerModal'

const btn: React.CSSProperties = {
  padding: '0.25rem 0.6rem',
  borderRadius: 6,
  border: '1px solid var(--border-strong)',
  background: 'var(--surface)',
  color: 'var(--text-700)',
  font: 'inherit',
  fontSize: '0.75rem',
  fontWeight: 600,
  cursor: 'pointer',
}

export default function JobWorkOrderStrip({
  job,
  variant = 'strip',
  authUserId,
  readOnly = false,
}: {
  /** Null while the job is unsaved (New Job): the row explains the door opens after the first save. */
  job: JobWithDetails | null
  /** strip = boxed line (bill panels); inline = chip + buttons only (fact row value). */
  variant?: 'strip' | 'inline'
  authUserId: string | undefined
  /** View bill: chip + View only — the money-out side is read there, not written. */
  readOnly?: boolean
}) {
  const { coverage, reload } = useJobWorkOrderCoverage(job)
  const [initial, setInitial] = useState<WorkOrderAssemblerInitial | null>(null)

  if (!job) {
    if (variant === 'inline') return <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Save the job first, then draft a work order from here.</span>
    return null
  }
  if (coverage == null) return null

  const openExisting = () => coverage.kind !== 'none' && setInitial({ commitmentId: coverage.id })
  const openNew = () => setInitial({ jobId: job.id })
  const primary = coverage.kind === 'none' ? openNew : openExisting
  const primaryLabel =
    coverage.kind === 'none'
      ? 'Draft a work order…'
      : coverage.kind === 'draft'
        ? coverage.unpriced
          ? 'Price…'
          : 'Send…'
        : coverage.kind === 'sent'
          ? 'View'
          : coverage.kind === 'signed'
            ? 'View record'
            : 'Re-offer…'
  const controls = (
    <>
      <JobWorkOrderChip coverage={coverage} onClick={primary} />
      {readOnly && coverage.kind === 'none' ? null : (
        <button
          type="button"
          style={
            !readOnly && (coverage.kind === 'none' || coverage.kind === 'draft' || coverage.kind === 'declined')
              ? { ...btn, background: 'var(--text-link)', borderColor: 'var(--text-link)', color: 'white' }
              : btn
          }
          onClick={primary}
        >
          {readOnly ? 'View' : primaryLabel}
        </button>
      )}
      {!readOnly && coverage.kind === 'declined' ? (
        <button type="button" style={btn} onClick={openNew}>
          Draft for another sub…
        </button>
      ) : null}
      <WorkOrderAssemblerModal
        open={initial != null}
        onClose={() => {
          setInitial(null)
          void reload()
        }}
        jobs={[job]}
        initial={initial}
        authUserId={authUserId}
        onChanged={() => void reload()}
      />
    </>
  )
  if (variant === 'inline') return <span style={{ display: 'inline-flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>{controls}</span>
  const tone = coverage.kind === 'signed' ? 'var(--bg-green-tint)' : coverage.kind === 'sent' ? 'var(--bg-amber-tint)' : 'var(--bg-subtle)'
  return (
    <div
      title={workOrderChipTitle(coverage)}
      style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', padding: '0.45rem 0.7rem', borderRadius: 8, background: tone, border: '1px solid var(--border)', marginBottom: '0.75rem', fontSize: '0.8rem' }}
    >
      <span style={{ color: 'var(--text-muted)' }}>Sub work order:</span>
      <span style={{ flex: 1, minWidth: 0, fontWeight: 600 }}>
        {coverage.kind === 'none'
          ? 'No agreement — nothing signed for a sub on this job'
          : coverage.kind === 'signed'
            ? `${coverage.subName} signed${coverage.signedOn ? ` ${coverage.signedOn}` : ''}${coverage.recordId ? ` · ${coverage.recordId}` : ''}`
            : coverage.kind === 'sent'
              ? `Sent to ${coverage.subName}${coverage.expired ? ' — offer expired' : ''}`
              : coverage.kind === 'draft'
                ? `Drafted for ${coverage.subName}${coverage.unpriced ? ' — no price yet' : ''}`
                : `${coverage.subName} declined`}
      </span>
      {controls}
    </div>
  )
}
