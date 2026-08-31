/**
 * Pure logic for the sign-in magic-link fallback (v2.2524, ported from
 * CountTooling's features/auth-magic-link.js).
 *
 * After OFFER_AFTER failed password attempts on the SAME email, the sign-in
 * page offers to email a one-time sign-in link instead (signInWithOtp with
 * shouldCreateUser: false — PipeTooling accounts are office-provisioned, so a
 * typo'd email must never create one). Counters are per normalized email so a
 * typo'd address's failures don't qualify the corrected one.
 *
 * This module owns the counting + error translation; SignIn.tsx owns the
 * send call, the sent state, and the resend cooldown timer.
 */

export const MAGIC_LINK_OFFER_AFTER = 2

/** GoTrue's magic-link email rate limit — resends before this just fail. */
export const MAGIC_LINK_RESEND_COOLDOWN_S = 60

export function normalizeSignInEmail(email: string): string {
  return email.trim().toLowerCase()
}

/** Returns a new counts map with one more consecutive failure for this email. */
export function recordFailedSignIn(
  counts: Readonly<Record<string, number>>,
  email: string,
): Record<string, number> {
  const key = normalizeSignInEmail(email)
  if (!key) return { ...counts }
  return { ...counts, [key]: (counts[key] ?? 0) + 1 }
}

export function shouldOfferMagicLink(
  counts: Readonly<Record<string, number>>,
  email: string,
): boolean {
  const key = normalizeSignInEmail(email)
  if (!key) return false
  return (counts[key] ?? 0) >= MAGIC_LINK_OFFER_AFTER
}

/**
 * GoTrue's raw OTP-send messages, translated for the cases people actually
 * hit. "Signups not allowed for otp" really means "no account with that
 * email" (shouldCreateUser: false + office-provisioned accounts), so say
 * that. Enumeration-hardening deliberately traded away for an invite-only
 * tool — same call CountTooling made.
 */
export function friendlyOtpError(message: string | null | undefined): string {
  const msg = String(message ?? '')
  if (/failed to fetch|networkerror|network request failed|load failed|fetch failed/i.test(msg)) {
    return 'Can’t reach the server — check your connection and try again.'
  }
  if (/signups? not allowed/i.test(msg)) {
    return 'No account found for that email. Accounts are set up by the office — contact them to get access.'
  }
  if (/rate limit/i.test(msg)) {
    return 'Email limit reached — wait a few minutes and try again.'
  }
  if (/banned/i.test(msg)) {
    return 'This account has been deactivated — contact the office.'
  }
  return msg || 'Could not send the link'
}
