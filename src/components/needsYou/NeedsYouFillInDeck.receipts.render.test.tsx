// @vitest-environment jsdom
/**
 * The Fill them in deck's receipt kind (punch list #299, the step after PR 2): the newest charge first with what the
 * app knows, Got it saves and moves on with no Save, Undo takes the mark back and brings the row back, Copy the receipt
 * link makes the link and stays on the row, a refused press stays on the row with its reason, and each row's door goes
 * where its press lives. Made-up rows.
 */
import { useState } from 'react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { installDomShims, renderWithProviders, settle } from '../../test/renderSmokeMocks'
import { receiptFillInRows, type ReceiptChaseSource } from '../../lib/needsYou/fillInReceipts'
import type { ReceiptFillInIo } from '../../lib/needsYou/fillInReceiptsIo'
import { NeedsYouFillInDeck } from './NeedsYouFillInDeck'
import type { FillInRow } from '../../hooks/useFillInRows'

const navigate = vi.fn()
vi.mock('react-router-dom', async (orig) => ({ ...(await orig<typeof import('react-router-dom')>()), useNavigate: () => navigate }))
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../lib/navClickTelemetry', () => ({ recordNavClick: vi.fn(), recordNavClickFromEvent: vi.fn() }))

const source = (id: string, why: string, over: Partial<ReceiptChaseSource> = {}): ReceiptChaseSource => ({
  request_id: id,
  mercury_transaction_id: `charge-${id}`,
  why,
  holder_user_id: 'u-jordan',
  holder_name: 'Jordan Vance',
  store: 'Ridgeway Supply',
  amount: 228.58,
  posted_at: '2026-11-03T23:00:00.000Z',
  texted_at: null,
  reminded_at: null,
  closes_at: '2026-11-18T00:14:00.000Z',
  ...over,
})

const sources = (): ReceiptChaseSource[] => [
  source('r-cell', 'no_cell', { posted_at: '2026-11-04T23:00:00.000Z' }),
  source('r-card', 'no_person', { holder_user_id: null, holder_name: '', store: 'Cedar Bend Hardware', amount: 84.21, posted_at: '2026-11-03T23:00:00.000Z' }),
  source('r-twice', 'no_answer', { holder_name: 'Sam Okoro', store: 'Corner Fuel', amount: 41.17, posted_at: '2026-11-02T23:00:00.000Z', texted_at: '2026-11-03T00:14:00.000Z', reminded_at: '2026-11-04T00:00:00.000Z' }),
]

function harness(saveError?: Error) {
  const saves: string[] = []
  const undos: string[] = []
  const io: ReceiptFillInIo = {
    fetchSources: async () => sources(),
    save: async (requestId) => {
      if (saveError) throw saveError
      saves.push(requestId)
    },
    undo: async (requestId) => {
      undos.push(requestId)
    },
  }
  const copyLink = vi.fn(async (_chargeId: string) => ({ url: 'https://clicktooling.com/r/k7m2p9xq4d', closesOn: '2026-11-18' as string | null, copied: true }))
  let rows: FillInRow[] = receiptFillInRows(sources())
  const none = { fetchSources: async () => [], save: async () => ({ entryId: null }), undo: async () => {} }
  const noVehicles = { fetchGaps: async () => [], fetchPlans: async () => [], save: async () => { throw new Error('not here') }, undo: async () => {} }
  const noAccounts = { fetchGaps: async () => [], fetchJobs: async () => [], save: async () => { throw new Error('not here') }, undo: async () => {} }
  const noContracts = { fetchSources: async () => ({ jobs: [], contracts: [], estimates: [], floorCents: 0 }), resend: async () => {}, text: async () => false, filePaper: async () => ({ uploadError: null }) }
  function Host() {
    const [, bump] = useState(0)
    return (
      <NeedsYouFillInDeck
        rows={rows}
        loading={false}
        userId="u-1"
        role="assistant"
        startKind="receipt"
        onRowSaved={(r) => {
          rows = rows.filter((x) => x.key !== r.key)
          bump((n) => n + 1)
        }}
        onRowRestored={(r) => {
          rows = [r, ...rows]
          bump((n) => n + 1)
        }}
        onExit={() => {}}
        io={{ lostBids: none, vehicles: noVehicles, jobAccounts: noAccounts, contracts: noContracts, receipts: io }}
        copyReceiptLinkOf={copyLink}
      />
    )
  }
  return { render: () => renderWithProviders(<Host />), saves, undos, copyLink }
}

