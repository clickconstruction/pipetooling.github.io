// @vitest-environment jsdom
/**
 * Render smoke for v2.5806 (punch list #155): the Account nicknames modal draws one card per
 * Mercury account, the unnamed first and marked, with the name Mercury gives the account and
 * Use this name, the full id with Copy, the ledger's facts and newest lines, and Show in ledger.
 * Save, Clear and the empty-box rule are the page's; the modal only calls them.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { BankingAccountNicknamesModal } from './BankingAccountNicknamesModal'
import type { AccountFactsInputRow, MercuryListedAccount } from '../lib/banking/accountFacts'

vi.mock('../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

const OPS = '049bd408-77e2-4d1b-a6c5-2f3e4d5c6b7a'
const CARDS = '8f49aca0-5c1e-4b2a-9d33-7e8f60a1b2c3'
const CLOSED = 'c093bb40-1a7d-4f09-8e52-b4c6d7e8f901'
const TAXES = 'a21630f8-4c2d-4a1b-8e9f-6d5c4b3a2f10'

function tx(id: string, account: string, amount: number, counterparty: string, day: number): AccountFactsInputRow {
  const iso = new Date(Date.UTC(2026, 9, day, 15)).toISOString()
  return { id, mercury_account_id: account, amount, kind: amount > 0 ? 'incomingDomesticWire' : 'debitCardTransaction', counterparty_name: counterparty, posted_at: iso, created_at: iso }
}

const ROWS: AccountFactsInputRow[] = [
  tx('t1', OPS, 12400, 'Ridgeway Builders', 22),
  tx('t2', OPS, -9812.55, 'Gusto', 21),
  tx('t3', OPS, -1204.3, 'Hollis Supply', 20),
  tx('t4', OPS, -5000, 'Mercury transfer', 19),
  tx('t5', OPS, -88.12, 'Shell', 2),
  tx('t6', CARDS, -612.4, 'Hollis Supply', 21),
  tx('t7', CARDS, -1940, 'Ferguson', 17),
  tx('t8', CLOSED, 5000, 'Mercury transfer', 1),
]

const MERCURY: MercuryListedAccount[] = [
  { id: OPS, name: 'Ops Checking', kind: 'mercury', currentBalance: 38402.17 },
  { id: CARDS, name: 'Supply Cards', kind: 'mercury', currentBalance: 2114.6 },
  { id: TAXES, name: 'Taxes', kind: 'savings', currentBalance: 21000 },
]

function renderModal(over: Partial<Parameters<typeof BankingAccountNicknamesModal>[0]> = {}) {
  const onSave = vi.fn()
  const onClear = vi.fn()
  const onShowInLedger = vi.fn()
  const setNicknameDrafts = vi.fn()
  const onClose = vi.fn()
  const loadMercuryAccounts = vi.fn(async () => MERCURY)
  const utils = render(
    <BankingAccountNicknamesModal
      open
      onClose={onClose}
      accountIds={[TAXES, OPS, CLOSED, CARDS]}
      nicknameByAccount={{ [OPS]: 'Operating', [TAXES]: 'Tax set-aside' }}
      nicknameDrafts={{}}
      setNicknameDrafts={setNicknameDrafts}
      savingNicknameId={null}
      onSave={onSave}
      onClear={onClear}
      rows={ROWS}
      rowsComplete
      onShowInLedger={onShowInLedger}
      loadMercuryAccounts={loadMercuryAccounts}
      {...over}
    />,
  )
  return { ...utils, onSave, onClear, onShowInLedger, setNicknameDrafts, onClose, loadMercuryAccounts }
}

/** Settle before you assert: Mercury's list lands after the first paint, so wait for a card's line to fill. */
async function settled(cardId: string, text: RegExp) {
  await waitFor(() =>
    expect(within(screen.getByTestId(`account-nickname-card-${cardId}`)).getByTestId('account-nickname-mercury-line').textContent).toMatch(text),
  )
}

