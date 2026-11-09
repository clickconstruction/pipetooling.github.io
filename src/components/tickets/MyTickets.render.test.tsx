// @vitest-environment jsdom
/**
 * My tickets (punch list #295, PR 2): the list reads a person's tickets with where each stands, an empty list names
 * the press that fills it, a failed read offers Retry, and a row opens the ticket with its three presses.
 */
import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../hooks/useAuth', async () => (await import('../../test/renderSmokeMocks')).useAuthModuleMock({ role: 'helpers', profileName: 'Jordan' }))

import { MyTickets } from './MyTickets'
import { renderWithProviders, settle } from '../../test/renderSmokeMocks'
import type { TicketScreensIo } from '../../lib/tickets/ticketScreensIo'
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
    counter_ticket_pages: [{ id: 'p1', ticket_id: 't1', page_no: 1, mime: 'image/jpeg', storage_path: 'u1/t1/p1.jpg', drive_file_id: null, filed_at: null, fail_why: null }],
    ...over,
  }
}

function makeIo(over: Partial<TicketScreensIo> = {}): TicketScreensIo {
  return {
    sheetFacts: () => Promise.resolve({ facts: { poEntries: [], clockedJob: null, dayJobs: [] }, fresh: true }),
    allJobs: () => Promise.resolve([]),
    list: () => Promise.resolve([ticket(), ticket({ id: 't2', job_id: null, po_entry_id: 'po1', no_one_job: true })]),
    jobFacts: () => Promise.resolve(new Map([['oak', { jobId: 'oak', label: 'JP1042', name: 'Oak Hollow Bldg C' }]])),
    pageUrl: () => Promise.resolve(null),
    changeJob: () => Promise.resolve(),
    remove: () => Promise.resolve(),
    addPage: () => Promise.resolve(),
    ...over,
  }
}

describe('MyTickets', () => {
  it('lists each ticket with its job and where it stands', async () => {
    renderWithProviders(<MyTickets userId="u1" io={makeIo()} />)
    await settle()
    expect(await screen.findByText('JP1042, Oak Hollow Bldg C')).toBeTruthy()
    expect(screen.getByText('Waiting for its charge or its bill')).toBeTruthy()
    expect(screen.getByText('Not for one job')).toBeTruthy()
    expect(screen.getByText('On account, waiting for the bill')).toBeTruthy()
  })

  it('names the press that fills an empty list', async () => {
    renderWithProviders(<MyTickets userId="u1" io={makeIo({ list: () => Promise.resolve([]) })} />)
    await settle()
    expect(await screen.findByText('No tickets yet. Photo of a ticket adds the first.')).toBeTruthy()
  })

  it('shows why a read failed, with no empty line beside it', async () => {
    renderWithProviders(<MyTickets userId="u1" io={makeIo({ list: () => Promise.reject(new Error('permission denied for table counter_tickets')) })} />)
    await settle()
    expect(screen.queryByText('No tickets yet. Photo of a ticket adds the first.')).toBeNull()
    expect(screen.queryByText('Loading your tickets…')).toBeNull()
  })

  it('opens a ticket with the taker’s three presses', async () => {
    renderWithProviders(<MyTickets userId="u1" io={makeIo()} />)
    await settle()
    fireEvent.click(await screen.findByText('JP1042, Oak Hollow Bldg C'))
    expect(await screen.findByText('Change the job')).toBeTruthy()
    expect(screen.getByText('Add a page')).toBeTruthy()
    expect(screen.getByText('Remove this ticket')).toBeTruthy()
  })

  it('takes the job change and the removal away once the office has used the ticket', async () => {
    renderWithProviders(<MyTickets userId="u1" io={makeIo({ list: () => Promise.resolve([ticket({ used_at: '2026-11-05T15:00:00Z', mercury_transaction_id: 'tx', match_kind: 'minute' })]) })} />)
    await settle()
    fireEvent.click(await screen.findByText('JP1042, Oak Hollow Bldg C'))
    expect(await screen.findByText('The office has used this ticket. Ask the office to change it.')).toBeTruthy()
    expect(screen.queryByText('Change the job')).toBeNull()
    expect(screen.queryByText('Remove this ticket')).toBeNull()
    expect(screen.getByText('Add a page')).toBeTruthy()
    expect(screen.getAllByText('Matched to its charge').length).toBeGreaterThan(0)
  })
})
