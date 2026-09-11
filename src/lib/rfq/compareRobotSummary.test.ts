import { describe, expect, it } from 'vitest'

import { buildQuoteComparison, type CompareQuote } from './quoteCompare'
import { describeChoiceRange, describeIncomplete, robotColumnText, summarizeRobotWork } from './compareRobotSummary'
import { COMPONENT_ROLE_LABELS } from './quoteKits'

const money = (c: number) => `$${(c / 100).toFixed(2)}`

// NWS priced WC1&2 as a kit + carrier and picked it; a second house skipped the carrier.
// RPZ came as six sizes, none chosen. FD-1 was a plain line the estimator repicked herself.
const NWS: CompareQuote = {
  id: 'q-nws',
  supplyHouseId: 'h-nws',
  houseName: 'National Wholesale Supply',
  receivedAt: '2026-09-10T20:00:00Z',
  validUntil: '2026-09-04',
  lines: [
    { id: 'n1', fixture: 'WC1&2', unitPriceEachCents: 101000, cantSupply: false, componentRole: 'kit', picked: true, pickReason: 'cheapest complete kit', pickSource: 'robot' },
    { id: 'n2', fixture: 'WC1&2', unitPriceEachCents: null, cantSupply: false, componentRole: 'bowl', label: 'TOTO CT728CUVG#01', picked: true, pickSource: 'robot' },
    { id: 'n3', fixture: 'WC1&2', unitPriceEachCents: 33841, cantSupply: false, componentRole: 'carrier', label: 'Josam 12704', picked: true, pickSource: 'robot' },
    { id: 'r1', fixture: 'RPZ', unitPriceEachCents: 286485, cantSupply: false, optionGroup: 'size', optionLabel: '2½in' },
    { id: 'r2', fixture: 'RPZ', unitPriceEachCents: 368009, cantSupply: false, optionGroup: 'size', optionLabel: '4in' },
    { id: 'f1', fixture: 'FD-1', unitPriceEachCents: 11057, cantSupply: false, pickReason: 'only house quoted', pickSource: null },
  ],
}
const OTHER: CompareQuote = {
  id: 'q-o',
  supplyHouseId: 'h-o',
  houseName: 'Other House',
  receivedAt: '2026-09-10T21:00:00Z',
  lines: [
    { id: 'o1', fixture: 'WC1&2', unitPriceEachCents: 95000, cantSupply: false, componentRole: 'kit' },
    { id: 'o2', fixture: 'WC1&2', unitPriceEachCents: null, cantSupply: false, componentRole: 'bowl' },
    { id: 'o3', fixture: 'FD-1', unitPriceEachCents: 10900, cantSupply: false, picked: true, pickSource: 'human' },
  ],
}
const QTY = new Map([['wc1&2', 11], ['rpz', 1], ['fd-1', 3]])

describe('summarizeRobotWork', () => {
  const c = buildQuoteComparison({ quotes: [NWS, OTHER], currentQtyByName: QTY, today: '2026-09-10' })
  const s = summarizeRobotWork(c.rows)
  it('counts robot picks, human picks and overrules', () => {
    expect(s.robotPicked).toBe(1) // WC1&2
    expect(s.humanPicked).toBe(1) // FD-1
    expect(s.humanChanged).toBe(1) // FD-1 — the robot's reason sits on the NWS cell she did not pick
    expect(s.hasRobotWork).toBe(true)
  })
  it('lists rows that still need a choice and counts incomplete kits', () => {
    expect(s.needsChoice.map((r) => r.fixture)).toEqual(['RPZ'])
    expect(s.needsChoice[0]!.choices[0]!.options.map((o) => o.label)).toEqual(['2½in', '4in'])
    expect(s.incompleteCells).toBe(1) // Other House skipped the carrier
  })
  it('the Robot column reads the pick reason, the overrule, or the open choice', () => {
    const wc = c.rows.find((r) => r.fixture === 'WC1&2')!
    const rpz = c.rows.find((r) => r.fixture === 'RPZ')!
    const fd = c.rows.find((r) => r.fixture === 'FD-1')!
    expect(robotColumnText(wc)).toBe('cheapest complete kit')
    expect(robotColumnText(rpz)).toBe('needs your choice')
    expect(robotColumnText(fd)).toBe('you changed this · robot had: only house quoted')
    const other = wc.perHouse['h-o']!
    expect(describeIncomplete(other, (r) => COMPONENT_ROLE_LABELS[r as keyof typeof COMPONENT_ROLE_LABELS] ?? r)).toBe('missing carrier')
  })
})

describe('describeChoiceRange', () => {
  it('formats a range, a single price, or none', () => {
    expect(describeChoiceRange(12455, 27114, money)).toBe('$124.55 – $271.14')
    expect(describeChoiceRange(5000, 5000, money)).toBe('$50.00')
    expect(describeChoiceRange(null, null, money)).toBe('no prices')
  })
})
