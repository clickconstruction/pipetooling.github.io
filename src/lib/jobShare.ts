/**
 * Share-a-job kernel: builds the payload for texting a job to a teammate
 * (job #, name, address + a `?jobDetail=` deep link) and runs the share
 * through the native share sheet with a clipboard fallback for desktop.
 *
 * The deep link lands on `/jobs?jobDetail=<id>`, which opens the job detail
 * modal behind the recipient's own login — sharing grants no access.
 */

export type JobShareFields = {
  hcpNumber: string | null | undefined
  jobName: string | null | undefined
  jobAddress: string | null | undefined
}

export type JobSharePayload = {
  title: string
  text: string
  url: string
}

/** `Job #951 — Shearer Pinpoint`, degrading gracefully when either part is missing. */
export function buildJobShareTitle(fields: JobShareFields): string {
  const hcp = fields.hcpNumber?.trim() ?? ''
  const name = fields.jobName?.trim() ?? ''
  const parts = [hcp ? `Job #${hcp}` : null, name || null].filter(Boolean)
  return parts.length > 0 ? parts.join(' — ') : 'Job'
}

export function buildJobShareDeepLink(jobId: string, origin: string): string {
  return `${origin.replace(/\/+$/, '')}/jobs?jobDetail=${encodeURIComponent(jobId)}`
}

export function buildJobSharePayload(jobId: string, fields: JobShareFields, origin: string): JobSharePayload {
  const title = buildJobShareTitle(fields)
  const address = fields.jobAddress?.trim() ?? ''
  return {
    title,
    text: address ? `${title}\n${address}` : title,
    url: buildJobShareDeepLink(jobId, origin),
  }
}

/** 128-bit random token as 32 hex chars — the public share-link credential. */
export function generateJobShareToken(cryptoObj: Pick<Crypto, 'getRandomValues'> = crypto): string {
  const bytes = cryptoObj.getRandomValues(new Uint8Array(16))
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/** sha256 hex of the raw token — the only form ever stored (job_share_links.token_hash). */
export async function sha256Hex(value: string, subtle: SubtleCrypto = crypto.subtle): Promise<string> {
  const digest = await subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/** The job-share edge function URL that unfurls as a rich OG card (Phase 2). */
export function buildJobShareFunctionUrl(supabaseUrl: string, rawToken: string): string {
  return `${supabaseUrl.replace(/\/+$/, '')}/functions/v1/job-share?t=${encodeURIComponent(rawToken)}`
}

/**
 * The branded share domain (v2.1770): a Cloudflare Worker (`job-share-preview`)
 * that fronts the job-share edge function and restores real text/html —
 * Supabase neutralizes HTML on its shared functions domain (see
 * EDGE_FUNCTIONS.md → job-share), which is why the raw function URL renders as
 * a "Text Document" blob in Messages instead of a rich card. Since v2.2494 the
 * Worker carries BOTH share.clicktooling.com (minted here) and
 * share.pipetooling.com (kept forever so links already texted keep working) —
 * the Worker rewrites to the request's own origin, so both just work.
 */
export const JOB_SHARE_PREVIEW_BASE_URL = 'https://share.clicktooling.com'

/** The texted link: unfurls as a rich OG card, then redirects taps into the app. */
export function buildJobSharePreviewUrl(rawToken: string): string {
  return `${JOB_SHARE_PREVIEW_BASE_URL}/?t=${encodeURIComponent(rawToken)}`
}

export type JobShareOutcome = 'shared' | 'copied' | 'canceled' | 'failed'

/** The slice of `navigator` the share runner touches (injectable for tests). */
export type ShareNavigatorLike = {
  share?: (data: { title: string; text: string; url: string }) => Promise<void>
  clipboard?: { writeText: (text: string) => Promise<void> }
}

/**
 * Native share sheet when available (iOS/Android + some desktop browsers),
 * else copy `text + url` to the clipboard. A dismissed share sheet reports
 * 'canceled' — callers should stay quiet about it; any other share failure
 * falls through to the clipboard path.
 */
export async function runJobShare(payload: JobSharePayload, nav: ShareNavigatorLike): Promise<JobShareOutcome> {
  if (typeof nav.share === 'function') {
    try {
      await nav.share({ title: payload.title, text: payload.text, url: payload.url })
      return 'shared'
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return 'canceled'
    }
  }
  try {
    await nav.clipboard?.writeText(`${payload.text}\n${payload.url}`)
    return nav.clipboard ? 'copied' : 'failed'
  } catch {
    return 'failed'
  }
}
