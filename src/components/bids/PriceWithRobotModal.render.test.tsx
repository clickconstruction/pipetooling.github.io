// @vitest-environment jsdom
/**
 * Render smokes for PriceWithRobotModal (Price Matrix PR 2) — the "Price it
 * with the robot" sheet in both faces: the queue form (readable links ticked,
 * waiting houses listed as skipped, Queue it writes one request row) and the
 * status face (Take it back only while queued).
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'

import { renderWithProviders } from '../../test/renderSmokeMocks'
import { PriceWithRobotModal } from './PriceWithRobotModal'
import type { PriceMatrixRequestRow } from '../../lib/rfq/priceMatrixRequest'

const state: { inserted: Record<string, unknown>[]; updated: Array<{ patch: Record<string, unknown>; id: string }> } = { inserted: [], updated: [] }

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'wendi', email: 'wendi@x.test' }, profileName: 'Wendi', role: 'estimator' }),
}))

vi.mock('../../hooks/useUserDisplayNames', () => ({
  useUserDisplayNames: () => ({ wendi: 'Wendi' }),
}))

vi.mock('../../lib/supplyHousePickerRows', () => ({
  fetchSupplyHousePickerRows: () => Promise.resolve([{ id: 'h-nws', name: 'National Wholesale Supply' }, { id: 'h-ferg', name: 'Ferguson' }]),
}))

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      if (table === 'bid_rfqs') {
        return {
          select: () => ({
            eq: () => ({
              order: () =>
                Promise.resolve({
                  data: [
                    { id: 'a', status: 'quoted', sent_via: 'outside', supply_house_id: 'h-nws', sent_to: null, created_at: '2026-09-09T10:00:00Z', requested_on: '2026-09-09', quote_url: 'https://drive.google.com/file/d/abc' },
                    { id: 'b', status: 'sent', sent_via: 'outside', supply_house_id: 'h-ferg', sent_to: null, created_at: '2026-09-03T10:00:00Z', requested_on: '2026-09-03', quote_url: null },
                  ],
                  error: null,
                }),
            }),
          }),
        }
      }
      if (table === 'bid_price_matrix_requests') {
        return {
          insert: (row: Record<string, unknown>) => {
            state.inserted.push(row)
            return Promise.resolve({ data: null, error: null })
          },
          update: (patch: Record<string, unknown>) => ({
            eq: (_col: string, id: string) => ({
              eq: () => {
                state.updated.push({ patch, id })
                return Promise.resolve({ data: null, error: null })
              },
            }),
          }),
        }
      }
      return { select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) }
    },
  },
}))

const rows = [
  { id: 'r1', fixture: 'WC1&2', count: 11, unit: null },
  { id: 'r2', fixture: 'LAV-2', count: 6, unit: null },
  { id: 'r3', fixture: 'LABOR', count: 0, unit: null },
]

describe('PriceWithRobotModal', () => {
  it('queue face: lists the readable link ticked and the waiting house as skipped, then writes one request', async () => {
    state.inserted = []
    const onChanged = vi.fn()
    renderWithProviders(
      <PriceWithRobotModal
        open
        onClose={() => {}}
        bidId="b359"
        bidVersionId={null}
        bidLabel="BP359"
        rows={rows}
        activeRequest={null}
        supported
        onChanged={onChanged}
        onOpenCompare={() => {}}
      />,
    )
    expect(await screen.findByText('National Wholesale Supply')).toBeTruthy()
    expect(screen.getByText('Ferguson')).toBeTruthy()
    expect(screen.getByText(/no link yet — the robot skips it/)).toBeTruthy()
    expect(screen.getByText(/2 fixture rows/)).toBeTruthy()
    const queue = screen.getByRole('button', { name: 'Queue it for the robot' })
    await waitFor(() => expect((queue as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(queue)
    await waitFor(() => expect(state.inserted).toHaveLength(1))
    const row = state.inserted[0]!
    expect(row.bid_id).toBe('b359')
    expect(row.requested_by).toBe('wendi')
    expect(row.status).toBe('queued')
    expect((row.scope as unknown[]).length).toBe(2)
    expect((row.sources as Array<{ house_name: string }>).map((s) => s.house_name)).toEqual(['National Wholesale Supply'])
    expect(onChanged).toHaveBeenCalled()
  })

  it('queue face with the table not yet in the schema: the notice shows and Queue it stays disabled', async () => {
    renderWithProviders(
      <PriceWithRobotModal open onClose={() => {}} bidId="b359" bidVersionId={null} bidLabel="BP359" rows={rows} activeRequest={null} supported={false} onChanged={() => {}} onOpenCompare={() => {}} />,
    )
    expect(await screen.findByText(/not switched on yet/)).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Queue it for the robot' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('status face: a queued request offers Take it back and writes cancelled; a ready one offers the matrix instead', async () => {
    state.updated = []
    const base: PriceMatrixRequestRow = {
      id: 'req-1',
      bid_id: 'b359',
      status: 'queued',
      requested_at: new Date().toISOString(),
      requested_by: 'wendi',
      scope: [{ count_row_id: 'r1', fixture: 'WC1&2', count: 11, unit: null }],
      sources: [{ rfq_id: 'a', supply_house_id: 'h-nws', house_name: 'National Wholesale Supply', url: 'https://drive.google.com/file/d/abc', requested_on: '2026-09-09' }],
      claimed_by: null,
      claimed_at: null,
      heartbeat_at: null,
      finished_at: null,
      reviewed_at: null,
      summary: null,
      result: null,
    }
    const onChanged = vi.fn()
    const r1 = renderWithProviders(
      <PriceWithRobotModal open onClose={() => {}} bidId="b359" bidVersionId={null} bidLabel="BP359" rows={rows} activeRequest={base} supported onChanged={onChanged} onOpenCompare={() => {}} />,
    )
    expect(await screen.findByText(/Queued just now by Wendi/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Take it back' }))
    await waitFor(() => expect(state.updated).toHaveLength(1))
    expect(state.updated[0]!.patch.status).toBe('cancelled')
    expect(state.updated[0]!.id).toBe('req-1')
    r1.unmount()

    const onOpenCompare = vi.fn()
    renderWithProviders(
      <PriceWithRobotModal
        open
        onClose={() => {}}
        bidId="b359"
        bidVersionId={null}
        bidLabel="BP359"
        rows={rows}
        activeRequest={{ ...base, status: 'ready', result: { rows_priced: 23, rows_asked: 4 } }}
        supported
        onChanged={() => {}}
        onOpenCompare={onOpenCompare}
      />,
    )
    expect(await screen.findByText(/23 picks, 4 to settle/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Take it back' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Review the matrix' }))
    expect(onOpenCompare).toHaveBeenCalled()
  })
})
