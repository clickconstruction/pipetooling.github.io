// @vitest-environment jsdom
/**
 * The Job window's parts block counts card charges by Jobs → Job Summary's rule
 * (v2.2692): the Card charges total leaves an Internal Transfer out and counts a
 * charge that is also on a supply invoice once (under the invoice), and the
 * line itself says why it is not in the total.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithProviders, useAuthModuleMock } from '../../test/renderSmokeMocks'
import { JobDetailMaterialsCostSection } from './JobDetailMaterialsCostSection'
import type { JobMaterialsCostSnapshot } from '../../lib/fetchJobMaterialsCostSnapshot'

vi.mock('../../hooks/useAuth', async () => useAuthModuleMock())
vi.mock('../../hooks/useMercuryLedgerNicknames', () => ({
  useMercuryLedgerNicknames: () => ({ nicknameByDebitCard: {} }),
}))

const line = (id: string, amount: number, counterpartyName: string, note: string | null = null) => ({
  id,
  mercuryTransactionId: `tx-${id}`,
  allocationAmount: amount,
  note,
  postedAt: '2026-09-02T15:00:00Z',
  counterpartyName,
  debitCardId: null,
})

const snapshot = (over: Partial<JobMaterialsCostSnapshot> = {}): JobMaterialsCostSnapshot => ({
  supplyInvoiceTotal: 0,
  supplyInvoiceRpcFailed: false,
  supplyInvoiceLines: [],
  mercuryAllocLines: [line('buy', -100, 'Ferguson'), line('transfer', -500, 'Mercury'), line('invoiced', -40, 'Morrison', 'PVC')],
  mercuryFetchFailed: false,
  cardExclusions: {
    bucketByTxId: new Map([['tx-transfer', 'internal_transfer']]),
    invoiceLinkedTxIds: new Set(['tx-invoiced']),
  },
  tallyPartLines: [],
  tallyFetchFailed: false,
  ...over,
})

function cardRow() {
  const title = screen.getByText('Card charges')
  const row = title.closest('button') ?? title.parentElement
  if (!row) throw new Error('no Card charges row')
  return row
}

describe('Job window — Card charges by Job Summary’s rule', () => {
  it('totals what the job cost, not every line attached', () => {
    renderWithProviders(<JobDetailMaterialsCostSection loading={false} snapshot={snapshot()} canExpand billedMaterials={[]} />)
    expect(cardRow().textContent).toContain('100.00')
    expect(cardRow().textContent).not.toContain('640.00')
  })

  it('says on each line left out why it is not in the total', () => {
    renderWithProviders(<JobDetailMaterialsCostSection loading={false} snapshot={snapshot()} canExpand billedMaterials={[]} />)
    fireEvent.click(cardRow())
    const notes = screen.getAllByTestId('card-line-not-counted').map((n) => n.textContent)
    expect(notes).toEqual(['Internal Transfer — not a job cost', 'Also on a supply-house invoice — counted there'])
    // The allocation's own note stays beside the reason.
    expect(screen.getByText('PVC')).toBeTruthy()
  })

  it('without the lookups every line counts, as before', () => {
    renderWithProviders(
      <JobDetailMaterialsCostSection loading={false} snapshot={snapshot({ cardExclusions: undefined })} canExpand billedMaterials={[]} />,
    )
    expect(cardRow().textContent).toContain('640.00')
    fireEvent.click(cardRow())
    expect(screen.queryAllByTestId('card-line-not-counted')).toHaveLength(0)
  })

  it('marks a fuel charge with its tag and names the fuel in the Card charges row', () => {
    const fuel = { id: 'fuel', name: 'Fuel & gas', icon: '⛽', color: 'amber' as const, sort_order: 1, default_key: 'fuel', show_as_cost_line: true, hide_from_picker: false }
    renderWithProviders(
      <JobDetailMaterialsCostSection
        loading={false}
        snapshot={snapshot({
          mercuryAllocLines: [line('buy', -100, 'Ferguson'), line('gas', -60, 'Shell')],
          cardExclusions: undefined,
          cardCostLines: [{ tagId: 'fuel', name: 'Fuel & gas', icon: '⛽', color: 'amber', usd: 60 }],
          cardTagByTxId: new Map([['tx-gas', fuel]]),
        })}
        canExpand
        billedMaterials={[]}
      />,
    )
    expect(cardRow().textContent).toContain('includes ⛽ Fuel & gas $60.00')
    expect(cardRow().textContent).toContain('160.00')
    fireEvent.click(cardRow())
    expect(screen.getAllByTestId('card-line-tag').map((t) => t.textContent)).toEqual(['⛽ Fuel & gas'])
  })
})
