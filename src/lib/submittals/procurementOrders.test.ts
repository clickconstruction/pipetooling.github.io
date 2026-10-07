import { describe, expect, it } from 'vitest'
import { groupDateWords, orderBySoon, orderSections, rowsToMark, tagsOf, theyWrote } from './procurementOrders'
import { row, spacexLater as later, spacexToday as today } from './procurementSpacex.fixtures'

describe('orderSections', () => {
  it('today: nothing to order; five parts sent back with their notes, fourteen fixtures waiting, the carriers on site under their PO', () => {
    const secs = orderSections(today, '2026-10-05')
    expect(secs.map((s) => [s.title, s.count, s.note])).toEqual([
      ['Sent back by the GC', 5, 'pick another product, then resubmit on step 7'],
      ['Waiting on their answer', 39, '14 fixtures · not ordered until they approve'],
      ['On site', 3, ''],
    ])
    expect(secs[0]!.rows.map(theyWrote)).toEqual(['They wrote “830AA”', 'They wrote “TEL145”', 'They wrote “KOHLER 2215-0”', 'They wrote “TEL145”', 'They wrote “TET2UA31#SS”'])
    const waiting = secs[1]!.groups
    expect(waiting.map((g) => g.title)).toEqual(['12" DEEP MOP SINK', 'DWH-1', 'EWC-1', 'FCO', 'FD', 'HB-3', 'LAV-1', 'LAV-2', 'UR-1, UR-2', 'UTILITY SINK', 'WC-1, WC-2', 'WHA-200', 'WHA-300', 'WHA-500'])
    // A fixture says what it is and how its parts split; one part shows the product; no product says so.
    const lav2 = waiting.find((g) => g.title === 'LAV-2')!
    expect(lav2).toMatchObject({ note: 'LAV2 × 6 · 1 part · 5 order only', count: 6, orderOnlyFrom: 1, right: '', answerItemId: 'it-LAV-2', openByDefault: false })
    expect(lav2.rows.map((r) => r.orderOnly)).toEqual([false, true, true, true, true, true])
    expect(waiting.find((g) => g.title === 'FCO')).toMatchObject({ note: 'PRODUCT fco', count: 1, orderOnlyFrom: null })
    expect(waiting.find((g) => g.title === 'UTILITY SINK')).toMatchObject({ noProduct: true, note: '', answerItemId: null })
    expect(secs[2]!.groups.map((g) => [g.title, g.count, g.note, g.right, g.rightTone])).toEqual([['PO space x carriers.', 3, 'EWC-1, UR-1, UR-2, WC-1, WC-2 · ordered 09/23', '✓ On site 09/29', 'done']])
  })

  it('three weeks on: five orders to place by date, two POs on order with the late one first', () => {
    const secs = orderSections(later, '2026-10-26')
    expect(secs.map((s) => [s.title, s.count, s.note, s.tone])).toEqual([
      ['Order now · National Wholesale', 15, '5 orders to place, by date', 'go'],
      ['On order', 4, '1 late', 'late'],
      ['Sent back by the GC', 3, 'pick another product, then resubmit on step 7', 'back'],
      ['Waiting on their answer', 20, '5 fixtures · the first needs an answer by 11/10', 'quiet'],
      ['On site', 5, '', 'done'],
    ])
    expect(secs[0]!.groups.map((g) => [g.title, g.soon, g.tone, g.count, g.note, g.openByDefault])).toEqual([
      ['Order by 10/27', 'tomorrow', 'soon', 6, '12" DEEP MOP SINK · Trim Set, needed 12/08 · 6 wk lead', true],
      ['Order by 11/03', '', 'go', 2, 'EWC-1 · Trim Set, needed 12/08 · 5 wk lead', false],
      ['Order by 11/10', '', 'go', 2, 'DWH-1 · Trim Set, needed 12/08 · 4 wk lead', false],
      ['Order by 11/24', '', 'go', 1, 'HB-3 · Trim Set, needed 12/08 · 2 wk lead', false],
      ['Order by 12/01', '', 'go', 4, 'EWC-1 · order only · Trim Set, needed 12/08 · 1 wk lead', false],
    ])
    // One fixture and one set of facts: a line names neither its tag nor its stage.
    expect(secs[0]!.groups[0]).toMatchObject({ showTag: false, showFacts: false })
    expect(secs[1]!.groups.map((g) => [g.title, g.count, g.note, g.right, g.rightTone, g.showTag])).toEqual([
      ['PO 4480', 1, 'WC-1, WC-2 · Rough In, needed 10/20 · 3 wk lead · ordered 10/08', 'Arrives 10/29, 9 d late', 'late', false],
      ['PO 4502', 3, 'WHA-200, WHA-300, WHA-500 · Top Out, needed 11/10 · 2 wk lead · ordered 10/20', 'Arrives 11/03', 'quiet', true],
    ])
    expect(secs[3]!.groups.find((g) => g.title === 'LAV-1')).toMatchObject({ right: 'answer by 11/10' })
    expect(secs[4]!.groups.map((g) => [g.title, g.note, g.right])).toEqual([
      ['PO space x carriers.', 'EWC-1, UR-1, UR-2, WC-1, WC-2 · ordered 09/23', '✓ On site 09/29'],
      ['PO 4471', 'FCO, FD · ordered 10/06', '✓ On site 10/15'],
    ])
  })

  it('an order-by date presses inside three days and is red once past; with no date the group says so, last', () => {
    expect(orderBySoon('2026-10-27', '2026-10-27')).toEqual({ words: 'today', tone: 'soon' })
    expect(orderBySoon('2026-10-27', '2026-10-24')).toEqual({ words: 'in 3 days', tone: 'soon' })
    expect(orderBySoon('2026-10-27', '2026-10-23')).toEqual({ words: '', tone: 'go' })
    expect(orderBySoon('2026-10-27', '2026-10-29')).toEqual({ words: '2 days ago', tone: 'past' })
    const secs = orderSections([row('a', 'released'), row('b', 'released', { orderBy: '2026-11-03', leadTimeDays: 7 })], '2026-10-26')
    expect(secs[0]!.groups.map((g) => [g.title, g.tone])).toEqual([['Order by 11/03', 'go'], ['No order-by date yet', 'quiet']])
  })

  it('two houses are two sections, the soonest first and no house last; parts that differ say their own facts; lines with no PO are one group', () => {
    const rows = [
      row('a', 'released', { supplyHouse: null, orderBy: '2026-10-28' }),
      row('b', 'released', { supplyHouse: 'Moore Supply', orderBy: '2026-11-20', stage: 'rough_in', leadTimeDays: 7 }),
      row('c', 'released', { supplyHouse: 'Moore Supply', orderBy: '2026-11-20', stage: 'trim_set', leadTimeDays: 14 }),
      row('d', 'released', { supplyHouse: 'National Wholesale', orderBy: '2026-11-03' }),
      row('e', 'ordered', { orderedOn: '2026-10-20' }),
      row('f', 'ordered', { orderedOn: '2026-10-21' }),
    ]
    const secs = orderSections(rows, '2026-10-26')
    expect(secs.map((s) => [s.title, s.note])).toEqual([
      ['Order now · National Wholesale', '1 order to place, by date'],
      ['Order now · Moore Supply', '1 order to place, by date'],
      ['Order now · no house yet', '1 order to place, by date · set a house to order'],
      ['On order', ''],
    ])
    expect(secs[1]!.groups[0]).toMatchObject({ note: 'b, c', showTag: true, showFacts: true })
    expect(secs[3]!.groups.map((g) => [g.title, g.count, g.note, g.right])).toEqual([['No PO', 2, 'e, f · Trim Set', '']])
  })

  it('v2.4663 · a draft nobody has shared: its fixtures sit under Not sent to the GC yet, with no door and no answer-by; a hand line still waits as its own; shared, the same lines wait on their answer', () => {
    const draft = today.filter((r) => r.status === 'awaiting').map((r) => ({ ...r, status: 'not_submitted' as const, submittal: 'none' as const, leadTimeDays: 28, requiredOn: '2026-12-08' }))
    const hand = row('hand:1', 'not_submitted', { isHand: true, tag: null, product: 'Grease interceptor 750 gal', itemId: null, submittal: 'none' })
    const secs = orderSections([...draft, hand], '2026-10-05', new Set(), 4)
    expect(secs.map((s) => [s.kind, s.title, s.count, s.note])).toEqual([
      ['waiting', 'Waiting on their answer', 1, '1 fixture · not ordered until they approve'],
      ['not_sent', 'Not sent to the GC yet', 38, '13 fixtures · share Rev 4 to get an answer'],
    ])
    const lav2 = secs[1]!.groups.find((g) => g.title === 'LAV-2')!
    expect(lav2).toMatchObject({ kind: 'fixture', note: 'LAV2 × 6 · 1 part · 5 order only', count: 6, right: '', answerItemId: null })
    expect(groupDateWords(lav2, '2026-10-05')).toEqual({ words: '', tone: 'quiet' })
    expect(secs[1]!.groups.every((g) => g.answerItemId === null && g.right === '')).toBe(true)
    // Once shared (no draft number) the same lines wait on the GC, with their doors and the answer-by date.
    const shared = orderSections([...draft, hand], '2026-10-05', new Set(), null)
    expect(shared.map((s) => [s.kind, s.count, s.note])).toEqual([['waiting', 39, '14 fixtures · the first needs an answer by 11/10']])
    expect(shared[0]!.groups.find((g) => g.title === 'LAV-2')).toMatchObject({ right: 'answer by 11/10', answerItemId: 'it-LAV-2' })
  })

  it('a group is new only when every part changed since the last update; before the first update nothing is', () => {
    expect(orderSections(later, '2026-10-26').flatMap((s) => s.groups).some((g) => g.isNew)).toBe(false)
    const changed = new Set(['part:h2', 'part:h3', 'part:h5', 'part:m1'].map((k) => (k === 'part:h2' ? 'WHA-200' : k === 'part:h3' ? 'WHA-300' : k === 'part:h5' ? 'WHA-500' : k)))
    const groups = orderSections(later, '2026-10-26', changed).flatMap((s) => s.groups)
    expect(groups.filter((g) => g.isNew).map((g) => g.title)).toEqual(['PO 4502'])
  })

  it('a line added by hand waits on nobody’s fixture: it stands as its own, with no answer door; two carriers are flagged', () => {
    const rows = [
      row('hand:1', 'not_submitted', { isHand: true, tag: null, product: 'Grease interceptor 750 gal', itemId: null, submittal: 'none' }),
      row('part:x', 'awaiting', { tag: 'WC-1', partKey: 'x', product: 'JOSAM 12694 closet carrier', itemId: 'it-wc' }),
      row('part:y', 'awaiting', { tag: 'WC-1', partKey: 'y', product: 'ZURN Z1201 carrier', itemId: 'it-wc' }),
    ]
    const groups = orderSections(rows, '2026-10-26')[0]!.groups
    expect(groups.map((g) => [g.title, g.note, g.warn, g.answerItemId])).toEqual([
      ['Grease interceptor 750 gal', 'added by hand', '', null],
      ['WC-1', '2 parts', 'Two carriers', 'it-wc'],
    ])
  })
})

