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

/** The bid's three stages, which is as fine as a job line's name is ever read: ground and rough, top out, trim and final. */
export type StageGroup = 'rough' | 'top' | 'trim'

/** The bid stage a rank falls in: ground and rough are Rough In, top out is Top Out, trim and final are Trim Set. */
export function stageGroupOfRank(rank: StageRank): StageGroup {
  return rank <= 1 ? 'rough' : rank === 2 ? 'top' : 'trim'
}

/** A stage's word anywhere in a name, by group. These never give a line a stage; they only say a second stage is named. */
const GROUP_WORDS: Record<StageGroup, RegExp> = {
  rough: /\b(under\s*ground|under\s*slab|ground\s*work|groundwork|pre[\s-]?pour|slab)\b|\brough/,
  top: /\b(top|stack)[\s-]?out\b/,
  trim: /\b(trim|finish(es|ing)?|final|punch)\b/,
}

/**
 * Ground / pre-pour → rough → top out → trim → final. `null` = not a stage word.
 *
 * The one reader of a stage's name (punch list #397, PR 6). The bid's side used to keep its own
 * (`bidStageOfLine`), which found the word anywhere in the name, so a service line such as
 * "installed shower trim" read as the Trim stage. It reads through this now. The database keeps
 * the same rule for filing a checklist as a record (`stage_checklist_kind_of`), and one table of
 * names, `STAGE_NAME_TABLE` in the test beside this file, holds the two in step.
 *
 * The rule:
 *   - the START of the name gives the stage, after a leading "Stage 2 —" or "3." is dropped;
 *   - "Set trim" is the trim stage said the other way round;
 *   - a name that also holds the word of a DIFFERENT bid stage stands for none: "Rough in, top
 *     out and trim" is the whole job on one line, not its rough-in. Words of the same bid stage
 *     may sit together ("Rough in and underground", "Trim and final").
 */
export function stageRank(name: string | null | undefined): StageRank | null {
  const n = (name ?? '')
    .trim()
    .toLowerCase()
    .replace(/^(stage|phase|step)\s*\d+\s*[-–—:.]?\s*/, '')
    .replace(/^\d+\s*[-–—:.)]\s*/, '')
  if (!n) return null
  let rank: StageRank | null = null
  if (/^(under\s*ground|under\s*slab|ground\s*work|groundwork|pre[\s-]?pour|slab)\b/.test(n)) rank = 0
  else if (/^rough/.test(n)) rank = 1
  else if (/^(top|stack)[\s-]?out/.test(n)) rank = 2
  else if (/^(trim|finish(es|ing)?)\b/.test(n) || /^set\s+trim\b/.test(n)) rank = 3
  else if (/^(final|punch)\b/.test(n)) rank = 4
  if (rank == null) return null
  const own = stageGroupOfRank(rank)
  for (const g of ['rough', 'top', 'trim'] as const) if (g !== own && GROUP_WORDS[g].test(n)) return null
  return rank
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
