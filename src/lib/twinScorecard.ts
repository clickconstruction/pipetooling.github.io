// T4 auto-scorecard kernel (Census Toolkit Plan, v2.2554).
//
// At backtest/shadow unseal, the twin must compare its takeoff against the
// human reference line-by-line before a dollar delta means anything
// (PLACEMENT.md "Reference protocol at unseal"). This kernel does the
// mechanical part: parse the reference's freeform count rows, parse the
// twin's items, run the scope-match check, and emit per-tag count deltas
// plus per-system footage ratios.
//
// Reference rows are human-typed (`bids_count_rows.fixture`): "SK-1",
// "ft of 3/4IN TYPE L COPPER", "2 1/2 gas 90", "demo wh prepare for new".
// The parser classifies rather than validates - anything unrecognized
// lands in `other` and still shows up in the scorecard as unmatched.

export type RefRow = { fixture: string | null; count: number; page?: string | null }
export type TwinItem = { name: string; count: number }

export type ParsedRow =
  | { kind: 'fixture'; tag: string; count: number; raw: string }
  | { kind: 'footage'; system: PipeSystem; sizeIn: number | null; feet: number; raw: string }
  | { kind: 'fitting'; system: PipeSystem; sizeIn: number | null; count: number; raw: string }
  | { kind: 'other'; name: string; count: number; raw: string }

export type PipeSystem = 'waste' | 'vent' | 'water' | 'gas' | 'storm' | 'demo' | 'unknown'

export type ScopeMatchResult = {
  verdict: 'pass' | 'fail' | 'unknown'
  refTags: string[]
  missingFromSet: string[]
  matchRate: number | null
}

export type Scorecard = {
  scopeMatch: ScopeMatchResult
  fixtures: { tag: string; ref: number; twin: number; delta: number }[]
  fixtureAccuracy: number | null
  footage: { system: PipeSystem; refFt: number; twinFt: number; ratio: number | null }[]
  unmatchedRef: string[]
  unmatchedTwin: string[]
}

// Tags that are fixtures/equipment even without a digit suffix.
const BARE_TAGS = new Set([
  'IMB', 'EWH', 'AFR', 'TMV', 'RPZ', 'BFP', 'HB', 'MSB', 'WHA', 'FCO',
  'COTG', 'WCO', 'EWC', 'FD', 'FS', 'WH', 'CP', 'WB', 'DF', 'MS',
])

const SYSTEM_PATTERNS: [RegExp, PipeSystem][] = [
  [/\bDEMO\b/i, 'demo'],
  [/\b(STORM|\bSD\b|ROOF DRAIN|RD\b|EOD)\b/i, 'storm'],
  [/\bVENT\b/i, 'vent'],
  [/\b(GAS|\bG\b)\s*$|\bGAS\b/i, 'gas'],
  [/\b(WASTE|SEWER|SANI|CAST IRON|NO HUB|NO-HUB)\b/i, 'waste'],
  [/\b(COPPER|WATER|PEX|CPVC|DCW|DHW|HWR?|CW|TYPE L)\b/i, 'water'],
]

const FITTING_WORDS = /\b(90|45|ELBOW|TEE|WYE|SANI|COUPLING|BEND|\bT\b|\bY\b)\b/i

export function normalizeTag(raw: string): string {
  return raw.toUpperCase().replace(/[-\s]/g, '')
}

/** Parse "3IN", "3/4IN", "1 1/2IN", "2 1/2" leading size fragments to inches. */
export function parseSizeIn(text: string): number | null {
  const m = text.match(/(\d+)?\s*(\d)\s*\/\s*(\d)\s*(?:IN\b|"|(?=\s|$))|(\d+(?:\.\d+)?)\s*(?:IN\b|")/i)
  if (!m) return null
  if (m[4] !== undefined) return parseFloat(m[4])
  if (m[2] === undefined || m[3] === undefined) return null
  const whole = m[1] ? parseInt(m[1], 10) : 0
  return whole + parseInt(m[2], 10) / parseInt(m[3], 10)
}

export function classifySystem(text: string): PipeSystem {
  for (const [re, system] of SYSTEM_PATTERNS) {
    if (re.test(text)) return system
  }
  return 'unknown'
}

