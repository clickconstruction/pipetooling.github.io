/**
 * GC mode design spike: the customer's schedule sent on its own, the Gantt's Phase 3 (G-94). The
 * Friday report carries the schedule's words; a customer who asks "where are we" on a Tuesday gets
 * this: the same picture as their portal, as a dated letter, kept as it went, and printable to a
 * PDF. Nothing leaves the app in the prototype; the record is the letter.
 *
 * Its own file, out of the barrel: it reads the customer's schedule kernel.
 */
import type { GcProject, GcState } from './gcTypes'
import { CUSTOMER_STAGE_WORDS, customerAsks, customerChanges, customerDoneWords, customerMilestones, customerStages, customerStanding } from './gcCustomerSchedule'
import { customerContractDays } from './gcChangeOrderDays'
import { lateFinish } from './gcLateFinish'
import { shortDate, weekdayDate } from './gcWords'
import { GC_COMPANY } from './gcFixture'
// What moved to main (the real build) is re-exported from there, so there is one copy.
import type { ScheduleLetter } from '../gc/schedule/customerScheduleSend'
export type { ScheduleLetter } from '../gc/schedule/customerScheduleSend'
export { customerScheduleHtml, scheduleSendRecord, scheduleSends } from '../gc/schedule/customerScheduleSend'

export function customerScheduleLetter(state: GcState, project: GcProject, by: string): ScheduleLetter {
  const customer = state.customers.find((c) => c.id === project.customerId)
  const contact = customer?.contact || customer?.name || project.owner
  const first = contact.split(/\s+/)[0] ?? contact
  const standing = customerStanding(state, project)
  const stages = customerStages(state, project)
  const milestones = customerMilestones(state, project)
  const lines: string[] = [`Hello ${first},`, `Here is where ${project.name} stands as of ${weekdayDate(state.today)}.`, standing.finishWords, ...customerContractDays(project), ...lateFinish(state, project).customerWords]
  const done = customerDoneWords(standing)
  if (done) lines.push(done)
  for (const s of stages) {
    const stand = s.state === 'done' ? 'done' : s.state === 'notStarted' ? `starts ${weekdayDate(s.start)}` : `${CUSTOMER_STAGE_WORDS[s.state]}, ${Math.round(s.pct)}% done`
    lines.push(`${s.label}: ${stand}, ${shortDate(s.start)} to ${shortDate(s.finish)}.`)
  }
  for (const m of milestones) {
    const late = m.state === 'late' || m.state === 'missed'
    lines.push(`${m.milestone.label}: ${shortDate(m.due)}${m.state === 'hit' ? ', met' : late ? `, ${m.daysLate} days late` : ''}.`)
  }
  const changes = customerChanges(project, state.today)
  lines.push(changes.length === 0 ? 'Nothing moved this week. The schedule stands as planned.' : `What changed this week: ${changes.join(' ')}`)
  for (const ask of customerAsks(project)) lines.push(`We need from you: ${ask.words}`)
  lines.push(`Call me with any question.`, `${by}, ${GC_COMPANY.name}`)
  return { to: `${contact}, ${customer?.name ?? project.owner}`, subject: `Your schedule on ${project.name}, ${shortDate(state.today)}`, lines }
}
