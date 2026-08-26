/**
 * Count-row units (v2.2113): a count row's `count` is either a tally (each) or a
 * length (feet), and the two must never be summed together. Nothing in the
 * schema says which (stage 2 adds a nullable `unit` column) — today the unit
 * lives in the fixture NAME by convention, stamped by the CountTooling
 * "Copy to /Tooling" export (`ft of 2in Copper`, `px of …` for unscaled runs)
 * and echoed by hand entry (`feet of sewer`, `1/2" PEX PER FT`). This kernel is
 * the ONE place that reads that convention.
 *
 * Rules are deliberately tight: a linear row must say "<unit> of <thing>" or
 * end in "per ft" — so `FT-1` (a fixture tag) stays `ea`. Known false
 * negatives (`2" HDPE pipe`, `FT SEWER LINE`) are `ea` until the row carries an
 * explicit unit; never loosen the regex to catch them.
 */

export type CountUnit = 'ea' | 'ft' | 'px' | 'sqft'

export const COUNT_UNITS: readonly CountUnit[] = ['ea', 'ft', 'px', 'sqft']

/** Short display label per unit. */
export const COUNT_UNIT_LABEL: Record<CountUnit, string> = { ea: 'ea', ft: 'ft', px: 'px', sqft: 'sq ft' }

/** Noun for "N <noun>" tiles/toasts. */
export const COUNT_UNIT_NOUN: Record<CountUnit, { one: string; many: string }> = {
  ea: { one: 'count', many: 'counts' },
  ft: { one: 'line type', many: 'line types' },
  px: { one: 'unscaled run', many: 'unscaled runs' },
  sqft: { one: 'area', many: 'areas' },
}

export function isCountUnit(v: unknown): v is CountUnit {
  return typeof v === 'string' && (COUNT_UNITS as readonly string[]).includes(v)
}

const GROUP_PREFIX_RE = /^\[[^\]]*\]\s*/ // CountTooling "[Group] " name prefix
const PX_RE = /^px\s+of\b/i
const SQFT_RE = /^(sq\.?\s?ft|sqft|square\s+(feet|foot|ft)|sf)\.?\s+of\b/i
const FT_RE = /^(ft|feet|foot|lf|lin\.?\s?ft|linear\s+(feet|foot|ft))\.?\s+of\b/i
const PER_FT_RE = /\bper\s+(ft|foot|lf|linear\s+foot)\.?\s*$/i

/** Infer a row's unit from its fixture name alone (the pre-column convention). */
export function classifyCountRowUnit(fixture: string | null | undefined): CountUnit {
  const name = (fixture ?? '').trim().replace(GROUP_PREFIX_RE, '')
  if (!name) return 'ea'
  if (PX_RE.test(name)) return 'px'
  if (SQFT_RE.test(name)) return 'sqft'
  if (FT_RE.test(name)) return 'ft'
  if (PER_FT_RE.test(name)) return 'ft'
  return 'ea'
}

/**
 * The fixture name minus its `[Group]` and unit prefixes — the "thing" itself
 * (`ft of 2" Demo Water Line` → `2" Demo Water Line`). Names without a unit
 * prefix pass through unchanged (trimmed). Trailing "per ft" stays: it is part
 * of how those rows are named by hand.
 */
export function stripCountRowUnitPrefix(fixture: string | null | undefined): string {
  const name = (fixture ?? '').trim().replace(GROUP_PREFIX_RE, '')
  for (const re of [PX_RE, SQFT_RE, FT_RE]) {
    if (re.test(name)) return name.replace(re, '').trim()
  }
  return name
}

/**
 * The unit a row is counted in: an explicit `unit` wins; a missing/unknown one
 * falls back to the name convention. Every surface that totals count rows
 * reads through this — never `row.unit` directly.
 */
export function effectiveCountUnit(row: { fixture: string | null | undefined; unit?: string | null }): CountUnit {
  return isCountUnit(row.unit) ? row.unit : classifyCountRowUnit(row.fixture)
}

export type UnitTotals = Record<CountUnit, { items: number; total: number }>

export function emptyUnitTotals(): UnitTotals {
  return { ea: { items: 0, total: 0 }, ft: { items: 0, total: 0 }, px: { items: 0, total: 0 }, sqft: { items: 0, total: 0 } }
}

/** Items + Σ count per unit. Buckets are never added together. */
export function sumByUnit(rows: ReadonlyArray<{ fixture: string | null | undefined; unit?: string | null; count: number | string | null | undefined }>): UnitTotals {
  const t = emptyUnitTotals()
  for (const r of rows) {
    const u = effectiveCountUnit(r)
    const n = Number(r.count)
    t[u].items += 1
    t[u].total += Number.isFinite(n) ? n : 0
  }
  return t
}

/** "1,122" for each, "444.74" for feet — up to 2 decimals, trailing zeros dropped. */
export function formatUnitTotal(n: number, unit: CountUnit): string {
  void unit
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

/** "12 ea · 148.5 ft" — zero buckets omitted; "0" when everything is empty. Order: ea, ft, sqft, px. */
export function formatUnitTotals(t: UnitTotals): string {
  const parts: string[] = []
  for (const u of ['ea', 'ft', 'sqft', 'px'] as const) {
    if (t[u].items > 0) parts.push(`${formatUnitTotal(t[u].total, u)} ${COUNT_UNIT_LABEL[u]}`)
  }
  return parts.length ? parts.join(' · ') : '0'
}

/**
 * Import-toast summary: "29 counts (1,122 ea) · 6 line types (444.74 ft)".
 * px/sqft appear only when present.
 */
export function summarizeRowsByUnit(rows: ReadonlyArray<{ fixture: string | null | undefined; unit?: string | null; count: number | string | null | undefined }>): string {
  const t = sumByUnit(rows)
  const parts: string[] = []
  for (const u of ['ea', 'ft', 'sqft', 'px'] as const) {
    const b = t[u]
    if (b.items === 0) continue
    const noun = b.items === 1 ? COUNT_UNIT_NOUN[u].one : COUNT_UNIT_NOUN[u].many
    parts.push(`${b.items} ${noun} (${formatUnitTotal(b.total, u)} ${COUNT_UNIT_LABEL[u]})`)
  }
  return parts.join(' · ')
}
