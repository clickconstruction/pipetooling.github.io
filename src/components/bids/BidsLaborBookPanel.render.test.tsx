// @vitest-environment jsdom
/**
 * Render smoke for the Labor book panel (Pricing decomposition PR 3): the collapsible
 * section, the book chips and the browsed book's entries, and the two dialogs — the book
 * form's Delete offered only on a non-Default book, and the entry form's Reads-as /
 * Hours-are-per pair with the unit locked while the entry reads as a task.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { BidsLaborBookPanel, type LaborBookEntryForm, type LaborBookPanelBook, type LaborBookVersionForm } from './BidsLaborBookPanel'
import type { LaborBookEntryWithFixture, LaborBookVersion } from '../../lib/bids/bidPricingEngineTypes'

const version = (id: string, name: string) => ({ id, name, service_type_id: 's1', is_robot: false, created_at: null }) as LaborBookVersion
const entry = (id: string, name: string, o: Record<string, unknown> = {}) =>
  ({ id, version_id: 'v1', fixture_type_id: 'f1', fixture_types: { name }, rough_in_hrs: 1.5, top_out_hrs: 0.5, trim_set_hrs: 0.25, alias_names: null, kind: 'fixture', unit: 'each', sequence_order: 0, created_at: null, ...o }) as unknown as LaborBookEntryWithFixture

function parts(over: { book?: Partial<LaborBookPanelBook>; versionForm?: Partial<LaborBookVersionForm>; entryForm?: Partial<LaborBookEntryForm> } = {}) {
  const book: LaborBookPanelBook = {
    sectionOpen: true,
    onToggleSection: vi.fn(),
    versions: [version('v1', 'Default'), version('v2', 'Bryan')],
    entries: [entry('e1', 'Toilet'), entry('e2', 'Pipe run', { unit: 'per_100ft', alias_names: ['PEX run'] })],
    browsedVersionId: 'v1',
    onBrowseVersion: vi.fn(),
    onAddBook: vi.fn(),
    onEditBook: vi.fn(),
    onAddEntry: vi.fn(),
    onEditEntry: vi.fn(),
    ...over.book,
  }
  const versionForm: LaborBookVersionForm = {
    open: false, editing: null, nameInput: '', onNameChange: vi.fn(), saving: false,
    onSubmit: vi.fn(), onClose: vi.fn(), onDelete: vi.fn(async () => true), ...over.versionForm,
  }
  const entryForm: LaborBookEntryForm = {
    open: false, editing: null, error: null, fixtureName: '', onFixtureNameChange: vi.fn(),
    fixtureTypes: [{ id: 'f1', name: 'Toilet' }], aliasNames: '', onAliasNamesChange: vi.fn(),
    kind: 'fixture', onKindChange: vi.fn(), unit: 'each', onUnitChange: vi.fn(),
    roughIn: '1', onRoughInChange: vi.fn(), topOut: '0', onTopOutChange: vi.fn(), trimSet: '0', onTrimSetChange: vi.fn(),
    saving: false, onSubmit: vi.fn(), onClose: vi.fn(), onDelete: vi.fn(async () => true), ...over.entryForm,
  }
  return { book, versionForm, entryForm }
}

describe('BidsLaborBookPanel', () => {
  it('lists the books and the browsed book’s entries, and reports every door', () => {
    const p = parts()
    render(<BidsLaborBookPanel {...p} />)
    expect(screen.getByText('Default')).toBeTruthy()
    expect(screen.getByText('Toilet')).toBeTruthy()
    expect(screen.getByText('also: PEX run')).toBeTruthy()
    fireEvent.click(screen.getByText('Bryan'))
    expect(p.book.onBrowseVersion).toHaveBeenCalledWith('v2')
    fireEvent.click(screen.getByText('Add book'))
    expect(p.book.onAddBook).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByText('Add entry'))
    expect(p.book.onAddEntry).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByText('Labor book'))
    expect(p.book.onToggleSection).toHaveBeenCalledTimes(1)
  })

  it('collapsed, it renders only its heading; with no browsed book, no entries table', () => {
    const { unmount } = render(<BidsLaborBookPanel {...parts({ book: { sectionOpen: false } })} />)
    expect(screen.getByText('Labor book')).toBeTruthy()
    expect(screen.queryByText('Add book')).toBeNull()
    unmount()
    render(<BidsLaborBookPanel {...parts({ book: { browsedVersionId: null } })} />)
    expect(screen.getByText('Add book')).toBeTruthy()
    expect(screen.queryByText('Entries (hrs per stage)')).toBeNull()
  })

  it('the book form offers Delete only on a non-Default book', () => {
    const { unmount } = render(<BidsLaborBookPanel {...parts({ versionForm: { open: true, editing: version('v1', 'Default'), nameInput: 'Default' } })} />)
    expect(screen.getByText('Edit book')).toBeTruthy()
    expect(screen.queryByText('Delete version')).toBeNull()
    unmount()
    const p = parts({ versionForm: { open: true, editing: version('v2', 'Bryan'), nameInput: 'Bryan' } })
    render(<BidsLaborBookPanel {...p} />)
    fireEvent.click(screen.getByText('Delete version'))
    expect(p.versionForm.onDelete).toHaveBeenCalledTimes(1)
  })

  it('the entry form shows the tab’s error, and locks Hours-are-per while the entry reads as a task', () => {
    const { unmount } = render(<BidsLaborBookPanel {...parts({ entryForm: { open: true, error: 'Fixture name is required' } })} />)
    expect(screen.getByText('New entry')).toBeTruthy()
    expect(screen.getByText('Fixture name is required')).toBeTruthy()
    expect((screen.getByLabelText('Hours are per') as HTMLSelectElement).disabled).toBe(false)
    unmount()
    render(<BidsLaborBookPanel {...parts({ entryForm: { open: true, kind: 'task' } })} />)
    const unit = screen.getByLabelText('Hours are per') as HTMLSelectElement
    expect(unit.disabled).toBe(true)
    expect(unit.value).toBe('each')
  })
})
