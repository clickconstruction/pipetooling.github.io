import type { StageRank } from './stageRecognition'

/**
 * One table of line names and the stage each must read as (punch list #397, PR 6).
 *
 * Two things read a stage from a line's name: the app's `stageRank` and the database's
 * `stage_checklist_kind_of`. They are two pieces of code in two languages, so this table is what
 * holds them in step. `stageRecognition.test.ts` runs every row through `stageRank`, and checks
 * that `supabase/tests/stage_kind/20_scenario.sql` asserts the same row against the database's
 * function. A row added here fails that test until the scenario carries it.
 *
 * The names are made up, in the shapes real lines take. `null` = the name stands for no stage.
 */
export const STAGE_NAME_TABLE: ReadonlyArray<readonly [name: string, rank: StageRank | null]> = [
  // The start of the name gives the stage.
  ['Underground', 0],
  ['Under slab plumbing', 0],
  ['Pre-pour', 0],
  ['Rough In', 1],
  ['ROUGH-IN', 1],
  ['Rough-in plumbing, 2nd floor', 1],
  ['Top Out', 2],
  ['Top-out, sewer line, water line', 2],
  ['topout', 2],
  ['Stack out', 2],
  ['Trim Set', 3],
  ['Trim out', 3],
  ['Finish', 3],
  ['Final', 4],
  ['Final invoice', 4],
  ['Punch', 4],
  // A leading number or "Stage 2" is dropped first.
  ['Stage 2 — Top Out', 2],
  ['Phase 1: Rough In', 1],
  ['3. Trim Set', 3],
  // "Set trim" is the trim stage said the other way round.
  ['Set trim', 3],
  ['set trim', 3],
  // Words of the same bid stage may sit together.
  ['Rough in and underground', 1],
  ['Trim and final', 3],
  // A name that also holds another stage's word stands for none.
  ['Rough in, top out and trim. Water heater included.', null],
  ['Rough and top out', null],
  ['Top out and trim', null],
  ['Final invoice, materials for the top-out', null],
  // A stage's word in the middle of a sentence gives no stage.
  ['Installed shower trim and reset toilet', null],
  ['Half bath trim out', null],
  ['Trip charge for a dry run to start rough in', null],
  // Everything else.
  ['Bid price', null],
  ['Job total (migrated)', null],
  ['Per plans', null],
  ['Change order: chip and move manifold', null],
  ['Permit', null],
  ['Laptop', null],
  ['', null],
]

/** The checklist kind a rank carries, as the database's function answers it: ground and final carry none. */
export function stageKindOfRank(rank: StageRank | null): 'rough_in' | 'top_out' | 'trim_set' | null {
  return rank === 1 ? 'rough_in' : rank === 2 ? 'top_out' : rank === 3 ? 'trim_set' : null
}

/** The scenario's line for a row, which the unit test looks for word for word. */
export function stageNameScenarioLine(name: string, rank: StageRank | null): string {
  const kind = stageKindOfRank(rank)
  const q = (s: string) => `'${s.replace(/'/g, "''")}'`
  return `SELECT sk.same(${q(name)}, public.stage_checklist_kind_of(${q(name)}), ${kind ? q(kind) : 'NULL'});`
}
