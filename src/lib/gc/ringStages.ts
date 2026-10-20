/**
 * GC mode, the real build, the Board's B2b-vi-c: which stages' rings a reader sees (call L of
 * to-dos/gc-mode/mockups/board-b2b-vi.md on branch spike/gc-mode). A kernel cannot tell a layer not read from a layer
 * that is empty, so a ring that counted a table its reader cannot read would give a false count: no logs read reads as
 * "no daily log" every day, no draws read as 0% built. So a stage's ring draws only for a reader every source it counts
 * lets in. A GC table lets a role in through `GC_TABLE_DOORS` (its door, or its wider `reads`); anything else the ring
 * counts is named in `GC_OTHER_SOURCES` with its own readers. So a door PR that widens a table widens the ring with no
 * edit here.
 */
import type { UserRole } from '../../hooks/useAuth'
import { GC_BUILDING_TEAM, GC_MONEY_TEAM, GC_OFFICE_TEAM, GC_SCHEDULE_TEAM } from './access'
import { GC_TABLE_DOORS, type GcDoor } from './doors'
import type { GcStage } from './types'

/** Who a door lets read: the database's `gc_office_team()`, `gc_on_schedule_team()`, `gc_money_team()` and `is_dev()`. */
const DOOR_READERS: Record<GcDoor, readonly UserRole[]> = { office: GC_OFFICE_TEAM, schedule: GC_SCHEDULE_TEAM, money: GC_MONEY_TEAM, dev: ['dev'] }

/** What the ring counts that is not a GC table, each with who reads it. */
export const GC_OTHER_SOURCES: Record<string, { about: string; readers: readonly UserRole[] }> = {
  gc_company_paper_states: { about: 'the companies’ papers, through the function the Board reads them with (v2.5179)', readers: GC_OFFICE_TEAM },
  gc_change_orders_office: { about: 'the change orders’ days and words with no money, the view the schedule reads (its PR 16b-i)', readers: GC_OFFICE_TEAM },
  crew_clock_ins: { about: 'our crew’s clock-ins on its Pipeline job (`gc_crew_on_site`), read with the daily logs (Building’s U8)', readers: GC_BUILDING_TEAM },
  crew_percents: { about: 'our crew’s percent from its Pipeline job (Building’s U8), for a dev and the money team', readers: [...new Set([...GC_BUILDING_TEAM, ...GC_MONEY_TEAM])] },
}

const BIDDING = [
  'gc_projects',
  'gc_trade_packages',
  'gc_scope_items',
  'gc_plan_sets',
  'gc_plan_set_items',
  'gc_plan_set_sends',
  'gc_companies',
  'gc_invites',
  'gc_quotes',
  'gc_company_contacts',
  'gc_trade_promises',
  'gc_trade_promise_moves',
] as const

/** The schedule's tables: `loadSchedule` reads every table of the Schedule lane. */
const SCHEDULE = Object.entries(GC_TABLE_DOORS)
  .filter(([, d]) => d.lane === 'Schedule')
  .map(([table]) => table)
const BUYING_OUT = [...BIDDING, 'gc_sows', 'gc_sow_lines', 'gc_company_paper_states', ...SCHEDULE]
const BUILDING = [
  ...BUYING_OUT,
  'gc_draws',
  'gc_draw_lines',
  'gc_sow_line_reports',
  'gc_back_charges',
  'gc_change_order_trade_sends',
  'gc_change_orders_office',
  'gc_trade_change_requests',
  'gc_daily_logs',
  'gc_daily_log_crews',
  'gc_daily_log_delays',
  'crew_clock_ins',
  'crew_percents',
  'gc_punch_items',
  'gc_submittals',
  'gc_submittal_rounds',
  'gc_submittal_holds',
]

/** What each stage's ring counts: Bidding the asks and quotes, Buying out Get started, Building the work reported and the job's own. */
export const RING_SOURCES: Record<GcStage, readonly string[]> = { pursuing: BIDDING, buyout: BUYING_OUT, building: BUILDING }

/** Who reads one source. Null: neither map names it, which the test refuses. */
export function sourceReaders(source: string): readonly UserRole[] | null {
  const door = GC_TABLE_DOORS[source]
  if (door) return [...new Set([...DOOR_READERS[door.door], ...(door.reads ? DOOR_READERS[door.reads] : [])])]
  return GC_OTHER_SOURCES[source]?.readers ?? null
}

/** The stages whose ring this reader sees: those whose every source lets them read. */
export function ringStages(role: UserRole | null | undefined): Set<GcStage> {
  const out = new Set<GcStage>()
  if (!role) return out
  for (const [stage, sources] of Object.entries(RING_SOURCES) as [GcStage, readonly string[]][]) {
    if (sources.every((s) => sourceReaders(s)?.includes(role))) out.add(stage)
  }
  return out
}
