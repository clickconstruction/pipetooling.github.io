// @vitest-environment jsdom
/**
 * Render smoke for Banking → User review → a cell's ledger (punch list #184, sweep A, PR 2):
 * *Unassign 3 shown* goes on past a row that fails, names that row with the reason, and
 * *Try it again ▸* runs the same press on just that row.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import type { Database } from '../../types/database'
import { BankingMercuryUserReviewLedgerModal } from './BankingMercuryUserReviewLedgerModal'

type MercuryTxRow = Database['public']['Tables']['mercury_transactions']['Row']

const setAttribution = vi.fn(async (o: { mercuryTransactionId: string }) => {
  if (o.mercuryTransactionId === 'tx-b') throw { message: 'new row violates row-level security policy', code: '42501' }
})
vi.mock('../../lib/mercurySetUserAttribution', () => ({
  mercurySetTransactionAttribution: (o: { mercuryTransactionId: string }) => setAttribution(o),
}))
vi.mock('../../lib/fetchMercuryTransactionRaws', () => ({
  fetchMercuryUserReviewTxMetaByTxIds: async () => new Map(),
}))
vi.mock('../SearchableSelect', () => ({
  SearchableSelect: (p: { listAriaLabel?: string; onChange: (v: string) => void }) => <select aria-label={p.listAriaLabel} onChange={(e) => p.onChange(e.target.value)} />,
}))

afterEach(() => {
  cleanup()
  setAttribution.mockClear()
})

const row = (id: string, counterparty: string, amount: number) =>
  ({ id, counterparty_name: counterparty, amount, posted_at: '2026-10-03T15:00:00Z', kind: 'debitCardTransaction', mercury_account_id: '11111111-2222-3333-4444-555555555555', raw: null, mercury_category: null }) as unknown as MercuryTxRow

describe('the ledger’s bulk unassign', () => {
  it('names the row that did not update, and Try again runs just that row', async () => {
    const onChanged = vi.fn()
    renderWithProviders(
      <BankingMercuryUserReviewLedgerModal
        open
        onClose={() => {}}
        rowName="Marisol"
        columnName="October"
        rows={[row('tx-a', 'Vance Hardware', -120), row('tx-b', 'Pruett Supply', -45.5), row('tx-c', 'Ridgeway Fuel', -60)]}
        totalAmount={-225.5}
        nicknameCtx={{ nicknameByDebitCard: {}, nicknameByAccount: {} } as never}
        attributionOptions={[]}
        currentAttributionValue="u:marisol"
        recentPersonPicksStorageKey={null}
        onAttributionChanged={onChanged}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Unassign 3 shown' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Unassign' }))
    const failed = await waitFor(() => {
      const el = document.querySelector('[data-ledger-bulk-failed]')
      if (!el) throw new Error('no failed list yet')
      return el
    })
    expect(setAttribution).toHaveBeenCalledTimes(3)
    expect(failed.textContent).toContain('1 transaction did not update. It stays here with the reason.')
    expect(failed.textContent).toContain('Pruett Supply · Oct 3, 2026 · -$45.50')
    setAttribution.mockImplementationOnce(async () => {})
    fireEvent.click(screen.getByRole('button', { name: 'Try it again ▸' }))
    await waitFor(() => expect(document.querySelector('[data-ledger-bulk-failed]')).toBeNull())
    expect(setAttribution.mock.calls[setAttribution.mock.calls.length - 1]?.[0]).toMatchObject({ mercuryTransactionId: 'tx-b', userId: null, personId: null })
    expect(onChanged).toHaveBeenCalledTimes(2)
  })
})
