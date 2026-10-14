// @vitest-environment jsdom
/**
 * Edit Bid → CountTooling projects (v2.5520): the list's words from the sources and the rows' shares, a removal that
 * re-stamps the rows carrying the project and hands the next first link to the form, and a link added by hand.
 * The supabase stub records the writes; the kernel is real.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

const writes: Array<{ table: string; op: string; payload?: unknown; eq?: unknown[] }> = []
const SOURCES = [
  { id: 's1', bid_id: 'b1', link: 'https://counttooling.com/app/?t=aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', token: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', project_name: 'SpaceX BA', scope: 'all', imported_by: 'u-t', first_imported_at: '2026-10-09T15:00:00Z', last_imported_at: '2026-10-09T15:00:00Z' },
  { id: 's2', bid_id: 'b1', link: 'https://counttooling.com/app/?t=11111111-2222-3333-4444-555555555555', token: '11111111-2222-3333-4444-555555555555', project_name: 'SpaceX BA', scope: 'all', imported_by: 'u-r', first_imported_at: '2026-10-13T15:00:00Z', last_imported_at: '2026-10-13T15:00:00Z' },
]
const ROWS = [
  { id: 'w34', source_shares: { s1: 1489.04, s2: 338.41 } },
  { id: 'ewc', source_shares: { s1: 5 } },
  { id: 'w1', source_shares: { s2: 682.49 } },
  { id: 'hand', source_shares: null },
]
vi.mock('../../lib/supabase', () => {
  const builder = (table: string) => {
    const state: { op: string; payload?: unknown; eq: unknown[] } = { op: 'select', eq: [] }
    const chain: Record<string, unknown> = {}
    const self = () => chain
    chain.select = () => self()
    chain.order = () => self()
    chain.eq = (...args: unknown[]) => { state.eq.push(args); return self() }
    chain.insert = (payload: unknown) => { state.op = 'insert'; state.payload = payload; return self() }
    chain.update = (payload: unknown) => { state.op = 'update'; state.payload = payload; return self() }
    chain.delete = () => { state.op = 'delete'; return self() }
    chain.then = (resolve: (v: unknown) => void) => {
      if (state.op === 'select') {
        const data = table === 'bid_count_sources' ? SOURCES : table === 'bids_count_rows' ? ROWS : []
        resolve({ data, error: null })
        return
      }
      writes.push({ table, op: state.op, payload: state.payload, eq: state.eq })
      resolve({ data: null, error: null })
    }
    return chain
  }
  return { supabase: { from: (table: string) => builder(table) } }
})
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u-me' }, role: 'estimator', profileName: 'Wendi' }) }))
vi.mock('../../hooks/useUserDisplayNames', () => ({ useUserDisplayNames: () => ({ 'u-t': 'Taunya', 'u-r': 'Robert' }) }))
const open = vi.fn()
vi.mock('../../lib/openInExternalBrowser', () => ({ openInExternalBrowser: (href: string) => open(href) }))

const { BidCountSourcesField } = await import('./BidCountSourcesField')

afterEach(() => {
  cleanup()
  writes.length = 0
  open.mockClear()
})

describe('BidCountSourcesField (v2.5520)', () => {
  it('lists each project with its importer, day, scope and rows; the first is marked; Open opens the link', async () => {
    render(<BidCountSourcesField bidId="b1" />)
    const items = await screen.findAllByTestId('bid-count-source')
    expect(items).toHaveLength(2)
    expect(items[0]!.textContent).toContain('SpaceX BA · Taunya')
    expect(items[0]!.textContent).toContain('first')
    expect(items[0]!.textContent).toContain('imported by Taunya · Oct 9 · every sheet · 2 rows, 1 shared')
    expect(items[1]!.textContent).toContain('SpaceX BA · Robert')
    expect(items[1]!.textContent).toContain('combined')
    expect(items[1]!.textContent).toContain('2 rows, 1 shared')
    fireEvent.click(screen.getAllByRole('button', { name: 'Open ↗' })[1]!)
    expect(open).toHaveBeenCalledWith(SOURCES[1]!.link)
  })

  it('removing the first project re-stamps its rows, deletes the source, and hands the next link to the form', async () => {
    const onFirstLinkChange = vi.fn()
    render(<BidCountSourcesField bidId="b1" onFirstLinkChange={onFirstLinkChange} />)
    await screen.findAllByTestId('bid-count-source')
    fireEvent.click(screen.getByRole('button', { name: 'Remove SpaceX BA · Taunya' }))
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
    await waitFor(() => expect(writes.some((w) => w.table === 'bid_count_sources' && w.op === 'delete')).toBe(true))
    const updates = writes.filter((w) => w.table === 'bids_count_rows' && w.op === 'update')
    expect(updates.map((u) => [u.eq?.[0], u.payload])).toEqual([
      [['id', 'w34'], { source_shares: { s2: 338.41 } }],
      [['id', 'ewc'], { source_shares: null }],
    ])
    expect(onFirstLinkChange).toHaveBeenCalledWith(SOURCES[1]!.link)
  })

  it('a link typed by hand is added with its token and the signed-in importer; a project already on the bid is refused', async () => {
    render(<BidCountSourcesField bidId="b1" />)
    await screen.findAllByTestId('bid-count-source')
    fireEvent.click(screen.getByRole('button', { name: '+ Add a CountTooling link' }))
    const input = screen.getByRole('textbox', { name: 'CountTooling link to add' })
    fireEvent.change(input, { target: { value: 'https://counttooling.com/app/?t=AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(await screen.findByText('That project is already on the bid')).toBeTruthy()
    fireEvent.change(input, { target: { value: 'https://counttooling.com/app/?t=99999999-8888-7777-6666-555555555555' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    await waitFor(() => expect(writes.some((w) => w.table === 'bid_count_sources' && w.op === 'insert')).toBe(true))
    const ins = writes.find((w) => w.table === 'bid_count_sources' && w.op === 'insert')!
    expect(ins.payload).toEqual({ bid_id: 'b1', link: 'https://counttooling.com/app/?t=99999999-8888-7777-6666-555555555555', token: '99999999-8888-7777-6666-555555555555', project_name: null, scope: 'unknown', imported_by: 'u-me' })
  })
})
