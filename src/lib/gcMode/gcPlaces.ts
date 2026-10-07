/**
 * GC mode design spike: too many trades in one place, the Gantt's G-83 (mock-up
 * `to-dos/gc-mode/mockups/G-83.md`). A bar's place is a plain word the office keeps on it: Roof,
 * Inside, Site, Level 2. Where one can be made, a guess comes from the bar's name, its trade or its
 * stage. A guess is shown as a guess and counts for nothing until the office keeps it, so a job with
 * no place kept is flagged nowhere.
 *
 * With places kept, a day with TRADES_IN_ONE_PLACE trades or more in one place is too many. It is
 * counted by the day, by the plan's own dates as G-84 counts people, from today on, and flagged by
 * the week: on the chart's lane, before a move saves, on the morning list and on the call list. The
 * people said beside it are G-84's numbers (`crewNumbers`), never a second rule.
 *
 * Its own file, out of the barrel: the reducer, the Schedule tab, the morning list and the call list read it.
 */
// What moved to main (the real build) is re-exported from there, so there is one copy.
export type { CrowdedCall, CrowdedSpell, CrowdedTrade, CrowdedWeek } from '../gc/schedule/places'
export { crowdedCalls, crowdedPlaces, crowdedSpells, crowdedWeeks, morningCrowding, placesSummary } from '../gc/schedule/places'

export type { CrowdingChange, PlaceChange, PlaceFrom, PlaceGuess, PlaceRow } from '../gc/schedule/places'
export { PLACE_MAX, PLACE_RULE, TRADES_IN_ONE_PLACE, cleanPlace, crowdingAfterMove, keptPlaces, placeChanges, placeGuess, placeProblem, placeRows, placesLogWords, takesPlace, withPlaces } from '../gc/schedule/places'