describe('BankingAccountNicknamesModal', () => {
  it('lists the unnamed first and marked, then the named by nickname, and reads Mercury once', async () => {
    const { loadMercuryAccounts } = renderModal()
    const cards = screen.getAllByTestId(/^account-nickname-card-/)
    expect(cards.map((c) => c.getAttribute('data-testid'))).toEqual([
      `account-nickname-card-${CARDS}`,
      `account-nickname-card-${CLOSED}`,
      `account-nickname-card-${OPS}`,
      `account-nickname-card-${TAXES}`,
    ])
    expect(cards[0]!.getAttribute('data-unnamed')).toBe('true')
    expect(cards[1]!.getAttribute('data-unnamed')).toBe('true')
    expect(cards[2]!.getAttribute('data-unnamed')).toBeNull()
    expect(within(cards[0]!).getByText('No nickname yet')).toBeTruthy()
    expect(screen.getByTestId('account-nicknames-scope').textContent).toContain("The facts come from the ledger's 8 loaded transactions. 2 accounts have no nickname yet and sit first.")
    await waitFor(() => expect(within(cards[2]!).getByText('Ops Checking')).toBeTruthy())
    expect(loadMercuryAccounts).toHaveBeenCalledTimes(1)
  })

  it("shows Mercury's name, kind and balance, and Use this name fills the box without saving", async () => {
    const { setNicknameDrafts, onSave } = renderModal()
    const card = screen.getByTestId(`account-nickname-card-${CARDS}`)
    await waitFor(() => expect(within(card).getByText('Supply Cards')).toBeTruthy())
    expect(within(card).getByTestId('account-nickname-mercury-line').textContent).toContain('Checking · balance $2,114.60')
    fireEvent.click(within(card).getByTestId('account-nickname-use-name'))
    expect(setNicknameDrafts).toHaveBeenCalledTimes(1)
    const updater = setNicknameDrafts.mock.calls[0]![0] as (d: Record<string, string>) => Record<string, string>
    expect(updater({})).toEqual({ [CARDS]: 'Supply Cards' })
    expect(onSave).not.toHaveBeenCalled()
  })

  it('says when Mercury no longer lists an account, and when the ledger holds nothing for one', async () => {
    renderModal()
    const closed = screen.getByTestId(`account-nickname-card-${CLOSED}`)
    await waitFor(() => expect(within(closed).getByTestId('account-nickname-mercury-line').textContent).toContain("Not on Mercury's account list"))
    expect(within(closed).queryByTestId('account-nickname-use-name')).toBeNull()
    const taxes = screen.getByTestId(`account-nickname-card-${TAXES}`)
    expect(within(taxes).getByTestId('account-nickname-facts').textContent).toBe('No transactions yet in the ledger.')
    expect((within(taxes).getByTestId('account-nickname-show-in-ledger') as HTMLButtonElement).disabled).toBe(true)
  })

  it("draws the ledger's facts and the newest lines, newest first", async () => {
    renderModal()
    await settled(OPS, /Ops Checking/)
    const ops = screen.getByTestId(`account-nickname-card-${OPS}`)
    const facts = within(ops).getByTestId('account-nickname-facts').textContent ?? ''
    expect(facts).toContain('5 transactions')
    expect(facts).toContain('Oct 2, 2026 to Oct 22, 2026')
    expect(facts).toContain('in $12,400.00')
    expect(facts).toContain('out $16,104.97')
    expect(facts).toContain('often Gusto ×1, Hollis Supply ×1, Mercury transfer ×1')
    const lines = within(ops).getAllByRole('listitem').map((li) => li.textContent)
    expect(lines).toHaveLength(4)
    expect(lines[0]).toContain('Ridgeway Builders')
    expect(lines[0]).toContain('+$12,400.00')
    expect(lines[1]).toContain('−$9,812.55')
    expect(within(ops).getByText(OPS)).toBeTruthy()
  })

  it('Copy puts the id on the clipboard and reads Copied; Show in ledger hands the id up', async () => {
    const writeText = vi.fn(async () => undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    const { onShowInLedger } = renderModal()
    await settled(OPS, /Ops Checking/)
    const ops = screen.getByTestId(`account-nickname-card-${OPS}`)
    fireEvent.click(within(ops).getByTestId('account-nickname-copy'))
    await waitFor(() => expect(within(ops).getByTestId('account-nickname-copy').textContent).toBe('Copied'))
    expect(writeText).toHaveBeenCalledWith(OPS)
    fireEvent.click(within(ops).getByTestId('account-nickname-show-in-ledger'))
    expect(onShowInLedger).toHaveBeenCalledWith(OPS)
  })

  it('Save and Clear call the page with the id; Clear is dead on an unnamed account; Enter saves', async () => {
    const { onSave, onClear } = renderModal()
    await settled(OPS, /Ops Checking/)
    const ops = screen.getByTestId(`account-nickname-card-${OPS}`)
    fireEvent.click(within(ops).getByRole('button', { name: 'Save' }))
    expect(onSave).toHaveBeenCalledWith(OPS)
    fireEvent.click(within(ops).getByRole('button', { name: 'Clear' }))
    expect(onClear).toHaveBeenCalledWith(OPS)
    const cards = screen.getByTestId(`account-nickname-card-${CARDS}`)
    expect((within(cards).getByRole('button', { name: 'Clear' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.keyDown(within(cards).getByLabelText(`Nickname for account ${CARDS}`), { key: 'Enter' })
    expect(onSave).toHaveBeenCalledWith(CARDS)
  })

  it('on a tab that did not load the whole ledger it says so and takes the exact counts', async () => {
    renderModal({ rowsComplete: false, exactCountByAccount: { [OPS]: 312, [TAXES]: 9 } })
    await settled(OPS, /Ops Checking/)
    expect(screen.getByTestId('account-nicknames-scope').textContent).toContain('This tab loaded 8 rows, not the whole ledger.')
    expect(within(screen.getByTestId(`account-nickname-card-${OPS}`)).getByTestId('account-nickname-facts').textContent).toContain('312 transactions')
    const taxes = screen.getByTestId(`account-nickname-card-${TAXES}`)
    expect(within(taxes).getByTestId('account-nickname-facts').textContent).toContain('9 transactions')
    expect(within(taxes).queryByRole('list')).toBeNull()
    expect(within(screen.getByTestId(`account-nickname-card-${CARDS}`)).getByTestId('account-nickname-facts').textContent).toContain('2 transactions on this tab')
  })

  it('tells the dev when Mercury could not be read, and the rest of the card stands', async () => {
    renderModal({ loadMercuryAccounts: vi.fn(async () => { throw new Error('Forbidden — Banking access required') }) })
    const ops = screen.getByTestId(`account-nickname-card-${OPS}`)
    await waitFor(() => expect(within(ops).getByTestId('account-nickname-mercury-line').textContent).toContain("Could not read Mercury's account list: Forbidden"))
    expect(within(ops).getByTestId('account-nickname-facts').textContent).toContain('5 transactions')
  })
})
