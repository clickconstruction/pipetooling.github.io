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
