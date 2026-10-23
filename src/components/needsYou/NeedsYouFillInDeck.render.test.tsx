// @vitest-environment jsdom
/**
 * The Fill them in deck (v2.5774, punch list #145): one lost bid at a time, Save and next writes
 * the lens's patch and the contact-log entry through the io it is given, the saved row lands in
 * the trail with Undo and leaves the list, Undo puts it back, Skip sends a row to the back, the
 * end counts what was saved, and a note suggests a reason chip until one is tapped.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { installDomShims, renderWithProviders, settle } from '../../test/renderSmokeMocks'
import { lostBidFillInRows, type LostBidSource } from '../../lib/needsYou/fillInLostBids'
import type { LostBidFillInIo } from '../../lib/needsYou/fillInLostBidsIo'
import { NeedsYouFillInDeck } from './NeedsYouFillInDeck'
import type { FillInRow } from '../../hooks/useFillInRows'

const navigate = vi.fn()
vi.mock('react-router-dom', async (orig) => ({ ...(await orig<typeof import('react-router-dom')>()), useNavigate: () => navigate }))
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../lib/navClickTelemetry', () => ({ recordNavClick: vi.fn(), recordNavClickFromEvent: vi.fn() }))

const bid = (id: string, value: number, project: string): LostBidSource => ({
  id,
  bid_number: id.replace('bid-', ''),
  project_name: project,
  customer_id: 'gc-1',
  bid_value: value,
  outcome: 'lost',
  outcome_at: '2026-09-30T15:00:00Z',
  bid_date_sent: '2026-08-14T15:00:00Z',
  last_contact: null,
  loss_category: null,
  loss_reason: null,
  adopted_into_bid_id: null,
  customers: { name: 'Ridgeway Builders' },
  bids_gc_builders: null,
})

function harness() {
  const saves: unknown[] = []
  const undos: unknown[] = []
  const io: LostBidFillInIo = {
    fetchSources: async () => [],
    save: async (w) => {
      saves.push(w)
      return { entryId: w.entry ? 'entry-1' : null }
    },
    undo: async (a) => {
      undos.push(a)
    },
  }
  let rows: FillInRow[] = lostBidFillInRows([bid('bid-412', 84_300, 'Oak Street clinic'), bid('bid-398', 41_000, 'Pinecrest warehouse'), bid('bid-407', 22_750, 'Riverbend duplex')])
  const saved: string[] = []
  const restored: string[] = []
  const onExit = vi.fn()
  const onMark = vi.fn()
  const render = () =>
    renderWithProviders(
      <Harness
        get={() => rows}
        io={io}
        onRowSaved={(r) => {
          saved.push(r.key)
          rows = rows.filter((x) => x.key !== r.key)
        }}
        onRowRestored={(r) => {
          restored.push(r.key)
          rows = [r, ...rows]
        }}
        onExit={onExit}
        onMark={onMark}
      />,
    )
  return { render, saves, undos, saved, restored, onExit, onMark }
}

import { useState } from 'react'
function Harness({ get, io, onRowSaved, onRowRestored, onExit, onMark }: { get: () => FillInRow[]; io: LostBidFillInIo; onRowSaved: (r: FillInRow) => void; onRowRestored: (r: FillInRow) => void; onExit: () => void; onMark: () => void }) {
  const [, bump] = useState(0)
  return (
    <NeedsYouFillInDeck
      rows={get()}
      loading={false}
      userId="u-1"
      role="assistant"
      startKind="lost-bid"
      onRowSaved={(r) => {
        onRowSaved(r)
        bump((n) => n + 1)
      }}
      onRowRestored={(r) => {
        onRowRestored(r)
        bump((n) => n + 1)
      }}
      onExit={onExit}
      onMarkUpToDate={onMark}
      io={{ lostBids: io, vehicles: { fetchGaps: async () => [], fetchPlans: async () => [], save: async () => { throw new Error('not here') }, undo: async () => {} }, jobAccounts: { fetchGaps: async () => [], fetchJobs: async () => [], save: async () => { throw new Error('not here') }, undo: async () => {} } }}
    />
  )
}

const trail = () => document.querySelector('[data-fill-in-trail]')?.textContent ?? ''
const cardTitle = () => document.querySelector('[data-fill-in-row] [data-fill-in-title]')?.textContent ?? ''

beforeAll(installDomShims)
afterEach(() => {
  cleanup()
  navigate.mockClear()
})

describe('NeedsYouFillInDeck · lost bids', () => {
  it('opens on the biggest lost bid, with what the app knows, and Save waits for a reason', async () => {
    const h = harness()
    h.render()
    await settle()
    expect(screen.getByText('b412 Oak Street clinic · Ridgeway Builders · $84,300')).toBeTruthy()
    expect(screen.getByText('1 of 3 lost bids')).toBeTruthy()
    expect(screen.getByText('1 of 3')).toBeTruthy()
    expect(screen.getByText('Marked lost on Sep 30.')).toBeTruthy()
    expect(screen.getByText('No contact recorded since it went out.')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Save and next' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText(/Next: b398 Pinecrest warehouse/)).toBeTruthy()
  })

  it('a note suggests a chip; a tap wins over the note', async () => {
    const h = harness()
    h.render()
    await settle()
    fireEvent.change(screen.getByPlaceholderText('A line or two'), { target: { value: 'they went with another plumber' } })
    await settle()
    expect(screen.getByRole('radio', { name: /Went with another sub/ }).getAttribute('aria-checked')).toBe('true')
    expect(screen.getByText('from the note')).toBeTruthy()
    fireEvent.click(screen.getByRole('radio', { name: 'Price too high' }))
    expect(screen.getByRole('radio', { name: 'Price too high' }).getAttribute('aria-checked')).toBe('true')
    expect(screen.queryByText('from the note')).toBeNull()
  })

  it('Save and next writes the reason and the contact log, lands the row in the trail with Undo, and moves on', async () => {
    const h = harness()
    h.render()
    await settle()
    fireEvent.click(screen.getByRole('radio', { name: 'Price too high' }))
    fireEvent.change(screen.getByPlaceholderText('A line or two'), { target: { value: 'about 8 percent under us' } })
    fireEvent.change(screen.getByPlaceholderText('A name, if you called'), { target: { value: 'Dale Brennan' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save and next' }))
    await waitFor(() => expect(h.saves.length).toBe(1))
    await settle()
    expect(h.saves[0]).toMatchObject({ bidId: 'bid-412', patch: { loss_category: 'price', loss_reason: 'about 8 percent under us' } })
    expect((h.saves[0] as { entry: { notes: string } }).entry.notes).toBe('Reason recorded on Quickfill — Price too high: about 8 percent under us. Talked to Dale Brennan.')
    expect(h.saved).toEqual(['lost-bid:bid-412'])
    expect(trail()).toContain('b412 Oak Street clinic · Ridgeway Builders · $84,300 · Price too high · the Why we lost lens and the contact log have it')
    expect(screen.getByText('b398 Pinecrest warehouse · Ridgeway Builders · $41,000')).toBeTruthy()
    expect(screen.getByText('2 of 3 · 1 saved')).toBeTruthy()
    // Undo puts the bid back as it was and brings the row back.
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    await waitFor(() => expect(h.undos.length).toBe(1))
    await settle()
    expect(h.undos[0]).toEqual({ bidId: 'bid-412', previous: { loss_category: null, loss_reason: null }, entryId: 'entry-1' })
    expect(h.restored).toEqual(['lost-bid:bid-412'])
    expect(cardTitle()).toBe('b412 Oak Street clinic · Ridgeway Builders · $84,300')
    expect(trail()).not.toContain('the contact log have it')
  })

  it('Skip sends the row to the back and the trail brings it back', async () => {
    const h = harness()
    h.render()
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }))
    await settle()
    expect(cardTitle()).toBe('b398 Pinecrest warehouse · Ridgeway Builders · $41,000')
    expect(trail()).toContain('skipped · still on the list')
    fireEvent.click(screen.getByRole('button', { name: 'Back to it' }))
    await settle()
    expect(cardTitle()).toBe('b412 Oak Street clinic · Ridgeway Builders · $84,300')
  })

  it('the end counts what was saved and offers the Mark', async () => {
    const h = harness()
    h.render()
    await settle()
    for (let i = 0; i < 3; i++) {
      fireEvent.click(screen.getByRole('radio', { name: 'No answer' }))
      fireEvent.click(screen.getByRole('button', { name: 'Save and next' }))
      await waitFor(() => expect(h.saves.length).toBe(i + 1))
      await settle()
    }
    expect(screen.getByText('That is every row. 3 saved.')).toBeTruthy()
    expect(screen.getByText('3 lost bids have a reason.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Mark Needs you up to date' }))
    expect(h.onMark).toHaveBeenCalledTimes(1)
    expect(h.onExit).toHaveBeenCalledTimes(1)
  })

  it('the door opens the bid', async () => {
    const h = harness()
    h.render()
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'Open the bid ›' }))
    expect(navigate).toHaveBeenCalledWith('/bids?tab=bid-board&bidId=bid-412')
  })
})
