/**
 * Legacy static estimate email helpers (unused by app after v2.234).
 * Send path uses `estimateCustomerExperience.ts` + `app_settings` / overrides / snapshot.
 * Kept for reference; keep in sync with `supabase/functions/_shared/estimateCustomerEmail.ts` if revived.
 */

export function estimateEmailSubject(title: string): string {
  return `Estimate: ${title || 'Your estimate'}`
}

export function estimateEmailBody(acceptUrl: string): string {
  return (
    `Please review and accept your estimate.\n\n` +
    `Open this link:\n${acceptUrl}\n\n` +
    `Thank you.`
  )
}
