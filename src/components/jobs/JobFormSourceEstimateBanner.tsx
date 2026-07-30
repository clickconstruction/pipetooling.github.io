import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import type { Database } from '../../types/database'
import CustomerAcceptanceRecordModal from '../estimates/CustomerAcceptanceRecordModal'

type EstimatesRow = Database['public']['Tables']['estimates']['Row']

/**
 * Edit Job "Source estimate" banner: when the job was created from an estimate
 * (estimates.job_ledger_id points at it), show a green banner with a link to
 * the estimate and a "View contract & acceptance" button opening the
 * acceptance-record modal. Owns its own loader keyed on jobId; renders nothing
 * in new mode (jobId null) or when no estimate is linked.
 */
export function JobFormSourceEstimateBanner({
  jobId,
  onOverlayOpenChange,
}: {
  jobId: string | null
  /** Fires when the acceptance-record modal opens/closes, so the host (Edit Job) can pause its own Escape-to-close. */
  onOverlayOpenChange?: (open: boolean) => void
}) {
  const [sourceEstimateForJob, setSourceEstimateForJob] = useState<EstimatesRow | null>(null)
  const [sourceEstimateLoading, setSourceEstimateLoading] = useState(false)
  const [contractModalEstimateId, setContractModalEstimateId] = useState<string | null>(null)
  const contractModalOpen = contractModalEstimateId != null
  useEffect(() => {
    onOverlayOpenChange?.(contractModalOpen)
    // The host must not stay blocked if this banner unmounts with the modal open.
    return () => onOverlayOpenChange?.(false)
  }, [contractModalOpen, onOverlayOpenChange])

  useEffect(() => {
    if (!jobId) {
      setSourceEstimateForJob(null)
      setSourceEstimateLoading(false)
      return
    }
    let cancelled = false
    setSourceEstimateLoading(true)
    void (async () => {
      try {
        const est = await withSupabaseRetry(
          async () =>
            await supabase.from('estimates').select('*').eq('job_ledger_id', jobId).maybeSingle(),
          'load source estimate for job',
        )
        if (cancelled) return
        setSourceEstimateForJob((est ?? null) as EstimatesRow | null)
      } catch {
        if (!cancelled) setSourceEstimateForJob(null)
      } finally {
        if (!cancelled) setSourceEstimateLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [jobId])

  return (
    <>
      {jobId && sourceEstimateLoading ? (
        <p style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>Checking for linked estimate…</p>
      ) : null}
      {jobId && !sourceEstimateLoading && sourceEstimateForJob ? (
        <div
          style={{
            marginBottom: '0.75rem',
            padding: '0.6rem 0.75rem',
            background: 'var(--bg-green-tint)',
            border: '1px solid var(--border-green)',
            borderRadius: 6,
            fontSize: '0.875rem',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.5rem',
            alignItems: 'center',
          }}
        >
          <span>
            <strong>Source estimate:</strong>{' '}
            <Link
              to={`/estimates/${sourceEstimateForJob.estimate_number}`}
              style={{ color: '#15803d', fontWeight: 600 }}
            >
              #{sourceEstimateForJob.estimate_number}
            </Link>
            {sourceEstimateForJob.title?.trim() ? ` · ${sourceEstimateForJob.title.trim()}` : null}
          </span>
          <button
            type="button"
            onClick={() => setContractModalEstimateId(sourceEstimateForJob.id)}
            style={{
              padding: '0.35rem 0.65rem',
              fontSize: '0.8rem',
              background: 'var(--surface)',
              border: '1px solid var(--border-green)',
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            View contract &amp; acceptance
          </button>
        </div>
      ) : null}
      {/* Rendered inside the Edit-Job overlay's stacking context so its z-index
          (80) resolves locally and the record stacks ABOVE the form. As a
          sibling of the overlay (pre-extraction) it painted behind the form's
          z-1010 backdrop and was unreachable from Edit Job. */}
      <CustomerAcceptanceRecordModal
        open={contractModalEstimateId != null}
        estimateId={contractModalEstimateId}
        onClose={() => setContractModalEstimateId(null)}
      />
    </>
  )
}
