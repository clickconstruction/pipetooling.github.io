// @vitest-environment jsdom
/**
 * Call-again days on the Call queue (v2.4420, punch list #80): the three questions under a
 * contact tap, what Save writes, the four pills, the Later list and the due card. Today is
 * Friday Oct 2, 2026 in Chicago, the day the owner asked for it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, within } from '@testing-library/react'
import { renderWithProviders, settle, useAuthModuleMock } from '../../test/renderSmokeMocks'

import { BidsCallQueueTab } from './BidsCallQueueTab'
import { supabase } from '../../lib/supabase'
import type { BidWithBuilder } from '../../types/bidWithBuilder'

vi.mock('../../lib/supabase', () => ({ supabase: { from: vi.fn() } }))
vi.mock('../../hooks/useAuth', async () => useAuthModuleMock())

type Insert = { table: string; row: Record<string, unknown> }
let inserts: Insert[] = []
let tableRows: Record<string, unknown[]> = {}

/** A thenable PostgREST-ish chain: reads answer from `tableRows`, inserts are recorded. */
function chain(table: string) {
  let inserted: Record<string, unknown> | null = null
  const c: Record<string, unknown> = {}
  for (const m of ['select', 'in', 'order', 'limit', 'eq', 'update']) c[m] = () => c
  c.insert = (row: Record<string, unknown>) => {
    inserted = row
    inserts.push({ table, row })
    return c
  }
  c.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
    Promise.resolve({ data: inserted ? [{ id: `new-${table}`, note: null, ...inserted }] : (tableRows[table] ?? []), error: null }).then(resolve, reject)
  return c
}

const CITY = { id: 'gc-city', name: 'City of Riverton', contact_info: { phone: '8305550100' } } as unknown as BidWithBuilder['customers']
const HILLTOP = { id: 'gc-hill', name: 'Hilltop Builders', contact_info: null } as unknown as BidWithBuilder['customers']
const PEOPLE = [{ id: 'p-ray', customer_id: 'gc-city', name: 'J. Rayburn', phone: '(830) 555-0142', note: 'Councilman' }]

function bid(over: Record<string, unknown>): BidWithBuilder {
  return {
    id: 'bid-city',
    bid_number: '82',
    project_name: 'City re-pipe',
    bid_value: 27000,
    outcome: null,
    bid_date_sent: '2026-02-11',
    last_contact: null,
    loss_category: null,
    loss_reason: null,
    bid_tab_low: null,
    bid_tab_high: null,
    bid_tab_rank_from_low: null,
    bid_tab_bidder_count: null,
    customer_id: 'gc-city',
    gc_builder_id: null,
    service_type_id: 'st1',
    customers: CITY,
    bids_gc_builders: null,
    ...over,
  } as unknown as BidWithBuilder
}

function renderTab(bids: BidWithBuilder[]) {
  const onReloadBids = vi.fn()
  const onReloadContactPersons = vi.fn()
  const onError = vi.fn()
  renderWithProviders(
    <BidsCallQueueTab
      bids={bids}
      sentScope={{ kind: 'trade', tradeId: 'st1', tradeName: 'Plumbing' }}
      gcPacketsByBid={{}}
      ledgerPrefixMap={{}}
      lastContactFromEntries={{}}
      narrowViewport640={false}
      authUserId="u1"
      onError={onError}
      onReloadBids={onReloadBids}
      onOpenBuilderCard={() => {}}
      contactPersons={PEOPLE}
      onReloadContactPersons={onReloadContactPersons}
    />,
  )
  return { onReloadBids, onReloadContactPersons, onError }
}

const pill = (name: RegExp) => within(screen.getByRole('group', { name: 'Calls by when they are due' })).getByRole('button', { name })
const logRows = () => inserts.filter((i) => i.table === 'bids_submission_entries').map((i) => i.row)

beforeEach(() => {
  inserts = []
  tableRows = {}
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-02T15:00:00-05:00'))
  vi.mocked(supabase.from).mockImplementation(((table: string) => chain(table)) as never)
})
afterEach(() => {
  vi.useRealTimers()
})

