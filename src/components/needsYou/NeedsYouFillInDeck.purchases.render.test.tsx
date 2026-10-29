// @vitest-environment jsdom
/**
 * The Fill them in deck's purchases kind (v2.6071, punch list #178, PR 2): the oldest charge
 * first with what the app knows, the day's jobs as chips from the io, one chip takes the whole
 * charge and Save writes the Sort screen's rows, two chips split it with the amounts editable,
 * a search finds any other job, the trail says where it went, Undo clears the splits, and the
 * door opens the tally.
 */
import { useState } from 'react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { installDomShims, renderWithProviders, settle } from '../../test/renderSmokeMocks'
import { purchaseFillInRows, type PurchaseSource } from '../../lib/needsYou/fillInPurchases'
import type { PurchaseFillInIo, PurchaseSaved } from '../../lib/needsYou/fillInPurchasesIo'
import { NeedsYouFillInDeck } from './NeedsYouFillInDeck'
import type { FillInRow } from '../../hooks/useFillInRows'

const navigate = vi.fn()
vi.mock('react-router-dom', async (orig) => ({ ...(await orig<typeof import('react-router-dom')>()), useNavigate: () => navigate }))
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../lib/navClickTelemetry', () => ({ recordNavClick: vi.fn(), recordNavClickFromEvent: vi.fn() }))

const NOW = Date.parse('2026-10-31T15:00:00Z')

const charge = (p: Partial<PurchaseSource> = {}): PurchaseSource => ({
  mercury_transaction_id: 'tx-1',
  posted_at: '2026-10-28T13:00:00Z',
  amount: -184.2,
  counterparty_name: 'Ferguson Plumbing',
  note: null,
  tally_user_note: 'PRV and fittings for Beck',
  mercury_account_nickname: null,
  raw: { createdAt: '2026-10-27T19:10:00Z', mercuryCategory: 'FuelAndGas' },
  job_splits: [],
  jobs_summary: null,
  invoices_summary: null,
  ...p,
})

const rowsOf = () =>
  purchaseFillInRows({
    rows: [charge(), charge({ mercury_transaction_id: 'tx-2', posted_at: '2026-10-28T20:00:00Z', amount: -40, counterparty_name: 'Home Depot', raw: { createdAt: '2026-10-28T15:00:00Z' }, tally_user_note: null })],
    payrollFlagged: [],
    floorYmd: null,
    nowMs: NOW,
  })

function harness(opts: { dayJobs?: Array<{ id: string; main: string; address: string }> } = {}) {
  const saves: unknown[] = []
  const undos: PurchaseSaved[] = []
  const searches: string[] = []
  const io: PurchaseFillInIo = {
    fetchSources: async () => ({ rows: [], payrollFlagged: [], floorYmd: null }),
    fetchDayJobs: async () => ({ data: opts.dayJobs ?? [{ id: 'j-650', main: 'JP650 · Maple Street remodel', address: '12 Maple St' }, { id: 'j-712', main: 'JP712 · Cedar Loop clinic', address: '' }], error: null }),
    searchJobs: async (q) => {
      searches.push(q)
      return [{ id: 'j-901', main: '901 · Pinecrest warehouse', address: '4 Pine Rd' }]
    },
    save: async (w) => {
      saves.push(w)
      return { txId: w.txId }
    },
    undo: async (s) => {
      undos.push(s)
    },
  }
  let rows: FillInRow[] = rowsOf()
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
        startKind="purchase"
        onRowSaved={(r) => {
          rows = rows.filter((x) => x.key !== r.key)
          bump((n) => n + 1)
        }}
        onRowRestored={(r) => {
          rows = [r, ...rows]
          bump((n) => n + 1)
        }}
        onExit={() => {}}
        io={{ lostBids: none, vehicles: noVehicles, jobAccounts: noAccounts, contracts: { fetchSources: async () => ({ jobs: [], contracts: [], estimates: [], floorCents: 0 }), resend: async () => {}, text: async () => true, filePaper: async () => ({ uploadError: null }) }, purchases: io }}
      />
    )
  }
  return { render: () => renderWithProviders(<Host />), saves, undos, searches }
}

const trail = () => document.querySelector('[data-fill-in-trail]')?.textContent ?? ''
const save = () => screen.getByRole('button', { name: 'Save and next' }) as HTMLButtonElement
const chip = (id: string) => document.querySelector(`[data-purchase-chip="${id}"]`) as HTMLButtonElement

beforeAll(installDomShims)
afterEach(() => {
  cleanup()
  navigate.mockClear()
})

