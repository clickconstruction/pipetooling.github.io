// @vitest-environment jsdom
/**
 * The Fill them in deck's contract kind (v2.5777, punch list #146): a sent agreement out a week,
 * three doors drawn from what the row can take, the primary button saying what it will do, a
 * resend through the io with the line to add, paper needing a signer, and no Undo on this kind.
 */
import { useState } from 'react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { installDomShims, renderWithProviders, settle } from '../../test/renderSmokeMocks'
import { contractFillInRows, type ContractJobSource, type ContractRowSource } from '../../lib/needsYou/fillInContracts'
import type { ContractFillInIo } from '../../lib/needsYou/fillInContractsIo'
import { NeedsYouFillInDeck } from './NeedsYouFillInDeck'
import type { FillInRow } from '../../hooks/useFillInRows'

const navigate = vi.fn()
vi.mock('react-router-dom', async (orig) => ({ ...(await orig<typeof import('react-router-dom')>()), useNavigate: () => navigate }))
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../lib/navClickTelemetry', () => ({ recordNavClick: vi.fn(), recordNavClickFromEvent: vi.fn() }))

const NOW = new Date('2026-10-23T16:00:00Z')
const job = (p: Partial<ContractJobSource> = {}): ContractJobSource => ({ id: 'j-1', bid_id: null, status: 'working', revenue: 7450, hcp_number: '1038', click_number: null, job_name: 'Dana Whitfield', customer_name: 'Dana Whitfield', job_address: '9 Maple St', ...p })
const contract = (p: Partial<ContractRowSource> = {}): ContractRowSource => ({
  id: 'c-1',
  job_id: 'j-1',
  status: 'sent',
  revision: 1,
  recipient_email: 'dana@example.com',
  recipient_name: 'Dana Whitfield',
  recipient_phone: null,
  sent_at: '2026-09-24T15:00:00Z',
  last_sent_at: '2026-09-24T15:00:00Z',
  view_count: 2,
  signed_at: null,
  signer_printed_name: null,
  signer_mode: null,
  voided_at: null,
  signed_document_url: null,
  signer_consented_at: null,
  co_signer_name: null,
  co_signed_at: null,
  co_signer_printed_name: null,
  co_signer_mode: null,
  ...p,
})

function harness() {
  const resends: unknown[] = []
  const papers: unknown[] = []
  const io: ContractFillInIo = {
    fetchSources: async () => ({ jobs: [], contracts: [], estimates: [], floorCents: 0 }),
    resend: async (w) => {
      resends.push(w)
    },
    text: async () => true,
    filePaper: async (w) => {
      papers.push(w)
      return { uploadError: null }
    },
  }
  let rows: FillInRow[] = contractFillInRows({ jobs: [job()], contracts: [contract()], estimates: [], now: NOW, floorCents: 0 })
  const none = { fetchSources: async () => [], save: async () => ({ entryId: null }), undo: async () => {} }
  const noVehicles = { fetchGaps: async () => [], fetchPlans: async () => [], save: async () => { throw new Error('not here') }, undo: async () => {} }
  const noJobAccounts = { fetchGaps: async () => [], fetchJobs: async () => [], save: async () => { throw new Error('not here') }, undo: async () => {} }
  function Host() {
    const [, bump] = useState(0)
    return (
      <NeedsYouFillInDeck
        rows={rows}
        loading={false}
        userId="u-1"
        role="assistant"
        startKind="contract"
        onRowSaved={(r) => {
          rows = rows.filter((x) => x.key !== r.key)
          bump((n) => n + 1)
        }}
        onRowRestored={() => {}}
        onExit={() => {}}
        io={{ lostBids: none, vehicles: noVehicles, jobAccounts: noJobAccounts, contracts: io }}
      />
    )
  }
  return { render: () => renderWithProviders(<Host />), resends, papers }
}

const trail = () => document.querySelector('[data-fill-in-trail]')?.textContent ?? ''

beforeAll(installDomShims)
afterEach(() => {
  cleanup()
  navigate.mockClear()
})

describe('NeedsYouFillInDeck · contracts', () => {
  it('draws the row with what it knows, deadens the text door with no mobile, and resends with the line', async () => {
    const h = harness()
    h.render()
    await settle()
    expect(screen.getByText('#1038 Dana Whitfield · sent Sep 24 · $7,450 · 29 days unsigned')).toBeTruthy()
    expect(screen.getByText('Opened 2 times, never signed.')).toBeTruthy()
    expect((screen.getByRole('radio', { name: /Text the link/ }) as HTMLButtonElement).disabled).toBe(true)
    const primary = () => screen.getByRole('button', { name: /and next$/ }) as HTMLButtonElement
    expect(primary().textContent).toBe('Save and next')
    expect(primary().disabled).toBe(true)
    fireEvent.click(screen.getByRole('radio', { name: /Resend the email/ }))
    expect(primary().textContent).toBe('Send and next')
    expect(primary().disabled).toBe(false)
    fireEvent.change(screen.getByLabelText('A line to add'), { target: { value: 'When you have a minute' } })
    fireEvent.click(primary())
    await waitFor(() => expect(h.resends.length).toBe(1))
    await settle()
    expect(h.resends[0]).toEqual({ choice: 'resend', contractId: 'c-1', recipientEmail: 'dana@example.com', recipientName: 'Dana Whitfield', message: 'When you have a minute' })
    expect(trail()).toContain('the signing link went to dana@example.com again · still unsigned, so it stays on the Dashboard')
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull()
  })

  it('paper takes the signer and the day, and files it', async () => {
    const h = harness()
    h.render()
    await settle()
    fireEvent.click(screen.getByRole('radio', { name: /Signed on paper/ }))
    const primary = () => screen.getByRole('button', { name: 'Save and next' }) as HTMLButtonElement
    expect((screen.getByLabelText('Who signed') as HTMLInputElement).value).toBe('Dana Whitfield')
    expect(primary().disabled).toBe(false)
    fireEvent.change(screen.getByLabelText('Who signed'), { target: { value: '' } })
    expect(primary().disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Who signed'), { target: { value: 'Dana Whitfield' } })
    fireEvent.change(screen.getByLabelText('Signed on'), { target: { value: '2026-10-09' } })
    fireEvent.click(primary())
    await waitFor(() => expect(h.papers.length).toBe(1))
    expect(h.papers[0]).toMatchObject({ choice: 'paper', contractId: 'c-1', jobId: 'j-1', signerName: 'Dana Whitfield', signedOn: '2026-10-09' })
    await settle()
    expect(trail()).toContain('signed on paper Oct 9 by Dana Whitfield · on file as signed')
  })
})
