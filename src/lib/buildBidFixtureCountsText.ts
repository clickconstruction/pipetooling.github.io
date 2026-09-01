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
      lines.push(fixtureCountLine(r))
    }
    lines.push('')
    lines.push(`Items: ${usable.length}`)
  }

  return lines.join('\n')
}

function fixtureCountLine(r: FixtureCountTextRow): string {
  const fixture = (r.fixture ?? '').trim() || '—'
  const unit = (r.unit ?? '').trim()
  return `${fixture} — ${r.count}${unit ? ` ${unit}` : ''}`
}

/**
 * Division 22 variant (v2.2580 ledger): same rows, grouped under spec-section
 * headers in ascending MasterFormat order — the way a supply-house counter works
 * the spec book. Rows whose classification yields no section (unmatched, or a
 * deliberate no-code rule like DEMO) land in a "No code yet" tail; the copy never
 * blocks on an incomplete ledger. Still deliberately price-free.
 */
export function buildBidFixtureCountsTextGrouped(args: {
  bidLabel: string
  rows: ReadonlyArray<FixtureCountTextRow>
  /** name → section code, or null for unmatched/no-code (caller wraps classifySpecSection). */
  sectionCodeForName: (name: string) => string | null
  /** code → section title for headers; a missing title prints the code alone. */
  sectionTitleByCode: ReadonlyMap<string, string>
}): string {
  const lines: string[] = [`Bid: ${args.bidLabel}`]

  const usable = args.rows.filter((r) => Number.isFinite(r.count) && r.count > 0)
  if (usable.length === 0) return lines.join('\n')

  const byCode = new Map<string, FixtureCountTextRow[]>()
  const tail: FixtureCountTextRow[] = []
  for (const r of usable) {
    const code = args.sectionCodeForName((r.fixture ?? '').trim())
    if (code == null) {
      tail.push(r)
      continue
    }
    const bucket = byCode.get(code)
    if (bucket) bucket.push(r)
    else byCode.set(code, [r])
  }

  for (const code of [...byCode.keys()].sort((a, b) => a.localeCompare(b))) {
    const title = (args.sectionTitleByCode.get(code) ?? '').trim()
    lines.push('')
    lines.push(title ? `${code} · ${title}` : code)
    for (const r of byCode.get(code) ?? []) lines.push(fixtureCountLine(r))
  }

  if (tail.length > 0) {
    lines.push('')
    lines.push('No code yet')
    for (const r of tail) lines.push(fixtureCountLine(r))
  }

  lines.push('')
  lines.push(`Items: ${usable.length}`)
  return lines.join('\n')
}
