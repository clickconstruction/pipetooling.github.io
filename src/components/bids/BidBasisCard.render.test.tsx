// @vitest-environment jsdom
/**
 * Render smokes for the Bid basis card (v2.3219): nothing without a link or an
 * export; the "Plans as issued" state opens CountTooling and the waiting dialog
 * with the expected file name; a manifest posted on `window` from CountTooling
 * stamps the bid (wrong ref ignored); the by-hand stamp; the loaded notice with
 * a newer last-saved time turns the card amber; Remove goes through the confirm
 * dialog and clears the stamp; the Followup history list.
 */
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { BidBasisCard, BidBasisExportsList } from './BidBasisCard'
import { useBidBasisExports } from '../../hooks/useBidBasisExports'
import { renderWithProviders, SMOKE_AUTH_USER_ID } from '../../test/renderSmokeMocks'
import type { BidWithBuilder } from '../../types/bidWithBuilder'

type Row = Record<string, unknown> & { id: string; bid_id: string; exported_at: string; superseded_at: string | null }

/** A tiny in-memory stand-in for the `bid_plan_basis_exports` table (hoisted: vi.mock factories run before imports). */
const { store, makeBuilder } = vi.hoisted(() => {
const store: { rows: Row[]; seq: number } = { rows: [], seq: 0 }
function makeBuilder() {
  const st: { op: 'select' | 'insert' | 'update' | 'delete'; payload?: Record<string, unknown>; eq: Array<[string, unknown]>; is: Array<[string, unknown]>; neq: Array<[string, unknown]>; single: boolean } = { op: 'select', eq: [], is: [], neq: [], single: false }
  const matches = (r: Row) =>
    st.eq.every(([k, v]) => r[k] === v) && st.is.every(([k, v]) => r[k] === v) && st.neq.every(([k, v]) => r[k] !== v)
  const run = async () => {
    if (st.op === 'select') {
      const data = store.rows.filter(matches)
      return st.single ? { data: data[0] ?? null, error: null } : { data, error: null }
    }
    if (st.op === 'insert') {
      const row = { id: `row-${++store.seq}`, exported_at: new Date().toISOString(), superseded_at: null, sheet_labels: [], sheet_count: 0, notes_count: 0, include_report: false, ct_project_name: null, ct_updated_at: null, save_method: 'reported', ...(st.payload as object) } as unknown as Row
      store.rows.push(row)
      return { data: row, error: null }
    }
    if (st.op === 'update') {
      for (const r of store.rows) if (matches(r)) Object.assign(r, st.payload)
      return { data: null, error: null }
    }
    store.rows = store.rows.filter((r) => !matches(r))
    return { data: null, error: null }
  }
  const b: Record<string, unknown> = {}
  b.select = () => b
  b.order = () => b
  b.insert = (p: Record<string, unknown>) => { st.op = 'insert'; st.payload = p; return b }
  b.update = (p: Record<string, unknown>) => { st.op = 'update'; st.payload = p; return b }
  b.delete = () => { st.op = 'delete'; return b }
  b.eq = (k: string, v: unknown) => { st.eq.push([k, v]); return b }
  b.is = (k: string, v: unknown) => { st.is.push([k, v]); return b }
  b.neq = (k: string, v: unknown) => { st.neq.push([k, v]); return b }
  b.single = () => { st.single = true; return b }
  b.then = (ok?: (v: unknown) => unknown, ko?: (e: unknown) => unknown) => run().then(ok, ko)
  return b
}
return { store, makeBuilder }
})
vi.mock('../../lib/supabase', () => ({ supabase: { from: () => makeBuilder() } }))
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})

const TOKEN = '8f3a1c2e-1111-4222-8333-444455556666'
function bid(p: Partial<BidWithBuilder> = {}): BidWithBuilder {
  return {
    id: 'bid-1',
    bid_number: '409',
    project_name: 'Livingston Steel Office TI',
    count_tooling_plans_link: `https://counttooling.com/app/?t=${TOKEN}`,
    bid_to_marked_plans: false,
    design_drawing_plan_date: '2026-08-14',
    customers: null,
    bids_gc_builders: null,
    ...p,
  } as unknown as BidWithBuilder
}

function Harness({ b }: { b: BidWithBuilder }) {
  const exports = useBidBasisExports(b.id, `b${b.bid_number}`)
  return <BidBasisCard bid={b} exports={exports} />
}

