import { describe, expect, it } from 'vitest'
import type { ComparisonRow } from './manifest'
import type { CountDiff, Movement } from './onSite'
import { cannotFindPhoneRow, comparisonPhoneRow, countDiffPhoneRow, deliveryPhoneRow, historyPhoneRow, movementSign, movementWhereWords, pagePhoneRows, quietPartsLabel, SECTION_PHONE_PAGE, splitComparison } from './jobSectionsPhone'

const part = (over: Partial<ComparisonRow> = {}): ComparisonRow => ({ partKey: 'zz test elbow', partName: 'ZZ test elbow', manufacturer: null, bought: 100, addedOnSite: 0, used: 0, returned: 0, takenOrDamaged: 0, cannotFind: 0, left: 100, walkedAway: 0, money: null, lastCountAt: null, ...over })
const diff = (over: Partial<CountDiff> = {}): CountDiff => ({ movementId: 'm1', at: '2026-11-17T20:14:00Z', byName: 'Sam', containerId: 'c1', partKey: 'zz test elbow', partId: null, partName: 'ZZ test elbow', manufacturer: null, expected: 97, counted: 94, diff: -3, ...over })
const press = (over: Partial<Movement> = {}): Movement => ({ id: 'p1', jobId: 'j1', partId: null, partName: 'ZZ test elbow', manufacturer: null, quantity: 3, reason: 'used', fromContainerId: 'c1', toContainerId: null, note: '', byUserId: 'u1', byName: 'Sam', at: '2026-11-17T20:14:00Z', source: null, itemId: null, ...over }) as Movement
const labelOf = (id: string | null) => ({ c1: 'G12', c2: 'G13' })[id ?? ''] ?? (id ? 'a retired container' : '')

describe('Missing · what each part did', () => {
  it('a part nobody lost: bought and left, a green zero, nothing reported', () => {
    expect(comparisonPhoneRow(part())).toEqual({
      key: 'zz test elbow', title: 'ZZ test elbow', maker: '', figure: { figure: '0', words: 'walked away', tone: 'green' },
      held: 'bought 100 · left 100', reported: '', marked: false, money: null, noPrice: false, lastCountAt: null,
    })
  })

  it('what was reported is said in the table’s order, and a zero is left out as the table leaves it blank', () => {
    const r = comparisonPhoneRow(part({ addedOnSite: 4, used: 2, returned: 1, takenOrDamaged: 3, cannotFind: 1, left: 90 }))
    expect(r.reported).toBe('added on site 4 · used 2 · returned 1 · taken or damaged 3 · can’t find 1')
    expect(comparisonPhoneRow(part({ used: 12 })).reported).toBe('used 12')
  })

  it('what walked away is the figure, in amber, and the row is marked', () => {
    const r = comparisonPhoneRow(part({ left: 94, walkedAway: 6, money: 28.2, manufacturer: ' ZZ Maker ', lastCountAt: '2026-11-17T20:14:00Z' }))
    expect(r).toMatchObject({ maker: 'ZZ Maker', figure: { figure: '6', words: 'walked away', tone: 'amber' }, held: 'bought 100 · left 94', marked: true, money: 28.2, noPrice: false, lastCountAt: '2026-11-17T20:14:00Z' })
  })

  it('a part that walked away with no price says so, and one that did not walk says nothing about a price', () => {
    expect(comparisonPhoneRow(part({ walkedAway: 6, money: null })).noPrice).toBe(true)
    expect(comparisonPhoneRow(part({ walkedAway: 0, money: null })).noPrice).toBe(false)
  })

  it('big numbers keep their thousands mark', () => {
    expect(comparisonPhoneRow(part({ bought: 1250, left: 1100, walkedAway: 1150 }))).toMatchObject({ held: 'bought 1,250 · left 1,100', figure: { figure: '1,150' } })
  })
})

