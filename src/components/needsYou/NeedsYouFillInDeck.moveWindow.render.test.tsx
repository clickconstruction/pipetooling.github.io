// @vitest-environment jsdom
/**
 * The Fill them in deck's move-window kind (v2.6086, punch list #178, PR 3): the soonest window
 * first with what the app knows, three answers, moved with no account on record takes the
 * house's reference and saves the flag with the account, the emailed ask saves through the io
 * with Send and next and no Undo, not needed waits for the reason and Undo hands the account
 * back, and the door opens the worked list.
 */
import { useState } from 'react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { installDomShims, renderWithProviders, settle } from '../../test/renderSmokeMocks'
import { moveWindowFillInRows, type MoveWindowSources } from '../../lib/needsYou/fillInMoveWindow'
import type { MoveWindowFillInIo, MoveWindowSaved } from '../../lib/needsYou/fillInMoveWindowIo'
import { NeedsYouFillInDeck } from './NeedsYouFillInDeck'
import type { FillInRow } from '../../hooks/useFillInRows'

const navigate = vi.fn()
vi.mock('react-router-dom', async (orig) => ({ ...(await orig<typeof import('react-router-dom')>()), useNavigate: () => navigate }))
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../lib/navClickTelemetry', () => ({ recordNavClick: vi.fn(), recordNavClickFromEvent: vi.fn() }))

const TODAY = '2026-10-29'
const sources = (): MoveWindowSources => ({
  invoices: [
    { id: 'inv-a', supply_house_id: 'h-1', invoice_number: 'INV-a', purchase_order_number: '1182', invoice_date: '2026-10-01', amount: 2210, due_date: '2026-11-02', on_job_account: false },
    { id: 'inv-b', supply_house_id: 'h-1', invoice_number: 'INV-b', purchase_order_number: null, invoice_date: '2026-10-02', amount: 1742.65, due_date: TODAY, on_job_account: false },
    { id: 'inv-m', supply_house_id: 'h-2', invoice_number: 'INV-m', purchase_order_number: null, invoice_date: '2026-10-06', amount: 120, due_date: '2026-11-03', on_job_account: false },
  ],
  allocations: [
    { invoice_id: 'inv-a', job_id: 'j-650' },
    { invoice_id: 'inv-b', job_id: 'j-712' },
    { invoice_id: 'inv-m', job_id: 'j-901' },
  ],
  accounts: [{ job_id: 'j-650', supply_house_id: 'h-1', status: 'open', account_ref: '44812', opened_at: '2026-10-10T15:00:00Z', requested_at: null }],
  asks: [{ id: 'ask-1', invoice_id: 'inv-a', requested_at: '2026-10-27T14:00:00Z', via: 'email', sent_to: 'curly@bluebonnet.com' }],
  reps: [{ id: 'rep-1', supply_house_id: 'h-1', name: 'Curly', email: 'curly@bluebonnet.com', phone: '210-555-0100' }],
  houses: [
    { id: 'h-1', name: 'Bluebonnet Supply' },
    { id: 'h-2', name: 'Moore Supply' },
  ],
  jobs: [
    { id: 'j-650', hcp_number: '650', click_number: null, job_name: 'Maple Street remodel', job_address: null },
    { id: 'j-712', hcp_number: '712', click_number: null, job_name: 'Cedar Loop clinic', job_address: null },
    { id: 'j-901', hcp_number: '901', click_number: null, job_name: 'Pine Road duplex', job_address: null },
  ],
  todayYmd: TODAY,
  nowMs: Date.parse('2026-10-29T15:00:00Z'),
})

function harness() {
  const saves: unknown[] = []
  const undos: MoveWindowSaved[] = []
  const io: MoveWindowFillInIo = {
    fetchSources: async () => sources(),
    save: async (w) => {
      saves.push(w)
      if (w.choice === 'moved') return { choice: 'moved', invoiceId: w.invoiceId, confirmedAskId: null, insertedAskId: 'row-9', account: w.account ? { jobId: w.account.jobId, houseId: w.account.houseId, previous: null, flaggedInvoiceIds: [] } : null }
      if (w.choice === 'asked') return { choice: 'asked', invoiceId: w.invoiceId, sentTo: 'curly@bluebonnet.com' }
      return { choice: 'not_needed', invoiceId: w.invoiceId, account: { jobId: w.account.jobId, houseId: w.account.houseId, previous: null, flaggedInvoiceIds: [] } }
    },
    undo: async (s) => {
      undos.push(s)
    },
  }
  let rows: FillInRow[] = moveWindowFillInRows(sources())
  const none = { fetchSources: async () => [], save: async () => ({ entryId: null }), undo: async () => {} }
  const noVehicles = { fetchGaps: async () => [], fetchPlans: async () => [], save: async () => { throw new Error('not here') }, undo: async () => {} }
  const noAccounts = { fetchGaps: async () => [], fetchJobs: async () => [], save: async () => { throw new Error('not here') }, undo: async () => {} }
  function Host() {
    const [, bump] = useState(0)
    return (
      <NeedsYouFillInDeck
        rows={rows}
        loading={false}
        userId="u-1"
        role="assistant"
        startKind="move-window"
        onRowSaved={(r) => {
          rows = rows.filter((x) => x.key !== r.key)
          bump((n) => n + 1)
        }}
        onRowRestored={(r) => {
          rows = [r, ...rows]
          bump((n) => n + 1)
        }}
        onExit={() => {}}
        io={{ lostBids: none, vehicles: noVehicles, jobAccounts: noAccounts, contracts: { fetchSources: async () => ({ jobs: [], contracts: [], estimates: [], floorCents: 0 }), resend: async () => {}, text: async () => true, filePaper: async () => ({ uploadError: null }) }, moveWindow: io }}
      />
    )
  }
  return { render: () => renderWithProviders(<Host />), saves, undos }
}

