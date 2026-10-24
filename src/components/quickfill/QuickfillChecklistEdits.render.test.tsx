// @vitest-environment jsdom
/**
 * Quickfill's checklists keep a box's ticks (v2.5829): in a dev's Edit checklist mode, Remove
 * drops the box from the list and leaves its tick rows alone, and Rename changes the box's words
 * in place under the same id. Office Arriving and Assistant Dailys, which keep a row a tick.
 */
import type { ReactNode } from 'react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { installDomShims, renderWithProviders, settle } from '../../test/renderSmokeMocks'
import { QuickfillOfficeSection } from './QuickfillOfficeSection'
import { QuickfillAssistantDailysSection } from './QuickfillAssistantDailysSection'

type Op = { table: string; op: string; payload?: unknown; filters: Array<[string, unknown]> }
const state = vi.hoisted(() => ({ ops: [] as Array<{ table: string; op: string; payload?: unknown; filters: Array<[string, unknown]> }>, settings: {} as Record<string, string> }))

// Records every write; reads serve the items JSON from `state.settings` and no ticks today.
vi.mock('../../lib/supabase', () => {
  function builder(table: string) {
    const rec: Op = { table, op: 'select', filters: [] }
    const b: Record<string, unknown> = {}
    b.select = () => b
    for (const op of ['insert', 'delete', 'upsert', 'update']) {
      b[op] = (payload?: unknown) => {
        rec.op = op
        rec.payload = payload
        state.ops.push(rec)
        return b
      }
    }
    b.eq = (col: string, val: unknown) => (rec.filters.push([col, val]), b)
    for (const m of ['order', 'limit', 'gte', 'lte', 'in']) b[m] = () => b
    const rows = () => {
      if (rec.op !== 'select') return null
      if (table === 'app_settings') return Object.entries(state.settings).map(([key, value_text]) => ({ key, value_text }))
      return []
    }
    b.then = (onFulfilled?: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) => Promise.resolve({ data: rows(), error: null }).then(onFulfilled, onRejected)
    return b
  }
  return { supabase: { from: (table: string) => builder(table) } }
})
vi.mock('../../hooks/useAuth', async () => {
  const { makeUseAuthValue } = await import('../../test/renderSmokeMocks')
  return { useAuth: () => makeUseAuthValue({ role: 'dev' }), AuthProvider: ({ children }: { children: ReactNode }) => <>{children}</> }
})

const BOXES = [
  { id: 'a', label: 'Open the window shades' },
  { id: 'b', label: 'Turn on the lights' },
  { id: 'c', label: 'Mop and sweep' },
]

const savedLists = (key: string) =>
  state.ops
    .filter((o) => o.table === 'app_settings' && o.op === 'upsert' && (o.payload as { key?: string }).key === key)
    .map((o) => JSON.parse((o.payload as { value_text: string }).value_text) as Array<{ id: string; label: string }>)

beforeAll(installDomShims)
beforeEach(() => {
  state.ops = []
  localStorage.setItem('quickfill_office_arriving_dev_edit', '1')
  localStorage.setItem('quickfill_assistant_dailys_dev_edit', '1')
})
afterEach(() => {
  cleanup()
  localStorage.clear()
})

const STATIONS = [
  { name: 'Office Arriving', ui: () => <QuickfillOfficeSection variant="arriving" />, itemsKey: 'quickfill_office_arriving_items', ticks: 'quickfill_office_arriving_daily_checks' },
  { name: 'Assistant Dailys', ui: () => <QuickfillAssistantDailysSection />, itemsKey: 'quickfill_assistant_dailys_items', ticks: 'quickfill_assistant_dailys_daily_checks' },
]

describe.each(STATIONS)('$name · a box keeps its ticks (v2.5829)', ({ ui, itemsKey, ticks }) => {
  beforeEach(() => {
    state.settings = { [itemsKey]: JSON.stringify(BOXES) }
  })

  it('Remove drops the box from the list and deletes none of its tick rows', async () => {
    renderWithProviders(ui())
    await screen.findByText('Turn on the lights')
    await settle()
    fireEvent.click(screen.getAllByRole('button', { name: 'Remove' })[1]!)
    await waitFor(() => expect(savedLists(itemsKey)).toHaveLength(1))
    expect(savedLists(itemsKey)[0]!.map((i) => i.id)).toEqual(['a', 'c'])
    expect(state.ops.filter((o) => o.table === ticks && o.op === 'delete')).toEqual([])
    await waitFor(() => expect(screen.queryByText('Turn on the lights')).toBeNull())
  })

  it('Rename changes the words under the same id and place, and touches no tick row', async () => {
    renderWithProviders(ui())
    await screen.findByText('Turn on the lights')
    await settle()
    fireEvent.click(screen.getAllByRole('button', { name: 'Rename' })[1]!)
    const field = screen.getByRole('textbox', { name: 'New words for the box: Turn on the lights' })
    const save = screen.getByRole('button', { name: 'Save' })
    expect(save).toHaveProperty('disabled', true)
    fireEvent.change(field, { target: { value: 'Turn on the lights in every room' } })
    expect(save).toHaveProperty('disabled', false)
    fireEvent.click(save)
    await waitFor(() => expect(savedLists(itemsKey)).toHaveLength(1))
    expect(savedLists(itemsKey)[0]).toEqual([
      { id: 'a', label: 'Open the window shades' },
      { id: 'b', label: 'Turn on the lights in every room' },
      { id: 'c', label: 'Mop and sweep' },
    ])
    await screen.findByText('Turn on the lights in every room')
    expect(screen.queryByRole('textbox', { name: /New words for the box/ })).toBeNull()
    expect(state.ops.filter((o) => o.table === ticks)).toEqual([])
  })

  it('Escape leaves the box as it was and saves nothing', async () => {
    renderWithProviders(ui())
    await screen.findByText('Mop and sweep')
    await settle()
    fireEvent.click(screen.getAllByRole('button', { name: 'Rename' })[2]!)
    const field = screen.getByRole('textbox', { name: 'New words for the box: Mop and sweep' })
    fireEvent.change(field, { target: { value: 'Mop, sweep and dust' } })
    fireEvent.keyDown(field, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('textbox', { name: /New words for the box/ })).toBeNull())
    expect(screen.getByText('Mop and sweep')).toBeTruthy()
    expect(state.ops.filter((o) => o.op !== 'select')).toEqual([])
  })
})
