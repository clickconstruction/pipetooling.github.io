// @vitest-environment jsdom
/**
 * Edit Bid → Last Contact, the call-again day (v2.4421, punch list #80): a sent bid with no
 * answer shows its day; logging a contact can set it; "Set a day…" moves it with no contact.
 * Today is Friday Oct 2, 2026 in Chicago.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, within } from '@testing-library/react'
import { renderWithProviders, settle, useAuthModuleMock } from '../../test/renderSmokeMocks'

import { BidLogContactControl } from './BidLogContactControl'
import { supabase } from '../../lib/supabase'

vi.mock('../../lib/supabase', () => ({ supabase: { from: vi.fn() } }))
vi.mock('../../hooks/useAuth', async () => useAuthModuleMock({ user: { id: 'u1' } }))

let inserts: Array<{ table: string; row: Record<string, unknown> }> = []
let bidRow: Record<string, unknown> = {}
const PEOPLE = [{ id: 'p-ray', customer_id: 'gc-city', name: 'J. Rayburn', phone: '(830) 555-0142', note: null }]

function chain(table: string) {
  let inserted: Record<string, unknown> | null = null
  const c: Record<string, unknown> = {}
  for (const m of ['select', 'in', 'order', 'limit', 'eq', 'not', 'update']) c[m] = () => c
  c.insert = (row: Record<string, unknown>) => {
    inserted = row
    inserts.push({ table, row })
    // The trigger's work: a row that sets or clears a day rolls up onto the bid.
    if (table === 'bids_submission_entries' && (row.next_followup_on || row.next_followup_cleared)) {
      bidRow = { ...bidRow, next_followup_on: row.next_followup_on ?? null, next_followup_contact_person_id: row.next_followup_contact_person_id ?? null, next_followup_reason: row.next_followup_reason ?? null }
    }
    if (table === 'bids_submission_entries' && row.contact_method) bidRow = { ...bidRow, last_contact: row.occurred_at }
    return c
  }
  const answer = () => (table === 'bids' ? bidRow : table === 'customer_contact_persons' ? PEOPLE : [])
  c.maybeSingle = () => Promise.resolve({ data: answer(), error: null })
  c.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
    Promise.resolve({ data: inserted ? [{ id: 'new', ...inserted }] : answer(), error: null }).then(resolve, reject)
  return c
}

function renderControl() {
  const onLogged = vi.fn()
  renderWithProviders(<BidLogContactControl bidId="bid-city" lastContactLocal="" onLogged={onLogged} />)
  return { onLogged }
}
const logRows = () => inserts.filter((i) => i.table === 'bids_submission_entries').map((i) => i.row)

beforeEach(() => {
  inserts = []
  bidRow = { id: 'bid-city', customer_id: 'gc-city', bid_date_sent: '2026-02-11', outcome: null, last_contact: null }
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-02T15:00:00-05:00'))
  vi.mocked(supabase.from).mockImplementation(((table: string) => chain(table)) as never)
})
afterEach(() => {
  vi.useRealTimers()
})

describe('BidLogContactControl — the call-again day', () => {
  it('a sent bid with no day says so and offers Set a day…', async () => {
    renderControl()
    await settle()
    const line = screen.getByTestId('bid-call-again')
    expect(within(line).getByText(/No day set/)).toBeTruthy()
    expect(within(line).getByRole('button', { name: 'Set a day…' })).toBeTruthy()
  })

  it('a bid that is not sent, or is decided, has no call-again line', async () => {
    bidRow = { ...bidRow, bid_date_sent: null }
    renderControl()
    await settle()
    expect(screen.queryByTestId('bid-call-again')).toBeNull()
  })

  it('shows the day the bid has, who to ask for and why', async () => {
    bidRow = { ...bidRow, next_followup_on: '2027-01-05', next_followup_contact_person_id: 'p-ray', next_followup_reason: 'budget' }
    renderControl()
    await settle()
    expect(within(screen.getByTestId('bid-call-again')).getByText('Tue, Jan 5, 2027 · ask for J. Rayburn · Their budget')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Change…' })).toBeTruthy()
  })

  it('a day a later contact has spent reads as no day', async () => {
    bidRow = { ...bidRow, next_followup_on: '2026-09-20', last_contact: '2026-09-25T15:00:00Z' }
    renderControl()
    await settle()
    expect(within(screen.getByTestId('bid-call-again')).getByText(/No day set/)).toBeTruthy()
  })

  it('Set a day… writes a note, not a contact, and the line reads the new day', async () => {
    renderControl()
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'Set a day…' }))
    const panel = screen.getByRole('group', { name: 'When to call again' })
    fireEvent.click(within(panel).getByRole('button', { name: 'Next month' }))
    fireEvent.click(within(panel).getByRole('button', { name: 'J. Rayburn' }))
    fireEvent.click(within(panel).getByRole('button', { name: 'Save the date' }))
    await settle()
    expect(logRows()).toHaveLength(1)
    expect(logRows()[0]).toMatchObject({ bid_id: 'bid-city', contact_method: null, next_followup_on: '2026-11-02', next_followup_contact_person_id: 'p-ray', next_followup_cleared: false })
    expect(within(screen.getByTestId('bid-call-again')).getByText('Mon, Nov 2 · ask for J. Rayburn')).toBeTruthy()
  })

  it('Change… then No date removes it', async () => {
    bidRow = { ...bidRow, next_followup_on: '2027-01-05' }
    renderControl()
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'Change…' }))
    fireEvent.click(screen.getByRole('button', { name: 'No date' }))
    await settle()
    expect(logRows()[0]).toMatchObject({ contact_method: null, next_followup_on: null, next_followup_cleared: true, notes: 'Call-again date removed.' })
    expect(within(screen.getByTestId('bid-call-again')).getByText(/No day set/)).toBeTruthy()
  })

  it('Log contact… with a day picked writes one row: the contact, the day and the sentence', async () => {
    const { onLogged } = renderControl()
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'Log contact…' }))
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'Set contact method to Phone' }))
    fireEvent.change(screen.getByPlaceholderText(/What was said/), { target: { value: 'Holding for the next budget year' } })
    const panel = screen.getByRole('group', { name: 'When to call again' })
    // Inside the form the questions have no Save of their own.
    expect(within(panel).queryByRole('button', { name: 'Save' })).toBeNull()
    fireEvent.click(within(panel).getByRole('button', { name: '3 months' }))
    fireEvent.click(within(panel).getByRole('button', { name: 'Their budget' }))
    fireEvent.click(screen.getByRole('button', { name: 'Log contact' }))
    await settle()
    expect(logRows()).toHaveLength(1)
    expect(logRows()[0]).toMatchObject({ contact_method: 'Phone', next_followup_on: '2027-01-04', next_followup_contact_person_id: null, next_followup_reason: 'budget' })
    expect(logRows()[0]!.notes).toBe('Holding for the next budget year. Call again Mon, Jan 4, 2027. Waiting on their budget.')
    expect(onLogged).toHaveBeenCalled()
  })

  it('Log contact… with no day picked writes the row it always wrote', async () => {
    renderControl()
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'Log contact…' }))
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'Set contact method to Email' }))
    fireEvent.click(screen.getByRole('button', { name: 'Log contact' }))
    await settle()
    expect(Object.keys(logRows()[0]!).sort()).toEqual(['bid_id', 'contact_method', 'created_by', 'gc_customer_id', 'notes', 'occurred_at'])
    expect(logRows()[0]!.notes).toBeNull()
  })
})
