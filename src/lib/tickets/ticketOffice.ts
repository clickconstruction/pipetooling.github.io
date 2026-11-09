/**
 * Counter tickets, the office's side (punch list #295, PR 3). Pure: the tickets and the charges in, what the Team
 * queue draws out. A ticket on a charge leads that charge's line and its job is the sort's first choice
 * (`tallySortSuggestion.ts`'s `ticket` rule). The Tickets list holds every ticket the queue cannot show on a charge
 * line: one with no charge yet, one on a PO code waiting for its bill, one with no job, one for no one job, one the
 * matcher can only ask about, and one that disagrees with where the office already sent its charge.
 */
import { ticketChargeWords, ticketJobIds, ticketState, type CounterTicket, type TicketChargeFacts } from './ticket'
import type { TicketMatch } from './ticketMatch'

/** The live, saved tickets that are matched, by their charge. */
export function ticketsByCharge<T extends Pick<CounterTicket, 'mercury_transaction_id' | 'removed_at' | 'added_at'>>(tickets: readonly T[]): Map<string, T> {
  const out = new Map<string, T>()
  for (const t of tickets) if (t.mercury_transaction_id && !t.removed_at && t.added_at) out.set(t.mercury_transaction_id, t)
  return out
}

/** The first job each matched ticket names, by its charge: what the sort offers first. */
export function ticketJobByCharge(tickets: readonly Pick<CounterTicket, 'mercury_transaction_id' | 'removed_at' | 'added_at' | 'job_id' | 'also_job_ids'>[]): Map<string, string> {
  const out = new Map<string, string>()
  for (const [chargeId, t] of ticketsByCharge(tickets)) {
    const first = ticketJobIds(t)[0]
    if (first) out.set(chargeId, first)
  }
  return out
}

export interface ChargeSplit {
  jobId: string
  amount: number
}

/**
 * A ticket whose job is not where the office sent its charge: the ticket's first job against the charge's splits.
 * Null when the charge is unsorted, when the ticket names no job, or when the splits already hold the ticket's job.
 */
export function ticketDisagreement(t: Pick<CounterTicket, 'job_id' | 'also_job_ids' | 'no_one_job'>, splits: readonly ChargeSplit[]): { ticketJobId: string; sortedJobIds: string[] } | null {
  const ticketJobId = ticketJobIds(t)[0]
  if (!ticketJobId || splits.length === 0) return null
  const sortedJobIds = [...new Set(splits.map((s) => s.jobId))]
  if (sortedJobIds.includes(ticketJobId)) return null
  return { ticketJobId, sortedJobIds }
}

/** Why a ticket sits on the Tickets list rather than on a charge line. */
export type OfficeTicketWhy = 'asked' | 'disagrees' | 'no_job' | 'not_one_job' | 'no_charge' | 'on_account'

export interface OfficeTicketRow<T extends CounterTicket = CounterTicket> {
  ticket: T
  why: OfficeTicketWhy
  /** The charge the matcher asks about, or the one the office sent elsewhere. */
  chargeId: string | null
  /** For `disagrees`: where the office sent the charge. */
  sortedJobIds: string[]
  /** For `asked` with several charges that fit: the office picks among them. */
  fitChargeIds: string[]
}

const WHY_ORDER: Readonly<Record<OfficeTicketWhy, number>> = { asked: 0, disagrees: 1, no_job: 2, not_one_job: 3, no_charge: 4, on_account: 5 }

/**
 * The Tickets list: every live, saved ticket that is not simply sitting on a charge line with its job agreed. A
 * matched ticket shows only when it disagrees with the charge's splits. An unmatched one shows with the matcher's
 * answer: a question, or none. Sorted by what needs a person first, then newest first.
 */
export function officeTicketRows<T extends CounterTicket>(
  tickets: readonly T[],
  facts: { matches: ReadonlyMap<string, TicketMatch>; splitsByCharge: ReadonlyMap<string, readonly ChargeSplit[]> },
): OfficeTicketRow<T>[] {
  const rows: OfficeTicketRow<T>[] = []
  for (const t of tickets) {
    if (t.removed_at || !t.added_at) continue
    const state = ticketState(t)
    if (state === 'matched') {
      const d = ticketDisagreement(t, facts.splitsByCharge.get(t.mercury_transaction_id!) ?? [])
      if (d) rows.push({ ticket: t, why: 'disagrees', chargeId: t.mercury_transaction_id, sortedJobIds: d.sortedJobIds, fitChargeIds: [] })
      continue
    }
    if (state === 'billed' || state === 'paid_other') continue
    const m = facts.matches.get(t.id)
    if (m?.kind === 'ask') {
      rows.push({ ticket: t, why: 'asked', chargeId: m.chargeId, sortedJobIds: [], fitChargeIds: [m.chargeId] })
      continue
    }
    const fit = m?.kind === 'none' && m.why === 'several_fit' ? m.chargeIds : []
    if (fit.length > 0) {
      rows.push({ ticket: t, why: 'asked', chargeId: null, sortedJobIds: [], fitChargeIds: fit })
      continue
    }
    const why: OfficeTicketWhy = t.no_one_job ? 'not_one_job' : ticketJobIds(t).length === 0 ? 'no_job' : state === 'on_account' ? 'on_account' : 'no_charge'
    rows.push({ ticket: t, why, chargeId: null, sortedJobIds: [], fitChargeIds: [] })
  }
  return rows.sort((a, b) => WHY_ORDER[a.why] - WHY_ORDER[b.why] || Date.parse(b.ticket.taken_at) - Date.parse(a.ticket.taken_at) || a.ticket.id.localeCompare(b.ticket.id))
}

/** The question on a charge line or a Tickets row: *Jordan's ticket from 10:02 AM: is it $228.58 at Ridgeway Supply?* */
export function ticketAskWords(a: { takerName: string; takenAtWords: string; charge: TicketChargeFacts }): string {
  const who = a.takerName.trim() || 'The'
  return `${who === 'The' ? 'The' : `${who}'s`} ticket from ${a.takenAtWords}: is it ${ticketChargeWords(a.charge)}?`
}

/** The line a Tickets row reads under its job line, by why it is there. */
export function officeTicketWhyWords(row: Pick<OfficeTicketRow, 'why' | 'fitChargeIds'>, labels: { ticketJob: string | null; sortedJobs: string[] }): string {
  switch (row.why) {
    case 'asked':
      return row.fitChargeIds.length > 1 ? `${row.fitChargeIds.length} charges fit. Pick the one.` : 'One charge fits. Is it this one?'
    case 'disagrees':
      return `The ticket says ${labels.ticketJob ?? 'another job'}. The charge went to ${labels.sortedJobs.join(' and ') || 'another job'}.`
    case 'no_job':
      return 'No job on it yet. Pick the job.'
    case 'not_one_job':
      return 'Not for one job. Place it.'
    case 'no_charge':
      return 'No charge fits yet. It waits, or pick the charge, or say how it was paid.'
    case 'on_account':
      return 'On account. The bill closes it.'
  }
}

/** The green chip on a charge line: *Ticket · JP1042 first*, or *Ticket* when it names no job. */
export function ticketChipWords(ticketJobLabel: string | null): string {
  return ticketJobLabel ? `Ticket · ${ticketJobLabel} first` : 'Ticket'
}

/** The office's Tickets tab label with its count. */
export function ticketsTabLabel(count: number | null): string {
  return count === null ? 'Tickets' : `Tickets (${count})`
}
