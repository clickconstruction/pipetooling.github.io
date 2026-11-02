// @vitest-environment jsdom
/**
 * Edit Bid → Plans → Plan sets (v2.6169): the rows with their words and the robot's chip, Robot reads
 * this set handing the link up, a saved set probed at once, and × → Remove.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import type { BidJobPlanState } from '../../lib/bids/bidPricedOn'
import type { BidPricedOnIo } from '../../lib/bids/bidPricedOnIo'
import { BidPlanSetsField } from './BidPlanSetsField'

type Row = Record<string, unknown>
const state: { rows: Row[]; inserted: Row[]; updated: Array<{ id: string; patch: Row }>; deleted: string[]; probed: string[] } = {
  rows: [
    { id: 'r1', bid_id: 'b1', name: 'Issued set', memo: '', plan_date: '2026-09-14', link: 'https://drive.google.com/drive/folders/issued', file_name: '6 PDFs', file_size: 92_274_688, file_count: 6, checked_at: '2026-10-30T15:00:00Z', check_note: null, created_by: null, created_at: '2026-09-14T12:00:00Z', updated_at: '2026-09-14T12:00:00Z' },
    { id: 'r2', bid_id: 'b1', name: 'Addendum 1', memo: 'two more floor drains', plan_date: '2026-10-02', link: 'https://drive.google.com/drive/folders/add1', file_name: null, file_size: null, file_count: null, checked_at: null, check_note: null, created_by: null, created_at: '2026-10-02T12:00:00Z', updated_at: '2026-10-02T12:00:00Z' },
  ],
  inserted: [],
  updated: [],
  deleted: [],
  probed: [],
}
/** The two rows as the file starts, so a test after the first (which saves and removes) starts from them again. */
const START_ROWS = state.rows.map((r) => ({ ...r }))

vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' }, role: 'estimator' }) }))
const openedJobs: Array<{ id: string; tab: string | undefined }> = []
vi.mock('../../contexts/JobFormModalContext', () => ({ useJobFormModal: () => ({ openEditJob: (id: string, o?: { initialTab?: string }) => openedJobs.push({ id, tab: o?.initialTab }) }) }))

function jobState(over: Partial<BidJobPlanState> & { job_id: string }): BidJobPlanState {
  return { bid_id: 'b1', hcp_number: null, click_number: '972', job_name: 'Harlow Ranch gas test', part_id: 'p1', part_name: 'The Lodge', set_id: 's1', set_name: 'Issued set', set_kind: 'issued', set_dated: '2026-09-14', set_link: 'https://drive.google.com/drive/folders/issued', set_came_at: '2026-10-20T15:00:00Z', ...over }
}
function fakePricedOnIo(states: BidJobPlanState[] = []): BidPricedOnIo & { pinned: Array<string | null> } {
  const pinned: Array<string | null> = []
  return { pinned, loadJobsPlanState: vi.fn(async () => states), setPricedOn: vi.fn(async (_bidId: string, setId: string | null) => void pinned.push(setId)) }
}
vi.mock('../../lib/openInExternalBrowser', () => ({ openInExternalBrowser: () => {} }))
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      if (table !== 'bid_plan_sets') throw new Error(`unexpected table ${table}`)
      return {
        select: () => ({ eq: () => Promise.resolve({ data: state.rows, error: null }) }),
        insert: (row: Row) => {
          const saved = { ...row, id: `new-${state.inserted.length + 1}` }
          state.inserted.push(saved)
          state.rows = [...state.rows, { file_name: null, file_size: null, file_count: null, checked_at: null, check_note: null, created_at: '2026-10-30T16:00:00Z', updated_at: '2026-10-30T16:00:00Z', ...saved }]
          return { select: () => ({ single: () => Promise.resolve({ data: { id: saved.id, link: String(row.link) }, error: null }) }) }
        },
        update: (patch: Row) => ({
          eq: (_col: string, id: string) => {
            state.updated.push({ id, patch })
            state.rows = state.rows.map((r) => (r.id === id ? { ...r, ...patch } : r))
            return Promise.resolve({ error: null })
          },
        }),
        delete: () => ({
          eq: (_col: string, id: string) => {
            state.deleted.push(id)
            state.rows = state.rows.filter((r) => r.id !== id)
            return Promise.resolve({ error: null })
          },
        }),
      }
    },
    functions: {
      invoke: (_name: string, opts: { body: { probe_url: string } }) => {
        state.probed.push(opts.body.probe_url)
        return Promise.resolve({ data: { readable: true, note: 'folder · 3 PDFs', name: '3 PDFs', size: 44_040_192, count: 3 }, error: null })
      },
    },
  },
}))

afterEach(() => cleanup())

