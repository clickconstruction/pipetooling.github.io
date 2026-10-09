/**
 * GC mode design spike: By company as a call list, the Gantt's G-115 (`to-dos/gc-mode/GANTT_PLAN.md`,
 * mock-up `to-dos/gc-mode/mockups/G-115.md`). The office groups the chart by company because it is
 * about to pick up the phone. This is the list it works from: one row per person whose answer moves
 * the chart, every reason under their name, with Follow up's own Call and Follow up on each.
 *
 * - A hired trade, for its bars: an inspection that failed on its work, a bar late, due today or
 *   behind, new dates told and not answered or answered with another day, its own word from its
 *   portal that a bar will be late (G-117), a first day nobody confirmed.
 * - Whoever owes what holds a bar. Every hold on it counts, not only the one the chart's pill shows:
 *   a submittal, an RFI and a wait from their own records, any other kind (G-77's paperwork, one
 *   added later) from the chart's own map. The rule is keyed by the hold's kind and who owes it; a
 *   kind it does not know is the trade's own, worded as the chart words it. A hold that waits on
 *   us, the city or the utility is an aside under the trade, never a row: nobody to call.
 * - A trade whose crew now is short enough that it alone moves the finish (G-57's pick 2), in the
 *   days the Projected finish's second line says.
 * - Then everything else they owe on this job (`projectPeople`'s reasons): one call covers it all.
 *
 * Its own file, out of the barrel: it reads the schedule, the chart's holds and Follow up.
 */
import type { GcAction } from './gcTypes'
import { type FollowItem, type FollowPerson } from './gcFollowUpSheet'
// What moved to main (the real build) is re-exported from there, so there is one copy.
import type { DatesAnswer } from '../gc/schedule/callList'
export type { BarCaller, CallList, CallPerson, CallReason, CallRef, DatesAnswer, Words } from '../gc/schedule/callList'
export { barCaller, callList, callListFollowPeople, callListTitle, callRows, callSheetId, scheduleItem } from '../gc/schedule/callList'

/** A company has this many days to answer its new dates before a call is due (it moved to gcCounts.ts with the loops that read it). */
export { CONFIRM_WITHIN_DAYS } from './gcCounts'

/**
 * What a saved call does past logging it (G-115's pick 2), each through an action that exists:
 * new dates answered as the portal would; a day given on a delivery or a decision becomes its
 * expected day, with who said it; a day given on a submittal or a start becomes their word, which
 * Follow up chases and Building keeps. A day on late work is only logged with the call (G-117).
 */
export function callListCallActions(person: FollowPerson, items: FollowItem[], answer: { dates: DatesAnswer; day: string | null; said: string; by: string }): GcAction[] {
  const out: GcAction[] = []
  const seen = new Set<string>()
  const once = (key: string, action: GcAction) => {
    if (seen.has(key)) return
    seen.add(key)
    out.push(action)
  }
  const note = answer.said.trim()
  for (const i of items) {
    const s = i.schedule
    if (i.kind !== 'schedule' || !s || !i.projectId) continue
    if (s.kind === 'dates' && s.moveId && answer.dates !== 'none') {
      once(`dates:${s.moveId}`, {
        type: 'tradeAnswerDates',
        projectId: i.projectId,
        partnerId: person.partner.id,
        moveId: s.moveId,
        ok: answer.dates === 'work',
        ...(answer.dates === 'another' && answer.day ? { day: answer.day } : {}),
        ...(note ? { note } : {}),
      })
      continue
    }
    if (!answer.day) continue
    if (s.kind === 'held' && (s.hold === 'delivery' || s.hold === 'decision') && s.waitId) {
      once(`wait:${s.waitId}`, { type: 'setScheduleWaitStep', projectId: i.projectId, waitId: s.waitId, step: 'expected', on: answer.day, note: `${person.reach.first} said so on a call with ${answer.by}.` })
    } else if (s.kind === 'held' && s.hold === 'submittal' && s.packageId && !person.partner.id.startsWith('customer:')) {
      once(`submittals:${s.packageId}`, { type: 'recordPromise', partnerId: person.partner.id, kind: 'submittals', projectId: i.projectId, packageId: s.packageId, by: answer.day, from: 'office' })
    } else if (s.kind === 'start' && s.packageId) {
      once(`start:${s.packageId}`, { type: 'recordPromise', partnerId: person.partner.id, kind: 'start', projectId: i.projectId, packageId: s.packageId, by: answer.day, from: 'office' })
    }
  }
  return out
}
