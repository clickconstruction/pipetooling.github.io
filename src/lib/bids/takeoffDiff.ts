/**
 * Robot-vs-ours takeoff diff (v2.2553, audit cockpit v2). Pure kernel that
 * name-matches two priced takeoffs — the twin's draft rows and the reference
 * bid's rows — despite their different naming styles (`ft of 3/4" Cold Water`
 * vs `3/4IN WATER`) by parsing each row into a signature (kind + size + system
 * / fitting / fixture alias) and joining on it.
 *
 * Output is the three buckets an estimator already thinks in:
 *   missed — our rows the robot lacks (the dangerous kind)
 *   added  — robot rows we lack (overreach, or it caught something)
 *   gaps   — matched rows whose quantities disagree beyond tolerance
 * plus a per-system footage/fixture rollup for the 10-second read.
 *
 * Matching is best-effort by design: an unparseable row simply lands in
 * missed/added, where the auditor's verdict sorts it out.
 */

export interface TakeoffDiffRow {
  name: string
  count: number
  /** Priced extension (count × unit); 0 when unpriced. */
  ext: number
}

export type PipeSystem = 'waste' | 'vent' | 'water' | 'gas' | 'medgas' | 'storm' | 'condensate' | 'other'

export interface RowSignature {
  kind: 'footage' | 'fitting' | 'fixture'
  /** Canonical pipe size ('3/4', '1-1/2', '2') or null. */
  size: string | null
  system: PipeSystem | null
  /** Fitting type ('90', 'tee', 'wye', …) when kind is 'fitting'. */
  fitting: string | null
  /** Alias key ('wc', 'fd', 'hose reel') when kind is 'fixture'. */
  fixtureKey: string | null
}

const FRACTION_BY_DECIMAL: Record<string, string> = { '25': '1/4', '5': '1/2', '75': '3/4' }

function canonicalSize(whole: string | null, frac: string | null): string | null {
  if (whole && frac) return `${Number(whole)}-${frac}`
  if (frac) return frac
  if (whole == null) return null
  const n = Number(whole)
  if (!Number.isFinite(n) || n <= 0 || n > 24) return null
  if (Number.isInteger(n)) return String(n)
  const [w, d] = String(n).split('.')
  const f = FRACTION_BY_DECIMAL[d ?? '']
  return f ? (w === '0' ? f : `${w}-${f}`) : String(n)
}

