import { describe, expect, it } from 'vitest'
import { blockersPress, procurementNextLine, procurementSteps, rowsForStep, sendUpdateLabel, sharedHouse, stepOfRow, stepOnlyWords, stepShares } from './procurementBoard'
import { orderBlockers } from './procurementLog'
import { row, spacexLater, spacexToday } from './procurementSpacex.fixtures'

const today = spacexToday
const later = spacexLater

describe('procurementSteps', () => {
  it('today: 44 wait on the GC with 5 sent back, nothing to order or on order, 3 on site; every line is counted once', () => {
    const steps = procurementSteps(today)
    expect(steps.map((s) => [s.label, s.count, s.note, s.tone])).toEqual([
      ['Waiting on the GC', 44, '5 sent back', 'back'],
      ['To order', 0, 'nothing approved yet', 'quiet'],
      ['On order', 0, '', 'quiet'],
      ['On site', 3, 'last 09/29', 'quiet'],
    ])
    expect(steps.reduce((n, s) => n + s.count, 0)).toBe(today.length)
  })

  it('three weeks on: 23 · 15 · 4 · 5, the first order by 10/27, one late on order, the last on site 10/15', () => {
    expect(procurementSteps(later).map((s) => [s.count, s.note, s.tone])).toEqual([
      [23, '3 sent back', 'back'],
      [15, 'first by 10/27', 'go'],
      [4, '1 late', 'late'],
      [5, 'last 10/15', 'quiet'],
    ])
  })

  it('a delivered part is on site only, though it holds an order date; on order with nothing late says the next arrival', () => {
    expect(stepOfRow(row('x', 'delivered', { orderedOn: '2026-10-06', deliveredOn: '2026-10-15' }))).toBe('on_site')
    expect(procurementSteps(later.filter((r) => r.key !== 'part:w4'))[2]).toMatchObject({ count: 3, note: 'next arrives 11/03', tone: 'quiet' })
    // Approved parts with no order-by date yet: counted, with nothing to say under the number.
    expect(procurementSteps([row('a', 'released')])[1]).toMatchObject({ count: 1, note: '', tone: 'quiet' })
  })

  it('v2.4663 · a draft nobody has shared: the first step reads Not sent yet · Share Rev 4 first, the pill the same; a line sent back takes the note; one line the GC holds makes it Waiting on the GC again; a hand line is never "unsent"', () => {
    const draft = today.filter((r) => r.status !== 'sent_back').map((r) => (r.status === 'awaiting' ? { ...r, status: 'not_submitted' as const, submittal: 'none' as const } : r))
    const steps = procurementSteps(draft, 4)
    expect(steps[0]).toMatchObject({ key: 'gc', label: 'Not sent yet', count: 39, note: 'Share Rev 4 first', tone: 'quiet' })
    expect(stepOnlyWords('gc', 39, steps[0]!.label)).toEqual({ lead: 'Not sent yet: 39 parts.', rest: 'The other lines are hidden.' })
    expect(procurementNextLine(draft, '2026-10-05', 4)).toEqual(['Nothing can be ordered until the GC answers.', 'Share Rev 4 first. 39 parts have not been sent.'])
    // Two lines carried sent back onto the draft: the note is theirs, the Next line says both.
    const withBack = [...draft, ...today.filter((r) => r.status === 'sent_back').slice(0, 2)]
    expect(procurementSteps(withBack, 4)[0]).toMatchObject({ label: 'Not sent yet', count: 41, note: '2 sent back', tone: 'back' })
    expect(procurementNextLine(withBack, '2026-10-05', 4)).toEqual(['Nothing can be ordered until the GC answers.', 'They sent 2 parts back.', 'Share Rev 4 first. 39 parts have not been sent.'])
    // The same lines once the revision is shared (no draft number): the GC is waiting, as before.
    expect(procurementSteps(draft, null)[0]).toMatchObject({ label: 'Waiting on the GC', count: 39, note: '' })
    expect(procurementNextLine(draft, '2026-10-05', null)).toEqual(['Nothing can be ordered until the GC answers.', '39 parts wait on their answer.'])
    // One line the GC holds among the unsent (BP398: Rev 3 lines beside new Rev 4 ones): they are waiting, so the step keeps its name and counts the unsent under it.
    expect(procurementSteps([...draft, row('z', 'awaiting')], 4)[0]).toMatchObject({ label: 'Waiting on the GC', count: 40, note: '39 not sent yet', tone: 'quiet' })
    expect(procurementNextLine([...draft, row('z', 'awaiting')], '2026-10-05', 4)).toEqual(['Nothing can be ordered until the GC answers.', '1 part waits on their answer.', 'Share Rev 4 first. 39 parts have not been sent.'])
    // A hand line is never sent to the GC, so a draft of one hand line is not "unsent".
    expect(procurementSteps([row('hand:1', 'not_submitted', { isHand: true, tag: null, itemId: null })], 4)[0]).toMatchObject({ label: 'Waiting on the GC', count: 1, note: '' })
  })

  it('v2.4684 · in the GC\'s voice the same facts read Waiting on you · Nothing can be ordered until you answer · You sent · your answer · We order', () => {
    expect(procurementSteps(today, null, 'gc')[0]).toMatchObject({ label: 'Waiting on you', count: 44, note: '5 sent back' })
    expect(procurementNextLine(today, '2026-10-05', null, 'gc')).toEqual(['Nothing can be ordered until you answer.', 'You sent 5 parts back.', '39 more wait on your answer.'])
    expect(procurementNextLine(later, '2026-10-26', null, 'gc')).toEqual(['We order 6 parts by 10/27, tomorrow.', '1 part on order arrives late.', 'You sent 3 parts back.'])
    expect(procurementNextLine(today.filter((r) => r.status === 'awaiting'), '2026-10-05', null, 'gc')).toEqual(['Nothing can be ordered until you answer.', '38 parts wait on your answer.'])
    // The office's words are untouched.
    expect(procurementNextLine(later, '2026-10-26')).toEqual(['Order 6 parts by 10/27, tomorrow.', '1 part on order arrives late.', 'The GC sent 3 parts back.'])
  })

  it('a step shows only its lines, says so, and takes its share of the bar', () => {
    expect(rowsForStep(today, 'on_site').map((r) => r.key)).toEqual(['part:e7', 'part:u3', 'part:w5'])
    expect(rowsForStep(today, null)).toHaveLength(47)
    expect(stepOnlyWords('gc', 44)).toEqual({ lead: 'Waiting on the GC: 44 parts.', rest: 'The other lines are hidden.' })
    expect(stepOnlyWords('on_order', 1).lead).toBe('On order: 1 part.')
    expect(stepShares(procurementSteps(today)).map((s) => s.key)).toEqual(['gc', 'on_site'])
    expect(Math.round(stepShares(procurementSteps(today)).reduce((n, s) => n + s.percent, 0))).toBe(100)
    expect(stepShares(procurementSteps([]))).toEqual([])
  })
})

