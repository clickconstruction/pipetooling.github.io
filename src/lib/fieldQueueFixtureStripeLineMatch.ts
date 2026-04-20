import { revenueDollarsFromFixtures } from './revenueFromJobFixtures'
import type { StripeInvoiceLineDetail } from './stripeInvoiceDetailsResponse'

const MIN_SUBSTRING_LEN = 3

export type FieldQueueFixtureForMatch = {
  id: string
  name: string | null
  count: number | null
  line_unit_price: number | null
  line_description: string | null
  sequence_order?: number | null
}

function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function fixtureSearchNormalized(f: FieldQueueFixtureForMatch): string {
  const name = (f.name ?? '').trim()
  const desc = (f.line_description ?? '').trim()
  return normalizeText(desc ? `${name} ${desc}` : name)
}

function fixtureNameNormalized(f: FieldQueueFixtureForMatch): string {
  return normalizeText((f.name ?? '').trim())
}

function fixtureExtendedCents(f: FieldQueueFixtureForMatch): number {
  const name = (f.name ?? '').trim()
  if (!name) return 0
  const c = Number(f.count)
  const qty = Number.isFinite(c) && c > 0 ? c : 1
  const dollars = revenueDollarsFromFixtures([
    { name, count: qty, line_unit_price: f.line_unit_price },
  ])
  return Math.round(dollars * 100)
}

function textMatchesFixture(f: FieldQueueFixtureForMatch, line: StripeInvoiceLineDetail): boolean {
  const stripeDesc = normalizeText(line.description ?? '')
  const nameNorm = fixtureNameNormalized(f)
  const searchNorm = fixtureSearchNormalized(f)
  const scopeOnly = normalizeText((f.line_description ?? '').trim())
  if (stripeDesc.length === 0) return false

  const substringsOk = (a: string, b: string) =>
    a.length >= MIN_SUBSTRING_LEN &&
    b.length >= MIN_SUBSTRING_LEN &&
    (a.includes(b) || b.includes(a))

  if (nameNorm.length >= MIN_SUBSTRING_LEN) {
    if (stripeDesc.includes(nameNorm) || nameNorm.includes(stripeDesc)) return true
  }
  if (searchNorm.length >= MIN_SUBSTRING_LEN && searchNorm !== nameNorm) {
    if (stripeDesc.includes(searchNorm) || searchNorm.includes(stripeDesc)) return true
  }
  if (scopeOnly.length >= MIN_SUBSTRING_LEN) {
    if (substringsOk(stripeDesc, scopeOnly)) return true
  }
  return false
}

function amountMatchesFixture(f: FieldQueueFixtureForMatch, line: StripeInvoiceLineDetail): boolean {
  const expected = fixtureExtendedCents(f)
  if (expected <= 0) return false
  return Math.abs(expected - line.amount) <= 1
}

/**
 * Pairs named fixtures to Stripe invoice lines in fixture order (sequence_order).
 * Each Stripe line can match at most one fixture. Heuristic: description substring
 * (name / name+scope) or extended amount in cents within 1 of line.amount.
 */
export function matchedFixtureIdsForFieldQueue(
  fixtures: FieldQueueFixtureForMatch[],
  stripeLines: StripeInvoiceLineDetail[],
): Set<string> {
  const ordered = [...fixtures].sort((a, b) => (a.sequence_order ?? 0) - (b.sequence_order ?? 0))
  const usedLineIdx = new Set<number>()
  const matched = new Set<string>()

  for (const f of ordered) {
    const name = (f.name ?? '').trim()
    if (!name) continue

    for (let i = 0; i < stripeLines.length; i++) {
      if (usedLineIdx.has(i)) continue
      const line = stripeLines[i]!
      if (textMatchesFixture(f, line) || amountMatchesFixture(f, line)) {
        matched.add(f.id)
        usedLineIdx.add(i)
        break
      }
    }
  }

  return matched
}
