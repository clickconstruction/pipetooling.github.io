// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { BridgeCashAccounts } from './BridgeCashAccounts'
import { buildCashAccounts, parseBankNicknames } from '../../lib/bridge/cashAccounts'
import { parseMercuryCash } from '../../lib/bridge/mercuryCash'

// Made-up accounts and balances.
const body = {
  accounts: [
    { id: 'ops', name: 'Mercury Checking ••1111', nickname: 'Operating 1111', kind: 'checking', currentBalance: 28_400, availableBalance: 27_150 },
    { id: 'ap', name: 'Mercury Checking ••2222', nickname: 'Accounts Payable 2222', kind: 'checking', currentBalance: 12_400, availableBalance: 12_400 },
    { id: 'sav', name: 'Mercury Savings ••3333', kind: 'savings', currentBalance: 0, availableBalance: 0 },
  ],
  totalCurrentBalance: 40_800,
}
const bank = parseMercuryCash(body, '2026-11-10T16:00:00Z')
const names = parseBankNicknames(body)

describe('BridgeCashAccounts', () => {
  it('lists every account with what it holds, each switched on, and flips the one pressed', () => {
    const onFlip = vi.fn()
    renderWithProviders(<BridgeCashAccounts accounts={buildCashAccounts({ bank, names, out: [] })} onFlip={onFlip} />)
    const rows = screen.getAllByTestId('bridge-cash-account')
    expect(rows.map((r) => r.textContent)).toEqual(['Operating 1111Checking, $27,150 free to spend$28,400', 'Accounts Payable 2222Checking$12,400', 'Mercury Savings ••3333Savings$0'])
    const ap = screen.getByRole('checkbox', { name: 'Count Accounts Payable 2222 in cash on hand' }) as HTMLInputElement
    expect(ap.checked).toBe(true)
    expect(screen.getByTestId('bridge-cash-accounts-words').textContent).toBe('Every account counts toward cash on hand. Switch one off to leave it out of the forecast.')
    fireEvent.click(ap)
    expect(onFlip).toHaveBeenCalledWith('ap')
  })

  it('marks an account left out, keeps its balance on the row, and says what cash on hand now is', () => {
    renderWithProviders(<BridgeCashAccounts accounts={buildCashAccounts({ bank, names, out: ['ap'] })} onFlip={() => {}} />)
    const ap = screen.getByRole('checkbox', { name: 'Count Accounts Payable 2222 in cash on hand' }) as HTMLInputElement
    expect(ap.checked).toBe(false)
    expect(screen.getAllByTestId('bridge-cash-account')[1]?.textContent).toBe('Accounts Payable 2222Left out$12,400')
    expect(screen.getByTestId('bridge-cash-accounts-words').textContent).toBe('Cash on hand is $28.4k. The whole bank holds $40.8k. Bills still come off the forecast on the day they are due.')
  })
})
