/**
 * GC mode — design spike: how the stage is going, for the strip under a project's title (the owner,
 * 2026-10-04: "at the top of this page we should have some sort of visual that describes the health
 * of the stage"; he took the revised design in `to-dos/gc-mode/stage-health-mockup.html`). Every
 * stage reads the same way: a verdict with its reason, the stage's calendar, one tile a trade, a few
 * numbers, and the one thing to do next. The counts are the ring's own (`stageProgress`), so the
 * board and the project page never give two answers.
 */
// What moved to main (the real build) is re-exported from there, so there is one copy.
export type { CalendarDay, CalendarWeek, HealthBar, HealthNumber, HealthTab, HealthTile, HealthVerdict, StageCalendar, StageHealth, TileDot, TileState } from '../gc/stageHealth'
export { HEALTH_HOLE_DAYS, HEALTH_LAST_DAYS, HEALTH_SLIP_DAYS, HEALTH_START_DAYS, stageHealth, tradeHasNumber, weekIsQuiet, weekWorkingDays, workingDaysLeft } from '../gc/stageHealth'

export { quotesWantedOn } from '../gc/planQuestions'
