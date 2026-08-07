import { useCallback } from 'react'
import { Share } from 'lucide-react'

import { useToastContext } from '../../contexts/ToastContext'
import { buildJobSharePayload, runJobShare, type JobShareFields } from '../../lib/jobShare'

/**
 * Share-a-job action: native share sheet (iOS share sheet on the crew's
 * phones) with a clipboard fallback + toast on desktop. The hook is the
 * single home for the toast wording so the button, the mobile card sheet,
 * and the detail modal all behave identically.
 */
export function useShareJob(): (jobId: string, fields: JobShareFields) => Promise<void> {
  const { showToast } = useToastContext()
  return useCallback(
    async (jobId: string, fields: JobShareFields) => {
      const payload = buildJobSharePayload(jobId, fields, window.location.origin)
      const outcome = await runJobShare(payload, navigator)
      if (outcome === 'copied') showToast('Job info + link copied — paste it in a text', 'success')
      else if (outcome === 'failed') showToast('Could not share this job', 'error')
    },
    [showToast],
  )
}

export function ShareJobButton({
  jobId,
  fields,
  size = 16,
  padding = '0.25rem',
  color = 'var(--text-700)',
}: {
  jobId: string
  fields: JobShareFields
  size?: number
  padding?: string
  color?: string
}) {
  const shareJob = useShareJob()
  const label = 'Share job — text the job #, name, and address to a teammate'
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        void shareJob(jobId, fields)
      }}
      title={label}
      aria-label="Share job"
      style={{
        padding,
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        color,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 4,
      }}
    >
      <Share size={size} aria-hidden />
    </button>
  )
}
