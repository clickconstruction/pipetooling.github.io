/**
 * Stage recognition (Where the Job Is, PR 2 — owner-approved 2026-09-14).
 *
 * The v2.3083 backfill made every line item kind `any`, and the only way to
 * get a numbered stage is the In order / Any time selector on the Bill tab. On
 * 2026-09-14 no production job had one — while seven jobs in the ledger were
 * split exactly `Rough In · Top Out · Trim Set` by the segment generator's
 * preset, four of them Working. The plumbing vocabulary in ascending order IS
 * a stage plan; this module reads it so nobody has to declare it.
 *
 * The rule: a job's priced rows are recognized as Order stages when
 *   - no row is an explicit Order (the office declared a plan — leave it),
 *   - at least two priced rows whose kind is the `any` default carry a stage
 *     word (Ground / Pre-pour → Rough → Top Out → Trim → Final), and
 *   - their ranks never go backwards in sequence order (a second "Rough In"
 *     row is fine; Trim before Rough is not — that job is not in order).
 * Rows with no stage word (Permit, Change order, Materials) stay Any; a
 * deliberate plain row (kind null) is never recognized. A three-line service
 * job (Diagnostic · Parts · Labor) matches nothing and keeps one bar.
 *
 * Recognition is DISPLAY and REPORTING only: the Pipeline row draws the
 * stages and the crew's report picker offers them. The Bill tab's draw rules
 * (draws wait on the stage above) stay behind the explicit Order flag — the
 * owner's decision, 2026-09-14, "row only, for now". Pure.
 */

export type StageRank = 0 | 1 | 2 | 3 | 4

/** Ground / pre-pour → rough → top out → trim → final. `null` = not a stage word. */
export function stageRank(name: string | null | undefined): StageRank | null {
  const n = (name ?? '')
    .trim()
    .toLowerCase()
    .replace(/^(stage|phase|step)\s*\d+\s*[-–—:.]?\s*/, '')
    .replace(/^\d+\s*[-–—:.)]\s*/, '')
  if (!n) return null
  if (/^(under\s*ground|under\s*slab|ground\s*work|groundwork|pre[\s-]?pour|slab)\b/.test(n)) return 0
  if (/^rough/.test(n)) return 1
  if (/^(top|stack)[\s-]?out/.test(n)) return 2
  if (/^(trim|finish(es|ing)?)\b/.test(n)) return 3
  if (/^(final|punch)\b/.test(n)) return 4
  return null
}

export type RecognizableFixture = {
  id: string
  name: string | null
  count: number | null
  line_unit_price: number | null
  sequence_order: number | null
  /** Read loosely: `'order'` / `'any'` / anything else (null, undefined, unknown) = plain. */
  stage_kind?: string | null
}

export type StageRecognition = {
  /** True when the rows below were read as a plan. False = nothing changes. */
  recognized: boolean
  /** Fixture ids to treat as Order stages, in sequence order. Empty unless recognized. */
  orderIds: ReadonlyArray<string>
  /** Why not, for a tooltip or a test: `explicit` (an Order row exists), `too-few`, `out-of-order`. */
  reason: 'explicit' | 'too-few' | 'out-of-order' | null
}

const priced = (f: RecognizableFixture) => (Number(f.count) || 0) * (Number(f.line_unit_price) || 0) > 0

export function recognizeStages(fixtures: ReadonlyArray<RecognizableFixture>): StageRecognition {
  if (fixtures.some((f) => f.stage_kind === 'order')) return { recognized: false, orderIds: [], reason: 'explicit' }
  const candidates = [...fixtures]
    .filter((f) => f.stage_kind === 'any' && priced(f) && stageRank(f.name) != null)
    .sort((a, b) => (a.sequence_order ?? 0) - (b.sequence_order ?? 0))
  if (candidates.length < 2) return { recognized: false, orderIds: [], reason: 'too-few' }
  let last: StageRank = 0
  for (const f of candidates) {
    const r = stageRank(f.name)!
    if (r < last) return { recognized: false, orderIds: [], reason: 'out-of-order' }
    last = r
  }
  return { recognized: true, orderIds: candidates.map((f) => f.id), reason: null }
}

/**
 * The same rows with recognized ids re-kinded to `order`. Untouched (same
 * array) when nothing was recognized, so callers can `===` for "unchanged".
 */
export function applyRecognizedStages<T extends RecognizableFixture>(fixtures: ReadonlyArray<T>): { fixtures: ReadonlyArray<T>; recognized: boolean } {
  const r = recognizeStages(fixtures)
  if (!r.recognized) return { fixtures, recognized: false }
  const ids = new Set(r.orderIds)
  return { fixtures: fixtures.map((f) => (ids.has(f.id) ? { ...f, stage_kind: 'order' } : f)), recognized: true }
}
