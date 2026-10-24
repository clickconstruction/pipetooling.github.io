// @vitest-environment jsdom
/**
 * The Mark history window in the checklist ledger's shape (punch list #156, v2.5819): the
 * tiles, one cell a workday with the open count, the habit line, the rows with the Note column
 * only when a note exists, the Earlier fold; a station with no count ticks; a week with no
 * mark and an empty station say so; a station whose boxes write a row a tick gets The boxes
 * band on a desk, read from its daily-checks table, and no band on a phone.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { installDomShims, renderWithProviders, settle } from '../../test/renderSmokeMocks'
import { QuickfillSectionMarkHistoryModal } from './QuickfillSectionMarkHistoryModal'

const state = vi.hoisted(() => ({ tables: {} as Record<string, unknown[]>, narrow: false }))

// A small table stub that honours the reads the window makes: eq, gte, lte and lt on a column
// the row carries, order and limit; select is ignored (the rows already have the joined shape).
vi.mock('../../lib/supabase', () => {
  function builder(table: string) {
    const filters: Array<(r: Record<string, unknown>) => boolean> = []
    let orderBy: { col: string; asc: boolean } | null = null
    let limitN: number | null = null
    const rows = () => {
      let out = ((state.tables[table] ?? []) as Array<Record<string, unknown>>).filter((r) => filters.every((f) => f(r)))
      if (orderBy) {
        const { col, asc } = orderBy
        out = [...out].sort((x, y) => String(x[col]).localeCompare(String(y[col])) * (asc ? 1 : -1))
      }
      return limitN == null ? out : out.slice(0, limitN)
    }
    const on = (col: string, test: (v: string) => boolean) => (r: Record<string, unknown>) => !(col in r) || test(String(r[col]))
    const b: Record<string, unknown> = {}
    b.select = () => b
    b.eq = (col: string, val: unknown) => (filters.push(on(col, (v) => v === String(val))), b)
    b.gte = (col: string, val: string) => (filters.push(on(col, (v) => v >= val)), b)
    b.lte = (col: string, val: string) => (filters.push(on(col, (v) => v <= val)), b)
    b.lt = (col: string, val: string) => (filters.push(on(col, (v) => v < val)), b)
    b.order = (col: string, opts?: { ascending?: boolean }) => ((orderBy = { col, asc: opts?.ascending !== false }), b)
    b.limit = (n: number) => ((limitN = n), b)
    b.maybeSingle = () => Promise.resolve({ data: rows()[0] ?? null, error: null })
    b.then = (onFulfilled?: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) => Promise.resolve({ data: rows(), error: null }).then(onFulfilled, onRejected)
    return b
  }
  return { supabase: { from: (table: string) => builder(table) } }
})
vi.mock('../../utils/dateUtils', async (orig) => ({ ...(await orig<typeof import('../../utils/dateUtils')>()), todayYmdInAppTz: () => '2026-10-24' }))
vi.mock('../../hooks/useNarrowViewport640', () => ({ useNarrowViewport640: () => state.narrow }))

// Central daylight time, written as UTC (+5).
let seq = 0
function row(ymd: string, hhmm: string, name: string | null, count: number | null, note: string | null = null) {
  const [h, m] = hhmm.split(':').map(Number)
  seq++
  return {
    id: `e${seq}`,
    marked_at: new Date(`${ymd}T${String(h! + 5).padStart(2, '0')}:${String(m).padStart(2, '0')}:00Z`).toISOString(),
    outstanding_count: count,
    note_text: note,
    marked_by: name ? `u-${name}` : null,
    users: name ? { name } : null,
  }
}

/** Every workday from Aug 31 to Oct 23 at 9:30 but three, counts 0 or 3. */
function dailyRows(count: (ymd: string) => number | null, note: (ymd: string) => string | null = () => null) {
  const gaps = new Set(['2026-09-07', '2026-09-09', '2026-10-02'])
  const out: ReturnType<typeof row>[] = []
  const d = new Date('2026-08-31T00:00:00')
  while (d.getTime() <= new Date('2026-10-23T00:00:00').getTime()) {
    const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const dow = d.getDay()
    if (dow >= 1 && dow <= 5 && !gaps.has(ymd)) out.push(row(ymd, '09:30', ymd === '2026-09-03' ? 'Marisol' : 'Dana', count(ymd), note(ymd)))
    d.setDate(d.getDate() + 1)
  }
  return out.reverse()
}
const THREES = new Set(['2026-09-04', '2026-09-25', '2026-09-28', '2026-10-08', '2026-10-19', '2026-10-20'])