const trail = () => document.querySelector('[data-fill-in-trail]')?.textContent ?? ''
const cardTitle = () => document.querySelector('[data-fill-in-row] [data-fill-in-title]')?.textContent ?? ''

beforeAll(installDomShims)
afterEach(() => {
  cleanup()
  navigate.mockClear()
})

describe('NeedsYouFillInDeck · the move window', () => {
  it('opens on the soonest window with what the app knows; moved takes the reference and saves the flag with the account', async () => {
    const h = harness()
    h.render()
    await settle()
    expect(cardTitle()).toBe('$1,742.65 at Bluebonnet Supply · #712 Cedar Loop clinic · closes today')
    expect(screen.getByText('1 of 3 charges')).toBeTruthy()
    expect(screen.getByText('The window closes today, Thu Oct 29.')).toBeTruthy()
    expect(screen.getByText('No job account on record for this job at Bluebonnet Supply.')).toBeTruthy()
    const save = () => screen.getByRole('button', { name: 'Save and next' }) as HTMLButtonElement
    expect(save().disabled).toBe(true)
    expect(document.querySelector('[data-move-window-ref]')).toBeNull()
    fireEvent.click(screen.getByRole('radio', { name: /Moved · I called the house/ }))
    expect(document.querySelector('[data-move-window-ref]')).toBeTruthy()
    expect(save().disabled).toBe(false)
    fireEvent.change(screen.getByLabelText('The house’s reference'), { target: { value: '9001' } })
    fireEvent.click(save())
    await waitFor(() => expect(h.saves.length).toBe(1))
    await settle()
    expect(h.saves[0]).toMatchObject({ choice: 'moved', invoiceId: 'inv-b', account: { row: { status: 'open', account_ref: '9001', opened_via: 'phone' } } })
    expect(trail()).toContain('moved onto the job account · the account opened by phone, ref 9001 · Accounts payable has it')
    expect(cardTitle()).toBe('$2,210.00 at Bluebonnet Supply · #650 Maple Street remodel · closes in 4 days')
    // Undo hands everything back.
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    await waitFor(() => expect(h.undos.length).toBe(1))
    expect(h.undos[0]).toMatchObject({ choice: 'moved', invoiceId: 'inv-b', insertedAskId: 'row-9' })
  })

  it('the emailed ask reads Send the email again with an ask out, saves with Send and next, and cannot be undone', async () => {
    const h = harness()
    h.render()
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }))
    await settle()
    expect(cardTitle()).toBe('$2,210.00 at Bluebonnet Supply · #650 Maple Street remodel · closes in 4 days')
    expect(screen.getByText('Asked by email Oct 27, 2 days ago, to curly@bluebonnet.com. The house has not confirmed.')).toBeTruthy()
    // The account is open: moved asks no reference here.
    fireEvent.click(screen.getByRole('radio', { name: /Moved · I called the house/ }))
    expect(document.querySelector('[data-move-window-ref]')).toBeNull()
    fireEvent.click(screen.getByRole('radio', { name: /Send the email again/ }))
    expect(document.querySelector('[data-move-window-email]')?.textContent).toContain('Curly · curly@bluebonnet.com')
    fireEvent.click(screen.getByRole('button', { name: 'Send and next' }))
    await waitFor(() => expect(h.saves.length).toBe(1))
    await settle()
    expect(h.saves[0]).toEqual({ choice: 'asked', invoiceId: 'inv-a', includeAsked: true, sentTo: 'curly@bluebonnet.com' })
    expect(trail()).toContain('asked curly@bluebonnet.com by email · follow up with a call until the house confirms')
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull()
  })

  it('with no rep address the email is dead; not needed waits for the reason and Undo hands the account back', async () => {
    const h = harness()
    h.render()
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }))
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }))
    await settle()
    expect(cardTitle()).toBe('$120.00 at Moore Supply · #901 Pine Road duplex · closes in 5 days')
    expect((screen.getByRole('radio', { name: /Ask the house by email/ }) as HTMLButtonElement).disabled).toBe(true)
    const save = () => screen.getByRole('button', { name: 'Save and next' }) as HTMLButtonElement
    fireEvent.click(screen.getByRole('radio', { name: /No job account needed/ }))
    expect(save().disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Why not'), { target: { value: 'online orders only' } })
    expect(save().disabled).toBe(false)
    fireEvent.click(save())
    await waitFor(() => expect(h.saves.length).toBe(1))
    await settle()
    expect(h.saves[0]).toMatchObject({ choice: 'not_needed', invoiceId: 'inv-m', account: { row: { job_id: 'j-901', supply_house_id: 'h-2', status: 'not_needed', note: 'online orders only' } } })
    expect(trail()).toContain('not needed · online orders only · the house roster has it, and the charge leaves the window')
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    await waitFor(() => expect(h.undos.length).toBe(1))
    expect(h.undos[0]).toMatchObject({ choice: 'not_needed', invoiceId: 'inv-m' })
  })

  it('the door opens the worked list', async () => {
    const h = harness()
    h.render()
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'Open the list ›' }))
    expect(navigate).toHaveBeenCalledWith('/materials?tab=supply-houses&list=movable')
  })
})