describe('Missing · what was reported', () => {
  it('a count that came up short: how many are missing, the box, what was expected and what was counted', () => {
    expect(countDiffPhoneRow(diff(), 'G12')).toEqual({
      key: 'm1', title: 'ZZ test elbow', maker: '', kind: 'short', figure: { figure: '3', words: 'missing', tone: 'amber' },
      facts: 'G12 · expected 97 · counted 94', moneyQty: -3, partKey: 'zz test elbow', boxId: 'c1', byName: 'Sam', at: '2026-11-17T20:14:00Z', note: '',
    })
  })

  it('a count that found more is a find, in blue, and its money is for what was found', () => {
    expect(countDiffPhoneRow(diff({ counted: 99, diff: 2 }), 'G12')).toMatchObject({ kind: 'found', figure: { figure: '2', words: 'found', tone: 'blue' }, facts: 'G12 · expected 97 · counted 99', moneyQty: 2 })
  })

  it('a box nobody can name leaves no gap in the line', () => {
    expect(countDiffPhoneRow(diff(), '').facts).toBe('expected 97 · counted 94')
  })

  it('a Can’t find press: its count in red, the box, its note, and money for what is gone', () => {
    expect(cannotFindPhoneRow(press({ id: 'p9', reason: 'cannot_find', quantity: 5, note: ' not in the cage ' }), 'G12', 'zz test elbow')).toEqual({
      key: 'p9', title: 'ZZ test elbow', maker: '', kind: 'cannot', figure: { figure: '5', words: 'can’t find', tone: 'red' },
      facts: 'G12', moneyQty: -5, partKey: 'zz test elbow', boxId: 'c1', byName: 'Sam', at: '2026-11-17T20:14:00Z', note: 'not in the cage',
    })
  })
})

describe('Came in · deliveries so far', () => {
  it('an invoice that landed: its name, when, who and how many lines, with its pieces as the figure', () => {
    expect(deliveryPhoneRow({ source: 'INV-48812', at: '2026-11-17T20:14:00Z', by: 'Sam', lines: 3, qty: 120 }, 'Mon 11/17 2:14 PM')).toEqual({
      key: 'INV-48812', title: 'INV-48812', facts: 'Mon 11/17 2:14 PM · Sam · 3 lines', figure: { figure: '120', words: 'pieces', tone: 'plain' },
    })
  })

  it('one line and one piece are singular', () => {
    expect(deliveryPhoneRow({ source: 'PO 12', at: '', by: 'Sam', lines: 1, qty: 1 }, 'Mon 11/17 2:14 PM')).toMatchObject({ facts: 'Mon 11/17 2:14 PM · Sam · 1 line', figure: { figure: '1', words: 'piece' } })
  })
})

