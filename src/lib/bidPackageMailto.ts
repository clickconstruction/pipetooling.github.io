/**
 * Builds a `mailto:` URL for the Pricing tab "Send via my mail" path.
 *
 * `mailto:` cannot carry an HTML table — desktop mail clients render the body as plain text
 * only — so the body is the plain-text fallback from `buildBidPricingPackagePlainText`,
 * which already includes the `Job plans:` line, the heading, and the aligned table. The
 * companion clipboard step (in the modal) copies the HTML table so the user can paste it
 * into the message after the client opens.
 *
 * `encodeURIComponent` on every user-controllable segment; recipient email is allowlisted to
 * the local + domain shape so we never produce malformed mailto URLs from a stray space.
 */

export type BidPackageMailtoInput = {
  recipientEmail: string
  bidLabel: string
  plainTextBody: string
}

const SIMPLE_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function buildBidPackageMailtoUrl(input: BidPackageMailtoInput): string {
  const email = (input.recipientEmail ?? '').trim()
  if (!SIMPLE_EMAIL_RE.test(email)) {
    throw new Error(`Invalid recipient email: ${input.recipientEmail}`)
  }

  const subject = `Pricing — ${input.bidLabel}`.trim()
  const body = input.plainTextBody
  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}
