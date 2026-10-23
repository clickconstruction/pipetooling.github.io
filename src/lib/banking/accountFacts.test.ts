import { describe, expect, it } from 'vitest'
import {
  ACCOUNT_FACTS_FREQUENT_CAP,
  ACCOUNT_FACTS_NO_COUNTERPARTY,
  ACCOUNT_FACTS_RECENT_CAP,
  accountFactsFor,
  buildAccountFacts,
  emptyAccountFacts,
  formatMercuryAccountKind,
  indexMercuryAccounts,
  orderAccountsForNaming,
  type AccountFactsInputRow,
} from './accountFacts'

const OPS = 'ops-049bd408'
const PAYROLL = 'pay-4d651a50'
const CARDS = 'cards-8f49aca0'
const CLOSED = 'closed-c093bb40'
const TAXES = 'taxes-a21630f8'

/** A deterministic ledger: 400 rows over four accounts, dated across 2026, none alike. */
function makeLedger(): AccountFactsInputRow[] {
  let seed = 7
  const rand = () => {
    seed = (seed * 48271) % 2147483647
    return seed / 2147483647
  }
  const names = ['Hollis Supply', 'Ferguson', 'Gusto', 'Ridgeway Builders', 'Shell', null]
  const rows: AccountFactsInputRow[] = []
  const plan: Array<[string, number]> = [
    [OPS, 250],
    [PAYROLL, 90],
    [CARDS, 57],
    [CLOSED, 3],
  ]
  let n = 0
  for (const [account, count] of plan) {
    for (let i = 0; i < count; i++) {
      n += 1
      const day = 1 + Math.floor(rand() * 290)
      const d = new Date(Date.UTC(2026, 0, day, 12 + (n % 8)))
      const name = names[Math.floor(rand() * names.length)] ?? null
      const sign = rand() < 0.3 ? 1 : -1
      const amount = sign * Math.round(rand() * 500000) / 100
      rows.push({
        id: `tx-${String(n).padStart(4, '0')}`,
        mercury_account_id: account,
        amount,
        kind: sign > 0 ? 'incomingDomesticWire' : 'debitCardTransaction',
        counterparty_name: name,
        posted_at: n % 25 === 0 ? null : d.toISOString(),
        created_at: d.toISOString(),
      })
    }
  }
  return rows
}

describe('buildAccountFacts', () => {
  const rows = makeLedger()
  const facts = buildAccountFacts(rows)

  it('counts every row of every account and nothing else', () => {
    expect(rows).toHaveLength(400)
    expect([...facts.keys()].sort()).toEqual([CARDS, CLOSED, OPS, PAYROLL].sort())
    expect(accountFactsFor(facts, OPS).count).toBe(250)
    expect(accountFactsFor(facts, PAYROLL).count).toBe(90)
    expect(accountFactsFor(facts, CARDS).count).toBe(57)
    expect(accountFactsFor(facts, CLOSED).count).toBe(3)
  })

  it('sums the money in and the money out to the cent, out as a positive figure', () => {
    const ops = rows.filter((r) => r.mercury_account_id === OPS)
    const inUsd = Math.round(ops.filter((r) => r.amount > 0).reduce((s, r) => s + r.amount, 0) * 100) / 100
    const outUsd = Math.round(ops.filter((r) => r.amount < 0).reduce((s, r) => s - r.amount, 0) * 100) / 100
    const f = accountFactsFor(facts, OPS)
    expect(f.inUsd).toBe(inUsd)
    expect(f.outUsd).toBe(outUsd)
    expect(f.outUsd).toBeGreaterThan(0)
  })

  it('takes the first and last date from posted_at, falling back to created_at for a row that has not posted', () => {
    const ops = rows.filter((r) => r.mercury_account_id === OPS)
    const times = ops.map((r) => new Date(r.posted_at ?? r.created_at).getTime())
    const f = accountFactsFor(facts, OPS)
    expect(new Date(f.firstIso!).getTime()).toBe(Math.min(...times))
    expect(new Date(f.lastIso!).getTime()).toBe(Math.max(...times))
  })

  it('lists the newest lines first, capped, with the date, counterparty and amount of each', () => {
    const f = accountFactsFor(facts, OPS)
    expect(f.recent).toHaveLength(ACCOUNT_FACTS_RECENT_CAP)
    const ms = f.recent.map((l) => new Date(l.whenIso!).getTime())
    for (let i = 1; i < ms.length; i++) expect(ms[i - 1]).toBeGreaterThanOrEqual(ms[i]!)
    expect(ms[0]).toBe(new Date(f.lastIso!).getTime())
    const byId = new Map(rows.map((r) => [r.id, r]))
    for (const line of f.recent) {
      const src = byId.get(line.id)!
      expect(line.amount).toBe(src.amount)
      expect(line.counterparty).toBe(src.counterparty_name ?? ACCOUNT_FACTS_NO_COUNTERPARTY)
      expect(line.kind).toBe(src.kind)
    }
  })

  it('names the counterparties that recur most, most first, case-insensitive, capped', () => {
    const f = accountFactsFor(facts, OPS)
    expect(f.frequent).toHaveLength(ACCOUNT_FACTS_FREQUENT_CAP)
    for (let i = 1; i < f.frequent.length; i++) expect(f.frequent[i - 1]!.count).toBeGreaterThanOrEqual(f.frequent[i]!.count)
    const mixed = buildAccountFacts([
      row('a', 'x', 'Hollis Supply'),
      row('b', 'x', 'HOLLIS SUPPLY'),
      row('c', 'x', 'hollis supply'),
      row('d', 'x', 'Shell'),
    ])
    expect(accountFactsFor(mixed, 'x').frequent).toEqual([
      { name: 'Hollis Supply', count: 3 },
      { name: 'Shell', count: 1 },
    ])
  })

  it('a row with no counterparty counts under one plain label', () => {
    const f = buildAccountFacts([row('a', 'x', null), row('b', 'x', '  '), row('c', 'x', 'Shell')])
    expect(accountFactsFor(f, 'x').frequent[0]).toEqual({ name: ACCOUNT_FACTS_NO_COUNTERPARTY, count: 2 })
    expect(accountFactsFor(f, 'x').recent.map((l) => l.counterparty)).toContain(ACCOUNT_FACTS_NO_COUNTERPARTY)
  })

  it('answers the empty facts for an account with no rows, and skips rows with a blank account id', () => {
    expect(accountFactsFor(facts, TAXES)).toEqual(emptyAccountFacts(TAXES))
    const f = buildAccountFacts([{ ...row('a', ' ', 'Shell') }])
    expect(f.size).toBe(0)
  })

  it('keeps a stable order for rows posted the same minute, and sinks rows with no readable date', () => {
    const f = buildAccountFacts([
      { ...row('b', 'x', 'B'), posted_at: '2026-03-01T10:00:00.000Z' },
      { ...row('a', 'x', 'A'), posted_at: '2026-03-01T10:00:00.000Z' },
      { ...row('z', 'x', 'Z'), posted_at: 'not a date', created_at: 'not a date' },
    ])
    expect(accountFactsFor(f, 'x').recent.map((l) => l.id)).toEqual(['a', 'b', 'z'])
    expect(accountFactsFor(f, 'x').lastIso).toBe('2026-03-01T10:00:00.000Z')
    expect(accountFactsFor(f, 'x').firstIso).toBe('2026-03-01T10:00:00.000Z')
  })
})

