import { describe, expect, it } from 'vitest'
import { mercuryAccountsLine, parseMercuryCash } from './mercuryCash'

describe('parseMercuryCash', () => {
  it('reads the total and each account as the function sends them', () => {
    const c = parseMercuryCash({ ok: true, accounts: [{ id: 'a', name: 'Checking', kind: 'checking', currentBalance: 28_400.5, availableBalance: 28_000 }, { id: 'b', name: 'Savings', currentBalance: 3700 }], totalCurrentBalance: 32_100.5 }, '2026-10-10T18:00:00Z')
    expect(c.usd).toBe(32_100.5)
    expect(c.accounts).toEqual([
      { id: 'a', name: 'Checking', kind: 'checking', currentBalance: 28_400.5, availableBalance: 28_000 },
      { id: 'b', name: 'Savings', kind: null, currentBalance: 3700, availableBalance: 0 },
    ])
    expect(c.readAtIso).toBe('2026-10-10T18:00:00Z')
    expect(mercuryAccountsLine(c.accounts)).toBe('Checking $28.4k · Savings $3.7k')
    expect(mercuryAccountsLine([...c.accounts, { id: 'c', name: 'Checking ••5127', kind: 'checking', currentBalance: 0, availableBalance: 0 }, { id: 'd', name: 'Savings ••3203', kind: 'savings', currentBalance: 0.2, availableBalance: 0 }, { id: 'e', name: 'Checking ••8103', kind: 'checking', currentBalance: 21.87, availableBalance: 21.87 }])).toBe('Checking $28.4k · Savings $3.7k · Checking ••8103 $22 · 2 more at $0')
  })
  it('sums the accounts when the total is missing, and throws the function\'s own error', () => {
    expect(parseMercuryCash({ accounts: [{ currentBalance: 10 }, { currentBalance: 5 }] }, 'x').usd).toBe(15)
    expect(() => parseMercuryCash({ error: 'Forbidden — Banking access required' }, 'x')).toThrow('Forbidden — Banking access required')
    expect(parseMercuryCash(null, 'x')).toEqual({ usd: 0, accounts: [], readAtIso: 'x' })
  })
})
