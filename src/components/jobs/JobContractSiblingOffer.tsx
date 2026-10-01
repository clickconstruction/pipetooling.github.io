/**
 * The offer on a job with nothing on file (v2.4301): a signed paper already covers some of the
 * same customer's other jobs — does it name this job too? Never automatic: the office opens the
 * paper, then presses Add this job to it.
 */
import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useToastContext } from '../../contexts/ToastContext'
import { siblingOfferWords, type CoversPaper } from '../../lib/jobs/jobContractCovers'
import { addJobToPaper } from '../../lib/jobs/jobContractCoversWrite'

export default function JobContractSiblingOffer({
  jobId,
  offers,
  numById,
  onAdded,
}: {
  jobId: string
  offers: CoversPaper[]
  numById: Map<string, string>
  onAdded?: () => void
}) {
  const { user } = useAuth()
  const { showToast } = useToastContext()
  const [busyKey, setBusyKey] = useState<string | null>(null)
  if (offers.length === 0) return null
  const add = async (paper: CoversPaper) => {
    if (busyKey) return
    setBusyKey(paper.key)
    try {
      await addJobToPaper(paper, jobId, user?.id ?? null)
      showToast('Added. The paper now covers this job too. Nothing was sent to the customer.', 'success')
      onAdded?.()
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not add the job to the paper.', 'error')
    } finally {
      setBusyKey(null)
    }
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginTop: '0.4rem' }}>
      {offers.slice(0, 2).map((paper) => (
        <div
          key={paper.key}
          data-testid="contract-sibling-offer"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            flexWrap: 'wrap',
            padding: '0.4rem 0.6rem',
            borderRadius: 6,
            border: '1px dashed var(--border-strong)',
            background: 'var(--surface)',
            fontSize: '0.78rem',
          }}
        >
          <span style={{ flex: '1 1 220px', minWidth: 0, color: 'var(--text-700)' }}>
            {siblingOfferWords(paper.jobIds.map((id) => numById.get(id) ?? '').filter(Boolean))}
          </span>
          {paper.documentUrl ? (
            <a href={paper.documentUrl} target="_blank" rel="noreferrer" style={{ fontWeight: 600, color: 'var(--text-link)', textDecoration: 'none', whiteSpace: 'nowrap' }}>
              Open ↗
            </a>
          ) : null}
          <button
            type="button"
            disabled={busyKey != null}
            onClick={() => void add(paper)}
            style={{
              padding: '0.25rem 0.6rem',
              borderRadius: 6,
              border: '1px solid #047857',
              background: 'var(--surface)',
              color: '#047857',
              font: 'inherit',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: busyKey ? 'not-allowed' : 'pointer',
            }}
          >
            {busyKey === paper.key ? 'Adding…' : 'Add this job to it'}
          </button>
        </div>
      ))}
    </div>
  )
}
