/**
 * The contract strip (Contract Desk PR 3): one line under a job saying
 * whether an agreement is on file, with the door to send one or view the
 * record. Self-contained I/O (useJobContractCoverage) so the Bill Customer
 * modal, the View bill panel, and the Job window's fact row only mount it.
 */
import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useToastContext } from '../../contexts/ToastContext'
import { fileSignedJobContract } from '../../lib/jobs/jobContractFileWrite'
import { isAwaitingPaperCopy } from '../../lib/jobs/jobContractHandoff'
import { dispatchJobContractChanged } from '../../lib/jobs/jobContractNotNeeded'
import { contractLinkFieldState } from '../../lib/jobs/jobContractLinkField'
import type { JobWithDetails } from '../../types/jobWithDetails'
import { useJobContractCoverage } from '../../hooks/useJobContractCoverage'
import { jobContractChipLabel, jobContractChipTitle } from '../../lib/jobs/jobContractCoverage'
import { JobContractChip } from './JobContractChip'
import JobContractModal from './JobContractModal'
import JobSignedAgreementModal from './JobSignedAgreementModal'

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
  const { user: authUser } = useAuth()
  const { showToast } = useToastContext()
  const [modalOpen, setModalOpen] = useState(false)
  const [recordOpen, setRecordOpen] = useState(false)
  /** The contract field (refresh, to-dos/contract-sweep-refresh): a customer who already has a contract with us — paste where it lives in Drive. */
  const [link, setLink] = useState('')
  const [filingLink, setFilingLink] = useState(false)
  if (!job || coverage == null) return null

  const signer = (job.customer_name ?? '').trim() || (job.gcCustomer?.name ?? '').trim()
  const field = contractLinkFieldState({ coverageKind: coverage.kind, link, signerName: signer })
  const fileLink = async () => {
    if (filingLink || !field.canFile) return
    setFilingLink(true)
    try {
      // The same write the sweep and the Contract modal use: a live draft, or a copy out on paper, converts in place.
      const existing = rows.find((r) => r.status === 'draft') ?? rows.find((r) => isAwaitingPaperCopy(r)) ?? null
      const { row } = await fileSignedJobContract({ jobId: job.id, existingDraft: existing, basePayload: null, signerName: signer, signedOn: '', link, file: null, authUserId: authUser?.id ?? null })
      if (!row) throw new Error('The contract was not recorded.')
      setLink('')
      dispatchJobContractChanged()
      await reload()
      showToast('Contract filed — the job reads signed, and nothing was sent to the customer.', 'success')
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not file the contract.', 'error')
    } finally {
      setFilingLink(false)
    }
  }

  const signedRow = coverage.kind === 'signed' && coverage.contractId ? rows.find((r) => r.id === coverage.contractId) ?? null : null
  const label = jobContractChipLabel(coverage)
  const openPrimary = () => (coverage.kind === 'signed' ? setRecordOpen(true) : setModalOpen(true))
  const controls = (
    <>
      <JobContractChip coverage={coverage} onClick={openPrimary} />
      {coverage.kind === 'signed' && coverage.documentUrl ? (
        <a href={coverage.documentUrl} target="_blank" rel="noreferrer" style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-link)', textDecoration: 'none', whiteSpace: 'nowrap' }} data-testid="contract-open-link">
          Open the contract ↗
        </a>
      ) : null}
      {variant === 'inline' && field.show ? (
        <span style={{ display: 'inline-flex', gap: '0.35rem', alignItems: 'center', flex: '1 1 260px', minWidth: 0 }} data-testid="contract-link-field">
          <input
            type="url"
            inputMode="url"
            value={link}
            disabled={filingLink}
            onChange={(e) => setLink(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void fileLink()
              }
            }}
            placeholder="Already have their contract? Paste the Drive link…"
            aria-label="Link to the signed contract in Google Drive"
            title={field.hint ?? undefined}
            style={{ flex: 1, minWidth: 0, font: 'inherit', fontSize: '0.78rem', padding: '0.3rem 0.5rem', borderRadius: 6, border: `1px solid ${field.invalid ? 'var(--text-red-700)' : 'var(--border-strong)'}`, background: 'var(--surface)', color: 'inherit' }}
          />
          {link.trim() ? (
            <button type="button" style={{ ...btn, background: field.canFile ? '#059669' : 'var(--bg-muted)', borderColor: field.canFile ? '#059669' : 'var(--border)', color: field.canFile ? 'white' : 'var(--text-faint)', cursor: field.canFile && !filingLink ? 'pointer' : 'not-allowed' }} disabled={!field.canFile || filingLink} onClick={() => void fileLink()} title={field.hint ?? `Files it as signed by ${signer} — nothing is sent to the customer`}>
              {filingLink ? 'Filing…' : 'File it'}
            </button>
          ) : null}
        </span>
      ) : null}
      {coverage.kind === 'none' || coverage.kind === 'draft' ? (
        <button type="button" style={{ ...btn, background: 'var(--text-link)', borderColor: 'var(--text-link)', color: 'white' }} onClick={() => setModalOpen(true)}>
          Send contract
        </button>
      ) : coverage.kind === 'sent' ? (
        <button type="button" style={btn} onClick={() => setModalOpen(true)}>
          Resend / manage
        </button>
      ) : coverage.kind === 'signed' ? (
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
      <JobSignedAgreementModal
        open={recordOpen}
        onClose={() => setRecordOpen(false)}
        job={job}
        coverage={coverage.kind === 'signed' ? coverage : null}
        contractRow={signedRow}
        onStartNewAgreement={() => {
          setRecordOpen(false)
          setModalOpen(true)
        }}
      />
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
