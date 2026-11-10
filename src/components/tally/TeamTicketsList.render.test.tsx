// @vitest-environment jsdom
/**
 * The office's Tickets list (punch list #295, PR 3): each row says why it is there and offers the presses for it; an
 * empty list says nothing waits.
 */
import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { TeamTicketsList, type TeamTicketsListProps } from './TeamTicketsList'
import type { OfficeTicketRow } from '../../lib/tickets/ticketOffice'
import type { TicketWithPages } from '../../lib/tickets/ticketsIo'

function ticket(over: Partial<TicketWithPages> = {}): TicketWithPages {
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
    counter_ticket_pages: [],
    ...over,
  }
}

const jobs = new Map([
  ['oak', { jobId: 'oak', label: 'JP1042', name: 'Oak Hollow Bldg C' }],
  ['cedar', { jobId: 'cedar', label: 'JP1038', name: 'Cedar Bend water heater' }],
])

function props(rows: OfficeTicketRow<TicketWithPages>[], over: Partial<TeamTicketsListProps> = {}): TeamTicketsListProps {
  return {
    rows,
    jobs,
    chargeWords: (id) => (id === 'c1' ? '$228.58 at Ridgeway Supply, Tue Nov 4' : `charge ${id}`),
    chargesFor: () => [{ id: 'c5', words: '$41.17 at Cedar Bend Hardware, Tue Nov 4' }],
    busyId: null,
    onOpen: vi.fn(),
    onAnswer: vi.fn(),
    onPickCharge: vi.fn(),
    onPaidOther: vi.fn(),
    onChangeCharge: vi.fn(),
    onLeave: vi.fn(),
    onPickJob: vi.fn(),
    ...over,
  }
}

describe('TeamTicketsList', () => {
  it('says nothing waits when the list is empty', () => {
    renderWithProviders(<TeamTicketsList {...props([])} />)
    expect(screen.getByText(/Nothing waiting on the tickets/)).toBeTruthy()
  })

  it('asks It is / It is not for a ticket the matcher can only ask about', () => {
    const onAnswer = vi.fn()
    const t = ticket()
    renderWithProviders(<TeamTicketsList {...props([{ ticket: t, why: 'asked', chargeId: 'c1', sortedJobIds: [], fitChargeIds: ['c1'] }], { onAnswer })} />)
    expect(screen.getByText('One charge fits. Is it this one?')).toBeTruthy()
    expect(screen.getByText('$228.58 at Ridgeway Supply, Tue Nov 4')).toBeTruthy()
    fireEvent.click(screen.getByText('It is'))
    expect(onAnswer).toHaveBeenCalledWith(t, 'c1', true)
    fireEvent.click(screen.getByText('It is not'))
    expect(onAnswer).toHaveBeenCalledWith(t, 'c1', false)
  })

  it('offers Change it or Leave it for a ticket that disagrees with the sort', () => {
    const onChangeCharge = vi.fn()
    const onLeave = vi.fn()
    const t = ticket({ mercury_transaction_id: 'c1', match_kind: 'minute' })
    renderWithProviders(<TeamTicketsList {...props([{ ticket: t, why: 'disagrees', chargeId: 'c1', sortedJobIds: ['cedar'], fitChargeIds: [] }], { onChangeCharge, onLeave })} />)
    expect(screen.getByText('The ticket says JP1042. The charge went to JP1038.')).toBeTruthy()
    fireEvent.click(screen.getByText('Change it to JP1042'))
    expect(onChangeCharge).toHaveBeenCalledWith(t, 'oak')
    fireEvent.click(screen.getByText('Leave it on JP1038'))
    expect(onLeave).toHaveBeenCalledWith(t)
  })

  it('lets the office pick the charge or say how a ticket with no charge was paid', () => {
    const onPickCharge = vi.fn()
    const onPaidOther = vi.fn()
    const t = ticket()
    renderWithProviders(<TeamTicketsList {...props([{ ticket: t, why: 'no_charge', chargeId: null, sortedJobIds: [], fitChargeIds: [] }], { onPickCharge, onPaidOther })} />)
    expect(screen.getByText('No charge fits yet. It waits, or pick the charge, or say how it was paid.')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('A charge for Jordan ticket'), { target: { value: 'c5' } })
    expect(onPickCharge).toHaveBeenCalledWith(t, 'c5')
    fireEvent.click(screen.getByText('Paid another way…'))
    fireEvent.click(screen.getByText('Cash'))
    expect(onPaidOther).toHaveBeenCalledWith(t, 'cash')
  })

  it('offers a job for a ticket with none', () => {
    const onPickJob = vi.fn()
    const t = ticket({ job_id: null })
    renderWithProviders(<TeamTicketsList {...props([{ ticket: t, why: 'no_job', chargeId: null, sortedJobIds: [], fitChargeIds: [] }], { onPickJob })} />)
    expect(screen.getByText('No job yet')).toBeTruthy()
    fireEvent.click(screen.getByText('Pick a job'))
    expect(onPickJob).toHaveBeenCalledWith(t)
  })
})
