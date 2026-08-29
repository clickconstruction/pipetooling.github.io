import { useCallback } from 'react'
import { Share } from 'lucide-react'

import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import {
  buildJobSharePayload,
  buildJobSharePreviewUrl,
  generateJobShareToken,
  runJobShare,
  sha256Hex,
  type JobShareFields,
} from '../../lib/jobShare'

/**
 * Mint a tokenized share link (Phase 2, v2.1454; revived v2.1770 behind the
 * branded share domain — Supabase neutralizes HTML on its shared functions
 * domain, so the raw function URL rendered as a "Text Document" blob in
 * Messages; the Cloudflare Worker on our own domain restores the rich card).
 * Random 128-bit token, sha256 hash stored in job_share_links (RLS gates the
 * insert on the caller's own job visibility). Returns null when minting isn't
 * possible (read-only training users, offline) so the caller falls back to
 * the plain deep link — sharing always works.
 */
async function mintJobShareUrl(jobId: string): Promise<string | null> {
  try {
    // Deliberately NOT withSupabaseRetry: navigator.share must fire while the
    // tap's transient activation is alive (iOS), so this is one fast attempt —
    // getSession() is local, the insert is a single round-trip, and any
    // failure falls back to the deep link instead of retrying.
    const { data: sessionData } = await supabase.auth.getSession()
    const userId = sessionData.session?.user.id
    if (!userId) return null
    const rawToken = generateJobShareToken()
    const tokenHash = await sha256Hex(rawToken)
    const { error } = await supabase
      .from('job_share_links')
      .insert({ job_id: jobId, token_hash: tokenHash, created_by: userId })
    if (error) return null
    return buildJobSharePreviewUrl(rawToken)
  } catch {
    return null
  }
}

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
      const tokenUrl = await mintJobShareUrl(jobId)
      const outcome = await runJobShare(tokenUrl ? { ...payload, url: tokenUrl } : payload, navigator)
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
