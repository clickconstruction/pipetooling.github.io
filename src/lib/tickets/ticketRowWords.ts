/**
 * Counter tickets (punch list #295, PR 2): the lines a ticket's row and its window read as. Pure.
 */
import { formatDenverCalendarDayShort, formatDenverTimeOnly } from '../../utils/dateUtils'
import { ticketJobIds, type CounterTicket } from './ticket'
import type { TicketJobFacts } from './ticketJobs'

/** *JP1042, Oak Hollow Bldg C*, two jobs joined by *and*, *Not for one job*, or *No job yet*. */
export function ticketJobLine(t: Pick<CounterTicket, 'job_id' | 'also_job_ids' | 'no_one_job'>, jobs: ReadonlyMap<string, TicketJobFacts>): string {
  if (t.no_one_job) return 'Not for one job'
  const ids = ticketJobIds(t)
  if (ids.length === 0) return 'No job yet'
  const facts = ids.map((id) => jobs.get(id))
  if (ids.length === 1) {
    const f = facts[0]
    return f ? (f.name ? `${f.label}, ${f.name}` : f.label) : 'A job'
  }
  const labels = facts.map((f) => f?.label ?? 'a job')
  return `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`
}

/** *Nov 4 at 10:02 AM, 2 pages*: when it was taken and how many pages; a PDF or a paper handed in says the day alone. */
export function ticketWhenLine(t: Pick<CounterTicket, 'taken_at' | 'taken_at_from'>, pageCount: number): string {
  const ms = Date.parse(t.taken_at)
  const day = Number.isFinite(ms) ? formatDenverCalendarDayShort(ms) : ''
  const when = Number.isFinite(ms) && t.taken_at_from !== 'none' ? `${day} at ${formatDenverTimeOnly(ms)}` : day
  const pages = pageCount === 1 ? '1 page' : `${pageCount} pages`
  return when ? `${when}, ${pages}` : pages
}

/** The line over My tickets for the ones still on the phone; null when none wait. */
export function ticketsOnPhoneWords(n: number): string | null {
  if (n <= 0) return null
  return n === 1 ? '1 ticket is on this phone. It sends when the signal is back.' : `${n} tickets are on this phone. They send when the signal is back.`
}

export const TICKET_USED_WORDS = 'The office has used this ticket. Ask the office to change it.'

/** What the line under the press says after a save: sent to its job, sent with no job, or kept on the phone. */
export function ticketSavedWords(outcome: { kind: 'sent' | 'kept' }, words: { label: string | null; noOneJob: boolean }): string {
  if (outcome.kind === 'kept') return 'The ticket is on this phone. It sends when the signal is back.'
  if (words.label) return `Ticket saved to ${words.label}.`
  return words.noOneJob ? 'Ticket saved. The office places it.' : 'Ticket saved. Pick its job when you can.'
}
