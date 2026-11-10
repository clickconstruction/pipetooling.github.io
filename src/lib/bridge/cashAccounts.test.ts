import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { accountsOutText, buildCashAccounts, countedCash, flipAccountOut, parseAccountsOut, parseBankNicknames } from './cashAccounts'
import { parseMercuryCash } from './mercuryCash'

// Made-up accounts and balances.
const body = {
  ok: true,
  accounts: [
    { id: 'ops', name: 'Mercury Checking ••1111', nickname: 'Operating 1111', kind: 'checking', currentBalance: 28_400, availableBalance: 27_150 },
    { id: 'ap', name: 'Mercury Checking ••2222', nickname: ' Accounts Payable 2222 ', kind: 'checking', currentBalance: 12_400, availableBalance: 12_400 },
    { id: 'sav', name: 'Mercury Savings ••3333', nickname: null, kind: 'savings', currentBalance: 500, availableBalance: 500 },
    { id: 'old', name: 'Mercury Checking ••4444', kind: 'checking', currentBalance: 0, availableBalance: 0 },
  ],
  totalCurrentBalance: 41_300,
}
const bank = parseMercuryCash(body, '2026-11-10T16:00:00Z')
const names = parseBankNicknames(body)

describe('parseBankNicknames', () => {
  it('keeps the name each account was given in Mercury, trimmed, and skips the ones with none', () => {
    expect([...names]).toEqual([
      ['ops', 'Operating 1111'],
      ['ap', 'Accounts Payable 2222'],
    ])
    expect(parseBankNicknames(null).size).toBe(0)
    expect(parseBankNicknames({ accounts: [{ id: 'x', nickname: '  ' }, { nickname: 'No id' }, 7] }).size).toBe(0)
  })
})

describe('the saved choice', () => {
  it('reads a list of ids, each once and in order, and reads anything else as nothing left out', () => {
    expect(parseAccountsOut('["b","a","b"]')).toEqual(['a', 'b'])
    expect(parseAccountsOut(null)).toEqual([])
    expect(parseAccountsOut('')).toEqual([])
    expect(parseAccountsOut('not json')).toEqual([])
    expect(parseAccountsOut('{"a":1}')).toEqual([])
    expect(parseAccountsOut('["a", 4, ""]')).toEqual(['a'])
  })
  it('writes the same text for the same choice, and a switch flips one account', () => {
    expect(accountsOutText(['b', 'a', 'b'])).toBe('["a","b"]')
    expect(accountsOutText([])).toBe('[]')
    expect(flipAccountOut([], 'ap')).toEqual(['ap'])
    expect(flipAccountOut(['ap', 'sav'], 'ap')).toEqual(['sav'])
    expect(flipAccountOut(['sav'], 'ap')).toEqual(['ap', 'sav'])
  })
})

describe('buildCashAccounts', () => {
  it('lists every account by its own name, the fullest first, and counts them all by default', () => {
    const c = buildCashAccounts({ bank, names, out: [] })
    expect(c.rows.map((r) => [r.name, r.kind, r.usd, r.availableUsd, r.counted])).toEqual([
      ['Operating 1111', 'Checking', 28_400, 27_150, true],
      ['Accounts Payable 2222', 'Checking', 12_400, null, true],
      ['Mercury Savings ••3333', 'Savings', 500, null, true],
      ['Mercury Checking ••4444', 'Checking', 0, null, true],
    ])
    expect(c.wholeUsd).toBe(41_300)
    expect(c.countedUsd).toBe(41_300)
    expect(c.leftOutCount).toBe(0)
    expect(c.note).toBeNull()
    expect(c.lines).toEqual(['Every account counts toward cash on hand.', 'Switch one off to leave it out of the forecast.'])
  })

  it('leaves an account out of cash on hand and says so, and the row keeps its place', () => {
    const c = buildCashAccounts({ bank, names, out: ['ap'] })
    expect(c.rows.map((r) => r.id)).toEqual(['ops', 'ap', 'sav', 'old'])
    expect(c.rows.find((r) => r.id === 'ap')?.counted).toBe(false)
    expect(c.countedUsd).toBe(28_900)
    expect(c.leftOutUsd).toBe(12_400)
    expect(c.note).toBe('Leaves out Accounts Payable 2222, $12.4k.')
    expect(c.lines).toEqual(['Cash on hand is $28.9k. The whole bank holds $41.3k.', 'Bills still come off the forecast on the day they are due.'])
  })

  it('counts the accounts when more than one is left out, an empty one too, and ignores an id the bank no longer has', () => {
    const c = buildCashAccounts({ bank, names, out: ['ap', 'old', 'closed-long-ago'] })
    expect(c.leftOutCount).toBe(2)
    expect(c.countedUsd).toBe(28_900)
    expect(c.note).toBe('Leaves out 2 accounts, $12.4k.')
    // An empty account left out ahead of the money still says so.
    expect(buildCashAccounts({ bank, names, out: ['old'] }).note).toBe('Leaves out Mercury Checking ••4444, $0.')
  })

  it('writes plain words', () => {
    for (const out of [[], ['ap'], ['ap', 'sav']]) {
      const c = buildCashAccounts({ bank, names, out })
      for (const line of [...c.lines, c.note ?? '']) expect(plainWordsFailures(line), line).toEqual([])
    }
  })
})

describe('countedCash', () => {
  it('is the bank itself when nothing is left out, and the bank less the left-out accounts otherwise', () => {
    expect(countedCash(bank, [])).toBe(bank)
    expect(countedCash(bank, ['closed-long-ago'])).toBe(bank)
    const c = countedCash(bank, ['ap'])
    expect(c.usd).toBe(28_900)
    expect(c.accounts.map((a) => a.id)).toEqual(['ops', 'sav', 'old'])
    expect(c.readAtIso).toBe(bank.readAtIso)
  })
})