const onClose = vi.fn()
const modal = (sectionId = 'texts', label = 'Texts') => <QuickfillSectionMarkHistoryModal open onClose={onClose} sectionId={sectionId} sectionLabel={label} />

function seedBoxes() {
  const marks = dailyRows((ymd) => (ymd === '2026-10-16' || ymd === '2026-10-23' ? 0 : 1))
  state.tables['quickfill_section_mark_events'] = marks
  state.tables['app_settings'] = [
    {
      key: 'quickfill_assistant_dailys_items',
      value_text: JSON.stringify([
        { id: 'a', label: 'Schedule conflicts flagged' },
        { id: 'b', label: 'Email inbox clear' },
        { id: 'c', label: 'Trash out when leaving' },
        { id: 'd', label: 'Turn on the lights' },
      ]),
    },
  ]
  // The trash box is older than the band; the lights box was added on Oct 23 and has no past.
  const ticks: unknown[] = [{ item_id: 'c', work_date: '2026-09-04', checked_at: '2026-09-04T14:30:00Z', users: { name: 'Marisol' } }]
  for (const m of marks) {
    const ymd = m.marked_at.slice(0, 10)
    if (ymd < '2026-09-28') continue
    ticks.push({ item_id: 'a', work_date: ymd, checked_at: m.marked_at, users: { name: 'Dana' } })
    ticks.push({ item_id: 'b', work_date: ymd, checked_at: m.marked_at, users: { name: 'Dana' } })
    if (ymd === '2026-10-16' || ymd === '2026-10-23') ticks.push({ item_id: 'c', work_date: ymd, checked_at: m.marked_at, users: { name: 'Marisol' } })
    if (ymd === '2026-10-23') ticks.push({ item_id: 'd', work_date: ymd, checked_at: m.marked_at, users: { name: 'Dana' } })
  }
  state.tables['quickfill_assistant_dailys_daily_checks'] = ticks
}

beforeAll(installDomShims)
afterEach(() => {
  cleanup()
  onClose.mockClear()
  state.tables = {}
  state.narrow = false
})