describe('BidsCallQueueTab — the three questions', () => {
  it('Still pending opens the questions and writes nothing until Save', async () => {
    renderTab([bid({})])
    await settle()
    fireEvent.click(screen.getByText(/Chase/))
    fireEvent.click(screen.getByRole('button', { name: 'Still pending' }))
    const panel = screen.getByRole('group', { name: 'When to call again' })
    expect(within(panel).getByRole('button', { name: 'Next week' })).toBeTruthy()
    // Who and why belong to a day: they are not asked until one is picked.
    expect(within(panel).queryByText('Ask for')).toBeNull()
    expect(within(panel).getByText('No day picked: back in the queue in 7 days.')).toBeTruthy()
    expect(logRows()).toEqual([])
  })

  it('Save with no day writes the contact exactly as before: no new columns', async () => {
    const { onReloadBids } = renderTab([bid({})])
    await settle()
    fireEvent.click(screen.getByText(/Chase/))
    fireEvent.click(screen.getByRole('button', { name: 'Still pending' }))
    fireEvent.click(within(screen.getByRole('group', { name: 'When to call again' })).getByRole('button', { name: 'Save' }))
    await settle()
    expect(logRows()).toHaveLength(1)
    expect(Object.keys(logRows()[0]!).sort()).toEqual(['bid_id', 'contact_method', 'created_by', 'gc_customer_id', 'notes', 'occurred_at'])
    expect(String(logRows()[0]!.notes)).not.toContain('Call again')
    expect(onReloadBids).toHaveBeenCalled()
  })

  it('a day, a person and a reason ride the same log row, with a plain sentence in the note', async () => {
    renderTab([bid({})])
    await settle()
    fireEvent.click(screen.getByText(/Chase/))
    fireEvent.change(screen.getByLabelText('Call note'), { target: { value: 'Holding for the next budget year' } })
    fireEvent.click(screen.getByRole('button', { name: 'Still pending' }))
    const panel = screen.getByRole('group', { name: 'When to call again' })
    fireEvent.click(within(panel).getByRole('button', { name: '3 months' }))
    fireEvent.click(within(panel).getByRole('button', { name: 'J. Rayburn' }))
    fireEvent.click(within(panel).getByRole('button', { name: 'Their budget' }))
    // Jan 2, 2027 is a Saturday: three months lands on Monday Jan 4.
    expect(within(panel).getByText('Out of the queue until Mon, Jan 4, 2027.')).toBeTruthy()
    fireEvent.click(within(panel).getByRole('button', { name: 'Save' }))
    await settle()
    expect(logRows()).toHaveLength(1)
    expect(logRows()[0]).toMatchObject({
      bid_id: 'bid-city',
      contact_method: 'Phone',
      next_followup_on: '2027-01-04',
      next_followup_contact_person_id: 'p-ray',
      next_followup_reason: 'budget',
    })
    expect(String(logRows()[0]!.notes)).toMatch(/Holding for the next budget year\. Call again Mon, Jan 4, 2027\. Ask for J\. Rayburn\. Waiting on their budget\.$/)
  })

  it('a typed day is taken, and a second tap on the lit chip closes the questions unsaved', async () => {
    renderTab([bid({})])
    await settle()
    fireEvent.click(screen.getByText(/Chase/))
    fireEvent.click(screen.getByRole('button', { name: 'Left message' }))
    const panel = screen.getByRole('group', { name: 'When to call again' })
    fireEvent.click(within(panel).getByRole('button', { name: 'pick a date' }))
    fireEvent.change(within(panel).getByLabelText('Day to call again'), { target: { value: '2027-01-05' } })
    expect(within(panel).getByText('Out of the queue until Tue, Jan 5, 2027.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Left message' }))
    expect(screen.queryByRole('group', { name: 'When to call again' })).toBeNull()
    expect(logRows()).toEqual([])
  })

  it('+ person adds the person to the customer and picks them', async () => {
    const { onReloadContactPersons } = renderTab([bid({})])
    await settle()
    fireEvent.click(screen.getByText(/Chase/))
    fireEvent.click(screen.getByRole('button', { name: 'Still pending' }))
    const panel = screen.getByRole('group', { name: 'When to call again' })
    fireEvent.click(within(panel).getByRole('button', { name: 'Next month' }))
    fireEvent.click(within(panel).getByRole('button', { name: '+ person' }))
    fireEvent.change(within(panel).getByLabelText("Person's name"), { target: { value: 'Dana Ortiz' } })
    fireEvent.change(within(panel).getByLabelText("Person's phone"), { target: { value: '830-555-0199' } })
    fireEvent.click(within(panel).getByRole('button', { name: 'Add to this customer' }))
    await settle()
    expect(inserts.find((i) => i.table === 'customer_contact_persons')?.row).toEqual({ customer_id: 'gc-city', name: 'Dana Ortiz', phone: '830-555-0199' })
    expect(onReloadContactPersons).toHaveBeenCalled()
    fireEvent.click(within(panel).getByRole('button', { name: 'Save' }))
    await settle()
    expect(logRows()[0]).toMatchObject({ next_followup_on: '2026-11-02', next_followup_contact_person_id: 'new-customer_contact_persons' })
    expect(String(logRows()[0]!.notes)).toContain('Ask for Dana Ortiz.')
  })

  it('Won still saves in one tap: a won bid has no next call', async () => {
    renderTab([bid({})])
    await settle()
    fireEvent.click(screen.getByText(/Chase/))
    fireEvent.click(screen.getByRole('button', { name: 'Won' }))
    await settle()
    expect(screen.queryByRole('group', { name: 'When to call again' })).toBeNull()
    expect(logRows()).toHaveLength(1)
  })
})

