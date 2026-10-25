// @vitest-environment jsdom
/**
 * The Fill them in deck's contract-missing kind (v2.5844, punch list #176, change 3): a live job
 * with no contract on file, two answers the deck saves (paper, No contract needed with a
 * reason), the send left to the sweep behind the row's door, Undo on No contract needed only.
 */
import { useState } from 'react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { installDomShims, renderWithProviders, settle } from '../../test/renderSmokeMocks'
import { contractMissingFillInRows } from '../../lib/needsYou/fillInContractsMissing'
import type { ContractMissingFillInIo } from '../../lib/needsYou/fillInContractsMissingIo'
import { NeedsYouFillInDeck } from './NeedsYouFillInDeck'
import type { FillInRow } from '../../hooks/useFillInRows'

const navigate = vi.fn()
vi.mock('react-router-dom', async (orig) => ({ ...(await orig<typeof import('react-router-dom')>()), useNavigate: () => navigate }))
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../lib/navClickTelemetry', () => ({ recordNavClick: vi.fn(), recordNavClickFromEvent: vi.fn() }))

const NOW = new Date('2026-10-25T16:00:00Z')

function harness(customerEmail: string | null = 'ap@structura.example') {
  const papers: unknown[] = []
  const notNeeded: unknown[] = []
  const undone: string[] = []
  const io: ContractMissingFillInIo = {
    fetchSources: async () => ({ jobs: [], contracts: [], estimates: [], floorCents: 0 }),
    filePaper: async (w) => {
      papers.push(w)
      return { uploadError: null }
    },
    markNotNeeded: async (w) => {
      notNeeded.push(w)
    },
    undoNotNeeded: async (jobId) => {
      undone.push(jobId)
    },
  }
  let rows: FillInRow[] = contractMissingFillInRows({
    jobs: [{ id: 'j-7', bid_id: null, status: 'working', revenue: 249_716, hcp_number: '1007', click_number: null, job_name: 'SPACEX BA-02N', customer_name: 'Structura, Inc.', job_address: '1 Rocket Rd', customer_email: customerEmail }],
    contracts: [],
    estimates: [],
    now: NOW,
    floorCents: 0,
  })
  const none = { fetchSources: async () => [], save: async () => ({ entryId: null }), undo: async () => {} }
  const noVehicles = { fetchGaps: async () => [], fetchPlans: async () => [], save: async () => { throw new Error('not here') }, undo: async () => {} }
  const noJobAccounts = { fetchGaps: async () => [], fetchJobs: async () => [], save: async () => { throw new Error('not here') }, undo: async () => {} }
  const noContracts = { fetchSources: async () => ({ jobs: [], contracts: [], estimates: [], floorCents: 0 }), resend: async () => {}, text: async () => true, filePaper: async () => ({ uploadError: null }) }
  function Host() {
    const [, bump] = useState(0)
    return (
      <NeedsYouFillInDeck
        rows={rows}
        loading={false}
        userId="u-1"
        role="assistant"
        startKind="contract-missing"
        onRowSaved={(r) => {
          rows = rows.filter((x) => x.key !== r.key)
          bump((n) => n + 1)
        }}
        onRowRestored={(r) => {
          rows = [...rows, r]
          bump((n) => n + 1)
        }}
        onExit={() => {}}
        io={{ lostBids: none, vehicles: noVehicles, jobAccounts: noJobAccounts, contracts: noContracts, contractsMissing: io }}
      />
    )
  }
  return { render: () => renderWithProviders(<Host />), papers, notNeeded, undone }
}

const trail = () => document.querySelector('[data-fill-in-trail]')?.textContent ?? ''

beforeAll(installDomShims)
afterEach(() => {
  cleanup()
  navigate.mockClear()
})

describe('NeedsYouFillInDeck · contracts missing', () => {
  it('draws the job with what it knows, says the send is the sweep’s, and the door opens the sweep', async () => {
    const h = harness()
    h.render()
    await settle()
    expect(screen.getByText('#1007 SPACEX BA-02N · Structura, Inc. · $249,716 · no contract on file')).toBeTruthy()
    expect(screen.getByText('Working · $249,716 of work on no signed agreement.')).toBeTruthy()
    expect(screen.getByText(/press Send it from the sweep/)).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Save and next' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: /Send it from the sweep/ }))
    expect(navigate).toHaveBeenCalledWith('/jobs?tab=stages&contractSweep=1')
  })

  it('No contract needed takes a reason, saves it, and Undo clears it', async () => {
    const h = harness(null)
    h.render()
    await settle()
    expect(screen.getByText(/needs an email first/)).toBeTruthy()
    fireEvent.click(screen.getByRole('radio', { name: /No contract needed/ }))
    const primary = () => screen.getByRole('button', { name: 'Save and next' }) as HTMLButtonElement
    expect(primary().disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Why no contract is needed'), { target: { value: 'A PO stands in for it' } })
    expect(primary().disabled).toBe(false)
    fireEvent.click(primary())
    await waitFor(() => expect(h.notNeeded.length).toBe(1))
    expect(h.notNeeded[0]).toEqual({ choice: 'not-needed', jobId: 'j-7', reason: 'A PO stands in for it' })
    await settle()
    expect(trail()).toContain('no contract needed · A PO stands in for it')
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    await waitFor(() => expect(h.undone).toEqual(['j-7']))
  })

  it('paper takes the signer and the day and files it with no draft', async () => {
    const h = harness()
    h.render()
    await settle()
    fireEvent.click(screen.getByRole('radio', { name: /Signed on paper/ }))
    expect((screen.getByLabelText('Who signed') as HTMLInputElement).value).toBe('Structura, Inc.')
    fireEvent.change(screen.getByLabelText('Signed on'), { target: { value: '2026-10-09' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save and next' }))
    await waitFor(() => expect(h.papers.length).toBe(1))
    expect(h.papers[0]).toMatchObject({ choice: 'paper', jobId: 'j-7', signerName: 'Structura, Inc.', signedOn: '2026-10-09' })
    await settle()
    expect(trail()).toContain('signed on paper by Structura, Inc. · on file as signed')
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull()
  })
})
