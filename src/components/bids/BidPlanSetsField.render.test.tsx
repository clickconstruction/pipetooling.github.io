// @vitest-environment jsdom
/**
 * Edit Bid → Plans → Plan sets (v2.6169): the rows with their words and the robot's chip, Robot reads
 * this set handing the link up, a saved set probed at once, and × → Remove.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
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

vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' }, role: 'estimator' }) }))
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
          return { select: () => ({ single: () => Promise.resolve({ data: { id: saved.id, link: saved.link }, error: null }) }) }
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

describe('BidPlanSetsField', () => {
  it('draws the rows newest first with the robot’s chip on the Plans link’s set, hands a link up, saves a set and reads its link, removes one', async () => {
    const onRobotSetChange = vi.fn()
    renderWithProviders(<BidPlanSetsField bidId="b1" plansLink="https://drive.google.com/drive/folders/issued" onRobotSetChange={onRobotSetChange} />)
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
})
