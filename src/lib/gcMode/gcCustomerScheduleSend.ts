/**
 * GC mode design spike: the customer's schedule sent on its own, the Gantt's Phase 3 (G-94). The
 * Friday report carries the schedule's words; a customer who asks "where are we" on a Tuesday gets
 * this: the same picture as their portal, as a dated letter, kept as it went, and printable to a
 * PDF. Nothing leaves the app in the prototype; the record is the letter.
 *
 * Its own file, out of the barrel: it reads the customer's schedule kernel.
 */
import type { GcProject, GcState, ScheduleSend } from './gcTypes'
import { customerAsks, customerChanges, customerMilestones, customerStages, customerStanding } from './gcCustomerSchedule'
import { customerContractDays } from './gcChangeOrderDays'
import { lateFinish } from './gcLateFinish'
import { shortDate, weekdayDate } from './gcWords'
import { GC_COMPANY } from './gcFixture'

/** The letter as it would go today: who to, the subject, and the lines. */
export interface ScheduleLetter {
  to: string
  subject: string
  lines: string[]
}

const STATE_WORDS = { done: 'done', underway: 'under way', behind: 'behind', notStarted: 'not started' } as const

export function customerScheduleLetter(state: GcState, project: GcProject, by: string): ScheduleLetter {
  const customer = state.customers.find((c) => c.id === project.customerId)
  const contact = customer?.contact || customer?.name || project.owner
  const first = contact.split(/\s+/)[0] ?? contact
  const standing = customerStanding(state, project)
  const stages = customerStages(state, project)
  const milestones = customerMilestones(state, project)
  const lines: string[] = [`Hello ${first},`, `Here is where ${project.name} stands as of ${weekdayDate(state.today)}.`, standing.finishWords, ...customerContractDays(project), ...lateFinish(state, project).customerWords]
  if (standing.finish) lines.push(`${standing.donePct}% of the work is done. We planned ${standing.plannedPct}% by today.`)
  for (const s of stages) {
    const stand = s.state === 'done' ? 'done' : s.state === 'notStarted' ? `starts ${weekdayDate(s.start)}` : `${STATE_WORDS[s.state]}, ${Math.round(s.pct)}% done`
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

/** The letter as a printable page: the portal's paper look, light, one paragraph a line. */
export function customerScheduleHtml(letter: ScheduleLetter): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(letter.subject)}</title><style>body{font:14px/1.5 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#16283c;background:#fff;max-width:42rem;margin:2rem auto;padding:0 1rem}h1{font-size:1.15rem;margin:0 0 .25rem}p{margin:.45rem 0}.to{color:#555;margin-bottom:1rem}</style></head><body><h1>${esc(letter.subject)}</h1><div class="to">To ${esc(letter.to)}</div>${letter.lines.map((l) => `<p>${esc(l)}</p>`).join('')}</body></html>`
}

/** The record of a send, as it is kept on the project. */
export function scheduleSendRecord(project: GcProject, letter: ScheduleLetter, by: string, today: string): ScheduleSend {
  return { id: `${project.id}-ssend-${(project.scheduleSends ?? []).length + 1}`, on: today, by, to: letter.to, subject: letter.subject, lines: letter.lines }
}

/** Every send, newest first. */
export function scheduleSends(project: GcProject): ScheduleSend[] {
  return [...(project.scheduleSends ?? [])].reverse()
}
