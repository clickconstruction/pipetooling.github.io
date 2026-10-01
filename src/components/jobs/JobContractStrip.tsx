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
import AddJobContractSheet from './AddJobContractSheet'
import JobContractSiblingOffer from './JobContractSiblingOffer'
import { useJobContractPapers } from '../../hooks/useJobContractPapers'
import { contractCoversLine, jobNumberLabel, siblingPaperOffers, streetOf } from '../../lib/jobs/jobContractCovers'

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
  quiet = false,
}: {
  job: JobWithDetails | null
  /** strip = boxed line (bill modals); inline = chip + buttons only (fact row value); row = one row of View bill's paperwork card (v2.4299). */
  variant?: 'strip' | 'inline' | 'row'
  /** Row only: another row of the card holds the move that matters, so Send contract is drawn plain. */
  quiet?: boolean
}) {
  const { coverage, rows, reload } = useJobContractCoverage(job)
  const { user: authUser } = useAuth()
  const { showToast } = useToastContext()
  const [modalOpen, setModalOpen] = useState(false)
  /** The contract field (refresh, to-dos/contract-sweep-refresh): a customer who already has a contract with us — paste where it lives in Drive. */
  const [link, setLink] = useState('')
  const [filingLink, setFilingLink] = useState(false)
  /** v2.4301: Add the contract — file a signed paper for this job and any other job of theirs it names. */
  const [sheetOpen, setSheetOpen] = useState(false)
  const papersOn = variant !== 'inline' && job != null && coverage != null
  const { papers, numById, reload: reloadPapers } = useJobContractPapers([job?.customer_id, job?.gc_customer_id], papersOn)
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

  const label = jobContractChipLabel(coverage)
  // v2.4183: one window across states — a signed chip opens it on the signed state.
  const openPrimary = () => setModalOpen(true)
  const controls = (
    <>
      {variant === 'row' ? null : <JobContractChip coverage={coverage} onClick={openPrimary} />}
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
      {(coverage.kind === 'none' || coverage.kind === 'draft') && variant !== 'inline' ? (
        <button type="button" style={quiet ? btn : { ...btn, borderColor: 'var(--text-link)', color: 'var(--text-link)' }} onClick={() => setSheetOpen(true)} data-testid="contract-add-button">
          Add the contract
        </button>
      ) : null}
      {coverage.kind === 'none' || coverage.kind === 'draft' ? (
        <button type="button" style={quiet ? btn : { ...btn, background: 'var(--text-link)', borderColor: 'var(--text-link)', color: 'white' }} onClick={() => setModalOpen(true)}>
          {variant === 'inline' ? 'Send contract' : 'Send one to sign'}
        </button>
      ) : coverage.kind === 'sent' ? (
        <button type="button" style={btn} onClick={() => setModalOpen(true)}>
          Resend / manage
        </button>
      ) : coverage.kind === 'signed' ? (
        <button type="button" style={btn} onClick={() => setModalOpen(true)}>
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
        coverage={coverage}
      />
      {sheetOpen ? (
        <AddJobContractSheet
          open
          mode="add"
          onClose={() => setSheetOpen(false)}
          onDone={() => {
            void reload()
            void reloadPapers()
          }}
          anchorJob={{ id: job.id, num: jobNumberLabel(job), where: streetOf(job.job_address) }}
          partyIds={[job.customer_id, job.gc_customer_id].filter((x): x is string => Boolean(x))}
          signerName={signer}
          subtitle={`Job ${jobNumberLabel(job)}${signer ? ` · ${signer}${!(job.customer_name ?? '').trim() && job.gcCustomer?.name ? ' is the GC on this job' : ''}` : ''}`}
        />
      ) : null}
    </>
  )
  if (variant === 'inline') return <span style={{ display: 'inline-flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>{controls}</span>
  // v2.4301: a paper filed for several jobs names them; a job with nothing on file hears of the paper its sibling jobs share.
  const myPaper = coverage.kind === 'signed' && coverage.source === 'paper' ? papers.find((pp) => pp.jobIds.includes(job.id)) : undefined
  const coversLine = myPaper ? contractCoversLine(myPaper.jobIds.map((id) => numById.get(id) ?? '')) : null
  const offers = coverage.kind === 'none' || coverage.kind === 'draft' ? siblingPaperOffers(papers, job.id) : []
  const siblingOffer = (
    <JobContractSiblingOffer
      jobId={job.id}
      offers={offers}
      numById={numById}
      onAdded={() => {
        void reload()
        void reloadPapers()
      }}
    />
  )
  if (variant === 'row') {
    return (
      <div className="billPaperworkRow" title={jobContractChipTitle(coverage)} data-testid="paperwork-contract-row">
        <span className="billPaperworkLabel">Contract</span>
        <span style={{ minWidth: 0, fontWeight: coverage.kind === 'none' ? 400 : 600 }}>{coverage.kind === 'none' ? 'None on file' : label}</span>
        <span className="billPaperworkControls">{controls}</span>
        {coversLine ? (
          <span className="billPaperworkUnder" style={{ fontSize: '0.75rem', color: 'var(--text-green-800)' }} data-testid="contract-covers-line">
            {coversLine}
          </span>
        ) : null}
        {offers.length > 0 ? <div className="billPaperworkUnder">{siblingOffer}</div> : null}
      </div>
    )
  }
  const tone = coverage.kind === 'signed' ? 'var(--bg-green-tint)' : coverage.kind === 'sent' ? 'var(--bg-amber-tint)' : 'var(--bg-subtle)'
  return (
    <div style={{ marginBottom: '0.75rem' }}>
      <div
        title={jobContractChipTitle(coverage)}
        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', padding: '0.45rem 0.7rem', borderRadius: 8, background: tone, border: '1px solid var(--border)', fontSize: '0.8rem' }}
      >
        <span style={{ color: 'var(--text-muted)' }}>Contract:</span>
        <span style={{ flex: '1 1 150px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
          <span style={{ fontWeight: 600 }}>{coverage.kind === 'none' ? 'Nothing on file for this job' : label}</span>
          {coversLine ? (
            <span style={{ fontSize: '0.74rem', color: 'var(--text-green-800)' }} data-testid="contract-covers-line">
              {coversLine}
            </span>
          ) : null}
        </span>
        {controls}
      </div>
      {siblingOffer}
    </div>
  )
}
