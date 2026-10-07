import { describe, expect, it } from 'vitest'
import { CALENDAR_MAX_DAYS, calendarAxis, groupMark } from './procurementCalendar'
import { orderSections } from './procurementOrders'
import { row, spacexLater as later, spacexToday as today } from './procurementSpacex.fixtures'

const STAGES = { rough_in: '2026-10-20', top_out: '2026-11-10', trim_set: '2026-12-08' }
const ASOF = '2026-10-26'
const r1 = (n: number | undefined) => (n == null ? n : Math.round(n * 10) / 10)

describe('calendarAxis', () => {
  it('nothing to place, no calendar: today no part has a lead time, and a needed date alone is not a mark', () => {
    expect(calendarAxis(today, {}, '2026-10-05')).toBeNull()
    expect(calendarAxis([row('a', 'awaiting', { requiredOn: '2026-12-08' })], STAGES, ASOF)).toBeNull()
    // What is on site places nothing.
    expect(calendarAxis([row('a', 'delivered', { orderedOn: '2026-10-06', deliveredOn: '2026-10-15', expectedOn: '2026-10-15' })], STAGES, ASOF)).toBeNull()
  })

  it('three weeks on: a week before today to five days past the last needed date, the Mondays named, today in place of the one beside it', () => {
    const axis = calendarAxis(later, STAGES, ASOF)!
    expect([axis.start, axis.end, axis.days, axis.capped]).toEqual(['2026-10-19', '2026-12-13', 55, false])
    // 10/26 is a Monday: today's label takes its place.
    expect(axis.weeks.map((w) => w.label)).toEqual(['10/19', '11/2', '11/9', '11/16', '11/23', '11/30', '12/7'])
    expect(r1(axis.today)).toBe(12.7)
    expect(axis.stages.map((s) => [s.label, r1(s.at), s.flip])).toEqual([['Rough In', 1.8, false], ['Top Out', 40, false], ['Trim Set', 90.9, true]])
  })

  it('a job needed months out is cut at 26 weeks, and the header names every second Monday', () => {
    const axis = calendarAxis([row('a', 'released', { orderBy: '2026-11-03', requiredOn: '2027-08-02' })], { trim_set: '2027-08-02' }, ASOF)!
    expect([axis.days, axis.capped]).toEqual([CALENDAR_MAX_DAYS, true])
    expect(axis.weeks.length).toBeLessThanOrEqual(14)
    // The stage's day is off the line, so its name is not written.
    expect(axis.stages).toEqual([])
  })
})

describe('groupMark', () => {
  const axis = calendarAxis(later, STAGES, ASOF)!
  const groups = orderSections(later, ASOF).flatMap((s) => s.groups)
  const mark = (title: string) => groupMark(groups.find((g) => g.title === title)!, axis, ASOF)

  it('an order to place: a diamond at the order-by date, amber inside three days, a dotted run to the tick at the needed date', () => {
    const soon = mark('Order by 10/27')!
    expect(soon.diamond).toMatchObject({ tone: 'soon', title: 'order by 10/27' })
    expect([r1(soon.diamond!.at), r1(soon.dotted!.from), r1(soon.dotted!.to), r1(soon.tick!.at)]).toEqual([14.5, 14.5, 90.9, 90.9])
    expect(soon.words).toBe('order by 10/27, needed 12/08')
    expect([soon.bar, soon.lateBar]).toEqual([null, null])
    expect(mark('Order by 11/24')!.diamond!.tone).toBe('go')
    expect(groupMark({ kind: 'to_place', tone: 'past', rows: [row('a', 'released', { orderBy: '2026-10-22', requiredOn: '2026-12-08' })] }, axis, ASOF)!.diamond!.tone).toBe('past')
    // No order-by date, no mark.
    expect(groupMark({ kind: 'to_place', tone: 'quiet', rows: [row('a', 'released')] }, axis, ASOF)).toBeNull()
  })

  it('an order placed: a bar from ordered to expected and a dotted run on to the tick; late, blue up to the tick and red past it', () => {
    const onTime = mark('PO 4502')!
    expect([r1(onTime.bar!.from), r1(onTime.bar!.to), onTime.bar!.clipped, r1(onTime.dotted!.from), r1(onTime.dotted!.to), r1(onTime.tick!.at)]).toEqual([1.8, 27.3, false, 27.3, 40, 40])
    expect(onTime.lateBar).toBeNull()
    expect(onTime.words).toBe('ordered 10/20, arrives 11/03, needed 11/10')
    // PO 4480 was ordered 10/08, before the line of weeks: cut square at the left edge. It lands 9 days past Rough In.
    const late = mark('PO 4480')!
    expect([r1(late.bar!.from), r1(late.bar!.to), late.bar!.clipped]).toEqual([0, 1.8, true])
    expect([r1(late.lateBar!.from), r1(late.lateBar!.to), late.dotted]).toEqual([1.8, 18.2, null])
    expect(late.words).toBe('ordered 10/08, arrives 10/29, needed 10/20, 9 days late')
  })

  it('a fixture that waits: an open diamond at the day the GC must answer by; none without a lead time or a needed date', () => {
    const lav = mark('LAV-1')!
    expect(lav.diamond).toMatchObject({ tone: 'ask', title: 'the GC must answer by 11/10' })
    expect([r1(lav.diamond!.at), r1(lav.tick!.at)]).toEqual([40, 90.9])
    expect(mark('UR-1, UR-2')).toBeNull()
  })

  it('an order on site carries no mark', () => {
    expect(mark('PO 4471')).toBeNull()
  })
})
