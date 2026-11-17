import { describe, expect, it } from 'vitest'
import { bankCandidatesFor, methodOfBankKind, payeeIsHouse, supplyBankLineWords, supplyBankLines, unclaimedHeading, unclaimedHouseLines, type SupplyBankLine } from './supplyPaymentBank'

// Made-up houses and bank lines. The stamps are noon UTC, so the company's day is the same day.
const row = (id: string, amount: number, day: string, payee: string, over: Record<string, unknown> = {}) => ({ id, amount, posted_at: `${day}T18:00:00Z`, counterparty_name: payee, status: 'sent', kind: 'other', ...over })
const rows = [
  row('ach', -5000, '2026-11-12', 'PECAN SUPPLY'),
  row('card', -6768.83, '2026-11-13', 'Cedar Fork Plumbing', { kind: 'debitCardTransaction' }),
  row('failed', -6768.83, '2026-11-13', 'Cedar Fork Plumbing', { kind: 'debitCardTransaction', status: 'failed' }),
  row('in', 900, '2026-11-12', 'PECAN SUPPLY'),
  row('own', -5000, '2026-11-12', 'Checking', { kind: 'internalTransfer' }),
]
const bank = supplyBankLines(rows)
const day = (ymd: string) => `${Number(ymd.slice(5, 7))}/${Number(ymd.slice(8, 10))}`

describe('the feed as lines', () => {
  it('keeps money out that moved, and reads a card line as card and the rest as ACH', () => {
    expect(bank.map((b) => [b.id, b.amount, b.method])).toEqual([['ach', 5000, 'ach'], ['card', 6768.83, 'card']])
    expect(methodOfBankKind('debitCardTransaction')).toBe('card')
    expect(methodOfBankKind('creditCardTransaction')).toBe('card')
    expect(methodOfBankKind('other')).toBe('ach')
    expect(methodOfBankKind(null)).toBe('ach')
  })

  it('words a line', () => {
    expect(supplyBankLineWords(bank[0] as SupplyBankLine, day)).toBe('11/12 · PECAN SUPPLY · $5,000.00')
  })
})

describe('is this payee the house', () => {
  it('reads one name holding the other, and never a shared word alone', () => {
    expect(payeeIsHouse('Cedar Fork Plumbing', 'Cedar Fork')).toBe(true)
    expect(payeeIsHouse('PECAN SUPPLY ACH', 'Pecan Supply')).toBe(true)
    expect(payeeIsHouse('Pecan', 'Pecan Supply')).toBe(true)
    expect(payeeIsHouse('Juniper Pipe Co', 'Pecan Supply')).toBe(false)
    // Half the houses are "… Supply": a line to one is not a payment to another.
    expect(payeeIsHouse('Walnut Supply', 'Pecan Supply')).toBe(false)
    expect(payeeIsHouse('The Supply Company', 'Pecan Supply')).toBe(false)
    expect(payeeIsHouse('', 'Pecan Supply')).toBe(false)
    expect(payeeIsHouse('PECAN SUPPLY', 'PS')).toBe(false)
  })
})

describe('a payment is offered its bank line', () => {
  it('offers the same money within three days, the house’s own line first', () => {
    const twin: SupplyBankLine = { id: 'other', amount: 5000, ymd: '2026-11-12', payee: 'Juniper Pipe Co', memo: '', method: 'ach' }
    const found = bankCandidatesFor({ amount: 5000, paid_on: '2026-11-13' }, 'Pecan Supply', [twin, ...bank], new Set())
    expect(found.map((c) => [c.id, c.days, c.isHouse])).toEqual([['ach', 1, true], ['other', 1, false]])
  })

  it('offers nothing a cent off, past three days, or already taken', () => {
    expect(bankCandidatesFor({ amount: 5000.01, paid_on: '2026-11-12' }, 'Pecan Supply', bank, new Set())).toEqual([])
    expect(bankCandidatesFor({ amount: 5000, paid_on: '2026-11-16' }, 'Pecan Supply', bank, new Set())).toEqual([])
    expect(bankCandidatesFor({ amount: 5000, paid_on: '2026-11-12' }, 'Pecan Supply', bank, new Set(['ach']))).toEqual([])
    expect(bankCandidatesFor({ amount: 0, paid_on: '2026-11-12' }, 'Pecan Supply', bank, new Set())).toEqual([])
  })
})

describe('bank lines to a house that no payment claims', () => {
  const houses = [
    { id: 'h1', name: 'Pecan Supply' },
    { id: 'h2', name: 'Cedar Fork' },
    { id: 'h3', name: 'Cedar Fork Plumbing' },
  ]

  it('lists them newest first, under the house whose name fits best', () => {
    const found = unclaimedHouseLines(bank, houses, new Set(), new Set(), '2026-11-01')
    expect(found.map((u) => [u.line.id, u.houseName])).toEqual([['card', 'Cedar Fork Plumbing'], ['ach', 'Pecan Supply']])
  })

  it('leaves out a line a payment claims, one the Tally settled, one before the start day, and one to nobody we buy from', () => {
    expect(unclaimedHouseLines(bank, houses, new Set(['ach']), new Set(['card']), '2026-11-01')).toEqual([])
    expect(unclaimedHouseLines(bank, houses, new Set(), new Set(), '2026-11-13').map((u) => u.line.id)).toEqual(['card'])
    expect(unclaimedHouseLines(bank, [{ id: 'x', name: 'Juniper Pipe' }], new Set(), new Set(), '2026-11-01')).toEqual([])
  })

  it('words its heading by the count', () => {
    expect(unclaimedHeading(2)).toBe('2 bank lines to supply houses have no payment recorded')
    expect(unclaimedHeading(1)).toBe('1 bank line to a supply house has no payment recorded')
    expect(unclaimedHeading(0)).toBe('')
  })
})
