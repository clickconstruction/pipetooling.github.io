import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import {
  COUNTER_TICKETS_BUCKET,
  TICKET_FOLDER_PATH,
  takerMayChange,
  ticketChargeWords,
  ticketDriveName,
  ticketFileExt,
  ticketIsOpen,
  ticketJobIds,
  ticketMatchKindWords,
  ticketState,
  ticketStateWords,
  ticketStoragePath,
  type CounterTicket,
  type TicketMatchKind,
  type TicketPaidOther,
} from './ticket'

const base = {
  removed_at: null,
  added_at: '2026-11-04T16:02:00Z',
  mercury_transaction_id: null,
  supply_house_invoice_id: null,
  paid_other: null,
  po_entry_id: null,
} satisfies Partial<CounterTicket>

describe('where a ticket waits and what Drive calls it', () => {
  it('waits under the uploader, then the ticket, then the page', () => {
    expect(COUNTER_TICKETS_BUCKET).toBe('counter-tickets')
    expect(ticketStoragePath({ uploaderId: 'u1', ticketId: 't1', pageId: 'p1' })).toBe('u1/t1/p1.jpg')
    expect(ticketStoragePath({ uploaderId: 'u1', ticketId: 't1', pageId: 'p2', mime: 'application/pdf' })).toBe('u1/t1/p2.pdf')
  })

  it('files under Team only, never the customer pictures', () => {
    expect(TICKET_FOLDER_PATH).toEqual(['Team only', 'Tickets'])
  })

  it('takes the ending of its kind, a picture when the kind is unknown', () => {
    expect(ticketFileExt('image/png')).toBe('png')
    expect(ticketFileExt('image/webp')).toBe('webp')
    expect(ticketFileExt('application/pdf')).toBe('pdf')
    expect(ticketFileExt('image/heic')).toBe('jpg')
    expect(ticketFileExt(null)).toBe('jpg')
  })

  it('is named by the day, the person and the total', () => {
    expect(ticketDriveName({ dayYmd: '2026-11-04', byName: 'Jordan' })).toBe('2026-11-04 Jordan · Ticket.jpg')
    expect(ticketDriveName({ dayYmd: '2026-11-04', byName: 'Jordan', total: 228.58 })).toBe('2026-11-04 Jordan · Ticket $228.58.jpg')
    expect(ticketDriveName({ dayYmd: '2026-11-04', byName: 'Jordan', total: 228.58, pageNo: 2 })).toBe('2026-11-04 Jordan · Ticket $228.58 · page 2.jpg')
    expect(ticketDriveName({ dayYmd: '2026-11-04', byName: 'Jordan', mime: 'application/pdf' })).toBe('2026-11-04 Jordan · Ticket.pdf')
  })

  it('says (2) when the folder holds the name, and Someone for no name', () => {
    expect(ticketDriveName({ dayYmd: '2026-11-04', byName: 'Jordan' }, 2)).toBe('2026-11-04 Jordan · Ticket (2).jpg')
    expect(ticketDriveName({ dayYmd: '2026-11-04', byName: '  ' })).toBe('2026-11-04 Someone · Ticket.jpg')
  })

  it('keeps a slash-and-control name out of the file name', () => {
    expect(ticketDriveName({ dayYmd: '2026-11-04', byName: 'Jor\\dan\n Lee' })).toBe('2026-11-04 Jor dan Lee · Ticket.jpg')
  })
})

