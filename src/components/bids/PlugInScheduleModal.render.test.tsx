// @vitest-environment jsdom
/**
 * Render smokes for PlugInScheduleModal ("Plug in the fixture schedule",
 * Submittals stage 1). Pins the window's own wiring, not the parser's rules
 * (parseFixtureSchedule.test.ts owns those): closed renders nothing and reads
 * nothing; open reads the bid's specified products and shows the title and the
 * bid label; a pasted schedule becomes one editable line per tag, matched to
 * the `rows` prop's count rows; a pasted tag replaces the saved row of the
 * same tag; Save is disabled with no lines and upserts `bid_specified_products`
 * on (bid, tag) with the payload the lines build, then reports onSaved and
 * onClose; a refused save says why and reports neither.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'

import { renderSettled, renderWithProviders, settle } from '../../test/renderSmokeMocks'
import { PlugInScheduleModal } from './PlugInScheduleModal'

type SavedRow = { tag: string; fixture: string | null; manufacturer: string | null; model: string | null; description: string | null }

const state: {
  existing: SavedRow[]
  reads: Array<{ table: string; columns: string; column: string; value: string; orderBy: string }>
  upserts: Array<{ rows: Array<Record<string, unknown>>; options: unknown }>
  /** supabase-js hands a refused write back as a plain object, not an Error. */
  upsertError: { message: string; code: string } | null
  /** Set to make the read of what is already on the bid fail. */
  readError: { message: string; code: string } | null
} = { existing: [], reads: [], upserts: [], upsertError: null, readError: null }

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'wendi', email: 'wendi@x.test' }, profileName: 'Wendi', role: 'estimator' }),
}))

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (table: string) => ({
      select: (columns: string) => ({
        eq: (column: string, value: string) => ({
          order: (orderBy: string) => {
            state.reads.push({ table, columns, column, value, orderBy })
            return Promise.resolve(state.readError ? { data: null, error: state.readError } : { data: state.existing, error: null })
          },
        }),
      }),
      upsert: (rows: Array<Record<string, unknown>>, options: unknown) => {
        state.upserts.push({ rows, options })
        return Promise.resolve({ data: null, error: state.upsertError })
      },
    }),
  },
}))

const rows = [
  { id: 'r1', fixture: 'Toilet', count: 11 },
  { id: 'r2', fixture: 'Lavatory', count: 6 },
  { id: 'r3', fixture: 'Water heater', count: 1 },
]

/** A header, two tags the count rows name, and one (ET-1) no count row names. */
const SCHEDULE = [
  'PLUMBING FIXTURE SCHEDULE',
  'WC-1 WATER CLOSET, WALL HUNG, 1.28 GPF TOTO CT708UVG#01 3" 2"',
  'LAV-1 LAVATORY, WALL HUNG, ADA TOTO LT307 / TEL145 1/2"',
  'ET-1 EXPANSION TANK AMTROL ST-12 3/4"',
].join('\n')

beforeEach(() => {
  state.existing = []
  state.reads = []
  state.readError = null
  state.upserts = []
  state.upsertError = null
})

/** Mounts the window open and waits for the read of what is already on the bid to land. */
async function openModal() {
  const onClose = vi.fn()
  const onSaved = vi.fn()
  await renderSettled(<PlugInScheduleModal open onClose={onClose} onSaved={onSaved} bidId="b359" bidLabel="BP359" rows={rows} />, {
    loaded: () =>
      waitFor(() => {
        expect(state.reads).toHaveLength(1)
        expect(screen.queryByText(/Loading what is already on the bid/)).toBeNull()
      }),
  })
  return { onClose, onSaved }
}

function paste(text: string) {
  fireEvent.change(screen.getByPlaceholderText(/WATER CLOSET, WALL HUNG/), { target: { value: text } })
  fireEvent.click(screen.getByRole('button', { name: 'Match to tags' }))
}

function valuesOf(label: string): string[] {
  return screen.getAllByLabelText(label).map((el) => (el as HTMLInputElement | HTMLSelectElement).value)
}

