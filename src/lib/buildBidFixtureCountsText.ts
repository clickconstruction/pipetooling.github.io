/**
 * Plain-text fixture list for the Pricing tab "Copy fixtures for text" menu item.
 *
 * Names and counts only — deliberately NO prices, revenue, margins, totals, or links:
 * the output is pasted into a text to a parts/supply house to request cost pricing,
 * and sale-side numbers must never leave the building.
 *
 * Client-only, clipboard-bound (same rationale as `buildBidPricingPackageSmsText`:
 * no Edge path consumes this).
 *
 * Shape (blank line separators preserved):
 *
 *   Bid: {bidLabel}
 *
 *   {fixture} — {count}[ {unit}]
 *   …
 *
 *   Items: {n}                        ← rows section omitted when nothing usable
 *
 * Per-row uses U+2014 (—) as the separator, matching the package SMS builder.
 */

export type FixtureCountTextRow = {
  fixture: string | null
  count: number
  unit?: string | null
}

export function buildBidFixtureCountsText(args: {
  bidLabel: string
  rows: ReadonlyArray<FixtureCountTextRow>
}): string {
  const lines: string[] = [`Bid: ${args.bidLabel}`]

  const usable = args.rows.filter((r) => Number.isFinite(r.count) && r.count > 0)
  if (usable.length > 0) {
    lines.push('')
    for (const r of usable) {
      const fixture = (r.fixture ?? '').trim() || '—'
      const unit = (r.unit ?? '').trim()
      lines.push(`${fixture} — ${r.count}${unit ? ` ${unit}` : ''}`)
    }
    lines.push('')
    lines.push(`Items: ${usable.length}`)
  }

  return lines.join('\n')
}