describe('where a ticket stands', () => {
  it('takes the first state that holds', () => {
    expect(ticketState(base)).toBe('waiting')
    expect(ticketState({ ...base, po_entry_id: 'po' })).toBe('on_account')
    expect(ticketState({ ...base, po_entry_id: 'po', paid_other: 'cash' })).toBe('paid_other')
    expect(ticketState({ ...base, po_entry_id: 'po', supply_house_invoice_id: 'inv' })).toBe('billed')
    expect(ticketState({ ...base, po_entry_id: 'po', supply_house_invoice_id: 'inv', mercury_transaction_id: 'tx' })).toBe('matched')
    expect(ticketState({ ...base, added_at: null })).toBe('open')
    expect(ticketState({ ...base, mercury_transaction_id: 'tx', removed_at: '2026-11-05T00:00:00Z' })).toBe('removed')
  })

  it('is open only while nothing has met it', () => {
    expect(ticketIsOpen(base)).toBe(true)
    expect(ticketIsOpen({ ...base, po_entry_id: 'po' })).toBe(true)
    expect(ticketIsOpen({ ...base, mercury_transaction_id: 'tx' })).toBe(false)
    expect(ticketIsOpen({ ...base, paid_other: 'cash' })).toBe(false)
    expect(ticketIsOpen({ ...base, removed_at: '2026-11-05T00:00:00Z' })).toBe(false)
  })

  it('reads a purchase as at the store and money back as back from it', () => {
    expect(ticketChargeWords({ amount: -228.58, counterparty_name: 'Ridgeway Supply' })).toBe('$228.58 at Ridgeway Supply')
    expect(ticketChargeWords({ amount: 41.17, counterparty_name: 'Cedar Bend Hardware' })).toBe('$41.17 back from Cedar Bend Hardware')
    expect(ticketChargeWords({ amount: -1234.5, counterparty_name: null })).toBe('$1,234.50')
    expect(ticketChargeWords({ amount: 12, counterparty_name: ' ' })).toBe('$12.00 back')
  })

  it('says each state in one line', () => {
    expect(ticketStateWords(base)).toBe('Waiting for its charge or its bill')
    expect(ticketStateWords({ ...base, po_entry_id: 'po' })).toBe('On account, waiting for the bill')
    expect(ticketStateWords({ ...base, mercury_transaction_id: 'tx' }, { charge: { amount: -228.58, counterparty_name: 'Ridgeway Supply' } })).toBe('Matched to $228.58 at Ridgeway Supply')
    expect(ticketStateWords({ ...base, mercury_transaction_id: 'tx' })).toBe('Matched to its charge')
    expect(ticketStateWords({ ...base, supply_house_invoice_id: 'inv' }, { invoiceNumber: 'S-10442' })).toBe('Recorded as bill S-10442')
    expect(ticketStateWords({ ...base, supply_house_invoice_id: 'inv' })).toBe('Recorded as a bill')
    expect(ticketStateWords({ ...base, paid_other: 'own_money' })).toBe('Paid with their own money')
    expect(ticketStateWords({ ...base, added_at: null })).toBe('Not saved yet')
    expect(ticketStateWords({ ...base, removed_at: '2026-11-05T00:00:00Z' })).toBe('Removed')
  })

  it('keeps every line to the plain words', () => {
    const paid: TicketPaidOther[] = ['cash', 'own_money', 'another_card', 'other']
    const kinds: TicketMatchKind[] = ['minute', 'total', 'asked', 'picked']
    const lines = [
      ticketStateWords(base),
      ticketStateWords({ ...base, po_entry_id: 'po' }),
      ticketStateWords({ ...base, mercury_transaction_id: 'tx' }, { charge: { amount: -228.58, counterparty_name: 'Ridgeway Supply' } }),
      ticketStateWords({ ...base, mercury_transaction_id: 'tx' }),
      ticketStateWords({ ...base, supply_house_invoice_id: 'inv' }, { invoiceNumber: 'S-10442' }),
      ticketStateWords({ ...base, added_at: null }),
      ...paid.map((p) => ticketStateWords({ ...base, paid_other: p })),
      ...kinds.map(ticketMatchKindWords),
    ]
    for (const line of lines) expect(plainWordsFailures(line), line).toEqual([])
  })
})

describe('what the person who took it may still do', () => {
  it('changes it until the office has used it', () => {
    expect(takerMayChange({ used_at: null, removed_at: null })).toBe(true)
    expect(takerMayChange({ used_at: '2026-11-05T00:00:00Z', removed_at: null })).toBe(false)
    expect(takerMayChange({ used_at: null, removed_at: '2026-11-05T00:00:00Z' })).toBe(false)
  })

  it('lists every job once, the first one first', () => {
    expect(ticketJobIds({ job_id: 'a', also_job_ids: ['b', 'a', 'c'] })).toEqual(['a', 'b', 'c'])
    expect(ticketJobIds({ job_id: null, also_job_ids: [] })).toEqual([])
  })
})
