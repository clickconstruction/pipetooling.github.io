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
 *   {fixture} — {count}, fixed price ${revenue}   ← a fixed-price row (v2.7136)
 *   …
 *
 *   Total: ${totalRevenue}            ← omitted when externalRows is empty
 *
 * Per-row uses U+00D7 (×) as the multiplier and U+2014 (—) as the separator. No HTML escape
 * — this is plain text destined for an SMS app.
 *
 * A fixed-price row has one price for the whole line, whatever the count
 * (`standardUnitRevenue`). Drawn with `×` it read `3 × $5,000 = $5,000`, a sum that does not
 * add up, so its line shows no `×` and no `=` (v2.7136). The count shows as stored. The one
 * figure is the line total, rounded like every other line total; for a fixed row that is the
 * price itself. The row's own flag decides, a count of 1 included: `1 × $750` would read as a
 * price for one, and the reader should know the price stays put if the count changes.
 * "Fixed price" is the app's own name: the margin breakdown says it, and the print marks the
 * price "(fixed)".
 *
 * Money reads in whole dollars (v2.7045): this is a look between teammates, not the paper
 * the GC gets, and cents on every line made a long text harder to read on a phone. The
 * email lanes and the stored prices keep their cents; only this text rounds.
 *   - A line total and the Total are each the true amount rounded, never a sum or a product
 *     of rounded parts, so the Total can sit a dollar or two off the lines added up by eye.
 *   - A count is not money and is never rounded (74.29 ft stays 74.29).
 *   - A unit price drops its cents only when the line still adds up without them. A rate of
 *     $12.50 a foot shown as $13 would misstate the price and break `count × price = total`,
 *     so that one keeps its cents.
 *   - An amount under 50 cents keeps its cents instead of reading $0.
 */

import {
  bidAddressMapsUrl,
  formatPackageCurrency,
  packagePriceHeading,
  type PackageExternalRow,
  type PackagePriceSection,
} from './buildBidPricingPackageHtml'
import { formatUsdNoCents } from './jobs/jobFormatting'

/** The amount to the cent first, so a float's 10.4999… that is really $10.50 rounds up. */
function wholeDollars(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.round(Math.round(n * 100) / 100)
}

/** `$1,235`; an amount under 50 cents keeps its cents so it never reads as nothing. */
function shareMoney(n: number): string {
  const whole = wholeDollars(n)
  if (whole === 0 && Number.isFinite(n) && Math.abs(n) >= 0.005) return `$${formatPackageCurrency(n)}`
  return formatUsdNoCents(whole)
}

/**
 * A unit price in whole dollars when the line still reads right that way: it had no cents,
 * or the count times the whole price lands on the line total shown. Otherwise it keeps its
 * cents. A fixed price never comes here: the row's flag gives it its own line (v2.7136), in
 * place of the old guess that a price equal to its line total was a fixed one.
 */
function shareUnitPrice(r: PackageExternalRow): string {
  const whole = wholeDollars(r.unitPrice)
  const shown = wholeDollars(r.revenue)
  const hasCents = Number.isFinite(r.unitPrice) && Math.abs(r.unitPrice - whole) >= 0.005
  const addsUp = wholeDollars(r.count * whole) === shown
  return hasCents && !addsUp ? `$${formatPackageCurrency(r.unitPrice)}` : shareMoney(r.unitPrice)
}

export function buildBidPricingPackageSmsText(args: {
  bidLabel: string
  plansLink: string | null
  countToolingPlansLink?: string | null
  address?: string | null
  externalRows: ReadonlyArray<PackageExternalRow>
  totalRevenue: number
  /** v2.3685 "Send both": when set, each price gets a heading line, its rows and its Total. */
  sections?: ReadonlyArray<PackagePriceSection>
}): string {
  const { bidLabel, plansLink, countToolingPlansLink, address, externalRows, totalRevenue, sections } = args

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

  const pushRows = (rows: ReadonlyArray<PackageExternalRow>, total: number) => {
    for (const r of rows) {
      const fixture = (r.fixture ?? '').trim() || '—'
      lines.push(
        r.isFixedPrice
          ? `${fixture} \u2014 ${r.count}, fixed price ${shareMoney(r.revenue)}`
          : `${fixture} \u2014 ${r.count} \u00d7 ${shareUnitPrice(r)} = ${shareMoney(r.revenue)}`,
      )
    }
    lines.push('')
    lines.push(`Total: ${shareMoney(total)}`)
  }

  if (sections && sections.length > 0) {
    for (const s of sections) {
      lines.push('')
      lines.push(packagePriceHeading(s))
      pushRows(s.externalRows, s.totalRevenue)
    }
  } else if (externalRows.length > 0) {
    lines.push('')
    pushRows(externalRows, totalRevenue)
  }

  return lines.join('\n')
}