describe('PlugInScheduleModal', () => {
  it('closed, it renders nothing and reads nothing', async () => {
    renderWithProviders(<PlugInScheduleModal open={false} onClose={() => {}} onSaved={() => {}} bidId="b359" bidLabel="BP359" rows={rows} />)
    await settle()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByText('Plug in the fixture schedule')).toBeNull()
    expect(state.reads).toHaveLength(0)
  })

  it('open on a bid with nothing saved, it shows the title and the bid label, and Match and Save are disabled', async () => {
    await openModal()
    expect(screen.getByRole('dialog', { name: 'Plug in the fixture schedule' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Plug in the fixture schedule' })).toBeTruthy()
    expect(screen.getByText(/BP359 · paste the plan/)).toBeTruthy()
    expect(screen.queryByText(/already on the bid/)).toBeNull()
    expect(screen.getByText(/Nothing on the bid yet/)).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Match to tags' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: /^Save 0 specified products$/ }) as HTMLButtonElement).disabled).toBe(true)
    // The read is this bid's specified products, in tag order.
    expect(state.reads[0]).toMatchObject({ table: 'bid_specified_products', column: 'bid_id', value: 'b359', orderBy: 'tag' })
  })

  it('a pasted schedule becomes one line per tag, matched to the count rows', async () => {
    await openModal()
    paste(SCHEDULE)
    expect(valuesOf('Tag')).toEqual(['WC-1', 'LAV-1', 'ET-1'])
    expect(valuesOf('Make')).toEqual(['TOTO', 'TOTO', 'Amtrol'])
    expect(valuesOf('Model')).toEqual(['CT708UVG#01', 'LT307', 'ST-12'])
    // WC-1 and LAV-1 land on the bid's count rows; no count row names an expansion tank.
    expect(valuesOf('Count row')).toEqual(['Toilet', 'Lavatory', ''])
    expect(screen.getByText('1 header or blank line skipped')).toBeTruthy()
    expect(screen.getByText(/3 tags · 1 not on a count row/)).toBeTruthy()
    expect((screen.getByRole('button', { name: /^Save 3 specified products$/ }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('a paste with no tags says so and leaves Save disabled', async () => {
    await openModal()
    paste('PLUMBING FIXTURE SCHEDULE\nMARK DESCRIPTION MANUFACTURER MODEL')
    expect(await screen.findByText(/No tags found/)).toBeTruthy()
    expect(screen.queryAllByLabelText('Tag')).toHaveLength(0)
    expect((screen.getByRole('button', { name: /^Save 0 specified products$/ }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('it lists what is already on the bid, and a pasted tag replaces the saved row of the same tag', async () => {
    state.existing = [
      { tag: 'FD-1', fixture: null, manufacturer: 'JR Smith', model: '2005', description: 'FLOOR DRAIN' },
      { tag: 'WC-1', fixture: 'Toilet', manufacturer: 'Kohler', model: 'K-4325', description: 'WATER CLOSET' },
    ]
    await openModal()
    expect(screen.getByText(/2 already on the bid/)).toBeTruthy()
    expect(valuesOf('Tag')).toEqual(['FD-1', 'WC-1'])
    expect(valuesOf('Make')).toEqual(['JR Smith', 'Kohler'])
    expect(screen.getAllByText('on the bid')).toHaveLength(2)

    paste(SCHEDULE)
    // The pasted lines come first; the saved WC-1 is gone, the saved FD-1 stays.
    expect(valuesOf('Tag')).toEqual(['WC-1', 'LAV-1', 'ET-1', 'FD-1'])
    expect(valuesOf('Make')).toEqual(['TOTO', 'TOTO', 'Amtrol', 'JR Smith'])
    expect(screen.getAllByText('on the bid')).toHaveLength(1)
  })

  it('Save upserts the lines on the bid and tag, then reports onSaved and onClose', async () => {
    const { onClose, onSaved } = await openModal()
    paste(SCHEDULE)
    // One more by hand, typed in lower case with stray spaces.
    fireEvent.click(screen.getByRole('button', { name: '+ Add a tag by hand' }))
    const handTag = screen.getAllByLabelText('Tag')[3]
    const handMake = screen.getAllByLabelText('Make')[3]
    if (!handTag || !handMake) throw new Error('the hand-added row did not render')
    fireEvent.change(handTag, { target: { value: ' hb-1 ' } })
    fireEvent.change(handMake, { target: { value: 'Woodford' } })

    fireEvent.click(screen.getByRole('button', { name: /^Save 4 specified products$/ }))
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1))
    expect(onClose).toHaveBeenCalledTimes(1)

    expect(state.upserts).toHaveLength(1)
    const write = state.upserts[0]
    expect(write?.options).toEqual({ onConflict: 'bid_id,tag' })
    expect(write?.rows.map((r) => r.bid_id)).toEqual(['b359', 'b359', 'b359', 'b359'])
    expect(write?.rows.map((r) => r.tag)).toEqual(['WC-1', 'LAV-1', 'ET-1', 'HB-1'])
    expect(write?.rows[0]).toMatchObject({
      bid_id: 'b359',
      tag: 'WC-1',
      fixture: 'Toilet',
      manufacturer: 'TOTO',
      model: 'CT708UVG#01',
      description: 'WATER CLOSET, WALL HUNG, 1.28 GPF',
      source: 'pasted',
      confirmed_by: 'wendi',
      created_by: 'wendi',
    })
    // A line on no count row saves with a null fixture, and empty cells save as null.
    expect(write?.rows[2]).toMatchObject({ tag: 'ET-1', fixture: null, manufacturer: 'Amtrol', model: 'ST-12', source: 'pasted' })
    expect(write?.rows[3]).toMatchObject({ tag: 'HB-1', fixture: null, manufacturer: 'Woodford', model: null, description: null, source: 'typed' })
    expect(await screen.findByText('4 specified products saved on the bid.')).toBeTruthy()
  })

  it('a refused save says why, keeps the window and its lines, and reports nothing', async () => {
    state.upsertError = { message: 'new row violates row-level security policy', code: '42501' }
    const { onClose, onSaved } = await openModal()
    paste(SCHEDULE)
    fireEvent.click(screen.getByRole('button', { name: /^Save 3 specified products$/ }))
    expect(await screen.findByText("You don't have permission to save the specified products.")).toBeTruthy()
    expect(state.upserts).toHaveLength(1)
    expect(onSaved).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
    // Still open, the lines intact, and Save can be pressed again.
    expect(valuesOf('Tag')).toEqual(['WC-1', 'LAV-1', 'ET-1'])
    await waitFor(() => expect((screen.getByRole('button', { name: /^Save 3 specified products$/ }) as HTMLButtonElement).disabled).toBe(false))
  })

  it('a read that fails says why, keeps matching and saving off so nothing is replaced unseen, and Retry reads again', async () => {
    // A non-transient code, so the retry helper answers at once.
    state.readError = { message: 'canceling statement due to lock timeout', code: 'P0001' }
    state.existing = [{ tag: 'WC-1', fixture: 'Toilet', manufacturer: 'Kohler', model: 'K-4325', description: null }]
    await renderSettled(<PlugInScheduleModal open onClose={vi.fn()} onSaved={vi.fn()} bidId="b359" bidLabel="BP359" rows={rows} />, {
      loaded: () => screen.findByRole('alert'),
    })
    expect(screen.getByRole('alert').textContent).toContain("Couldn't load specified products: canceling statement due to lock timeout")
    expect(screen.queryByText(/Nothing on the bid yet/)).toBeNull()
    fireEvent.change(screen.getByPlaceholderText(/WATER CLOSET, WALL HUNG/), { target: { value: SCHEDULE } })
    expect((screen.getByRole('button', { name: 'Match to tags' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: '+ Add a tag by hand' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: /^Save / }) as HTMLButtonElement).disabled).toBe(true)

    state.readError = null
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(valuesOf('Tag')).toEqual(['WC-1']))
    expect(screen.queryByRole('alert')).toBeNull()
    expect((screen.getByRole('button', { name: 'Match to tags' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('Close, Cancel and a click on the backdrop each report onClose; a click inside the window does not, nor a press on the backdrop alone', async () => {
    const { onClose, onSaved } = await openModal()
    const dialog = screen.getByRole('dialog', { name: 'Plug in the fixture schedule' })
    fireEvent.click(dialog)
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalledTimes(2)
    const backdrop = dialog.parentElement
    if (!backdrop) throw new Error('the window has no backdrop')
    fireEvent.mouseDown(backdrop)
    expect(onClose).toHaveBeenCalledTimes(2)
    fireEvent.click(backdrop)
    expect(onClose).toHaveBeenCalledTimes(3)
    expect(onSaved).not.toHaveBeenCalled()
    expect(state.upserts).toHaveLength(0)
  })
  it('2026-10-04 · the window keeps what was typed: nothing typed closes at once; a pasted schedule asks before it leaves, by the backdrop, the × and Esc', async () => {
    const clean = await openModal()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(clean.onClose).toHaveBeenCalledTimes(1)
    cleanup()
    state.reads = []
    const { onClose } = await openModal()
    paste(SCHEDULE)
    fireEvent.click(screen.getByRole('presentation'))
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByTestId('leave-question').textContent).toContain('Leave without saving? The schedule you typed is not saved yet.')
    fireEvent.click(screen.getByTestId('leave-keep'))
    expect(valuesOf('Tag')).toContain('WC-1')
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.getByTestId('leave-question')).toBeTruthy()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByTestId('leave-question')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    fireEvent.click(screen.getByTestId('leave-confirm'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