describe('BidsCallQueueTab — the queue by what is due', () => {
  it('a parked bid leaves the list for Later, where its date can be changed or removed', async () => {
    const { onReloadBids } = renderTab([
      bid({ next_followup_on: '2027-01-05', next_followup_contact_person_id: 'p-ray', next_followup_reason: 'budget', next_followup_entry_id: 'e1', last_contact: '2026-10-01T15:00:00Z' }),
    ])
    await settle()
    expect(pill(/^Later/).textContent).toBe('Later1')
    expect(pill(/^No date yet/).textContent).toBe('No date yet0')
    expect(screen.getByText('0 of 1 fresh · 1 later')).toBeTruthy()
    // Parked: nothing to chase, and its tab is not asked for either.
    expect(screen.getByText(/Call anyway/)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /Later · 1 bid waiting on a date/ }))
    const row = screen.getByTestId('call-queue-later-row')
    expect(within(row).getByText('Tue, Jan 5, 2027')).toBeTruthy()
    expect(within(row).getByText('Their budget · ask for J. Rayburn')).toBeTruthy()

    fireEvent.click(within(row).getByRole('button', { name: 'change date' }))
    const panel = within(row).getByRole('group', { name: 'When to call again' })
    // It starts from the day the bid has.
    expect(within(panel).getByRole('button', { name: 'Tue, Jan 5, 2027' }).getAttribute('aria-pressed')).toBe('true')
    expect(within(panel).getByRole('button', { name: 'J. Rayburn' }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(within(panel).getByRole('button', { name: 'Next week' }))
    fireEvent.click(within(panel).getByRole('button', { name: 'Save the date' }))
    await settle()
    // A note, not a contact: the last contact must not move.
    expect(logRows()[0]).toMatchObject({ contact_method: null, next_followup_on: '2026-10-09', next_followup_contact_person_id: 'p-ray', next_followup_reason: 'budget', next_followup_cleared: false })
    expect(String(logRows()[0]!.notes)).toMatch(/^Date moved\. Call again Fri, Oct 9\./)
    expect(onReloadBids).toHaveBeenCalled()

    fireEvent.click(within(screen.getByTestId('call-queue-later-row')).getByRole('button', { name: 'change date' }))
    fireEvent.click(within(screen.getByTestId('call-queue-later-row')).getByRole('button', { name: 'No date' }))
    await settle()
    expect(logRows()[1]).toMatchObject({ contact_method: null, next_followup_on: null, next_followup_contact_person_id: null, next_followup_reason: null, next_followup_cleared: true, notes: 'Call-again date removed.' })
  })

  it('on its day the card is on top, tagged, with who to ask for and what was said last time', async () => {
    tableRows.bids_submission_entries = [
      { id: 'e1', notes: 'Still pending. Holding for the next budget year. Call again Fri, Oct 2. Ask for J. Rayburn.', occurred_at: '2026-06-30T15:00:00Z', created_by_user: { name: 'Robert', email: 'r@x.test' } },
    ]
    renderTab([
      bid({ id: 'bid-old', bid_number: '12', project_name: 'A year quiet', customer_id: 'gc-hill', customers: HILLTOP, bid_date_sent: '2025-09-01' }),
      bid({ next_followup_on: '2026-10-02', next_followup_contact_person_id: 'p-ray', next_followup_reason: 'budget', next_followup_entry_id: 'e1', last_contact: '2026-06-30T15:00:00Z' }),
    ])
    await settle()
    expect(pill(/^Due/).textContent).toBe('Due1')
    expect(pill(/^No date yet/).textContent).toBe('No date yet1')
    const names = screen.getAllByText(/^(City of Riverton|Hilltop Builders)$/).map((n) => n.textContent)
    expect(names).toEqual(['City of Riverton', 'Hilltop Builders'])
    expect(screen.getAllByText('Due today').length).toBeGreaterThan(0)
    expect(screen.getByText(/promised for today/)).toBeTruthy()

    fireEvent.click(screen.getAllByText(/Chase/)[0]!)
    expect(screen.getByText('J. Rayburn')).toBeTruthy()
    expect(screen.getByRole('link', { name: /\(830\) 555-0142/ }).getAttribute('href')).toContain('tel:')
    // What was said, without the sentence about the day (the tag already says it).
    expect(screen.getByText('“Still pending. Holding for the next budget year.”')).toBeTruthy()
    expect(screen.getByText(/Last time, Tue, Jun 30/)).toBeTruthy()
    expect(screen.getByText(/— Robert/)).toBeTruthy()
    expect(screen.getByText(/waiting on their budget/)).toBeTruthy()

    // The pill narrows the list, and a second tap clears it.
    fireEvent.click(pill(/^Due/))
    expect(screen.queryByText('Hilltop Builders')).toBeNull()
    fireEvent.click(pill(/^Due/))
    expect(screen.getByText('Hilltop Builders')).toBeTruthy()
    fireEvent.click(pill(/^No date yet/))
    expect(screen.queryByText('City of Riverton')).toBeNull()
  })

  it('a missed day reads overdue, with the day it was promised for', async () => {
    renderTab([bid({ next_followup_on: '2026-09-29', last_contact: '2026-09-20T15:00:00Z' })])
    await settle()
    expect(pill(/^Overdue/).textContent).toBe('Overdue1')
    expect(screen.getByText('3 d overdue')).toBeTruthy()
    expect(screen.getByText(/promised Tue, Sep 29/)).toBeTruthy()
  })

  it('a day that a later contact has spent no longer parks or flags the bid', async () => {
    renderTab([bid({ next_followup_on: '2026-09-29', last_contact: '2026-09-30T15:00:00Z' })])
    await settle()
    // Contacted two days ago, on a day after the promise: fresh, on the seven-day rule again.
    expect(pill(/^Overdue/).textContent).toBe('Overdue0')
    expect(screen.getByText('1 of 1 fresh')).toBeTruthy()
  })

  it("a bid with no day of its own waits on its builder's", async () => {
    tableRows.customer_followup_prefs = [{ customer_id: 'gc-city', next_followup_at: '2026-10-20T13:00:00Z', snoozed_until: null }]
    renderTab([bid({})])
    await settle()
    expect(pill(/^Later/).textContent).toBe('Later1')
    fireEvent.click(screen.getByRole('button', { name: /Later · 1 bid waiting on a date/ }))
    const row = screen.getByTestId('call-queue-later-row')
    expect(within(row).getByText('Tue, Oct 20')).toBeTruthy()
    expect(within(row).getByText('the builder’s date')).toBeTruthy()
  })

  it('the Later pill shows only the parked bids', async () => {
    renderTab([
      bid({ next_followup_on: '2027-01-05' }),
      bid({ id: 'bid-old', bid_number: '12', project_name: 'A year quiet', customer_id: 'gc-hill', customers: HILLTOP, bid_date_sent: '2025-09-01' }),
    ])
    await settle()
    fireEvent.click(pill(/^Later/))
    expect(screen.getByTestId('call-queue-later-row')).toBeTruthy()
    expect(screen.queryByText('Hilltop Builders')).toBeNull()
    expect(screen.queryByText(/Start call/)).toBeNull()
  })
})