export function parseRow(rawName: string | null, count: number): ParsedRow {
  const raw = (rawName ?? '').trim()
  if (!raw) return { kind: 'other', name: '', count, raw }

  // Footage rows: "ft of 3IN WASTE", "349.9 ft ..." styles.
  const ftMatch = raw.match(/^ft of\s+(.*)$/i) ?? raw.match(/^feet of\s+(.*)$/i)
  if (ftMatch) {
    const body = ftMatch[1] ?? ''
    return {
      kind: 'footage',
      system: classifySystem(body),
      sizeIn: parseSizeIn(body),
      feet: count,
      raw,
    }
  }

  // Fixture tags: "SK-1", "WC-1A", "L1A", "EWC1", "B-3", bare "IMB"/"EWH".
  const tagMatch = raw.match(/^([A-Za-z]{1,4})[-\s]?(\d+[A-Za-z]?)$/)
  if (tagMatch) {
    return { kind: 'fixture', tag: normalizeTag(raw), count, raw }
  }
  if (BARE_TAGS.has(raw.toUpperCase())) {
    return { kind: 'fixture', tag: raw.toUpperCase(), count, raw }
  }

  // Fittings: a size + fitting word ("2IN 90 CAST IRON", "2 1/2 gas t").
  if (FITTING_WORDS.test(raw) && parseSizeIn(raw) !== null) {
    return {
      kind: 'fitting',
      system: classifySystem(raw),
      sizeIn: parseSizeIn(raw),
      count,
      raw,
    }
  }

  return { kind: 'other', name: raw, count, raw }
}

/**
 * Scope-match check (PLACEMENT.md, adopted after BT-15's void): every
 * reference fixture tag should exist in the fetched plan set. Fails when
 * fewer than half the tags are found (with at least 3 tags to judge by).
 */
export function scopeMatchCheck(refRows: RefRow[], setTags: string[]): ScopeMatchResult {
  const normalizedSet = new Set(setTags.map(normalizeTag))
  const refTags: string[] = []
  for (const row of refRows) {
    const parsed = parseRow(row.fixture, row.count)
    if (parsed.kind === 'fixture' && parsed.count > 0) refTags.push(parsed.tag)
  }
  const unique = [...new Set(refTags)]
  if (unique.length === 0) {
    return { verdict: 'unknown', refTags: unique, missingFromSet: [], matchRate: null }
  }
  const missing = unique.filter((t) => !normalizedSet.has(t))
  const matchRate = (unique.length - missing.length) / unique.length
  const verdict = unique.length >= 3 && matchRate < 0.5 ? 'fail' : 'pass'
  return { verdict, refTags: unique, missingFromSet: missing, matchRate }
}

export function compareTakeoffs(
  refRows: RefRow[],
  twinItems: TwinItem[],
  setTags: string[] = [],
): Scorecard {
  const refParsed = refRows.map((r) => parseRow(r.fixture, r.count))
  const twinParsed = twinItems.map((t) => parseRow(t.name, t.count))

  const refFixtures = new Map<string, number>()
  const twinFixtures = new Map<string, number>()
  const refFootage = new Map<PipeSystem, number>()
  const twinFootage = new Map<PipeSystem, number>()
  const unmatchedRef: string[] = []
  const unmatchedTwin: string[] = []

  for (const p of refParsed) {
    if (p.kind === 'fixture') refFixtures.set(p.tag, (refFixtures.get(p.tag) ?? 0) + p.count)
    else if (p.kind === 'footage') refFootage.set(p.system, (refFootage.get(p.system) ?? 0) + p.feet)
    else if (p.kind === 'other' && p.count > 0 && p.name) unmatchedRef.push(p.raw)
  }
  for (const p of twinParsed) {
    if (p.kind === 'fixture') twinFixtures.set(p.tag, (twinFixtures.get(p.tag) ?? 0) + p.count)
    else if (p.kind === 'footage') twinFootage.set(p.system, (twinFootage.get(p.system) ?? 0) + p.feet)
    else if (p.kind === 'other' && p.count > 0 && p.name) unmatchedTwin.push(p.raw)
  }

  const tags = [...new Set([...refFixtures.keys(), ...twinFixtures.keys()])].sort()
  const fixtures = tags.map((tag) => {
    const ref = refFixtures.get(tag) ?? 0
    const twin = twinFixtures.get(tag) ?? 0
    return { tag, ref, twin, delta: twin - ref }
  })
  const refTotal = fixtures.reduce((s, f) => s + f.ref, 0)
  const matchedTotal = fixtures.reduce((s, f) => s + Math.min(f.ref, f.twin), 0)
  const fixtureAccuracy = refTotal > 0 ? matchedTotal / refTotal : null

  const systems = [...new Set([...refFootage.keys(), ...twinFootage.keys()])].sort()
  const footage = systems.map((system) => {
    const refFt = refFootage.get(system) ?? 0
    const twinFt = twinFootage.get(system) ?? 0
    return { system, refFt, twinFt, ratio: refFt > 0 ? twinFt / refFt : null }
  })

  return {
    scopeMatch: scopeMatchCheck(refRows, setTags),
    fixtures,
    fixtureAccuracy,
    footage,
    unmatchedRef,
    unmatchedTwin,
  }
}
