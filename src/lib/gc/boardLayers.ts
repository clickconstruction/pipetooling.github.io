/**
 * GC mode, the real build, the Board's B2b-vi-c: the board with what the ring counts laid over it, one state for the ring
 * on each row and for How the stage is going under a project's title (the Board's B2b-vii), so the two never give two
 * answers (to-dos/gc-mode/mockups/board-b2b-vi.md on branch spike/gc-mode, call L). The layers go on in the Schedule
 * window's own order (`scheduleHoldsState`): the logs with our crew's clock-ins, the change orders' office half, the draws
 * with the trades' side of the change orders, the submittals; then the trades' asks for a change, the punch lists, the
 * schedules and our crew's percent. A layer not given is not read, and `ringReady` leaves out every stage that counts it,
 * so a ring waits rather than reading a missing layer as nothing.
 */
import { withSchedules } from './billCustomer'
import { withOfficeChangeOrders, type ChangeOrderOfficeRow } from './changeOrderOfficeRows'
import { withChangeRequests, type ChangeRequestRow } from './changeOrderRows'
import { withCrewPercents, type CrewJobRead } from './crewJobRows'
import { withCrewClockIns, withDailyLogs, type CrewOnSiteRow, type DailyLogRow } from './dailyLogRows'
import { withDraws, withTradeChanges, type DrawTables } from './drawRows'
import { withPunch, type PunchRow } from './punchRows'
import { withSubmittals, type SubmittalTables } from './submittalRows'
import type { GcProject, GcStage, GcState } from './types'

/** What the ring reads beyond the board, each read or not. */
export interface BoardLayers {
  logs?: DailyLogRow[]
  clockIns?: readonly CrewOnSiteRow[]
  changeOrders?: readonly ChangeOrderOfficeRow[]
  draws?: DrawTables
  submittals?: SubmittalTables
  changeRequests?: ChangeRequestRow[]
  punch?: PunchRow[]
  schedules?: ReadonlyMap<string, GcProject['schedule'] | null>
  crewPercents?: readonly CrewJobRead[]
}

export type BoardLayer = keyof BoardLayers

/** The layers each stage's ring counts. Bidding counts only the board. */
export const RING_LAYERS: Record<GcStage, readonly BoardLayer[]> = {
  pursuing: [],
  buyout: ['schedules'],
  building: ['logs', 'clockIns', 'changeOrders', 'draws', 'submittals', 'changeRequests', 'punch', 'schedules', 'crewPercents'],
}

/** The board with every layer given laid over it. A layer not given leaves the board as it was. */
export function boardLayers(board: GcState, layers: BoardLayers): GcState {
  let s = board
  if (layers.logs) s = withCrewClockIns(withDailyLogs(s, layers.logs), layers.clockIns ?? [])
  if (layers.changeOrders) s = withOfficeChangeOrders(s, layers.changeOrders)
  if (layers.draws) s = withTradeChanges(withDraws(s, layers.draws), layers.draws)
  if (layers.submittals) s = withSubmittals(s, layers.submittals)
  if (layers.changeRequests) s = withChangeRequests(s, layers.changeRequests)
  if (layers.punch) s = withPunch(s, layers.punch)
  if (layers.schedules) s = withSchedules(s, layers.schedules)
  if (layers.crewPercents) s = withCrewPercents(s, layers.crewPercents)
  return s
}

/** The stages, of those the reader may see, whose every layer was read: the rings that may draw now. */
export function ringReady(stages: ReadonlySet<GcStage>, layers: BoardLayers): Set<GcStage> {
  return new Set([...stages].filter((stage) => RING_LAYERS[stage].every((l) => layers[l] !== undefined)))
}
