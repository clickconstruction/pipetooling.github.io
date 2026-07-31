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

function renderSection(materials: MaterialRow[], handlers: Partial<{ add: () => void; remove: (id: string) => void }> = {}) {
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
      updateMaterialRow={() => {}}
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