describe('Used · every press', () => {
  it('signs a quantity as History does', () => {
    expect((['delivered', 'counted', 'moved', 'used', 'returned', 'taken', 'cannot_find', 'damaged'] as const).map(movementSign)).toEqual(['+', '', '', '−', '−', '−', '−', '−'])
  })

  it('says where each kind of press happened, in History’s own words', () => {
    expect(movementWhereWords(press({ reason: 'delivered', fromContainerId: null, toContainerId: 'c1', source: 'INV-48812' }), labelOf)).toBe('→ G12 · INV-48812')
    expect(movementWhereWords(press({ reason: 'delivered', fromContainerId: null, toContainerId: 'c1' }), labelOf)).toBe('→ G12')
    expect(movementWhereWords(press({ reason: 'moved', toContainerId: 'c2' }), labelOf)).toBe('G12 → G13')
    expect(movementWhereWords(press({ reason: 'returned' }), labelOf)).toBe('G12 → the supply house')
    expect(movementWhereWords(press({ reason: 'taken', note: 'Mateo’s truck' }), labelOf)).toBe('G12 → Mateo’s truck')
    expect(movementWhereWords(press({ reason: 'taken' }), labelOf)).toBe('G12 → off site')
    expect(movementWhereWords(press({ reason: 'used' }), labelOf)).toBe('G12')
    expect(movementWhereWords(press({ reason: 'counted', fromContainerId: 'gone' }), labelOf)).toBe('a retired container')
  })

  it('a press as a row: the part, what was done and where, a signed figure, who and the note', () => {
    expect(historyPhoneRow(press({ note: 'for the east wing' }), labelOf)).toEqual({
      key: 'p1', title: 'ZZ test elbow', what: 'Used', creditDue: false, where: 'G12', figure: { figure: '−3', words: '', tone: 'plain' }, byName: 'Sam', at: '2026-11-17T20:14:00Z', note: 'for the east wing',
    })
  })

  it('a return is owed a credit, a count is a plain number, and a delivery adds', () => {
    expect(historyPhoneRow(press({ reason: 'returned' }), labelOf)).toMatchObject({ what: 'Returned', creditDue: true, figure: { figure: '−3' } })
    expect(historyPhoneRow(press({ reason: 'counted', quantity: 94 }), labelOf)).toMatchObject({ what: 'Count', creditDue: false, figure: { figure: '94' } })
    expect(historyPhoneRow(press({ reason: 'delivered', quantity: 1250, fromContainerId: null, toContainerId: 'c1' }), labelOf)).toMatchObject({ what: 'Delivered', figure: { figure: '+1,250' } })
  })

  it('a take’s note is where it went, so it is said once', () => {
    expect(historyPhoneRow(press({ reason: 'taken', note: 'the shop' }), labelOf)).toMatchObject({ where: 'G12 → the shop', note: '' })
  })
})

describe('a long list, a screen at a time', () => {
  const list = (n: number) => Array.from({ length: n }, (_, i) => i)

  it('a short list is drawn whole, with no press', () => {
    expect(pagePhoneRows(list(12), SECTION_PHONE_PAGE)).toMatchObject({ left: 0, moreLabel: null })
    expect(pagePhoneRows(list(12), SECTION_PHONE_PAGE).rows).toHaveLength(12)
    expect(pagePhoneRows(list(60), SECTION_PHONE_PAGE)).toMatchObject({ left: 0, moreLabel: null })
  })

  it('a long list draws a page and its press says exactly how many it will add', () => {
    const first = pagePhoneRows(list(200), SECTION_PHONE_PAGE)
    expect(first.rows).toHaveLength(60)
    expect(first).toMatchObject({ left: 140, moreLabel: 'Show 60 more', next: 120 })
    const last = pagePhoneRows(list(200), 180)
    expect(last.rows).toHaveLength(180)
    expect(last).toMatchObject({ left: 20, moreLabel: 'Show the last 20', next: 240 })
    expect(pagePhoneRows(list(200), 240)).toMatchObject({ left: 0, moreLabel: null })
  })

  it('exactly one page left is the last', () => {
    expect(pagePhoneRows(list(120), 60).moreLabel).toBe('Show the last 60')
  })

  it('never draws fewer than a page, whatever it is asked for', () => {
    expect(pagePhoneRows(list(200), 0).rows).toHaveLength(60)
  })
})

describe('Missing · the parts with a gap lead', () => {
  it('splits the table’s rows into the ones with a gap and the rest, each in the table’s order', () => {
    const rows = [part({ partKey: 'a', walkedAway: 0 }), part({ partKey: 'b', walkedAway: 6 }), part({ partKey: 'c', walkedAway: 0 }), part({ partKey: 'd', walkedAway: 1 })]
    const { gap, quiet } = splitComparison(rows)
    expect(gap.map((r) => r.partKey)).toEqual(['b', 'd'])
    expect(quiet.map((r) => r.partKey)).toEqual(['a', 'c'])
  })

  it('the press that draws the rest says how many it will draw', () => {
    expect(quietPartsLabel(1)).toBe('Show 1 part with nothing walked away')
    expect(quietPartsLabel(104)).toBe('Show 104 parts with nothing walked away')
    expect(quietPartsLabel(1250)).toBe('Show 1,250 parts with nothing walked away')
  })
})
