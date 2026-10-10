/**
 * GC mode, the real build, the schedule's PR 1b: sending the customer their schedule (G-94), moved word for word from the GC mode prototype
 * (branch spike/gc-mode, `gcCustomerScheduleSend.ts`). The letter read the late finish and waited for Owner Billing's lift (O2); the
 * schedule's PR 15a moved it (`to-dos/gc-mode/mockups/schedule-pr15.md`, call 4), with one fix made in both copies: a customer with
 * no contact's name is greeted *Hello,* and the letter goes to the company alone. `scheduleSendRetryRow` is the window's own.
 */
import type { ScheduleSend } from './types'
import type { GcProject, GcState } from '../types'
import { CUSTOMER_STAGE_WORDS, customerAsks, customerChanges, customerDoneWords, customerMilestones, customerStages, customerStanding } from './customerSchedule'
import { customerContractDays } from './changeOrderDays'
import { lateFinish } from '../lateFinish'
import { shortDate, weekdayDate } from '../words'
import { GC_COMPANY } from '../company'

/** The letter as it would go today: who to, the subject, and the lines. */
export interface ScheduleLetter {
  to: string
  subject: string
  lines: string[]
}

export function customerScheduleLetter(state: GcState, project: GcProject, by: string): ScheduleLetter {
  const customer = state.customers.find((c) => c.id === project.customerId)
  const company = customer?.name || project.owner
  // Their contact by name, when the customer row has one: with none, the letter greets no one by name.
  const contact = customer?.contact?.trim() ?? ''
  const first = contact.split(/\s+/)[0] ?? ''
  const standing = customerStanding(state, project)
  const stages = customerStages(state, project)
  const milestones = customerMilestones(state, project)
  const lines: string[] = [first ? `Hello ${first},` : 'Hello,', `Here is where ${project.name} stands as of ${weekdayDate(state.today)}.`, standing.finishWords, ...customerContractDays(project), ...lateFinish(state, project).customerWords]
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
  return { to: contact ? `${contact}, ${company}` : company, subject: `Your schedule on ${project.name}, ${shortDate(state.today)}`, lines }
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

/**
 * The letter kept and not emailed that a press goes again on (PR 15a, call 2; `weeklyReportRetryRow`'s rule): the newest
 * kept the same day, to the same reader, with the same subject and lines. Null: the press keeps a new one.
 */
export function scheduleSendRetryRow(project: GcProject, letter: ScheduleLetter, today: string): ScheduleSend | null {
  const same = (project.scheduleSends ?? []).filter(
    (s) => !s.emailed && s.on === today && s.to === letter.to && s.subject === letter.subject && s.lines.length === letter.lines.length && s.lines.every((l, i) => l === letter.lines[i]),
  )
  return same[same.length - 1] ?? null
}