describe('orderAccountsForNaming', () => {
  const rows = makeLedger()
  const facts = buildAccountFacts(rows)
  const nick = { [OPS]: 'Operating', [PAYROLL]: 'Payroll', [TAXES]: 'Tax set-aside' }

  it('puts the unnamed first, the busiest of them first, then the named by nickname', () => {
    const out = orderAccountsForNaming([TAXES, OPS, CLOSED, PAYROLL, CARDS], nick, facts)
    expect(out).toEqual([CARDS, CLOSED, OPS, PAYROLL, TAXES])
  })

  it('treats a blank nickname as unnamed, dedupes and drops blank ids', () => {
    const out = orderAccountsForNaming([OPS, OPS, ' ', CARDS], { [OPS]: '  ' }, facts)
    expect(out).toEqual([OPS, CARDS])
  })

  it('an unnamed account with no rows sits after the unnamed with rows, by id', () => {
    const out = orderAccountsForNaming(['zz-empty', 'aa-empty', CARDS], {}, facts)
    expect(out).toEqual([CARDS, 'aa-empty', 'zz-empty'])
  })
})

describe('formatMercuryAccountKind', () => {
  it('says Checking for mercury and capitalizes anything else', () => {
    expect(formatMercuryAccountKind('mercury')).toBe('Checking')
    expect(formatMercuryAccountKind('savings')).toBe('Savings')
    expect(formatMercuryAccountKind('treasury')).toBe('Treasury')
    expect(formatMercuryAccountKind('creditCard')).toBe('Credit card')
    expect(formatMercuryAccountKind('odd')).toBe('Odd')
    expect(formatMercuryAccountKind(null)).toBeNull()
    expect(formatMercuryAccountKind(' ')).toBeNull()
  })
})

describe('indexMercuryAccounts', () => {
  it('keys the list by trimmed id and drops entries with none', () => {
    const m = indexMercuryAccounts([
      { id: ' a1 ', name: 'Ops Checking', kind: 'mercury', currentBalance: 10 },
      { id: '', name: 'Ghost', kind: null, currentBalance: 0 },
    ])
    expect([...m.keys()]).toEqual(['a1'])
    expect(m.get('a1')?.name).toBe('Ops Checking')
  })
})

function row(id: string, account: string, counterparty: string | null): AccountFactsInputRow {
  return {
    id,
    mercury_account_id: account,
    amount: -10,
    kind: 'debitCardTransaction',
    counterparty_name: counterparty,
    posted_at: '2026-05-01T12:00:00.000Z',
    created_at: '2026-05-01T12:00:00.000Z',
  }
}