describe('BidPlanSetsField', () => {
  it('draws the rows newest first with the robot’s chip on the Plans link’s set, hands a link up, saves a set and reads its link, removes one', async () => {
    const onRobotSetChange = vi.fn()
    renderWithProviders(<BidPlanSetsField bidId="b1" plansLink="https://drive.google.com/drive/folders/issued" onRobotSetChange={onRobotSetChange} pricedOnIo={fakePricedOnIo()} />)
    const rows = await screen.findAllByTestId('bid-plan-set-row')
    expect(rows).toHaveLength(2)
    expect(rows[0]!.textContent).toContain('Addendum 1')
    expect(rows[0]!.textContent).toContain('Not read yet')
    expect(rows[1]!.textContent).toContain('6 PDFs · 88 MB')
    expect(rows[1]!.querySelector('[data-testid="bid-plan-set-robot"]')).toBeTruthy()
    expect(rows[0]!.querySelector('[data-testid="bid-plan-set-robot"]')).toBeNull()

    // Robot reads this set: only the set without the chip offers it, and it hands the link up.
    fireEvent.click(screen.getByRole('button', { name: 'Robot reads this set' }))
    expect(onRobotSetChange).toHaveBeenCalledWith('https://drive.google.com/drive/folders/add1')

    // A new set: the name first, then the link, then the probe fills the file words.
    fireEvent.click(screen.getByRole('button', { name: '+ Add a set of plans' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save the set' }))
    expect(screen.getByRole('status').textContent).toBe('Give the set a name.')
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Permit set' } })
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-10-20' } })
    fireEvent.change(screen.getByLabelText('Memo'), { target: { value: 'Stamped by the city' } })
    fireEvent.change(screen.getByLabelText('Link · a Google Drive folder or file'), { target: { value: 'https://drive.google.com/drive/folders/permit' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save the set' }))
    await waitFor(() => expect(screen.getAllByTestId('bid-plan-set-row')).toHaveLength(3))
    expect(state.inserted[0]).toMatchObject({ bid_id: 'b1', name: 'Permit set', memo: 'Stamped by the city', plan_date: '2026-10-20', link: 'https://drive.google.com/drive/folders/permit', created_by: 'u1' })
    expect(state.probed).toEqual(['https://drive.google.com/drive/folders/permit'])
    expect(state.updated[0]).toMatchObject({ id: 'new-1', patch: { file_name: '3 PDFs', file_size: 44_040_192, file_count: 3, check_note: null } })
    await waitFor(() => expect(screen.getAllByTestId('bid-plan-set-row')[0]!.textContent).toContain('3 PDFs · 42 MB'))

    // × asks once; Remove deletes the row.
    fireEvent.click(screen.getByRole('button', { name: 'Remove Addendum 1' }))
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
    await waitFor(() => expect(state.deleted).toEqual(['r2']))
    await waitFor(() => expect(screen.getAllByTestId('bid-plan-set-row')).toHaveLength(2))
  })

  it('priced on: with no pin the robot’s set wears the chip and the line says so; Priced on this set pins a row through the io and moves the chip', async () => {
    state.rows = START_ROWS.map((r) => ({ ...r }))
    const io = fakePricedOnIo()
    renderWithProviders(<BidPlanSetsField bidId="b1" plansLink="https://drive.google.com/drive/folders/issued" onRobotSetChange={() => {}} pricedOnIo={io} />)
    const rows = await screen.findAllByTestId('bid-plan-set-row')
    expect(rows[1]!.querySelector('[data-testid="bid-plan-set-priced"]')).toBeTruthy()
    expect(rows[0]!.querySelector('[data-testid="bid-plan-set-priced"]')).toBeNull()
    expect(screen.getByTestId('bid-plan-sets-priced-on').textContent).toBe('Priced on Issued set, the set the robot reads, since none is pinned.')
    expect(screen.queryByTestId('bid-plan-sets-moved-on')).toBeNull()
    // Only the row without the chip offers the press.
    const presses = screen.getAllByRole('button', { name: 'Priced on this set' })
    expect(presses).toHaveLength(1)
    fireEvent.click(presses[0]!)
    await waitFor(() => expect(io.pinned).toEqual(['r2']))
    await waitFor(() => expect(screen.getAllByTestId('bid-plan-set-row')[0]!.querySelector('[data-testid="bid-plan-set-priced"]')).toBeTruthy())
    expect(screen.getByTestId('bid-plan-sets-priced-on').textContent).toBe('Priced on Addendum 1 · Oct 2, 2026.')
  })

  it('a pin read from the bid holds, and a job whose part moved on draws the amber note with its doors', async () => {
    const io = fakePricedOnIo([
      jobState({ job_id: 'j1', set_id: 's2', set_name: 'Addendum 2', set_dated: '2026-10-14', set_link: 'https://drive.google.com/drive/folders/add2' }),
      jobState({ job_id: 'j2', click_number: '980', part_id: 'p2', part_name: 'The Bunker' }),
    ])
    state.rows = START_ROWS.map((r) => ({ ...r }))
    renderWithProviders(<BidPlanSetsField bidId="b1" plansLink="https://drive.google.com/drive/folders/add1" onRobotSetChange={() => {}} pricedOnSetId="r1" pricedOnIo={io} />)
    const rows = await screen.findAllByTestId('bid-plan-set-row')
    // The robot reads Addendum 1; the price stands on Issued set: two chips on two rows.
    expect(rows[0]!.querySelector('[data-testid="bid-plan-set-robot"]')).toBeTruthy()
    expect(rows[1]!.querySelector('[data-testid="bid-plan-set-priced"]')).toBeTruthy()
    const notes = await screen.findAllByTestId('bid-plan-sets-moved-on')
    expect(notes).toHaveLength(1)
    expect(notes[0]!.textContent).toContain('On The Lodge, JP972 now builds from Addendum 2, dated Oct 14, 2026. This bid was priced on Issued set.')
    fireEvent.click(screen.getByRole('button', { name: 'Open JP972 ›' }))
    expect(openedJobs).toEqual([{ id: 'j1', tab: 'documents' }])
  })
})
