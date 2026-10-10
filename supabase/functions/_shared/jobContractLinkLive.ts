/**
 * Is a job contract's signing link live enough to hand out as it is (punch list #104)? One rule for the app's link
 * doors (`jobContractLinkOnRow` in src/lib/jobs/jobContractLifecycle.ts, v2.5119) and `send-job-contract`'s link mode
 * (v2.5145): the row is out (sent, not voided), it has a token, and its link has more than the margin left. Handing
 * out such a link is not a send, so neither side stamps the row: a PDF emailed to sign stays a PDF send, its count
 * and its reminders stay. Anything else goes through the send, which mints or renews the link.
 *
 * No imports, so Deno and Vite read the same file.
 */

/**
 * The days a link must still have before it is handed out as it is. A link texted on day 88 of 90 would die on day 90,
 * so inside this margin the send renews it. The margin also covers the office machine's clock against the server's.
 */
export const JOB_CONTRACT_LINK_HANDOUT_MARGIN_DAYS = 7

export type JobContractLinkRow = {
  status?: string | null
  voided_at?: string | null
  public_token?: string | null
  public_token_expires_at?: string | null
}

/** The token of a link live enough to hand out as it is, or null. A link with no expiry counts as live, as `sign-job-contract` reads it. */
export function jobContractLiveToken(row: JobContractLinkRow | null | undefined, nowMs: number): string | null {
  if (!row || row.voided_at || (row.status ?? '').trim() !== 'sent') return null
  const token = (row.public_token ?? '').trim()
  if (!token) return null
  const expires = row.public_token_expires_at ? Date.parse(row.public_token_expires_at) : Number.NaN
  if (Number.isFinite(expires) && expires - nowMs <= JOB_CONTRACT_LINK_HANDOUT_MARGIN_DAYS * 86_400_000) return null
  return token
}
