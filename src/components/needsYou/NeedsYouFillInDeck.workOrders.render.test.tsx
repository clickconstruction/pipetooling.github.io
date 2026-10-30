// @vitest-environment jsdom
/**
 * The Fill them in deck's work-order kind (v2.6094, punch list #178, PR 5): the oldest draft
 * first with what the app knows, Save waits for a price, the bid's sub-labor total fills it in
 * one tap, the save writes the price through the io, the trail says where the send waits, Undo
 * clears the price, and the door opens the draft on the board.
 */
import { useState } from 'react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { installDomShims, renderWithProviders, settle } from '../../test/renderSmokeMocks'
import { workOrderFillInRows, type WorkOrderSources } from '../../lib/needsYou/fillInWorkOrders'
import type { WorkOrderFillInIo, WorkOrderSaved } from '../../lib/needsYou/fillInWorkOrdersIo'
import { NeedsYouFillInDeck } from './NeedsYouFillInDeck'
import type { FillInRow } from '../../hooks/useFillInRows'

const navigate = vi.fn()
vi.mock('react-router-dom', async (orig) => ({ ...(await orig<typeof import('react-router-dom')>()), useNavigate: () => navigate }))
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../lib/navClickTelemetry', () => ({ recordNavClick: vi.fn(), recordNavClickFromEvent: vi.fn() }))

const sources = (): WorkOrderSources => ({
  drafts: [
    { id: 'wo-2', person_id: 'p-2', display_name: 'Rudy Vega', job_id: 'j-983', created_at: '2026-10-21T14:00:00Z', offer_scope_snapshot: { anchor: 'job', lines: [{ label: 'Rough-in', amount: null }] }, proposed_start: null, proposed_end: null },
    { id: 'wo-1', person_id: 'p-1', display_name: 'Dale Brennan', job_id: 'j-650', created_at: '2026-10-27T14:00:00Z', offer_scope_snapshot: null, proposed_start: null, proposed_end: null },
  ],
  jobs: [
    { id: 'j-983', hcp_number: '983', click_number: null, job_name: 'Water Heater removal', job_address: null },
    { id: 'j-650', hcp_number: '650', click_number: null, job_name: 'Maple Street remodel', job_address: null },
  ],
  hints: [{ jobId: 'j-983', rough_in: 2000, top_out: 1400, trim_set: 800, total: 4200 }],
  nowMs: Date.parse('2026-10-29T15:00:00Z'),
})

function harness() {
  const saves: unknown[] = []
  const undos: WorkOrderSaved[] = []
  const io: WorkOrderFillInIo = {
    fetchSources: async () => sources(),
    save: async (w) => {
      saves.push(w)
      return { commitmentId: w.commitmentId }
    },
    undo: async (s) => {
      undos.push(s)
    },
  }
  let rows: FillInRow[] = workOrderFillInRows(sources())
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
        startKind="work-order"
        onRowSaved={(r) => {
          rows = rows.filter((x) => x.key !== r.key)
          bump((n) => n + 1)
        }}
        onRowRestored={(r) => {
          rows = [r, ...rows]
          bump((n) => n + 1)
        }}
        onExit={() => {}}
        io={{ lostBids: none, vehicles: noVehicles, jobAccounts: noAccounts, contracts: { fetchSources: async () => ({ jobs: [], contracts: [], estimates: [], floorCents: 0 }), resend: async () => {}, text: async () => true, filePaper: async () => ({ uploadError: null }) }, workOrders: io }}
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

describe('NeedsYouFillInDeck · work orders', () => {
  it('opens on the oldest draft with what the app knows; the bid’s total fills the price and Save writes it', async () => {
    const h = harness()
    h.render()
    await settle()
    expect(cardTitle()).toBe('Rudy Vega · #983 Water Heater removal · drafted Oct 21')
    expect(screen.getByText('1 of 2 work orders')).toBeTruthy()
    expect(screen.getByText('Drafted for Rudy Vega Oct 21, 8 days ago.')).toBeTruthy()
    expect(screen.getByText('From the bid: $4,200.00 sub labor. Rough-in $2,000.00, top-out $1,400.00, trim-set $800.00.')).toBeTruthy()
    const save = () => screen.getByRole('button', { name: 'Save and next' }) as HTMLButtonElement
    expect(save().disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'From the bid: $4,200.00 sub labor' }))
    expect((screen.getByLabelText('The subcontract amount') as HTMLInputElement).value).toBe('4200')
    expect(save().disabled).toBe(false)
    fireEvent.click(save())
    await waitFor(() => expect(h.saves.length).toBe(1))
    await settle()
    expect(h.saves[0]).toEqual({ commitmentId: 'wo-2', amount: 4200 })
    expect(trail()).toContain('Rudy Vega · #983 Water Heater removal · drafted Oct 21 · priced $4,200.00 · the board\'s Next is Send for signature')
    expect(cardTitle()).toBe('Dale Brennan · #650 Maple Street remodel · drafted Oct 27')
    // No bid behind this one: the price is typed.
    expect(screen.getByText('No bid total to copy. Type the price the leader gave.')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('The subcontract amount'), { target: { value: '1850.5' } })
    expect(save().disabled).toBe(false)
    // Undo on the first clears its price and brings it back.
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    await waitFor(() => expect(h.undos.length).toBe(1))
    expect(h.undos[0]).toEqual({ commitmentId: 'wo-2' })
    await settle()
    expect(cardTitle()).toBe('Rudy Vega · #983 Water Heater removal · drafted Oct 21')
  })

  it('a zero price is not a price; the door opens the draft on the board', async () => {
    const h = harness()
    h.render()
    await settle()
    fireEvent.change(screen.getByLabelText('The subcontract amount'), { target: { value: '0' } })
    expect((screen.getByRole('button', { name: 'Save and next' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Open the draft ›' }))
    expect(navigate).toHaveBeenCalledWith('/jobs?tab=subs&wo=wo-2')
  })
})