describe('QuickfillSectionMarkHistoryModal · the ledger for one station (punch list #156)', () => {
  it('draws the tiles, the cells with the count, the habit line and the rows without a Note column', async () => {
    state.tables['quickfill_section_mark_events'] = dailyRows((ymd) => (THREES.has(ymd) ? 3 : 0))
    renderWithProviders(modal())
    const tiles = await screen.findByTestId('quickfill-mark-history-tiles')
    expect(tiles.textContent).toContain('5 of 5')
    expect(tiles.textContent).toContain('15')
    expect(tiles.textContent).toContain('of 40 days')
    const three = screen.getByTestId('quickfill-mark-history-cell-2026-10-20')
    expect(three.textContent).toBe('3')
    expect(three.getAttribute('aria-label')).toBe('Tue, Oct 20 · 9:30 AM · Dana · 3 open')
    expect(screen.getByTestId('quickfill-mark-history-cell-2026-10-21').textContent).toBe('0')
    expect(screen.getByTestId('quickfill-mark-history-cell-2026-10-02').getAttribute('aria-label')).toBe('Fri, Oct 2 · no mark')
    expect(screen.getByTestId('quickfill-mark-history-cell-2026-10-25').tagName).toBe('SPAN')
    const habit = screen.getByTestId('quickfill-mark-history-habit')
    expect(habit.textContent).toContain('Dana marked it 36 times and Marisol once. The usual time is about 9:30 AM.')
    expect(habit.textContent).toContain('Nothing open at 31 of 37 looks.')
    const rows = screen.getByTestId('quickfill-mark-history-rows')
    expect(rows.querySelectorAll('tbody tr')).toHaveLength(5)
    expect(rows.textContent).not.toContain('Note')
    expect(screen.queryByTestId('quickfill-mark-history-older')).toBeNull()
    expect(screen.queryByTestId('quickfill-mark-history-boxes')).toBeNull()
  })

  it('a tapped cell reads its mark under the grid, and the fold opens the older rows', async () => {
    state.tables['quickfill_section_mark_events'] = dailyRows((ymd) => (THREES.has(ymd) ? 3 : 0))
    renderWithProviders(modal())
    const three = await screen.findByTestId('quickfill-mark-history-cell-2026-10-20')
    await settle()
    expect(screen.getByTestId('quickfill-mark-history-selected').textContent).toBe('Tap a day to read its mark.')
    fireEvent.click(three)
    await waitFor(() => expect(screen.getByTestId('quickfill-mark-history-selected').textContent).toBe('Tue, Oct 20 · 9:30 AM · Dana · 3 open'))
    expect(three.getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: /Earlier \(all time\)/ }))
    const older = await screen.findByTestId('quickfill-mark-history-older')
    expect(older.querySelectorAll('tbody tr')).toHaveLength(32)
  })

  it('a station whose marks carry notes gets the Note column back', async () => {
    state.tables['quickfill_section_mark_events'] = dailyRows(() => 0, (ymd) => (ymd === '2026-10-22' ? 'still owe Reece a call' : 'nothing owed'))
    renderWithProviders(modal())
    const rows = await screen.findByTestId('quickfill-mark-history-rows')
    expect(rows.textContent).toContain('Note')
    expect(rows.textContent).toContain('still owe Reece a call')
  })

  it('a station with no count ticks its cells and says so', async () => {
    state.tables['quickfill_section_mark_events'] = dailyRows(() => null)
    renderWithProviders(modal())
    const cell = await screen.findByTestId('quickfill-mark-history-cell-2026-10-21')
    expect(cell.textContent).toBe('✓')
    expect(screen.getByTestId('quickfill-mark-history-habit').textContent).toContain('This station has no count. A mark is a look.')
  })

  it('a week with no mark: the tiles read none this week, the cells are dashed, the rows say so', async () => {
    state.tables['quickfill_section_mark_events'] = dailyRows(() => 0).filter((r) => r.marked_at.slice(0, 10) <= '2026-10-09')
    renderWithProviders(modal())
    const tiles = await screen.findByTestId('quickfill-mark-history-tiles')
    expect(tiles.textContent).toContain('0 of 5')
    expect(tiles.textContent).toContain('13')
    expect(tiles.textContent).toContain('of 40 days')
    expect(screen.getByTestId('quickfill-mark-history-cell-2026-10-21').getAttribute('aria-label')).toBe('Wed, Oct 21 · no mark')
    expect(screen.getByTestId('quickfill-mark-history-rows').textContent).toContain('No marks in the last 7 days.')
    expect(screen.getByRole('button', { name: /Earlier \(all time\)/ }).textContent).toContain('(27)')
  })

  it('an empty station says so, and Escape closes', async () => {
    renderWithProviders(modal())
    await screen.findByTestId('quickfill-mark-history-empty')
    expect(screen.queryByTestId('quickfill-mark-history-tiles')).toBeNull()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('a station with boxes gets The boxes band on a desk: one row a box from its first tick, the one left behind named', async () => {
    seedBoxes()
    renderWithProviders(modal('assistant-dailys', 'Assistant Dailys'))
    const band = await screen.findByTestId('quickfill-mark-history-boxes')
    await waitFor(() => expect(band.textContent).toContain('One box counts from its first tick on Fri, Oct 23.'))
    expect(band.textContent).toContain('from each box’s first tick')
    expect(screen.getByTestId('quickfill-mark-history-box-a').textContent).toBe('Schedule conflicts flagged')
    expect(band.textContent).toContain('19 of 20')
    expect(band.textContent).toContain('2 of 20')
    expect(band.textContent).toContain('1 of 1')
    expect(screen.getByTestId('quickfill-mark-history-box-d').getAttribute('title')).toBe('Turn on the lights. Counted from its first tick on Fri, Oct 23.')
    expect(band.textContent).toContain('Dana ticks the boxes.')
    expect(band.textContent).toContain('Left unticked most days: Trash out when leaving, 18 of 20.')
    expect(band.textContent).not.toContain('Turn on the lights, ')
    expect(band.querySelector('[title="Fri, Oct 16 · 9:30 AM · Marisol"]')).not.toBeNull()
    expect(band.querySelector('[title="Fri, Oct 2 · no mark that day"]')).not.toBeNull()
    expect(band.querySelector('[title="Mon, Sep 28 · before its first tick"]')).not.toBeNull()
  })

  it('a phone keeps the tiles, the grid and the rows and leaves the band off', async () => {
    seedBoxes()
    state.narrow = true
    renderWithProviders(modal('assistant-dailys', 'Assistant Dailys'))
    await screen.findByTestId('quickfill-mark-history-tiles')
    await settle()
    expect(screen.queryByTestId('quickfill-mark-history-boxes')).toBeNull()
    expect(screen.getByTestId('quickfill-mark-history-rows')).toBeTruthy()
  })
})