function manifest(overrides: Record<string, unknown> = {}) {
  return {
    type: 'counttooling:bid-basis-export',
    version: 1,
    ref: 'b409',
    filename: 'bid-basis_b409_livingston-steel-office-ti_2026-09-09_1432.pdf',
    saveMethod: 'intended',
    fileSizeBytes: 18400000,
    sheets: ['Livingston Steel Office TI — p1', 'P-201'],
    sheetCount: 2,
    pageIndices: [0, 3],
    markTotals: { counters: 14, runs: 6 },
    notesCount: 3,
    includeReport: true,
    projectName: 'Livingston Steel Office TI',
    projectId: 'proj-1',
    viewToken: TOKEN,
    pdfHash: 'hash-1',
    ctUpdatedAt: '2026-09-09T18:58:00Z',
    exportedAt: '2026-09-09T19:32:00Z',
    canvasSnapshot: { version: 1, pages: [] },
    ...overrides,
  }
}

function post(data: unknown, origin = 'https://counttooling.com') {
  act(() => {
    window.dispatchEvent(new MessageEvent('message', { data, origin }))
  })
}

describe('BidBasisCard', () => {
  let openSpy: MockInstance<typeof window.open>
  beforeEach(() => {
    store.rows = []
    store.seq = 0
    openSpy = vi.spyOn(window, 'open').mockImplementation(() => ({ closed: false, focus: () => {} }) as unknown as Window)
  })
  afterEach(() => {
    openSpy.mockRestore()
  })

  it('renders nothing without a CountTooling link and without exports', async () => {
    const { container } = renderWithProviders(<Harness b={bid({ count_tooling_plans_link: null })} />)
    await waitFor(() => expect(container.querySelector('#bid-basis-card')).toBeNull())
  })

  it('Plans as issued: the button opens CountTooling with the export flag and shows the waiting dialog', async () => {
    renderWithProviders(<Harness b={bid()} />)
    expect(await screen.findByText('Plans as issued')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Get marked-up plans from CountTooling/ }))
    expect(openSpy).toHaveBeenCalledWith(`https://counttooling.com/app/?t=${TOKEN}&export=bid-basis&ref=b409`, '_blank')
    const dialog = await screen.findByRole('dialog', { name: 'CountTooling opened in a new tab' })
    expect(within(dialog).getByText(/bid-basis_b409_livingston-steel-office-ti_\d{4}-\d{2}-\d{2}_\d{4}\.pdf/)).toBeTruthy()
    expect(within(dialog).getByText(/Search your computer for b409/)).toBeTruthy()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'CountTooling opened in a new tab' })).toBeNull())
  })

  it('a manifest from CountTooling stamps the bid, closes the waiting dialog, and shows the file name', async () => {
    renderWithProviders(<Harness b={bid()} />)
    await screen.findByText('Plans as issued')
    fireEvent.click(screen.getByRole('button', { name: /Get marked-up plans from CountTooling/ }))
    await screen.findByRole('dialog', { name: 'CountTooling opened in a new tab' })
    post(manifest())
    expect(await screen.findByText('Marked-up plans · stamped')).toBeTruthy()
    expect(screen.getByTestId('bid-basis-filename').textContent).toBe('bid-basis_b409_livingston-steel-office-ti_2026-09-09_1432.pdf')
    // Sheets carry the short labels (project prefix stripped), the report and the notes.
    expect(screen.getByTestId('bid-basis-summary').textContent).toBe('2 sheets · p1, P-201 · report · 3 notes')
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'CountTooling opened in a new tab' })).toBeNull())
    expect(store.rows).toHaveLength(1)
    expect(store.rows[0]!.bid_id).toBe('bid-1')
    expect(store.rows[0]!.exported_by).toBe(SMOKE_AUTH_USER_ID)
    expect(store.rows[0]!.ct_view_token).toBe(TOKEN)
  })

  it('ignores manifests from other origins and for other bids', async () => {
    renderWithProviders(<Harness b={bid()} />)
    await screen.findByText('Plans as issued')
    post(manifest(), 'https://evil.example')
    post(manifest({ ref: 'b410' }))
    await new Promise((r) => setTimeout(r, 30))
    expect(store.rows).toHaveLength(0)
    expect(screen.getByText('Plans as issued')).toBeTruthy()
  })

  it('Mark as attached by hand stamps with the typed file name and no snapshot', async () => {
    renderWithProviders(<Harness b={bid()} />)
    await screen.findByText('Plans as issued')
    fireEvent.click(screen.getByRole('button', { name: /Get marked-up plans from CountTooling/ }))
    const waiting = await screen.findByRole('dialog', { name: 'CountTooling opened in a new tab' })
    fireEvent.click(within(waiting).getByRole('button', { name: 'Mark as attached by hand' }))
    const manual = await screen.findByRole('dialog', { name: 'Mark as attached' })
    const input = within(manual).getByLabelText('File name') as HTMLInputElement
    expect(input.value).toMatch(/^bid-basis_b409_livingston-steel-office-ti_/)
    fireEvent.change(input, { target: { value: 'bid-basis_b409_livingston-steel-office-ti_2026-09-09_1432 (1).pdf' } })
    fireEvent.click(within(manual).getByRole('button', { name: 'Stamp this bid' }))
    expect(await screen.findByText('Marked-up plans · stamped')).toBeTruthy()
    expect(screen.getByText(/Marked as attached by hand/)).toBeTruthy()
    expect(store.rows[0]!.save_method).toBe('manual')
    expect(store.rows[0]!.filename).toBe('bid-basis_b409_livingston-steel-office-ti_2026-09-09_1432 (1).pdf')
  })

  it('a loaded notice with a newer last-saved time turns the card amber; Export again is offered', async () => {
    store.rows = [{ id: 'row-a', bid_id: 'bid-1', exported_at: '2026-09-09T19:32:00Z', superseded_at: null, filename: 'bid-basis_b409_x_2026-09-09_1432.pdf', save_method: 'reported', sheet_labels: ['P-101'], sheet_count: 1, notes_count: 0, include_report: true, ct_project_name: 'X', ct_updated_at: '2026-09-09T18:58:00Z', exported_by: SMOKE_AUTH_USER_ID }]
    renderWithProviders(<Harness b={bid()} />)
    expect(await screen.findByText('Marked-up plans · stamped')).toBeTruthy()
    expect(screen.getByText(/Exported .* by you/)).toBeTruthy()
    post({ type: 'counttooling:bid-basis-loaded', version: 1, ref: 'b409', ctUpdatedAt: '2026-09-11T14:14:00Z' })
    expect(await screen.findByText('Takeoff changed since')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Export again/ }))
    expect(openSpy).toHaveBeenCalled()
    // An older time never flags.
    fireEvent.click(screen.getByRole('button', { name: /Keep the/ }))
    expect(await screen.findByText('Marked-up plans · stamped')).toBeTruthy()
  })

  it('a second export supersedes the first; History lists both; Remove clears the current stamp after confirming', async () => {
    renderWithProviders(<Harness b={bid()} />)
    await screen.findByText('Plans as issued')
    post(manifest())
    await screen.findByText('Marked-up plans · stamped')
    post(manifest({ filename: 'bid-basis_b409_livingston-steel-office-ti_2026-09-11_0940.pdf', exportedAt: '2026-09-11T14:40:00Z' }))
    await waitFor(() => expect(screen.getByTestId('bid-basis-filename').textContent).toContain('2026-09-11_0940'))
    expect(store.rows.filter((r) => r.superseded_at)).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: /History \(2\)/ }))
    const history = screen.getByTestId('bid-basis-history')
    expect(within(history).getByText('current')).toBeTruthy()
    expect(within(history).getByText('replaced')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
    // The confirm dialog's own Remove button (outside the card).
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Remove' }).length).toBe(2))
    const confirmBtn = screen.getAllByRole('button', { name: 'Remove' }).find((b) => !b.closest('#bid-basis-card'))!
    fireEvent.click(confirmBtn)
    await waitFor(() => expect(store.rows.filter((r) => r.id === 'row-2')).toHaveLength(0))
  })

  it('BidBasisExportsList shows a dash with no rows and the rows otherwise', async () => {
    const { rerender } = renderWithProviders(<BidBasisExportsList bidId="bid-1" />)
    expect(await screen.findByText('—')).toBeTruthy()
    store.rows = [{ id: 'row-a', bid_id: 'bid-1', exported_at: '2026-09-09T19:32:00Z', superseded_at: null, filename: 'bid-basis_b409_x_2026-09-09_1432.pdf', save_method: 'manual', sheet_labels: [], sheet_count: 0, notes_count: 0, include_report: false, ct_project_name: null, ct_updated_at: null }]
    rerender(<BidBasisExportsList bidId="bid-2" />)
    rerender(<BidBasisExportsList bidId="bid-1" />)
    expect(await screen.findByText('bid-basis_b409_x_2026-09-09_1432.pdf')).toBeTruthy()
    expect(screen.getByText(/current · by hand/)).toBeTruthy()
  })
})
