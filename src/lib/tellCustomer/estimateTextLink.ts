/**
 * The link the estimate text carries (v2.6657, punch list #281, PR 1 of three). The email's own link is the accept
 * page with a 64-hex token, 107 characters, and the text read like a tracking code. A share link to the same page
 * (`share_estimate_link`, #127) is 32 characters of token, 75 in all, with the same powers for the same 14 days, and
 * the emailed link keeps working beside it. So after the email goes the sheet makes one share link for the text and
 * falls back to the email's own link when the share cannot be made, so no text is lost to a refused mint. Pure: the
 * choice and its words; the mint is the io's.
 */

/** What the text carries: the link, and whether it is the short share link or the email's own. */
export interface EstimateTextLink {
  link: string
  short: boolean
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
