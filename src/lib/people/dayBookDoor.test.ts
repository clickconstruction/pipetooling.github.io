import { describe, expect, it } from 'vitest'
import { dayBookDoorHref, parseDayBookDoor } from './dayBookDoor'

describe('dayBookDoor', () => {
  it('round-trips a person and range', () => {
    const href = dayBookDoorHref({ from: '2026-09-08', to: '2026-09-14', person: 'u-1' })
    expect(href).toBe('/people?tab=day_book&dayb_from=2026-09-08&dayb_to=2026-09-14&dayb_person=u-1')
    expect(parseDayBookDoor(href.slice(href.indexOf('?')))).toEqual({ from: '2026-09-08', to: '2026-09-14', person: 'u-1' })
  })

  it('a range without a person is a door too', () => {
    expect(parseDayBookDoor('?tab=day_book&dayb_from=2026-09-01&dayb_to=2026-09-30')).toEqual({
      from: '2026-09-01',
      to: '2026-09-30',
      person: null,
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
})
