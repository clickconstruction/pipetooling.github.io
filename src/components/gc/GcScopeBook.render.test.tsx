// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { GcScopeBookWindow } from './GcScopeBook'
import type { ScopeBookInput } from '../../lib/gc/scopeBook'
import { installDomShims } from '../../test/renderSmokeMocks'

installDomShims()

/** One GC project with two Plumbing lines, and a store with one saved line: the book the window reads. */
const input: ScopeBookInput = {
  projects: [
    {
      id: 'p1',
      name: 'Fair Oaks Clinic',
      planSets: [{ label: 'Bid set', issuedOn: '2026-10-01' }],
      packages: [
        { id: 'pk1', trade: 'Plumbing', scope: [{ id: 's1', label: 'Underground' }, { id: 's2', label: 'Top out' }], invites: [], excludes: [{ label: 'Gas piping', by: 'the owner' }] },
      ],
    },
  ],
  store: { saved: [{ trade: 'Plumbing', words: 'Fixture trim', savedOn: '2026-10-02', spec: '22 40 00' }], edits: [], merges: [], sets: [] },
  pastJobs: [],
  today: '2026-10-06',
}

describe('GcScopeBookWindow', () => {
  it('shows the trade’s lines and types a new one into the book through the write it is given', () => {
    const onSave = vi.fn()
    render(<GcScopeBookWindow input={input} startTrade="Plumbing" onClose={() => undefined} writes={{ onSave, onEdit: vi.fn(), onMerge: vi.fn(), onSaveSet: vi.fn() }} />)
    expect(screen.getByRole('dialog', { name: 'The scope book' })).toBeTruthy()
    expect(screen.getByText('Underground')).toBeTruthy()
    expect(screen.getByText('Fixture trim')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('A new Plumbing line for the book'), { target: { value: 'Water heater' } })
    fireEvent.click(screen.getByRole('button', { name: '+ Add to the book' }))
    expect(onSave).toHaveBeenCalledWith('Plumbing', 'Water heater', undefined)
  })

  it('saves the scope it was opened with as a set, naming the project', () => {
    const onSaveSet = vi.fn()
    render(
      <GcScopeBookWindow
        input={input}
        startTrade="Plumbing"
        current={{ trade: 'Plumbing', lines: ['Underground', 'Top out'], projectName: 'Fair Oaks Clinic', projectId: 'p1' }}
        onClose={() => undefined}
        writes={{ onSave: vi.fn(), onEdit: vi.fn(), onMerge: vi.fn(), onSaveSet }}
      />,
    )
    fireEvent.click(screen.getByRole('tab', { name: /Sets/ }))
    expect((screen.getByLabelText("The set's name") as HTMLInputElement).value).toBe('Plumbing for Fair Oaks Clinic')
    fireEvent.click(screen.getByRole('button', { name: 'Save the set' }))
    expect(onSaveSet).toHaveBeenCalledWith('Plumbing', 'Plumbing for Fair Oaks Clinic', ['Underground', 'Top out'], 'p1')
  })
})