/** Extract a canonical pipe size; returns the size and the name with it removed. */
function extractSize(name: string): { size: string | null; rest: string } {
  // 1 1/2" | 1-1/2 in | 1 1/2 — and the run-together takeoff shorthand 11/2IN (= 1-1/2")
  let m = name.match(/\b(\d)[ -](\d\/\d)\s*(?:"|in\b\.?)?/)
  if (m) return { size: canonicalSize(m[1] ?? null, m[2] ?? null), rest: name.replace(m[0], ' ') }
  m = name.match(/\b([1-9])(1\/2|1\/4|3\/4)\s*(?:"|in\b\.?)?/)
  if (m) return { size: canonicalSize(m[1] ?? null, m[2] ?? null), rest: name.replace(m[0], ' ') }
  // 3/4" | 3/4in | 3/4
  m = name.match(/\b(\d\/\d)\s*(?:"|in\b\.?)?/)
  if (m) return { size: canonicalSize(null, m[1] ?? null), rest: name.replace(m[0], ' ') }
  // 2" | 2in | 1.5" — the unit marker is REQUIRED for whole numbers so 90s/45s stay fittings
  m = name.match(/\b(\d+(?:\.\d+)?)\s*(?:"|in\b\.?)/)
  if (m) return { size: canonicalSize(m[1] ?? null, null), rest: name.replace(m[0], ' ') }
  return { size: null, rest: name }
}

const SYSTEM_TESTS: Array<{ system: PipeSystem; re: RegExp }> = [
  { system: 'medgas', re: /med[ -]?gas|medical|\bo2\b|oxygen|\bvac(?:uum)?\b|\bn2o\b|nitrous|\bwagd\b|\bmed\b|\bmd\b/ },
  { system: 'storm', re: /storm|roof drain|\brd\b|overflow|downspout|leader/ },
  { system: 'condensate', re: /\bcond(?:ensate)?\b/ },
  { system: 'vent', re: /\bvent\b|\bvtr\b/ },
  { system: 'waste', re: /waste|\bsan(?:itary)?\b|sewer|\bsoil\b|\bdwv\b|grease|\bacid\b|\blab waste\b/ },
  { system: 'gas', re: /\bgas\b|\blp\b|propane/ },
  { system: 'water', re: /water|\bcw\b|\bhw\b|\bhwr\b|\bcold\b|\bhot\b|\bdom(?:estic)?\b|\bpex\b/ },
]

function detectSystem(name: string): PipeSystem | null {
  for (const t of SYSTEM_TESTS) if (t.re.test(name)) return t.system
  return null
}

const FITTING_RE = /(?:^|[\s·(])(90|45|22|tee|wye|ell|elbow|coupling|combo|bend)(?:s?\b)/
const FOOTAGE_RE = /\bft\b\.?|\blf\b|footage|lin(?:ear)?\s*(?:ft|feet)|\bfeet\b/

/** Common fixture-schedule aliases so 'Water Closet (floor)' matches 'WC'. */
const FIXTURE_ALIASES: Array<{ key: string; re: RegExp }> = [
  { key: 'wc', re: /water closet|\bwc\b|toilet/ },
  { key: 'lav', re: /lav(?:atory)?\b/ },
  { key: 'ur', re: /urinal|\bur\b/ },
  { key: 'fd', re: /floor drain|\bfd\b/ },
  { key: 'fs', re: /floor sink|\bfs\b/ },
  { key: 'hb', re: /hose bibb?|\bhb\b|wall hydrant|\bwh-?\d/ },
  { key: 'wh', re: /water heater|\bwh\b/ },
  { key: 'co', re: /clean ?out|\bco\b|\bwco\b|\bfco\b/ },
  { key: 'ms', re: /mop sink|service sink|\bms\b|\bss\b/ },
  { key: 'ewc', re: /drinking fountain|electric water cooler|\bewc\b|\bdf\b/ },
  { key: 'sink', re: /\bsink\b|\bsk\b/ },
  { key: 'hr', re: /hose reel|\bhr\b/ },
  { key: 'tp', re: /trap primer|\btp\b/ },
  { key: 'gi', re: /grease (?:trap|interceptor)|\bgi\b/ },
  { key: 'wb', re: /wash(?:er)? box|ice maker box|\bwb\b|\bimb\b/ },
  { key: 'shower', re: /shower|\bsh\b/ },
  { key: 'tub', re: /\btub\b|bathtub/ },
  { key: 'wm', re: /washing machine|\bwm\b/ },
  { key: 'gd', re: /garbage disposal|disposer|\bgd\b/ },
]

function normalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/[”″]/g, '"')
    .replace(/[‐–—-]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
}

export function parseRowSignature(rawName: string): RowSignature {
  const name = normalize(rawName)
  const { size, rest } = extractSize(name)
  const system = detectSystem(name)
  const fittingMatch = rest.match(FITTING_RE)
  const isFootage = FOOTAGE_RE.test(name)
  if (isFootage) return { kind: 'footage', size, system, fitting: null, fixtureKey: null }
  if (fittingMatch) {
    const f = fittingMatch[1] === 'elbow' ? 'ell' : (fittingMatch[1] ?? null)
    return { kind: 'fitting', size, system, fitting: f, fixtureKey: null }
  }
  for (const a of FIXTURE_ALIASES) {
    if (a.re.test(name)) return { kind: 'fixture', size: null, system: null, fitting: null, fixtureKey: a.key }
  }
  // Pipe-run heuristic: '3/4IN WATER' style — size + system with nothing else
  // meaningful left reads as footage even without an explicit 'ft'.
  if (size && system) {
    const leftover = rest
      .replace(/\b(?:of|pipe|piping|line|run|type|l|m|k|cpvc|pvc|pex|copper|ci|cast iron|no ?hub|sch ?40|sch ?80)\b/g, ' ')
      .replace(SYSTEM_TESTS.find((t) => t.system === system)!.re, ' ')
      .replace(/[^a-z0-9]/g, '')
    if (leftover.length <= 2) return { kind: 'footage', size, system, fitting: null, fixtureKey: null }
  }
  // Unknown equipment: first two meaningful tokens as the key.
  const tokens = normalize(rawName)
    .replace(/\(.*?\)/g, ' ')
    .replace(/[^a-z0-9/ ]/g, ' ')
    .split(' ')
    .filter(Boolean)
  return { kind: 'fixture', size: null, system: null, fitting: null, fixtureKey: tokens.slice(0, 2).join(' ') || 'unknown' }
}

export function signatureKey(sig: RowSignature): string {
  if (sig.kind === 'fixture') return `fx|${sig.fixtureKey}`
  // Fittings match on size + type only: the robot names them bare ('4" Tee')
  // while human rows often carry the system ('4IN TEE WASTE').
  if (sig.kind === 'fitting') return `fitting|${sig.size ?? '?'}|${sig.fitting ?? ''}`
  return `${sig.kind}|${sig.size ?? '?'}|${sig.system ?? '?'}`
}

export interface DiffEntry {
  key: string
  /** Display name — ours when we have the row, else the robot's. */
  label: string
  robotCount: number
  ourCount: number
  robotExt: number
  ourExt: number
  /** Signed dollars: robot minus ours (missed rows are negative). */
  impact: number
}

export interface TakeoffDiff {
  missed: DiffEntry[]
  added: DiffEntry[]
  gaps: DiffEntry[]
  /** Matched rows whose quantities agree within tolerance. */
  matchedOkCount: number
}

interface SideAgg {
  label: string
  labelExt: number
  count: number
  ext: number
  sig: RowSignature
}

function aggregateBySignature(rows: TakeoffDiffRow[]): Map<string, SideAgg> {
  const out = new Map<string, SideAgg>()
  for (const r of rows) {
    if (!r.name?.trim() || !(r.count > 0)) continue
    const sig = parseRowSignature(r.name)
    const key = signatureKey(sig)
    const cur = out.get(key)
    if (cur) {
      cur.count += r.count
      cur.ext += r.ext
      if (r.ext > cur.labelExt) {
        cur.label = r.name
        cur.labelExt = r.ext
      }
    } else {
      out.set(key, { label: r.name, labelExt: r.ext, count: r.count, ext: r.ext, sig })
    }
  }
  return out
}

const byImpact = (a: DiffEntry, b: DiffEntry) => Math.abs(b.impact) - Math.abs(a.impact)

/** Quantities agree when within ±tolerance of the larger side (default 15%). */
export function diffTakeoffs(robotRows: TakeoffDiffRow[], ourRows: TakeoffDiffRow[], tolerance = 0.15): TakeoffDiff {
  const robot = aggregateBySignature(robotRows)
  const ours = aggregateBySignature(ourRows)
  const missed: DiffEntry[] = []
  const added: DiffEntry[] = []
  const gaps: DiffEntry[] = []
  let matchedOkCount = 0
  for (const [key, o] of ours) {
    const r = robot.get(key)
    if (!r) {
      missed.push({ key, label: o.label, robotCount: 0, ourCount: o.count, robotExt: 0, ourExt: o.ext, impact: -o.ext })
      continue
    }
    const spread = Math.abs(r.count - o.count) / Math.max(r.count, o.count)
    if (spread <= tolerance) matchedOkCount += 1
    else gaps.push({ key, label: o.label, robotCount: r.count, ourCount: o.count, robotExt: r.ext, ourExt: o.ext, impact: r.ext - o.ext })
  }
  for (const [key, r] of robot) {
    if (ours.has(key)) continue
    added.push({ key, label: r.label, robotCount: r.count, ourCount: 0, robotExt: r.ext, ourExt: 0, impact: r.ext })
  }
  missed.sort(byImpact)
  added.sort(byImpact)
  gaps.sort(byImpact)
  return { missed, added, gaps, matchedOkCount }
}

/**
 * One-tap verdicts (the auditor's judgment IS the teaching signal). The tag
 * prefix is machine-parseable by the digest sweep and maps onto its outcomes:
 *   teach  → the robot's playbook/price-book (digest: doctrine/books)
 *   record → our reference bid is wrong → repair task (digest: reference_quality)
 *   ok     → scope difference / judgment call, no change (digest: bid_only)
 */
export type AuditVerdict = 'teach' | 'record' | 'ok'

export const AUDIT_VERDICT_TAG: Record<AuditVerdict, string> = {
  teach: '[verdict:teach]',
  record: '[verdict:record]',
  ok: '[verdict:ok]',
}

const fmtQty = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1))
const fmtUsd = (n: number) => `$${Math.round(Math.abs(n)).toLocaleString()}`

/** Drafted note body for a verdict on a diff entry — posted as-is for 'ok', editable first for the rest. */
export function buildVerdictDraft(verdict: AuditVerdict, e: Pick<DiffEntry, 'label' | 'robotCount' | 'ourCount' | 'robotExt' | 'ourExt'>): string {
  const tag = AUDIT_VERDICT_TAG[verdict]
  if (verdict === 'ok') return `${tag} ${e.label} — both fine (scope difference / judgment call).`
  if (verdict === 'record') return `${tag} ${e.label} — our record looks off (robot ×${fmtQty(e.robotCount)}, ours ×${fmtQty(e.ourCount)}). `
  if (e.robotCount === 0) return `${tag} ${e.label} — robot missed this (ours ×${fmtQty(e.ourCount)}, ${fmtUsd(e.ourExt)}). `
  if (e.ourCount === 0) return `${tag} ${e.label} — robot added this (×${fmtQty(e.robotCount)}, ${fmtUsd(e.robotExt)}); we don't carry it. `
  return `${tag} ${e.label} — robot ×${fmtQty(e.robotCount)} vs ours ×${fmtQty(e.ourCount)}. `
}

/** Which composer section a diff row's verdict note belongs in. */
export function entrySection(label: string): 'footage' | 'counts' {
  return parseRowSignature(label).kind === 'footage' ? 'footage' : 'counts'
}

export interface SystemRollupRow {
  label: string
  unit: 'ft' | 'ea'
  robot: number
  ours: number
}

const ROLLUP_GROUPS: Array<{ label: string; systems: Array<PipeSystem | null> }> = [
  { label: 'Waste + vent', systems: ['waste', 'vent'] },
  { label: 'Water', systems: ['water'] },
  { label: 'Gas', systems: ['gas'] },
  { label: 'Med-gas', systems: ['medgas'] },
  { label: 'Storm', systems: ['storm'] },
  { label: 'Other pipe', systems: ['condensate', 'other', null] },
]

/** Footage feet per system group + fixture count, robot vs ours. */
export function rollupSystems(robotRows: TakeoffDiffRow[], ourRows: TakeoffDiffRow[]): SystemRollupRow[] {
  const tally = (rows: TakeoffDiffRow[]) => {
    const ft = new Map<string, number>()
    let fixtures = 0
    for (const r of rows) {
      if (!r.name?.trim() || !(r.count > 0)) continue
      const sig = parseRowSignature(r.name)
      if (sig.kind === 'footage') {
        const group = ROLLUP_GROUPS.find((g) => g.systems.includes(sig.system))
        if (group) ft.set(group.label, (ft.get(group.label) ?? 0) + r.count)
      } else if (sig.kind === 'fixture') {
        fixtures += r.count
      }
    }
    return { ft, fixtures }
  }
  const r = tally(robotRows)
  const o = tally(ourRows)
  const out: SystemRollupRow[] = []
  for (const g of ROLLUP_GROUPS) {
    const robot = r.ft.get(g.label) ?? 0
    const ours = o.ft.get(g.label) ?? 0
    if (robot > 0 || ours > 0) out.push({ label: g.label, unit: 'ft', robot, ours })
  }
  if (r.fixtures > 0 || o.fixtures > 0) out.push({ label: 'Fixtures', unit: 'ea', robot: r.fixtures, ours: o.fixtures })
  return out
}
