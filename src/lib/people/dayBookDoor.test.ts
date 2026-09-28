import { describe, expect, it } from 'vitest'
import { DAY_BOOK_DOOR_PARAMS, dayBookDoorHref, dropDayBookDoorParams, parseDayBookDoor } from './dayBookDoor'

describe('dayBookDoor', () => {
  it('round-trips a person and range', () => {
    const href = dayBookDoorHref({ from: '2026-09-08', to: '2026-09-14', person: 'u-1' })
    expect(href).toBe('/people?tab=day_book&dayb_from=2026-09-08&dayb_to=2026-09-14&dayb_person=u-1')
    expect(parseDayBookDoor(href.slice(href.indexOf('?')))).toEqual({ from: '2026-09-08', to: '2026-09-14', person: 'u-1', view: 'week' })
  })

  it('a range without a person is a door too', () => {
    expect(parseDayBookDoor('?tab=day_book&dayb_from=2026-09-01&dayb_to=2026-09-30')).toEqual({
      from: '2026-09-01',
      to: '2026-09-30',
      person: null,
      view: 'week',
    })
  })

  it('swaps a reversed range and rejects malformed dates or another tab', () => {
    expect(parseDayBookDoor('?tab=day_book&dayb_from=2026-09-14&dayb_to=2026-09-08')?.from).toBe('2026-09-08')
    expect(parseDayBookDoor('?tab=day_book&dayb_from=Sep+8&dayb_to=2026-09-14')).toBeNull()
    expect(parseDayBookDoor('?tab=review&dayb_from=2026-09-08&dayb_to=2026-09-14')).toBeNull()
  })

  it("ignores the Person desk's bare person param", () => {
    expect(parseDayBookDoor('?tab=day_book&dayb_from=2026-09-08&dayb_to=2026-09-14&person=u-9')?.person).toBeNull()
  })

  it('carries the Month view, and only that word', () => {
    const href = dayBookDoorHref({ from: '2026-09-01', to: '2026-09-30', person: null, view: 'month' })
    expect(href).toContain('dayb_view=month')
    expect(parseDayBookDoor(href.slice(href.indexOf('?')))?.view).toBe('month')
    expect(parseDayBookDoor('?tab=day_book&dayb_from=2026-09-01&dayb_to=2026-09-30&dayb_view=year')?.view).toBe('week')
    expect(dayBookDoorHref({ from: '2026-09-01', to: '2026-09-30', person: null })).not.toContain('dayb_view')
  })
  it('opens from Bids too, where the tab is spelled day-book', () => {
    expect(parseDayBookDoor('?tab=day-book&dayb_from=2026-09-01&dayb_to=2026-09-30')?.from).toBe('2026-09-01')
    expect(parseDayBookDoor('?tab=day_book&dayb_from=2026-09-01&dayb_to=2026-09-30')?.from).toBe('2026-09-01')
  })

  it('leaving the tab takes its params out of the URL and nothing else', () => {
    const params = new URLSearchParams('tab=bid-board&dayb_from=2026-09-28&dayb_to=2026-10-04&dayb_person=u-1&dayb_view=month&bidId=b-1&person=u-9')
    const out = dropDayBookDoorParams(params)
    expect(out).toBe(params)
    expect(out.toString()).toBe('tab=bid-board&bidId=b-1&person=u-9')
  })

  it('drops every param the door writes', () => {
    const href = dayBookDoorHref({ from: '2026-09-01', to: '2026-09-30', person: 'u-1', view: 'month' })
    const params = new URLSearchParams(href.slice(href.indexOf('?') + 1))
    expect([...dropDayBookDoorParams(params).keys()]).toEqual(['tab'])
    expect([...DAY_BOOK_DOOR_PARAMS]).toEqual(['dayb_from', 'dayb_to', 'dayb_person', 'dayb_view'])
  })

  it('a URL with none of them is left as it was', () => {
    expect(dropDayBookDoorParams(new URLSearchParams('tab=counts&bidId=b-1')).toString()).toBe('tab=counts&bidId=b-1')
  })
})
