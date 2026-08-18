/**
 * SMS-friendly plain-text builder for the Pricing tab "Copy for text" button.
 *
 * Client-only (intentionally NOT mirrored to `supabase/functions/_shared/`): no Edge path
 * consumes this — the modal copies the output to the clipboard so the user can paste it
 * into Messages / WhatsApp / etc.
 *
 * Shape (blank line separators preserved):
 *
 *   Bid: {bidLabel}
 *   Address: {address}                ← omitted when null/blank
 *   Map: {googleMapsUrl}              ← omitted when address is null/blank
 *   Job plans: {plansLink}            ← omitted when null/blank
 *   CountTooling Plans: {ctpLink}     ← omitted when null/blank
 *
 *   {fixture} — {count} × ${unit} = ${revenue}
 *   …
 *
 *   Total: ${totalRevenue}            ← omitted when externalRows is empty
 *
 * Per-row uses U+00D7 (×) as the multiplier and U+2014 (—) as the separator. No HTML escape
 * — this is plain text destined for an SMS app.
 */

import {
  bidAddressMapsUrl,
  formatPackageCurrency,
  type PackageExternalRow,
} from './buildBidPricingPackageHtml'

export function buildBidPricingPackageSmsText(args: {
  bidLabel: string
  plansLink: string | null
  countToolingPlansLink?: string | null
  address?: string | null
  externalRows: ReadonlyArray<PackageExternalRow>
  totalRevenue: number
}): string {
  const { bidLabel, plansLink, countToolingPlansLink, address, externalRows, totalRevenue } = args

  const lines: string[] = []
  lines.push(`Bid: ${bidLabel}`)

  const addressMapsUrl = bidAddressMapsUrl(address)
  if (addressMapsUrl) {
    lines.push(`Address: ${(address ?? '').trim()}`)
    lines.push(`Map: ${addressMapsUrl}`)
  }

  const link = (plansLink ?? '').trim()
  if (link) {
    lines.push(`Job plans: ${link}`)
  }

  const countToolingLink = (countToolingPlansLink ?? '').trim()
  if (countToolingLink) {
    lines.push(`CountTooling Plans: ${countToolingLink}`)
  }

  if (externalRows.length > 0) {
    lines.push('')
    for (const r of externalRows) {
      const fixture = (r.fixture ?? '').trim() || '—'
      lines.push(
        `${fixture} \u2014 ${r.count} \u00d7 $${formatPackageCurrency(r.unitPrice)} = $${formatPackageCurrency(r.revenue)}`,
      )
    }
    lines.push('')
    lines.push(`Total: $${formatPackageCurrency(totalRevenue)}`)
  }

  return lines.join('\n')
}
