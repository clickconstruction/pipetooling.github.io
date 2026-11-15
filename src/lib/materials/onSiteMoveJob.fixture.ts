/**
 * Materials on site (punch list #209, v2.7305): the plan `on_site_move_job` hands back, in the dev seat's own shape
 * (`dev_on_site_move_job` since v2.6808, the four tables of 2026-11-13 since v2.7265), as a fixture for the kernel's
 * tests, the window's render tests and the seat's `devMcpWrites.test.ts`. Gun Dog's two jobs on 2026-11-14.
 */
export const PLAN_FROM = '7d759246-0000-4000-8000-000000000224'
export const PLAN_TO = '7d759246-0000-4000-8000-000000001091'

/** `on_site_job_counts` as the database sends it (every key a number). */
export const planCounts = (o: Partial<Record<string, number>>) => ({ places: 0, containers: 0, retired_containers: 0, movements: 0, container_moves: 0, photos: 0, part_renames: 0, sticker_runs: 0, ties: 0, prices: 0, site_ties: 0, site_prices: 0, lines_on_hand: 0, parts_on_hand: 0, ...o })

/** The reply `on_site_move_job` hands back, the seat's shape since v2.7265: Gun Dog's two jobs. */
export const PLAN_REPLY = {
  ok: true,
  dry_run: true,
  from: { id: PLAN_FROM, label: 'JP224', name: 'Materials: Phase 2 draws' },
  to: { id: PLAN_TO, label: 'JP1091', name: 'Lift stations and site visit' },
  by: 'Taunya',
  words: 'Everything on site on JP224 moves to JP1091: 92 cages and boxes (6 retired), 3 places, 284 ledger rows, 4 box moves, 91 photos. Every cage and box keeps its id and the code printed on its label; no ledger row is rewritten, only the job it sits under.',
  moved: planCounts({ places: 2, containers: 92, retired_containers: 6, movements: 284, container_moves: 4, photos: 91 }),
  places_merged: [{ name: 'Gun dog', containers: 5 }],
  unsorted_folded: null,
  labels_renamed: [{ code: '7D759246', kind: 'cage', from: 'G6', to: 'G95' }],
  photos: { rows: 91, in_drive: 90, waiting: 1, words: 'Every photo’s row moves with its box. 90 files are already in Drive and stay in JP224’s photo folder.' },
  ties: { into: 'site', dropped: [], words: 'No Same part? answers or prices of the job’s own to move.' },
  on_hand: { holds: true, words: 'The parts on hand add up: 2230 from JP224 and 3 already on JP1091 read 2233 after.' },
  before: { from: planCounts({ places: 3, containers: 92, retired_containers: 6, movements: 284, container_moves: 4, photos: 91, lines_on_hand: 117, parts_on_hand: 2230 }), to: planCounts({ places: 1, containers: 2, movements: 1, lines_on_hand: 1, parts_on_hand: 3 }) },
  after: { from: planCounts({}), to: planCounts({ places: 3, containers: 94, retired_containers: 6, movements: 285, container_moves: 4, photos: 91, lines_on_hand: 118, parts_on_hand: 2233 }) },
  notes: { from: 'Materials on site moved to JP1091 …', to: 'Materials on site moved here from JP224 …' },
  next: 'A phone that still has JP224 open on the On site tab should open JP1091 instead.',
}
