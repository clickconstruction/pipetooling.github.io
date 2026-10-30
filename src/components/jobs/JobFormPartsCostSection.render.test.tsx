// @vitest-environment jsdom
/**
 * Render tests for the Other job charges hide-until-summoned rows (v2.1143):
 * empty rows are hidden by default (just the ghost add button), "+ Add other
 * charge" reveals one, rows with content always show, and removing hides
 * drafts again.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithProviders, useAuthModuleMock } from '../../test/renderSmokeMocks'
import { JobFormPartsCostSection } from './JobFormPartsCostSection'
import type { MaterialRow } from '../../lib/jobs/jobFormTypes'

vi.mock('../../hooks/useAuth', async () => useAuthModuleMock())
vi.mock('../../hooks/useMercuryLedgerNicknames', () => ({
  useMercuryLedgerNicknames: () => ({ nicknameByDebitCard: {} }),
}))

function renderSection(
  materials: MaterialRow[],
  handlers: Partial<{ add: () => void; remove: (id: string) => void; update: (id: string, updates: Partial<MaterialRow>) => void }> = {},
) {
  return renderWithProviders(
    <JobFormPartsCostSection
      editing={null}
      materialsAccordionOpen="billed"
      toggleMaterialsAccordion={() => {}}
      jobMaterialsSnapshotLoading={false}
      supplyInvoiceTotal={0}
      supplyInvoiceRpcFailed={false}
      supplyInvoiceLines={[]}
      mercuryCardTotal={0}
      mercuryFetchFailed={false}
      mercuryAllocLines={[]}
      tallyPartsTotal={0}
      tallyFetchFailed={false}
      tallyPartLines={[]}
      billedMaterialsTotalDisplay="0.00"
      materials={materials}
      addMaterialRow={handlers.add ?? (() => {})}
      updateMaterialRow={handlers.update ?? (() => {})}
      removeMaterialRow={handlers.remove ?? (() => {})}
    />,
  )
}

const emptyRow = (id: string): MaterialRow => ({ id, description: '', amount: 0 })
const filledRow = (id: string, description: string, amount: number): MaterialRow => ({ id, description, amount })

describe('Other job charges — hide-until-summoned rows', () => {
  it('hides the empty row by default; the ghost button reveals it without appending', () => {
    const add = vi.fn()
    renderSection([emptyRow('a')], { add })
    expect(screen.queryByLabelText('Other charge description')).toBeNull()
    fireEvent.click(screen.getByText('+ Add other charge'))
    expect(add).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Other charge description')).toBeTruthy()
  })

  it('appends a row when no hidden empty row exists', () => {
    const add = vi.fn()
    renderSection([filledRow('a', 'Dump fee', 85)], { add })
    expect(screen.getByDisplayValue('Dump fee')).toBeTruthy()
    fireEvent.click(screen.getByText('+ Add other charge'))
    expect(add).toHaveBeenCalledTimes(1)
  })

  it('always shows rows with content and re-hides drafts after a remove', () => {
    const remove = vi.fn()
    renderSection([filledRow('a', 'Dump fee', 85), emptyRow('b')], { remove })
    // Content row visible, empty draft hidden.
    expect(screen.getByDisplayValue('Dump fee')).toBeTruthy()
    expect(screen.getAllByLabelText('Other charge description')).toHaveLength(1)
    // Summon the draft, then remove it — drafts hide again.
    fireEvent.click(screen.getByText('+ Add other charge'))
    expect(screen.getAllByLabelText('Other charge description')).toHaveLength(2)
    const trashes = screen.getAllByLabelText('Remove')
    const lastTrash = trashes[trashes.length - 1]
    if (!lastTrash) throw new Error('expected a trash button')
    fireEvent.click(lastTrash)
    expect(remove).toHaveBeenCalledWith('b')
    expect(screen.getAllByLabelText('Other charge description')).toHaveLength(1)
  })
})

describe('Where the money went — fuel as its own row (punch list #52)', () => {
  it('draws ⛽ Fuel & gas as its own row, taken out of the card charges', () => {
    renderWithProviders(
      <JobFormPartsCostSection
        editing={{ id: 'job-1' } as never}
        materialsAccordionOpen={null}
        toggleMaterialsAccordion={() => {}}
        jobMaterialsSnapshotLoading={false}
        supplyInvoiceTotal={0}
        supplyInvoiceRpcFailed={false}
        supplyInvoiceLines={[]}
        mercuryCardTotal={160}
        mercuryFetchFailed={false}
        mercuryAllocLines={[]}
        mercuryCardCostLines={[{ tagId: 'fuel', name: 'Fuel & gas', icon: '⛽', color: 'amber', usd: 60 }]}
        tallyPartsTotal={0}
        tallyFetchFailed={false}
        tallyPartLines={[]}
        billedMaterialsTotalDisplay="0.00"
        materials={[]}
        addMaterialRow={() => {}}
        updateMaterialRow={() => {}}
        removeMaterialRow={() => {}}
        teamLabor={{ loading: false, error: false, row: null, showOpenLink: false }}
        subLabor={{ loading: false, error: false, data: { count: 0, total: 0 }, effectiveHcp: '', showOpenLink: false }}
      />,
    )
    const table = screen.getByTestId('job-money-table')
    const rows = [...table.querySelectorAll('tbody tr')].map((tr) => tr.textContent ?? '')
    expect(rows.find((t) => t.startsWith('⛽ Fuel & gas'))).toContain('60.00')
    expect(rows.find((t) => t.startsWith('Other card charges'))).toContain('100.00')
    expect(rows[rows.length - 1]).toContain('160.00')
  })
})

describe('Other job charges read as money (punch list #215)', () => {
  const centsIn = (el: HTMLElement) => el.parentElement?.querySelector('[data-testid="money-cents"]')?.textContent ?? null

  it('blurred, the amount has commas and the cents drawn smaller; focused, it is the plain digits', () => {
    renderSection([filledRow('a', 'Permit fee', 39796.7)])
    const box = screen.getByLabelText('Other charge amount') as HTMLInputElement
    expect(box.value).toBe('39,796.70')
    expect(centsIn(box)).toBe('.70')
    fireEvent.focus(box)
    expect(box.value).toBe('39796.70')
    expect(centsIn(box)).toBeNull()
    fireEvent.blur(box)
    expect(box.value).toBe('39,796.70')
    expect(centsIn(box)).toBe('.70')
  })

  it('commits the typed amount as a number on each keystroke, commas allowed', () => {
    const update = vi.fn()
    renderSection([filledRow('a', 'Permit fee', 0)], { update })
    const box = screen.getByLabelText('Other charge amount')
    fireEvent.focus(box)
    fireEvent.change(box, { target: { value: '1,250.5' } })
    expect(update).toHaveBeenLastCalledWith('a', { amount: 1250.5 })
    fireEvent.change(box, { target: { value: '' } })
    expect(update).toHaveBeenLastCalledWith('a', { amount: 0 })
  })

  it('an ESTIMATE description wears the chip and shows the words after it, until its box has focus', () => {
    const update = vi.fn()
    renderSection([filledRow('a', 'ESTIMATE — Office overhead Q3 share', 12480.75)], { update })
    expect(screen.getByTestId('estimate-chip')).toBeTruthy()
    const desc = screen.getByLabelText('Other charge description') as HTMLInputElement
    expect(desc.value).toBe('Office overhead Q3 share')
    fireEvent.focus(desc)
    expect(desc.value).toBe('ESTIMATE — Office overhead Q3 share')
    expect(screen.queryByTestId('estimate-chip')).toBeNull()
    fireEvent.change(desc, { target: { value: 'ESTIMATE — Office overhead Q3 share, revised' } })
    expect(update).toHaveBeenLastCalledWith('a', { description: 'ESTIMATE — Office overhead Q3 share, revised' })
    fireEvent.blur(desc)
    expect(screen.getByTestId('estimate-chip')).toBeTruthy()
  })

  it('a plain description wears no chip, and the accordion total draws its cents smaller too', () => {
    renderSection([filledRow('a', 'Dump fee', 85)])
    expect(screen.queryByTestId('estimate-chip')).toBeNull()
    const cents = screen.getAllByTestId('money-cents').map((el) => el.textContent)
    expect(cents).toContain('.00')
    expect(cents).toContain('.00')
  })
})

describe('Other job charges carry a date and a memo (punch list #215, PR 2)', () => {
  it('shows the date box with the row’s date and commits a change or a clear', () => {
    const update = vi.fn()
    renderSection([{ id: 'a', description: 'Permit fee', amount: 1250, charged_on: '2026-10-02', memo: null }], { update })
    const date = screen.getByLabelText('Other charge date') as HTMLInputElement
    expect(date.value).toBe('2026-10-02')
    fireEvent.change(date, { target: { value: '2026-10-14' } })
    expect(update).toHaveBeenLastCalledWith('a', { charged_on: '2026-10-14' })
    fireEvent.change(date, { target: { value: '' } })
    expect(update).toHaveBeenLastCalledWith('a', { charged_on: null })
  })

  it('a memo shows under its row; a row without one offers + memo, which opens the line', () => {
    const update = vi.fn()
    renderSection(
      [
        { id: 'a', description: 'Permit fee', amount: 1250, charged_on: null, memo: 'Receipt in the job folder.' },
        { id: 'b', description: 'Dumpster', amount: 384.6 },
      ],
      { update },
    )
    expect(screen.getByDisplayValue('Receipt in the job folder.')).toBeTruthy()
    expect(screen.getAllByLabelText('Other charge memo')).toHaveLength(1)
    fireEvent.click(screen.getByLabelText('Add a memo to this charge'))
    const memos = screen.getAllByLabelText('Other charge memo')
    expect(memos).toHaveLength(2)
    const opened = memos[1]
    if (!opened) throw new Error('expected the summoned memo box')
    fireEvent.change(opened, { target: { value: 'Two pulls' } })
    expect(update).toHaveBeenLastCalledWith('b', { memo: 'Two pulls' })
  })

  it('summoning a charge row onto an empty row gives it today’s date', () => {
    const update = vi.fn()
    renderSection([emptyRow('a')], { update })
    fireEvent.click(screen.getByText('+ Add other charge'))
    expect(update).toHaveBeenCalledWith('a', { charged_on: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) })
  })
})