const trail = () => document.querySelector('[data-fill-in-trail]')?.textContent ?? ''
const cardTitle = () => document.querySelector('[data-fill-in-row] [data-fill-in-title]')?.textContent ?? ''
const press = (name: string) => screen.getByRole('button', { name }) as HTMLButtonElement

beforeAll(installDomShims)
afterEach(() => {
  cleanup()
  navigate.mockClear()
})

describe('NeedsYouFillInDeck · receipts', () => {
  it('opens on the newest charge with what the app knows, and has no Save', async () => {
    harness().render()
    await settle()
    expect(cardTitle()).toBe('Jordan has no cell on file, and $228.58 at Ridgeway Supply posted to their card.')
    expect(screen.getByText('1 of 3 charges')).toBeTruthy()
    expect(screen.getByText('Add the cell on People, and the next charge texts them.')).toBeTruthy()
    expect(press('Got it').style.background).toBe('rgb(37, 99, 235)')
    expect(press('Copy the receipt link')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Save and next' })).toBeNull()
  })

  it('Got it marks the request done and moves on; Undo takes the mark back and brings the row back', async () => {
    const h = harness()
    h.render()
    await settle()
    fireEvent.click(press('Got it'))
    await waitFor(() => expect(h.saves).toEqual(['r-cell']))
    await settle()
    expect(trail()).toContain('Got it: $228.58 at Ridgeway Supply.')
    expect(cardTitle()).toBe('$84.21 at Cedar Bend Hardware posted to a card tied to no one.')
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    await waitFor(() => expect(h.undos).toEqual(['r-cell']))
    await settle()
    expect(cardTitle()).toBe('Jordan has no cell on file, and $228.58 at Ridgeway Supply posted to their card.')
  })

  it('Copy the receipt link makes the charge’s link, says so, and stays on the row', async () => {
    const h = harness()
    h.render()
    await settle()
    fireEvent.click(press('Copy the receipt link'))
    await waitFor(() => expect(h.copyLink).toHaveBeenCalledWith('charge-r-cell'))
    expect(await screen.findByText('Receipt link copied for $228.58 at Ridgeway Supply. It opens until Nov 18.')).toBeTruthy()
    expect(cardTitle()).toBe('Jordan has no cell on file, and $228.58 at Ridgeway Supply posted to their card.')
    expect(h.saves).toEqual([])
  })

  it('a link that could not be made says why, and the row stays', async () => {
    const h = harness()
    h.copyLink.mockRejectedValueOnce(new Error('Only the office can copy a receipt link.'))
    h.render()
    await settle()
    fireEvent.click(press('Copy the receipt link'))
    expect(await screen.findByText(/Only the office can copy a receipt link/)).toBeTruthy()
    expect(press('Got it').disabled).toBe(false)
  })

  it('a refused Got it stays on the row and says why', async () => {
    const h = harness(new Error('Only the office marks a receipt request done.'))
    h.render()
    await settle()
    fireEvent.click(press('Got it'))
    expect(await screen.findByText(/Only the office marks a receipt request done/)).toBeTruthy()
    expect(cardTitle()).toBe('Jordan has no cell on file, and $228.58 at Ridgeway Supply posted to their card.')
    expect(press('Got it').disabled).toBe(false)
  })

  it('Skip sends the row to the back and saves nothing', async () => {
    const h = harness()
    h.render()
    await settle()
    fireEvent.click(press('Skip'))
    await settle()
    expect(cardTitle()).toBe('$84.21 at Cedar Bend Hardware posted to a card tied to no one.')
    expect(h.saves).toEqual([])
    expect(trail()).toContain('skipped')
  })

  it('each row’s door goes where its press lives', async () => {
    harness().render()
    await settle()
    fireEvent.click(screen.getByRole('button', { name: "Add Jordan's cell ›" }))
    expect(navigate).toHaveBeenCalledWith('/people?tab=users')
    fireEvent.click(press('Skip'))
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'Tie the card ›' }))
    expect(navigate).toHaveBeenCalledWith('/banking?tab=sorting&cards=1')
    fireEvent.click(press('Skip'))
    await settle()
    expect(cardTitle()).toBe('Sam was texted twice about $41.17 at Corner Fuel and sent no receipt.')
    expect(screen.getByText('Texted Mon 6:14 PM, reminded Tue 6:00 PM.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Open the Team queue ›' }))
    expect(navigate).toHaveBeenCalledWith('/tally?tab=transactions')
  })
})
