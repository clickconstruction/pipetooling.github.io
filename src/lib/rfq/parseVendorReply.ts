/**
 * Vendor-reply parser (RFQ Phase 1a, v2.2629 — docs/SUPPLY_HOUSE_RFQ_PLAN.md).
 *
 * Turns a raw pasted supply-house reply ("4\" cast iron 18.90/ft", "3/4 90s
 * $368/box of 50", "wc carriers no stock til Oct") into candidate quote lines
 * matched against the bid's fixture names. Pure — the Plug-in modal owns all
 * IO and the human correction pass; nothing here writes anywhere.
 *
 * Order of operations per line (each step consumes its tokens so the next
 * can't misread them): basis first ("/ft", "per 100", "box of 50" — so the
 * 50 is never mistaken for a price), then price (prefer $-prefixed, else the
 * LAST remaining number — beats model numbers like "JR smith 2010 - 148"),
 * then no-stock phrasing, then fixture matching by size tokens + a domain
 * synonym table (cast iron/CI → WASTE, copper/viega/pex → WATER, …).
 * A line may match several fixtures ("GCO/FCO 116 each" → both, same price).
 * Prices ~8× off the provided baseline are flagged, never dropped.
 */

export type ReplyBasis = 'each' | 'ft' | 'per_100' | 'box'

export type ReplyFixture = { name: string; count: number; unit?: string | null }

export type ParsedReplyLine = {
  raw: string
  /** Matched fixture names (same price applies to each); empty = unassigned. */
  fixtures: string[]
  confidence: 'exact' | 'fuzzy'
  basis: ReplyBasis
  /** Units per basis (box of 50 → 50; per_100 → 100; each/ft → 1). */
  basisQty: number
  /** Price as pasted, in cents, at the stated basis. Null on no-stock lines. */
  basisPriceCents: number | null
  /** The derived truth: cents per single unit. */
  unitPriceEachCents: number | null
  cantSupply: boolean
  /** True when the price is >8x or <1/8 the baseline for the matched fixture. */
  outlier: boolean
}

export type ParsedReply = {
  lines: ParsedReplyLine[]
  /** Raw lines with nothing usable to match or price — the human assigns or ignores. */
  unassigned: string[]
}

const NO_STOCK = /no stock|out of stock|n\/a\b|can'?t supply|cannot supply|unavailable|special order|call me|don'?t (?:carry|stock)/i

function canonicalSize(tok: string): string {
  const t = tok.trim().toLowerCase()
  const mixed = t.match(/^(\d+)\s+(\d)\/(\d)$/)
  if (mixed) return String(Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]))
  const frac = t.match(/^(\d)\/(\d)$/)
  if (frac) return String(Number(frac[1]) / Number(frac[2]))
  const n = Number(t)
  return Number.isFinite(n) ? String(n) : t
}

/**
 * Sizes present in a string, canonicalized ("1 1/2" → "1.5", "3/4" → "0.75").
 * A size is a fraction/mixed number (marker optional: `3/4 90s`) or a number
 * WITH an inch marker (`4"`, `3IN`). Bare numbers are never sizes — that is
 * what keeps prices (14.25), model numbers (2010), and row suffixes (FD-2)
 * out of the size channel.
 */
