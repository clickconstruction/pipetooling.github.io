// @vitest-environment jsdom
/**
 * The Fill them in deck's job-account kind (v2.5776, punch list #146): three answers, only the
 * fields the answer needs, Save waits for a reason when not needed, the save is the Mark opened
 * sheet's row through the io, the trail says what happened, and Undo hands back what was there.
 */
import { useState } from 'react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { installDomShims, renderWithProviders, settle } from '../../test/renderSmokeMocks'
import { jobAccountFillInRows } from '../../lib/needsYou/fillInJobAccounts'
import type { JobAccountFillInIo, JobAccountSaved } from '../../lib/needsYou/fillInJobAccountsIo'
import { NeedsYouFillInDeck } from './NeedsYouFillInDeck'
import type { FillInRow } from '../../hooks/useFillInRows'

const navigate = vi.fn()
vi.mock('react-router-dom', async (orig) => ({ ...(await orig<typeof import('react-router-dom')>()), useNavigate: () => navigate }))
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../lib/navClickTelemetry', () => ({ recordNavClick: vi.fn(), recordNavClickFromEvent: vi.fn() }))

const rowsOf = () =>
  jobAccountFillInRows(
    [
      { job_id: 'j-1', supply_house_id: 'h-1', house_name: 'Ferguson', allocated_total: 1860, unpaid_total: 420, invoice_count: 3, po_count: 0, last_at: '2026-10-02T15:00:00Z', rep_name: 'Curly', rep_phone: '210-555-0100' },
      { job_id: 'j-2', supply_house_id: 'h-2', house_name: 'Moore Supply', allocated_total: 300, unpaid_total: 0, invoice_count: 1, po_count: 0, last_at: null, rep_name: null, rep_phone: null },
    ],
    [
      { id: 'j-1', hcp_number: '650', click_number: null, job_name: 'Maple Street remodel', job_address: null },
      { id: 'j-2', hcp_number: null, click_number: 'C12', job_name: 'Cedar Loop clinic', job_address: null },
    ],
  )

function harness() {
  const saves: unknown[] = []
  const undos: JobAccountSaved[] = []
  const io: JobAccountFillInIo = {
    fetchGaps: async () => [],
    fetchJobs: async () => [],
    save: async (w) => {
      saves.push(w)
      return { jobId: w.jobId, houseId: w.houseId, previous: null, flaggedInvoiceIds: w.flagInvoices ? ['inv-1', 'inv-2'] : [] }
    },
    undo: async (s) => {
      undos.push(s)
    },
  }
  let rows: FillInRow[] = rowsOf()
  const none = { fetchSources: async () => [], save: async () => ({ entryId: null }), undo: async () => {} }
  const noVehicles = { fetchGaps: async () => [], fetchPlans: async () => [], save: async () => { throw new Error('not here') }, undo: async () => {} }
  function Host() {
    const [, bump] = useState(0)
    return (
      <NeedsYouFillInDeck
        rows={rows}
        loading={false}
        userId="u-1"
        role="assistant"
        startKind="job-account"
        onRowSaved={(r) => {
          rows = rows.filter((x) => x.key !== r.key)
          bump((n) => n + 1)
        }}
        onRowRestored={(r) => {
          rows = [r, ...rows]
          bump((n) => n + 1)
        }}
        onExit={() => {}}
        io={{ lostBids: none, vehicles: noVehicles, jobAccounts: io, contracts: { fetchSources: async () => ({ jobs: [], contracts: [], estimates: [], floorCents: 0 }), resend: async () => {}, text: async () => true, filePaper: async () => ({ uploadError: null }) } }}
      />
    )
  }
  return { render: () => renderWithProviders(<Host />), saves, undos }
}

const trail = () => document.querySelector('[data-fill-in-trail]')?.textContent ?? ''

beforeAll(installDomShims)
afterEach(() => {
  cleanup()
  navigate.mockClear()
})

describe('NeedsYouFillInDeck · job accounts', () => {
  it('opens on the biggest unpaid pair, asks the three answers, and opened asks how and the reference', async () => {
    const h = harness()
    h.render()
    await settle()
    expect(screen.getByText('#650 Maple Street remodel · Ferguson · $1,860 on 3 invoices')).toBeTruthy()
    expect(screen.getByText('The rep for job accounts is Curly, 210-555-0100.')).toBeTruthy()
    const save = () => screen.getByRole('button', { name: 'Save and next' }) as HTMLButtonElement
    expect(save().disabled).toBe(true)
    expect(document.querySelector('[data-job-account-open]')).toBeNull()
    fireEvent.click(screen.getByRole('radio', { name: /It is on our job account there/ }))
    expect(document.querySelector('[data-job-account-open]')).toBeTruthy()
    expect(save().disabled).toBe(false)
    fireEvent.change(screen.getByLabelText('The house’s reference'), { target: { value: '44812' } })
    fireEvent.click(save())
    await waitFor(() => expect(h.saves.length).toBe(1))
    await settle()
    expect(h.saves[0]).toMatchObject({ jobId: 'j-1', houseId: 'h-1', row: { status: 'open', account_ref: '44812', opened_via: 'phone' }, flagInvoices: true })
    expect(trail()).toContain('opened by phone · ref 44812 · 2 invoices flagged on it · the house roster has it')
    expect(screen.getByText('#C12 Cedar Loop clinic · Moore Supply · $300 on one invoice')).toBeTruthy()
  })

  it('not needed waits for the reason; Undo hands back what was there', async () => {
    const h = harness()
    h.render()
    await settle()
    const save = () => screen.getByRole('button', { name: 'Save and next' }) as HTMLButtonElement
    fireEvent.click(screen.getByRole('radio', { name: /No account needed/ }))
    expect(save().disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Why not'), { target: { value: 'the insurer pays the house direct' } })
    expect(save().disabled).toBe(false)
    fireEvent.click(save())
    await waitFor(() => expect(h.saves.length).toBe(1))
    await settle()
    expect(h.saves[0]).toMatchObject({ row: { status: 'not_needed', note: 'the insurer pays the house direct', opened_via: null }, flagInvoices: false })
    expect(trail()).toContain('not needed · the insurer pays the house direct')
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    await waitFor(() => expect(h.undos.length).toBe(1))
    expect(h.undos[0]).toEqual({ jobId: 'j-1', houseId: 'h-1', previous: null, flaggedInvoiceIds: [] })
  })

  it('asked the house needs nothing more', async () => {
    const h = harness()
    h.render()
    await settle()
    fireEvent.click(screen.getByRole('radio', { name: /Asked the house for one/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Save and next' }))
    await waitFor(() => expect(h.saves.length).toBe(1))
    expect(h.saves[0]).toMatchObject({ row: { status: 'requested' }, flagInvoices: false })
  })
})