describe('the small words', () => {
  it('a card says its order’s date in words: how far off an order-by date is, when a PO lands, when the GC must answer, when it landed', () => {
    const said = (asOf: string) => Object.fromEntries(orderSections(later, asOf).flatMap((sec) => sec.groups).map((g) => [g.title, groupDateWords(g, asOf)]))
    const on = said('2026-10-26')
    expect(on['Order by 10/27']).toEqual({ words: 'tomorrow', tone: 'soon' })
    expect(on['Order by 11/03']).toEqual({ words: 'in 8 days', tone: 'quiet' })
    expect(on['PO 4480']).toEqual({ words: 'arrives 10/29, 9 days late', tone: 'late' })
    expect(on['PO 4502']).toEqual({ words: 'arrives 11/03', tone: 'quiet' })
    expect(on['LAV-1']).toEqual({ words: 'answer by 11/10', tone: 'quiet' })
    expect(on['UR-1, UR-2']).toEqual({ words: '', tone: 'quiet' })
    expect(on['PO 4471']).toEqual({ words: '✓ On site 10/15', tone: 'done' })
    expect(said('2026-10-27')['Order by 10/27']).toEqual({ words: 'today', tone: 'soon' })
    expect(said('2026-10-30')['Order by 10/27']).toEqual({ words: '3 days ago', tone: 'past' })
    expect(groupDateWords({ kind: 'to_place', rows: [row('a', 'released')], right: '', rightTone: 'quiet', tone: 'quiet' }, '2026-10-26')).toEqual({ words: '', tone: 'quiet' })
  })

  it('tags are named up to three, then counted', () => {
    expect(tagsOf([row('FCO', 'awaiting'), row('FD', 'awaiting'), row('HB-3', 'awaiting'), row('X', 'awaiting'), row('Y', 'awaiting')])).toBe('FCO, FD, HB-3 +2')
    expect(tagsOf([row('a', 'awaiting', { tag: null, product: 'Lift station' })])).toBe('Lift station')
  })

  it('Mark ordered takes the ticked parts of the group, or the whole group when none are ticked', () => {
    const group = { rows: [row('a', 'released'), row('b', 'released'), row('c', 'released')] }
    expect(rowsToMark(group, new Set()).map((r) => r.key)).toEqual(['a', 'b', 'c'])
    expect(rowsToMark(group, new Set(['b', 'zz'])).map((r) => r.key)).toEqual(['b'])
  })

  it('a part sent back says what they wrote, or that they wrote nothing', () => {
    expect(theyWrote({ reviewNote: ' TEL145 ' })).toBe('They wrote “TEL145”')
    expect(theyWrote({ reviewNote: null })).toBe('No note from them')
  })
})
