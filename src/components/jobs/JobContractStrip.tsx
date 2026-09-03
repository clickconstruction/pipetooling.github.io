/**
 * The contract strip (Contract Desk PR 3): one line under a job saying
 * whether an agreement is on file, with the door to send one or view the
 * record. Self-contained I/O (useJobContractCoverage) so the Bill Customer
 * modal, the View bill panel, and the Job window's fact row only mount it.
 */
import { useState } from 'react'
import type { JobWithDetails } from '../../types/jobWithDetails'
import { useJobContractCoverage } from '../../hooks/useJobContractCoverage'
import { jobContractChipLabel, jobContractChipTitle } from '../../lib/jobs/jobContractCoverage'
import { JobContractChip } from './JobContractChip'
import JobContractModal from './JobContractModal'
import JobContractRecordModal from './JobContractRecordModal'

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

export default function JobContractStrip({
  job,
  variant = 'strip',
}: {
  job: JobWithDetails | null
  /** strip = boxed line (bill modals); inline = chip + buttons only (fact row value). */
  variant?: 'strip' | 'inline'
}) {
  const { coverage, rows, reload } = useJobContractCoverage(job)
  const [modalOpen, setModalOpen] = useState(false)
  const [recordOpen, setRecordOpen] = useState(false)
  if (!job || coverage == null) return null

  const signedRow = coverage.kind === 'signed' && coverage.contractId ? rows.find((r) => r.id === coverage.contractId) ?? null : null
  const label = jobContractChipLabel(coverage)
  const controls = (
    <>
      <JobContractChip coverage={coverage} onClick={() => setModalOpen(true)} />
      {coverage.kind === 'none' || coverage.kind === 'draft' ? (
        <button type="button" style={{ ...btn, background: 'var(--text-link)', borderColor: 'var(--text-link)', color: 'white' }} onClick={() => setModalOpen(true)}>
          Send contract
        </button>
      ) : coverage.kind === 'sent' ? (
        <button type="button" style={btn} onClick={() => setModalOpen(true)}>
          Resend / manage
        </button>
      ) : signedRow ? (
        <button type="button" style={btn} onClick={() => setRecordOpen(true)}>
          View record
        </button>
      ) : null}
      <JobContractModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false)
          void reload()
        }}
        job={job}
        onChanged={() => void reload()}
      />
      <JobContractRecordModal open={recordOpen} onClose={() => setRecordOpen(false)} row={signedRow} job={job} />
    </>
  )
  if (variant === 'inline') return <span style={{ display: 'inline-flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>{controls}</span>
  const tone = coverage.kind === 'signed' ? 'var(--bg-green-tint)' : coverage.kind === 'sent' ? 'var(--bg-amber-tint)' : 'var(--bg-subtle)'
  return (
    <div
      title={jobContractChipTitle(coverage)}
      style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', padding: '0.45rem 0.7rem', borderRadius: 8, background: tone, border: '1px solid var(--border)', marginBottom: '0.75rem', fontSize: '0.8rem' }}
    >
      <span style={{ color: 'var(--text-muted)' }}>Contract:</span>
      <span style={{ flex: 1, minWidth: 0, fontWeight: 600 }}>{coverage.kind === 'none' ? 'No signed agreement on file for this job' : label}</span>
      {controls}
    </div>
  )
}
