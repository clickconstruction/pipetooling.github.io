import { describe, expect, it } from 'vitest'
import { dayBookDoorHref, parseDayBookDoor } from './dayBookDoor'

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
})
