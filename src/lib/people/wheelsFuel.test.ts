import { describe, expect, it } from 'vitest'
import type { CardChargeWindowRow } from '../banking/cardChargesWindow'
import { buildCategoryTagLookups, type CategoryTagRow } from '../banking/categoryTags'
import { wheelsCardLabel, wheelsFuelFromSpending } from './wheelsFuel'

/**
 * Wheels' fuel by person over People → Spending's kernel (v2.6671). The rollup's own suite holds
 * the rule; this pins what Wheels reads off it: a held card's fuel with no attribution is the
 * holder's, an attribution wins over the holder, a card with no holder is listed by card, a company
 * card's fuel is set aside by card unless someone is attributed, a refund comes off, an Internal
 * Transfer is not fuel, and a person record with no login cannot reach a row.
 */
let seq = 0
function charge(over: Partial<CardChargeWindowRow> & { amount: number }): CardChargeWindowRow {
  seq += 1
  return {
    id: `tx-${seq}`,
    postedAt: '2026-09-10T15:00:00Z',
    purchasedAt: '2026-09-10T03:00:00Z',
    counterpartyName: 'Shell',
    kind: 'debitCardTransaction',
    status: 'sent',
    bankCategory: 'Gas Stations',
    debitCardId: 'card-a',
    cardNickname: null,
    cardRole: null,
    holderUserId: 'u-ana',
    holderName: 'Ana',
    attributedUserId: null,
    attributedPersonId: null,
    labelId: null,
    labelDefaultKey: null,
    payrollMarked: false,
    splits: [],
    invoiceLinks: [],
    sortedAt: null,
    sortedByName: null,
    viewerCanSort: true,
    ...over,
  }
}
const tag = (over: Partial<CategoryTagRow>): CategoryTagRow => ({ id: 't', name: 'Tag', icon: '🏷', color: 'gray', sort_order: 1, default_key: null, show_as_cost_line: false, hide_from_picker: false, ...over } as CategoryTagRow)
const lookups = buildCategoryTagLookups(
  [tag({ id: 'tag-fuel', name: 'Fuel & gas', icon: '⛽', default_key: 'fuel_vehicle' }), tag({ id: 'tag-meals', name: 'Meals' })],
  [
    { tag_id: 'tag-fuel', bank_category: 'Gas Stations', label_id: null },
    { tag_id: 'tag-fuel', bank_category: null, label_id: 'lbl-fuel' },
    { tag_id: 'tag-meals', bank_category: 'Restaurants', label_id: null },
  ],
)
const directory = {
  userNameById: new Map([['u-ana', 'Ana'], ['u-bob', 'Bob']]),
  personById: new Map([['p-cy', { name: 'Cy', accountUserId: null }], ['p-bob', { name: 'Bob', accountUserId: 'u-bob' }]]),
}

describe('wheelsFuelFromSpending', () => {
  it('gives a held card’s fuel to the holder, an attribution to its person, and lists fuel that reaches no login by card', () => {
    const fuel = wheelsFuelFromSpending({
      lookups,
      fuelTagId: 'tag-fuel',
      directory,
      charges: [
        charge({ amount: -60 }), // Ana's card, nobody attributed → Ana, by the card (the follow-up's point)
        charge({ amount: -35, attributedUserId: 'u-bob' }), // on Ana's card but Bob's fill-up → Bob
        charge({ amount: -22, attributedPersonId: 'p-bob' }), // a person record linked to Bob's login → Bob
        charge({ amount: 10, kind: 'other' }), // a refund to Ana's card comes off
        charge({ amount: -40, debitCardId: 'card-b', cardNickname: 'Truck 2 card', holderUserId: null, holderName: null, bankCategory: 'Restaurants', labelId: 'lbl-fuel' }), // fuel by label; no holder → by card
        charge({ amount: -18, debitCardId: 'card-c', holderUserId: null, holderName: null, attributedPersonId: 'p-cy' }), // a person record with no login cannot reach a row
        charge({ amount: -25, debitCardId: 'card-gps', cardRole: 'company', holderUserId: null, holderName: null }), // a company card: set aside
        charge({ amount: -9, debitCardId: 'card-gps', cardRole: 'company', holderUserId: null, holderName: null, attributedUserId: 'u-ana' }), // …unless someone is attributed
        charge({ amount: -30, bankCategory: 'Restaurants' }), // meals: not fuel
        charge({ amount: -20, labelId: 'lbl-other' }), // labelled into no tag: the label outranks the bank's guess
        charge({ amount: -500, labelId: 'lbl-transfer', labelDefaultKey: 'internal_transfer' }), // an Internal Transfer is not spend
      ],
    })
    expect([...fuel.fuelByUser.entries()].sort()).toEqual([
      ['u-ana', 59], // 60 − 10 + 9
      ['u-bob', 57],
    ])
    expect(fuel.unattributedUsd).toBe(58)
    expect(fuel.unattributedCards).toEqual([
      { cardId: 'card-b', label: 'Truck 2 card', usd: 40, n: 1 },
      { cardId: 'card-c', label: 'card …ardc', usd: 18, n: 1 },
    ])
    expect(fuel.companyCardSpend).toEqual({ usd: 25, n: 1, byCard: [{ cardId: 'card-gps', label: 'card …dgps', usd: 25, n: 1 }] })
  })

  it('with no fuel tag everything is empty; with no directory the holder still counts, named or not', () => {
    const charges = [charge({ amount: -60 })]
    expect(wheelsFuelFromSpending({ lookups, fuelTagId: null, directory, charges })).toEqual({
      fuelByUser: new Map(),
      unattributedUsd: 0,
      unattributedCards: [],
      companyCardSpend: { usd: 0, n: 0, byCard: [] },
    })
    expect(wheelsFuelFromSpending({ lookups, fuelTagId: 'tag-fuel', charges }).fuelByUser.get('u-ana')).toBe(60)
  })

  it('labels a card by its nickname, else its last four, and "no card" without one', () => {
    expect(wheelsCardLabel('bb2cfabe-74ac-11f0-bf2b-cf8ecc6de40f', 'Jonathan 4692')).toBe('Jonathan 4692')
    expect(wheelsCardLabel('11e42d2c-8f7e-11f1-aa2d-7fe8c2f61158', '  ')).toBe('card …1158')
    expect(wheelsCardLabel(null, null)).toBe('no card')
  })
})