describe('procurementNextLine', () => {
  it('nothing to order: the GC holds it, with what they sent back and what still waits', () => {
    expect(procurementNextLine(today, '2026-10-05')).toEqual(['Nothing can be ordered until the GC answers.', 'They sent 5 parts back.', '39 more wait on their answer.'])
    expect(procurementNextLine([row('a', 'awaiting')], '2026-10-05')).toEqual(['Nothing can be ordered until the GC answers.', '1 part waits on their answer.'])
    expect(procurementNextLine([row('a', 'sent_back'), row('b', 'awaiting')], '2026-10-05')).toEqual(['Nothing can be ordered until the GC answers.', 'They sent 1 part back.', '1 more waits on their answer.'])
  })

  it('something to order: how many by the first date and how soon, then the late, then the sent back', () => {
    expect(procurementNextLine(later, '2026-10-26')).toEqual(['Order 6 parts by 10/27, tomorrow.', '1 part on order arrives late.', 'The GC sent 3 parts back.'])
    expect(procurementNextLine(later, '2026-10-27')[0]).toBe('Order 6 parts by 10/27, today.')
    expect(procurementNextLine(later, '2026-10-30')[0]).toBe('Order 6 parts by 10/27, 3 days ago.')
    expect(procurementNextLine(later, '2026-10-12')[0]).toBe('Order 6 parts by 10/27.')
    expect(procurementNextLine([row('a', 'released'), row('b', 'released')], '2026-10-26')).toEqual(['2 parts are approved and not ordered.'])
  })

  it('nothing held and nothing to order: what is on order, or that it is all on site; an empty log says nothing', () => {
    expect(procurementNextLine([row('a', 'ordered'), row('b', 'delivered')], '2026-10-26')).toEqual(['Nothing is left to order. 1 part is on order.'])
    expect(procurementNextLine([row('a', 'ordered', { late: true })], '2026-10-26')).toEqual(['Nothing is left to order. 1 part is on order.', '1 part on order arrives late.'])
    expect(procurementNextLine([row('b', 'delivered')], '2026-10-26')).toEqual(['Every part is on site.'])
    expect(procurementNextLine([], '2026-10-26')).toEqual([])
  })
})

describe('what the lines share', () => {
  it('the missing facts press only when a part that can be ordered lacks a lead time or a stage', () => {
    expect(blockersPress(today, orderBlockers(today))).toBe(false)
    expect(blockersPress(later, orderBlockers(later))).toBe(false)
    const one = [...later, row('z', 'released', { stage: null, leadTimeDays: 7 })]
    expect(blockersPress(one, orderBlockers(one))).toBe(true)
  })

  it('one house is said once; two houses, or a line with none, are not', () => {
    expect(sharedHouse(today)).toBe('National Wholesale')
    expect(sharedHouse([...today, row('z', 'awaiting', { supplyHouse: 'Moore Supply' })])).toBeNull()
    expect(sharedHouse([...today, row('z', 'awaiting', { supplyHouse: null })])).toBeNull()
    expect(sharedHouse([])).toBeNull()
  })

  it('the send button carries the count only after an update has gone', () => {
    expect(sendUpdateLabel(false, 47)).toBe('Send update…')
    expect(sendUpdateLabel(true, 0)).toBe('Send update…')
    expect(sendUpdateLabel(true, 14)).toBe('Send update · 14 changes')
    expect(sendUpdateLabel(true, 1)).toBe('Send update · 1 change')
  })
})
