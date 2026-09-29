/**
 * The job's stage dates for the procurement log (v2.4083 / v2.4087) — shared by the
 * app (`src/lib/submittals/procurementLog.ts` re-exports these) and `get-submittal-room`,
 * so the office's log and the GC's room card read the same "required" dates.
 * Pure: no imports.
 */

export type ProcurementStageKey = 'rough_in' | 'top_out' | 'trim_set'
export type StageDates = Partial<Record<ProcurementStageKey, string>>

/** "Rough-in", "Underground" → rough_in; "Top out", "Above slab" → top_out; "Trim", "Finish", "Final" → trim_set. */
export function stageOfStageName(name: string | null | undefined): ProcurementStageKey | null {
  const n = (name ?? '').toLowerCase()
  if (!n) return null
  if (/rough|underground|slab|ground/.test(n)) return 'rough_in'
  if (/top\s*-?\s*out|above|wall|frame/.test(n)) return 'top_out'
  if (/trim|finish|final|set/.test(n)) return 'trim_set'
  return null
}

/** The earliest window start per stage across the job's Order stages (by their names). */
export function stageDatesFromJob(fixtures: ReadonlyArray<{ id: string; name: string; stage_kind: string | null }>, windows: ReadonlyArray<{ fixture_id: string; window_start: string | null }>): StageDates {
  const out: StageDates = {}
  const stageByFixture = new Map<string, ProcurementStageKey>()
  for (const f of fixtures) {
    if (f.stage_kind !== 'order') continue
    const s = stageOfStageName(f.name)
    if (s) stageByFixture.set(f.id, s)
  }
  for (const w of windows) {
    const s = stageByFixture.get(w.fixture_id)
    const start = w.window_start ? w.window_start.slice(0, 10) : null
    if (!s || !start) continue
    const cur = out[s]
    if (!cur || start < cur) out[s] = start
  }
  return out
}
