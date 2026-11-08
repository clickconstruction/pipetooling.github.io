/**
 * The link the estimate text carries (punch list #281: v2.6657 PR 1, v2.6677 PR 2, v2.6678 PR 3). The email's own
 * link is the accept page with a 64-hex token, 107 characters, and the text read like a tracking code. A share link to
 * the same page (`share_estimate_link`, #127) is a ten-letter code with the same powers for the same 14 days, and the
 * emailed link keeps working beside it. Since PR 3 the text's link rides the Click Plumbing host:
 * `https://my.clickplumbing.com/e/<code>`, 41 characters, which the `portal-link-shell` Worker answers with a 301 to
 * the app's `/e/:code` route (`estimateTextShareUrl`); with no short host set it is the accept page's own URL. So after
 * the email goes the sheet makes one share link for the text and falls back to the email's own link when the share
 * cannot be made, so no text is lost to a refused mint. Pure: the choice and its words; the mint is the io's.
 */
import { APP_ORIGIN } from '../appOrigin'
import { ESTIMATE_SHORT_ORIGIN, estimateShortUrl } from '../portal/portalShortOrigin'

/** What the text carries: the link, and whether it is the short share link or the email's own. */
export interface EstimateTextLink {
  link: string
  short: boolean
}

/**
 * The URL the text carries for a share code: the Click Plumbing host's `/e/<code>` while `ESTIMATE_SHORT_ORIGIN` is set,
 * else the app's own accept page. A blank code is no link.
 */
export function estimateTextShareUrl(code: string, shortOrigin: string | null = ESTIMATE_SHORT_ORIGIN): string {
  const c = code.trim()
  if (!c) return ''
  // The accept page's own URL, as `estimateLinkIo.estimateAcceptUrl` builds it; spelled here so the kernel imports no io.
  return shortOrigin ? estimateShortUrl(c, shortOrigin) : `${APP_ORIGIN}/estimate/accept?t=${encodeURIComponent(c)}`
}

/** The email's own link when no share came back, else the share link. A blank share is no share. */
export function pickEstimateTextLink(acceptUrl: string, shareUrl: string | null | undefined): EstimateTextLink {
  const share = typeof shareUrl === 'string' ? shareUrl.trim() : ''
  return share ? { link: share, short: true } : { link: acceptUrl, short: false }
}

/**
 * The link for the text: the share link when `share` answers one, the email's own when it throws or answers nothing.
 * The failure is swallowed on purpose: the email went, and the text must go with a working link either way.
 */
export async function estimateTextLink(acceptUrl: string, share: () => Promise<string>): Promise<EstimateTextLink> {
  try {
    return pickEstimateTextLink(acceptUrl, await share())
  } catch {
    return pickEstimateTextLink(acceptUrl, null)
  }
}
