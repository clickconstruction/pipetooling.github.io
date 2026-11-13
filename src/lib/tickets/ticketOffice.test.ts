import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import type { CounterTicket } from './ticket'
import type { TicketMatch } from './ticketMatch'
import { officeTicketRows, officeTicketWhyWords, ticketAskWords, ticketChipWords, ticketDisagreement, ticketJobByCharge, ticketsByCharge, ticketsTabLabel } from './ticketOffice'

function ticket(over: Partial<CounterTicket> = {}): CounterTicket {
  return {
    id: 't1',
    taken_by: 'u1',
    taken_by_name: 'Jordan',
    taken_at: '2026-11-04T16:02:00Z',
    taken_at_from: 'press',
    source: 'camera',
    job_id: 'oak',
    also_job_ids: [],
    no_one_job: false,
    po_entry_id: null,
    total: null,
    note: '',
    added_at: '2026-11-04T16:02:30Z',
    mercury_transaction_id: null,
    match_kind: null,
    matched_at: null,
    matched_by: null,
    declined_transaction_ids: [],
    paid_other: null,
    paid_other_note: '',
    supply_house_invoice_id: null,
    used_at: null,
    removed_at: null,
    ...over,
  }
}

describe('tickets on their charges', () => {
  it('maps live, saved, matched tickets by charge, and the first job each names', () => {
    const a = ticket({ id: 'a', mercury_transaction_id: 'c1', match_kind: 'minute' })
    const b = ticket({ id: 'b', mercury_transaction_id: 'c2', match_kind: 'minute', removed_at: '2026-11-05T00:00:00Z' })
    const c = ticket({ id: 'c', mercury_transaction_id: 'c3', match_kind: 'minute', added_at: null })
    const d = ticket({ id: 'd', mercury_transaction_id: 'c4', match_kind: 'picked', job_id: null, also_job_ids: ['cedar'] })
    const e = ticket({ id: 'e', mercury_transaction_id: 'c5', match_kind: 'picked', job_id: null, no_one_job: true })
    expect([...ticketsByCharge([a, b, c, d, e]).keys()]).toEqual(['c1', 'c4', 'c5'])
    expect([...ticketJobByCharge([a, b, c, d, e])]).toEqual([
      ['c1', 'oak'],
      ['c4', 'cedar'],
    ])
  })

  it('finds a ticket that disagrees with where the charge went', () => {
    expect(ticketDisagreement(ticket(), [{ jobId: 'cedar', amount: -228.58 }])).toEqual({ ticketJobId: 'oak', sortedJobIds: ['cedar'] })
    expect(ticketDisagreement(ticket(), [{ jobId: 'oak', amount: -100 }, { jobId: 'cedar', amount: -128.58 }])).toBeNull()
    expect(ticketDisagreement(ticket(), [])).toBeNull()
    expect(ticketDisagreement(ticket({ job_id: null, no_one_job: true }), [{ jobId: 'cedar', amount: -1 }])).toBeNull()
  })
})

describe('the Tickets list', () => {
  const asked: TicketMatch = { kind: 'ask', who: 'taker', why: 'late', chargeId: 'c9' }
  const several: TicketMatch = { kind: 'none', why: 'several_fit', chargeIds: ['c7', 'c8'] }
  const none: TicketMatch = { kind: 'none', why: 'no_charge', chargeIds: [] }

  it('holds what cannot sit on a charge line, what needs a person first', () => {
    const tickets = [
      ticket({ id: 'waiting', taken_at: '2026-11-04T10:00:00Z' }),
      ticket({ id: 'account', po_entry_id: 'po', taken_at: '2026-11-04T11:00:00Z' }),
      ticket({ id: 'nojob', job_id: null, taken_at: '2026-11-04T12:00:00Z' }),
      ticket({ id: 'stock', job_id: null, no_one_job: true, taken_at: '2026-11-04T13:00:00Z' }),
      ticket({ id: 'ask', taken_at: '2026-11-04T14:00:00Z' }),
      ticket({ id: 'pick', taken_at: '2026-11-04T15:00:00Z' }),
      ticket({ id: 'agreed', mercury_transaction_id: 'c1', match_kind: 'minute' }),
      ticket({ id: 'moved', mercury_transaction_id: 'c2', match_kind: 'minute' }),
      ticket({ id: 'paid', paid_other: 'cash' }),
      ticket({ id: 'billed', supply_house_invoice_id: 'inv' }),
      ticket({ id: 'gone', removed_at: '2026-11-05T00:00:00Z' }),
    ]
    const rows = officeTicketRows(tickets, {
      matches: new Map<string, TicketMatch>([
        ['waiting', none],
        ['ask', asked],
        ['pick', several],
      ]),
      splitsByCharge: new Map([
        ['c1', [{ jobId: 'oak', amount: -1 }]],
        ['c2', [{ jobId: 'cedar', amount: -1 }]],
      ]),
    })
    expect(rows.map((r) => `${r.ticket.id}:${r.why}`)).toEqual(['pick:asked', 'ask:asked', 'moved:disagrees', 'nojob:no_job', 'stock:not_one_job', 'waiting:no_charge', 'account:on_account'])
    expect(rows[0]!.fitChargeIds).toEqual(['c7', 'c8'])
    expect(rows[1]!.chargeId).toBe('c9')
    expect(rows[2]!.sortedJobIds).toEqual(['cedar'])
  })

  it('says why each row is there, in plain words', () => {
    const lines = [
      officeTicketWhyWords({ why: 'asked', fitChargeIds: ['a'] }, { ticketJob: null, sortedJobs: [] }),
      officeTicketWhyWords({ why: 'asked', fitChargeIds: ['a', 'b'] }, { ticketJob: null, sortedJobs: [] }),
      officeTicketWhyWords({ why: 'disagrees', fitChargeIds: [] }, { ticketJob: 'JP1042', sortedJobs: ['JP1038'] }),
      officeTicketWhyWords({ why: 'no_job', fitChargeIds: [] }, { ticketJob: null, sortedJobs: [] }),
      officeTicketWhyWords({ why: 'not_one_job', fitChargeIds: [] }, { ticketJob: null, sortedJobs: [] }),
      officeTicketWhyWords({ why: 'no_charge', fitChargeIds: [] }, { ticketJob: null, sortedJobs: [] }),
      officeTicketWhyWords({ why: 'on_account', fitChargeIds: [] }, { ticketJob: null, sortedJobs: [] }),
      ticketAskWords({ takerName: 'Jordan', takenAtWords: '10:02 AM', charge: { amount: -228.58, counterparty_name: 'Ridgeway Supply' } }),
    ]
    expect(lines[2]).toBe('The ticket says JP1042. The charge went to JP1038.')
    expect(lines[7]).toBe("Jordan's ticket from 10:02 AM: is it $228.58 at Ridgeway Supply?")
    for (const line of lines) expect(plainWordsFailures(line), line).toEqual([])
  })

  it('labels the chip and the tab', () => {
    expect(ticketChipWords('JP1042')).toBe('Ticket · JP1042 first')
    expect(ticketChipWords(null)).toBe('Ticket')
    // A photo through the charge's receipt link (#299) says which door it came by.
    expect(ticketChipWords('JP1038', 'link')).toBe('Receipt from the link · JP1038 first')
    expect(ticketChipWords(null, 'link')).toBe('Receipt from the link')
    expect(ticketChipWords('JP1042', 'camera')).toBe('Ticket · JP1042 first')
    expect(ticketsTabLabel(null)).toBe('Tickets')
    expect(ticketsTabLabel(3)).toBe('Tickets (3)')
  })
})
