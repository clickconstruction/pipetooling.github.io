// @vitest-environment jsdom
/**
 * Render smoke for the Labor book panel (Pricing decomposition PR 3; one book per trade since
 * the Labor refresh PR 6b, v2.3597): the collapsible section, the trade's one book with its
 * summary line, the entries with their *Hours from* chip and *Reset to robot* where a person's
 * number sits over the robot's, the role gate on Add entry, and the entry form's Reads-as /
 * Hours-are-per pair with the unit locked while the entry reads as a task.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { BidsLaborBookPanel, type LaborBookEntryForm, type LaborBookPanelBook } from './BidsLaborBookPanel'
import { laborBookRights } from '../../lib/bids/laborEntryProvenance'
import type { LaborBookEntryWithFixture } from '../../lib/bids/bidPricingEngineTypes'
import { settle } from '../../test/renderSmokeMocks'

const entry = (id: string, name: string, o: Record<string, unknown> = {}) =>
  ({
    id, version_id: 'v1', fixture_type_id: 'f1', fixture_types: { name },
    rough_in_hrs: 1.5, top_out_hrs: 0.5, trim_set_hrs: 0.25, robot_rough_in_hrs: 1.5, robot_top_out_hrs: 0.5, robot_trim_set_hrs: 0.25,
    origin: 'robot', set_by: null, set_at: null, set_note: null,
    alias_names: null, kind: 'fixture', unit: 'each', sequence_order: 0, created_at: null, ...o,
  }) as unknown as LaborBookEntryWithFixture

const entries = [
  entry('e1', 'Toilet', { alias_names: ['WC'] }),
  entry('e2', 'Pipe run', { unit: 'per_100ft', origin: 'human', robot_rough_in_hrs: null, robot_top_out_hrs: null, robot_trim_set_hrs: null, set_at: '2026-09-18T20:00:00Z', set_note: 'from Default' }),
  entry('e3', 'Lavatory', { rough_in_hrs: 0.75, set_by: 'u1', set_at: '2026-09-18T20:00:00Z' }),
  entry('e4', 'Water Fountain', { set_note: 'Default had 2.00/3.00/2.00 — Robot kept' }),
]

function parts(over: { book?: Partial<LaborBookPanelBook>; entryForm?: Partial<LaborBookEntryForm> } = {}) {
  const book: LaborBookPanelBook = {
    sectionOpen: true,
    onToggleSection: vi.fn(),
    book: { name: '🤖 Robot Default', tradeName: 'Plumbing' },
    summaryWords: '4 entries · 1 alias · 1 override',
    entries,
    rights: laborBookRights('dev'),
    userId: 'u2',
    nameOf: (id) => (id === 'u1' ? 'Wendi' : null),
    onAddEntry: vi.fn(),
    onEditEntry: vi.fn(),
    onResetToRobot: vi.fn(),
    resettingId: null,
    ...over.book,
  }
  const entryForm: LaborBookEntryForm = {
    open: false, editing: null, error: null, fixtureName: '', onFixtureNameChange: vi.fn(),
    fixtureTypes: [{ id: 'f1', name: 'Toilet' }], aliasNames: '', onAliasNamesChange: vi.fn(),
    kind: 'fixture', onKindChange: vi.fn(), unit: 'each', onUnitChange: vi.fn(),
    roughIn: '1', onRoughInChange: vi.fn(), topOut: '0', onTopOutChange: vi.fn(), trimSet: '0', onTrimSetChange: vi.fn(),
    saving: false, onSubmit: vi.fn(), onClose: vi.fn(), onDelete: vi.fn(async () => true), ...over.entryForm,
  }
  return { book, entryForm }
}

describe('BidsLaborBookPanel', () => {
  it('names the trade’s one book, lists its entries with a Hours-from chip each, and reports every door', async () => {
    const p = parts()
    render(<BidsLaborBookPanel {...p} />)
    await settle()
    const head = screen.getByTestId('labor-book-head')
    expect(within(head).getByText('🤖 Robot Default')).toBeTruthy()
    expect(within(head).getByText('· Plumbing')).toBeTruthy()
    expect(within(head).getByText('· 4 entries · 1 alias · 1 override')).toBeTruthy()
    expect(screen.queryByText('Add book')).toBeNull()
    expect(screen.getByText('Toilet')).toBeTruthy()
    expect(screen.getByText('also: WC')).toBeTruthy()
    const chips = screen.getAllByTestId('labor-hours-from').map((c) => c.textContent)
    expect(chips).toEqual(['robot', 'human · from Default', 'override · Wendi · Sep 18', 'robot · picked over Default 2/3/2'])
    fireEvent.click(screen.getByText('Reset to robot'))
    expect(p.book.onResetToRobot).toHaveBeenCalledWith(entries[2])
    fireEvent.click(screen.getByText('Add entry'))
    expect(p.book.onAddEntry).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getAllByTitle('Edit')[0]!)
    expect(p.book.onEditEntry).toHaveBeenCalledWith(entries[0])
    fireEvent.click(screen.getByText('Labor book'))
    expect(p.book.onToggleSection).toHaveBeenCalledTimes(1)
  })

  it('an estimator resets only their own override; the office reads with no Add entry, no pencil, no reset', async () => {
    const own = render(<BidsLaborBookPanel {...parts({ book: { rights: laborBookRights('estimator'), userId: 'u1' } })} />)
    await settle()
    expect(screen.getByText('Reset to robot')).toBeTruthy()
    expect(screen.getByText('Add entry')).toBeTruthy()
    own.unmount()
    const other = render(<BidsLaborBookPanel {...parts({ book: { rights: laborBookRights('estimator'), userId: 'u9' } })} />)
    await settle()
    expect(screen.queryByText('Reset to robot')).toBeNull()
    other.unmount()
    render(<BidsLaborBookPanel {...parts({ book: { rights: laborBookRights('assistant') } })} />)
    await settle()
    expect(screen.queryByText('Add entry')).toBeNull()
    expect(screen.queryByTitle('Edit')).toBeNull()
    expect(screen.queryByText('Reset to robot')).toBeNull()
    expect(screen.getByText('read-only for your role')).toBeTruthy()
  })

  it('collapsed, it renders only its heading; with no book for the trade, it says so and offers nothing', async () => {
    const { unmount } = render(<BidsLaborBookPanel {...parts({ book: { sectionOpen: false } })} />)
    await settle()
    expect(screen.getByText('Labor book')).toBeTruthy()
    expect(screen.queryByText('Add entry')).toBeNull()
    unmount()
    render(<BidsLaborBookPanel {...parts({ book: { book: null, entries: [] } })} />)
    await settle()
    expect(screen.getByText('This trade has no labor book yet — the robot seeds one.')).toBeTruthy()
    expect(screen.queryByText('Add entry')).toBeNull()
    expect(screen.queryByText('Entries (hrs per stage)')).toBeNull()
  })

  it('the entry form shows the tab’s error, the robot’s numbers under an override, and locks Hours-are-per while the entry reads as a task', async () => {
    const { unmount } = render(<BidsLaborBookPanel {...parts({ entryForm: { open: true, error: 'Fixture name is required', editing: entries[2]! } })} />)
    await settle()
    expect(screen.getByText('Edit entry')).toBeTruthy()
    expect(screen.getByText('Fixture name is required')).toBeTruthy()
    expect(screen.getByText(/The robot's own numbers, 1.5\/0.5\/0.25, stay under yours/)).toBeTruthy()
    expect((screen.getByLabelText('Hours are per') as HTMLSelectElement).disabled).toBe(false)
    unmount()
    render(<BidsLaborBookPanel {...parts({ entryForm: { open: true, kind: 'task' } })} />)
    await settle()
    expect(screen.getByText('New entry')).toBeTruthy()
    const unit = screen.getByLabelText('Hours are per') as HTMLSelectElement
    expect(unit.disabled).toBe(true)
    expect(unit.value).toBe('each')
  })
})