describe('NeedsYouFillInDeck · purchases', () => {
  it('opens on the oldest charge with what the app knows and the day’s jobs as chips; one chip takes the whole charge', async () => {
    const h = harness()
    h.render()
    await settle()
    expect(screen.getByText('$184.20 at Ferguson Plumbing · Oct 27')).toBeTruthy()
    expect(screen.getByText('1 of 2 purchases')).toBeTruthy()
    expect(screen.getByText('Bought Tuesday, Oct 27.')).toBeTruthy()
    expect(screen.getByText('Your memo: “PRV and fittings for Beck”.')).toBeTruthy()
    await waitFor(() => expect(chip('j-650')).toBeTruthy())
    expect(save().disabled).toBe(true)
    fireEvent.click(chip('j-650'))
    expect(chip('j-650').getAttribute('aria-pressed')).toBe('true')
    expect(document.querySelector('[data-purchase-split]')).toBeNull()
    expect(save().disabled).toBe(false)
    fireEvent.click(save())
    await waitFor(() => expect(h.saves.length).toBe(1))
    await settle()
    expect(h.saves[0]).toEqual({ txId: 'tx-1', rows: [{ job_id: 'j-650', amount: -184.2 }], labels: ['JP650 · Maple Street remodel'] })
    expect(trail()).toContain('$184.20 at Ferguson Plumbing · Oct 27 · on JP650 · Maple Street remodel · the tally has it')
    expect(screen.getByText('$40.00 at Home Depot · Oct 28')).toBeTruthy()
    expect(screen.getByText('2 of 2 · 1 saved')).toBeTruthy()
    // Undo clears the splits and brings the row back.
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    await waitFor(() => expect(h.undos.length).toBe(1))
    await settle()
    expect(h.undos[0]).toEqual({ txId: 'tx-1' })
    expect(screen.getByText('$184.20 at Ferguson Plumbing · Oct 27')).toBeTruthy()
  })

  it('two chips split the charge evenly, an amount typed balances the other, and Save writes both rows', async () => {
    const h = harness()
    h.render()
    await settle()
    await waitFor(() => expect(chip('j-650')).toBeTruthy())
    fireEvent.click(chip('j-650'))
    fireEvent.click(chip('j-712'))
    expect(document.querySelector('[data-purchase-split]')).toBeTruthy()
    expect((screen.getByLabelText('Amount for JP650 · Maple Street remodel') as HTMLInputElement).value).toBe('92.10')
    fireEvent.change(screen.getByLabelText('Amount for JP650 · Maple Street remodel'), { target: { value: '150' } })
    expect((screen.getByLabelText('Amount for JP712 · Cedar Loop clinic') as HTMLInputElement).value).toBe('34.20')
    expect(save().disabled).toBe(false)
    fireEvent.click(save())
    await waitFor(() => expect(h.saves.length).toBe(1))
    expect(h.saves[0]).toMatchObject({
      txId: 'tx-1',
      rows: [
        { job_id: 'j-650', amount: -150 },
        { job_id: 'j-712', amount: -34.2 },
      ],
    })
    await settle()
    expect(trail()).toContain('split $150.00 to JP650 · Maple Street remodel and $34.20 to JP712 · Cedar Loop clinic · the tally has it')
  })

  it('a search finds any other job and picking it adds a chip; with nothing on the clock the card says to search', async () => {
    const h = harness({ dayJobs: [] })
    h.render()
    await settle()
    await waitFor(() => expect(screen.getByText('Nothing on your clock or schedule those days. Search for the job below.')).toBeTruthy())
    fireEvent.change(screen.getByLabelText('Another job'), { target: { value: 'pine' } })
    await waitFor(() => expect(h.searches).toEqual(['pine']), { timeout: 2000 })
    await waitFor(() => expect(document.querySelector('[data-purchase-result="j-901"]')).toBeTruthy())
    fireEvent.click(document.querySelector('[data-purchase-result="j-901"]')!)
    await settle()
    expect(chip('j-901')).toBeTruthy()
    expect(chip('j-901').getAttribute('aria-pressed')).toBe('true')
    expect(save().disabled).toBe(false)
    fireEvent.click(save())
    await waitFor(() => expect(h.saves.length).toBe(1))
    expect(h.saves[0]).toMatchObject({ rows: [{ job_id: 'j-901', amount: -184.2 }], labels: ['901 · Pinecrest warehouse'] })
  })

  it('the door opens the tally', async () => {
    const h = harness()
    h.render()
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'Open Job Parts Tally ›' }))
    expect(navigate).toHaveBeenCalledWith('/tally?tab=transactions')
  })
})
