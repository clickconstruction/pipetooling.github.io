import { describe, expect, it } from 'vitest'
import { buildCategoryTagLookups, type CategoryTagRow } from '../banking/categoryTags'
import { EMPTY_CARD_CHARGE_EXCLUSIONS } from './cardChargeAllocationFilter'
import { clampCostLinesToCounted, costLinesTotal, jobCardCostLines } from './jobCardCostLines'
import type { JobMercuryAllocLine } from '../../../supabase/functions/_shared/jobMaterialsCostLines'

const tag = (id: string, name: string, icon: string, sort_order: number, show_as_cost_line = true): CategoryTagRow => ({
  id,
  name,
  icon,
  color: 'amber',
  sort_order,
  default_key: null,
  show_as_cost_line,
  hide_from_picker: false,
})
const FUEL = tag('fuel', 'Fuel & gas', '⛽', 1)
const TOOLS = tag('tools', 'Tools', '🔧', 2)
const MEALS = tag('meals', 'Meals', '🍔', 3, false)
const lookups = buildCategoryTagLookups(
  [FUEL, TOOLS, MEALS],
  [
    { tag_id: 'fuel', bank_category: 'Fuel', label_id: null },
    { tag_id: 'fuel', bank_category: null, label_id: 'label-truck-fuel' },
    { tag_id: 'tools', bank_category: 'Hardware', label_id: null },
    { tag_id: 'meals', bank_category: 'Restaurants', label_id: null },
  ],
)

const line = (id: string, amount: number): JobMercuryAllocLine => ({
  id,
  mercuryTransactionId: `tx-${id}`,
  allocationAmount: amount,
  note: null,
  postedAt: null,
  counterpartyName: null,
  debitCardId: null,
})

describe('clampCostLinesToCounted', () => {
  it('takes each line out of what is left of the counted card charges, in order, and drops the empty ones', () => {
    const lines = clampCostLinesToCounted([FUEL, TOOLS], new Map([['fuel', 80], ['tools', 50]]), 100)
    expect(lines.map((l) => [l.tagId, l.usd])).toEqual([['fuel', 80], ['tools', 20]])
    expect(costLinesTotal(lines)).toBe(100)
  })

  it('draws nothing with no counted charges, a negative total, or no slices', () => {
    expect(clampCostLinesToCounted([FUEL], new Map([['fuel', 80]]), 0)).toEqual([])
    expect(clampCostLinesToCounted([FUEL], new Map([['fuel', 80]]), -30)).toEqual([])
    expect(clampCostLinesToCounted([FUEL], undefined, 100)).toEqual([])
    expect(clampCostLinesToCounted([FUEL], new Map([['fuel', -10]]), 100)).toEqual([])
  })
})

describe('jobCardCostLines', () => {
  const split = (over: Partial<Parameters<typeof jobCardCostLines>[0]> = {}) =>
    jobCardCostLines({
      lines: [line('gas', -60), line('labelled', -25), line('saw', -40), line('lunch', -15), line('pipe', -100)],
      exclusions: EMPTY_CARD_CHARGE_EXCLUSIONS,
      labelIdByTxId: new Map([['tx-labelled', 'label-truck-fuel']]),
      categoryByTxId: new Map<string, unknown>([
        ['tx-gas', 'Fuel'],
        ['tx-labelled', 'Restaurants'],
        ['tx-saw', { name: 'Hardware' }],
        ['tx-lunch', 'Restaurants'],
        ['tx-pipe', 'Building Supplies'],
      ]),
      lookups,
      tags: [FUEL, TOOLS],
      countedCardUsd: 240,
      ...over,
    })

  it('sorts each card charge into its cost line: the label’s tag first, else the bank category’s', () => {
    const { costLines, tagByTxId } = split()
    expect(costLines.map((l) => [l.name, l.usd])).toEqual([
      ['Fuel & gas', 85],
      ['Tools', 40],
    ])
    // A labelled charge goes by its label, whatever the bank called it.
    expect(tagByTxId.get('tx-labelled')?.id).toBe('fuel')
    expect(tagByTxId.get('tx-saw')?.id).toBe('tools')
    // A tag that is not a cost line, and a charge with no tag, get no marker.
    expect(tagByTxId.has('tx-lunch')).toBe(false)
    expect(tagByTxId.has('tx-pipe')).toBe(false)
  })

  it('a refund on the card comes off its line', () => {
    const { costLines } = split({ lines: [line('gas', -60), line('gas-back', 20)], categoryByTxId: new Map([['tx-gas', 'Fuel'], ['tx-gas-back', 'Fuel']]), countedCardUsd: 40 })
    expect(costLines.map((l) => l.usd)).toEqual([40])
  })

  it('an Internal Transfer is on no line', () => {
    const { costLines } = split({ exclusions: { bucketByTxId: new Map([['tx-gas', 'internal_transfer']]), invoiceLinkedTxIds: new Set() }, countedCardUsd: 180 })
    expect(costLines.map((l) => [l.tagId, l.usd])).toEqual([
      ['fuel', 25],
      ['tools', 40],
    ])
  })

  it('never draws more than the card charges that count', () => {
    const { costLines } = split({ countedCardUsd: 50 })
    expect(costLines.map((l) => [l.tagId, l.usd])).toEqual([['fuel', 50]])
  })

  it('a line with no transaction is on no line', () => {
    const { costLines } = split({ lines: [{ ...line('gas', -60), mercuryTransactionId: null }] })
    expect(costLines).toEqual([])
  })
})

describe('cardCostLinesSubtitle', () => {
  it('names each cost line inside the card charges, and nothing when there are none', async () => {
    const { cardCostLinesSubtitle } = await import('./jobCardCostLines')
    expect(cardCostLinesSubtitle([{ name: 'Fuel & gas', icon: '⛽', usd: 85 }, { name: 'Tools', icon: '🔧', usd: 0 }])).toBe('includes ⛽ Fuel & gas $85.00')
    expect(cardCostLinesSubtitle([])).toBeUndefined()
    expect(cardCostLinesSubtitle(undefined)).toBeUndefined()
  })
})