export function extractSizes(s: string): string[] {
  const out = new Set<string>()
  for (const m of s.matchAll(/(\d+\s+\d\/\d|\d\/\d)\s*(?:"|''|in\b|inch(?:es)?\b|-in\b)?/gi)) {
    const canon = canonicalSize(m[1] ?? '')
    const n = Number(canon)
    if (Number.isFinite(n) && n > 0 && n <= 12) out.add(canon)
  }
  // Strip fraction/mixed tokens first so a fraction's denominator followed by
  // an inch mark (`1 1/2"`) is not re-read as a bare marked number (`2"`).
  const noFractions = s.replace(/\d+\s+\d\/\d|\d\/\d/g, ' ')
  for (const m of noFractions.matchAll(/(\d+(?:\.\d+)?)\s*(?:"|''|in\b|inch(?:es)?\b|-in\b)/gi)) {
    const canon = canonicalSize(m[1] ?? '')
    const n = Number(canon)
    if (Number.isFinite(n) && n > 0 && n <= 12) out.add(canon)
  }
  return [...out]
}

/**
 * Domain synonyms: vendor vocabulary → tokens that appear in fixture names.
 * `strong` marks unambiguous multi-word phrases ("floor drains", "carriers")
 * that identify the fixture family on their own.
 */
const SYNONYMS: Array<{ re: RegExp; tokens: string[]; strong?: boolean }> = [
  { re: /cast iron|\bci\b/i, tokens: ['waste', 'cast iron', 'sewer', 'sv'] },
  { re: /copper|viega|propress|type l|soft l|\bpex\b/i, tokens: ['water', 'cw', 'hw', 'copper', 'pex'] },
  { re: /\b90'?s?\b|ell\b|elbow/i, tokens: ['90'] },
  { re: /\btees?\b|\bt'?s\b/i, tokens: ['t'] },
  { re: /floor drains?/i, tokens: ['fd'], strong: true },
  { re: /\bfd\b/i, tokens: ['fd'] },
  { re: /floor sinks?/i, tokens: ['fs'], strong: true },
  { re: /clean ?outs?/i, tokens: ['co', 'gco', 'fco', 'wco'], strong: true },
  { re: /water closets?|toilets?/i, tokens: ['wc'], strong: true },
  { re: /\bwc\b/i, tokens: ['wc'] },
  { re: /lav(?:s|atories|atory)?\b/i, tokens: ['l', 'lav'] },
  { re: /urinals?/i, tokens: ['u', 'ur'], strong: true },
  { re: /water heaters?/i, tokens: ['wh'], strong: true },
  { re: /\bwh\b/i, tokens: ['wh'] },
  { re: /hose ?bibs?/i, tokens: ['hb'], strong: true },
  { re: /trap primers?/i, tokens: ['tp'], strong: true },
  { re: /carriers?/i, tokens: ['wc'], strong: true },
  { re: /\bgas\b/i, tokens: ['gas'] },
]

type Basis = { basis: ReplyBasis; qty: number; rest: string }

/** Pull the pricing basis out of the line, consuming its tokens. */
export function extractBasis(line: string): Basis {
  const rest = line
  const box = rest.match(/(?:\/|per\s+)?box(?:es)?\s*(?:of\s*)?\(?\s*(\d+)\s*\)?/i)
  if (box) return { basis: 'box', qty: Number(box[1]), rest: rest.replace(box[0], ' ') }
  const per100 = rest.match(/per\s*100\b|\/\s*100\b|per\s*c\b/i)
  if (per100) return { basis: 'per_100', qty: 100, rest: rest.replace(per100[0], ' ') }
  const ft = rest.match(/\/\s*ft\b|per\s*(?:ft|foot|lf)\b|a\s+foot\b|\bft\b(?=\s*$)/i)
  if (ft) return { basis: 'ft', qty: 1, rest: rest.replace(ft[0], ' ') }
  const each = rest.match(/\/\s*ea\b|per\s*each\b|\beach\b|\bea\b(?=\s*$)/i)
  if (each) return { basis: 'each', qty: 1, rest: rest.replace(each[0], ' ') }
  return { basis: 'each', qty: 1, rest }
}

/** The price on a (basis-consumed) line, in cents — $-prefixed wins, else the last plausible number. */
export function extractPriceCents(rest: string): number | null {
  const dollar = [...rest.matchAll(/\$\s*(\d{1,3}(?:,\d{3})*|\d+)(?:\.(\d{1,2}))?/g)]
  const pick = (m: RegExpMatchArray): number => {
    const whole = Number((m[1] ?? '0').replace(/,/g, ''))
    const centsPart = m[2] ? Number((m[2] + '0').slice(0, 2)) : 0
    return whole * 100 + centsPart
  }
  if (dollar.length > 0) return pick(dollar[dollar.length - 1]!)
  // No $: candidate numbers, excluding size-like fractions ("3/4") and inch-marked tokens.
  const cleaned = rest.replace(/\d\/\d/g, ' ').replace(/(\d+(?:\.\d+)?)\s*(?:"|''|in\b)/gi, ' ')
  const nums = [...cleaned.matchAll(/(?<![\d.])(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?(?![\d/])/g)]
  if (nums.length === 0) return null
  const last = nums[nums.length - 1]!
  const cents = pick(last)
  return cents > 0 ? cents : null
}

function toEachCents(basisPriceCents: number, basis: ReplyBasis, qty: number): number {
  if (basis === 'box' || basis === 'per_100') return Math.round(basisPriceCents / Math.max(1, qty))
  return basisPriceCents
}

function fixtureTokens(name: string): { sizes: string[]; words: Set<string> } {
  const lower = name.toLowerCase()
  const words = new Set(lower.split(/[^a-z0-9/]+/).filter(Boolean))
  return { sizes: extractSizes(name), words }
}

/**
 * Score a vendor line against one fixture: size agreement is strongest, then
 * synonym-domain hits, then literal token overlap (GCO in both, "90" in both).
 */
function scoreLine(
  lineLower: string,
  lineSizes: string[],
  fixture: { nameLower: string; sizes: string[]; words: Set<string> },
): number {
  let score = 0
  if (lineSizes.length > 0 && fixture.sizes.length > 0) {
    if (lineSizes.some((s) => fixture.sizes.includes(s))) score += 3
    else return 0 // both sides state a size and they disagree — not this fixture
  }
  // The whole fixture name appearing verbatim ("GCO/FCO 116 each") is decisive.
  if (fixture.nameLower.length >= 2 && new RegExp(`(?:^|[^a-z0-9])${escapeRe(fixture.nameLower)}(?:[^a-z0-9]|$)`).test(lineLower)) {
    score += 4
  }
  for (const syn of SYNONYMS) {
    if (syn.re.test(lineLower) && syn.tokens.some((t) => fixture.words.has(t))) score += syn.strong ? 3 : 2
  }
  for (const w of lineLower.split(/[^a-z0-9]+/)) {
    if (w.length >= 2 && fixture.words.has(w)) score += 1
  }
  return score
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function parseVendorReply(
  raw: string,
  fixtures: ReadonlyArray<ReplyFixture>,
  baselineEachCentsByName?: ReadonlyMap<string, number>,
): ParsedReply {
  const fixtureIndex = fixtures.map((f) => ({
    name: f.name,
    tokens: { nameLower: f.name.trim().toLowerCase(), ...fixtureTokens(f.name) },
  }))
  const lines: ParsedReplyLine[] = []
  const unassigned: string[] = []

  for (const rawLine of raw.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) continue

    const cantSupply = NO_STOCK.test(line)
    const { basis, qty, rest } = extractBasis(line)
    const basisPriceCents = cantSupply ? null : extractPriceCents(rest)

    const lineLower = line.toLowerCase()
    const lineSizes = extractSizes(rest.replace(/\$\s*[\d,.]+/g, ' '))
    const threshold = cantSupply ? 2 : 3
    const scored = fixtureIndex
      .map((f) => ({ name: f.name, score: scoreLine(lineLower, lineSizes, f.tokens) }))
      .filter((s) => s.score >= threshold)
      .sort((a, b) => b.score - a.score)

    const top = scored[0]
    const matches = top ? scored.filter((s) => s.score === top.score).map((s) => s.name) : []

    if (matches.length === 0 && basisPriceCents === null) {
      unassigned.push(line)
      continue
    }

    const unitEach = basisPriceCents === null ? null : toEachCents(basisPriceCents, basis, qty)
    const outlier =
      unitEach !== null &&
      matches.some((name) => {
        const base = baselineEachCentsByName?.get(name.trim().toLowerCase())
        return base != null && base > 0 && (unitEach > base * 8 || unitEach < base / 8)
      })

    lines.push({
      raw: line,
      fixtures: matches,
      confidence: top && top.score >= 5 && matches.length <= 2 ? 'exact' : 'fuzzy',
      basis,
      basisQty: qty,
      basisPriceCents,
      unitPriceEachCents: unitEach,
      cantSupply,
      outlier,
    })
  }

  return { lines, unassigned }
}
