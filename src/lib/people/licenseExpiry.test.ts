import { describe, expect, it } from 'vitest'
import { expiredLicensesHeading, lapsedWords, licenseExpiryBuckets, LICENSE_EXPIRING_WINDOW_DAYS } from './licenseExpiry'

const TODAY = '2026-11-02'
const row = (id: string, date_of_expiry: string) => ({ id, date_of_expiry })

describe('licenseExpiryBuckets', () => {
  it('puts a lapsed license in Expired with the days since, today and the window in Expiring with the days left, the rest in current', () => {
    const buckets = licenseExpiryBuckets(
      [row('far', '2027-06-01'), row('mar', '2026-03-15'), row('today', TODAY), row('edge', '2026-12-02'), row('yday', '2026-11-01'), row('past-edge', '2026-12-03')],
      TODAY,
    )
    expect(buckets.expired.map((l) => [l.id, l.daysSince])).toEqual([
      ['yday', 1],
      ['mar', 232],
    ])
    expect(buckets.expiringSoon.map((l) => [l.id, l.daysLeft])).toEqual([
      ['today', 0],
      ['edge', 30],
    ])
    expect(buckets.current.map((l) => l.id)).toEqual(['far', 'past-edge'])
  })

  it('orders the most recently lapsed first and keeps the rows’ order between equals', () => {
    const buckets = licenseExpiryBuckets([row('a', '2024-01-01'), row('b', '2026-10-01'), row('c', '2026-10-01'), row('d', '2026-10-30')], TODAY)
    expect(buckets.expired.map((l) => l.id)).toEqual(['d', 'b', 'c', 'a'])
  })

  it('keeps every field of the row on the way through', () => {
    const buckets = licenseExpiryBuckets([{ id: 'x', date_of_expiry: '2026-01-01', license_type: 'Master Plumber #1', person_name: 'Hal Sample' }], TODAY)
    expect(buckets.expired[0]).toEqual({ id: 'x', date_of_expiry: '2026-01-01', license_type: 'Master Plumber #1', person_name: 'Hal Sample', daysSince: 305 })
  })

  it('a date it cannot read goes to current, never to Expired', () => {
    const buckets = licenseExpiryBuckets([row('blank', ''), row('junk', 'soon')], TODAY)
    expect(buckets.expired).toEqual([])
    expect(buckets.expiringSoon).toEqual([])
    expect(buckets.current.map((l) => l.id)).toEqual(['blank', 'junk'])
  })

  it('takes a window of its own, and the default is thirty days', () => {
    expect(LICENSE_EXPIRING_WINDOW_DAYS).toBe(30)
    const buckets = licenseExpiryBuckets([row('ten', '2026-11-12')], TODAY, 7)
    expect(buckets.expiringSoon).toEqual([])
    expect(buckets.current.map((l) => l.id)).toEqual(['ten'])
  })

  it('leaves nothing out: every row lands in exactly one bucket', () => {
    const rows = Array.from({ length: 24 }, (_, i) => row(`r${i}`, i < 14 ? `2026-0${(i % 9) + 1}-10` : `2027-0${(i % 9) + 1}-10`))
    const buckets = licenseExpiryBuckets(rows, TODAY)
    expect(buckets.expired.length + buckets.expiringSoon.length + buckets.current.length).toBe(24)
    expect(buckets.expired).toHaveLength(14)
  })
})

describe('expiredLicensesHeading', () => {
  it('carries the count, singular at one, bare at zero', () => {
    expect(expiredLicensesHeading(0)).toBe('Expired licenses')
    expect(expiredLicensesHeading(1)).toBe('1 expired license')
    expect(expiredLicensesHeading(14)).toBe('14 expired licenses')
  })
})

describe('lapsedWords', () => {
  it('says the days since, singular at one', () => {
    expect(lapsedWords(1)).toBe('1 day ago')
    expect(lapsedWords(232)).toBe('232 days ago')
  })
})
