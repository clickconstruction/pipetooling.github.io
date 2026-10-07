import { describe, expect, it } from 'vitest'
import { buildUncollectibleReport, uncollectibleReportCsv, type UncollectibleReportRow } from './uncollectibleReport'

const row = (o: Partial<UncollectibleReportRow>): UncollectibleReportRow => ({ id: 'j', hcp_number: null, click_number: null, job_name: null, customer_name: null, revenue: 0, payments_made: 0, uncollectible_at: null, uncollectible_reason: null, ...o })

describe('buildUncollectibleReport — the accountant\'s list (punch list #94)', () => {
  it('groups by the year the office gave up, newest first, with totals, and carries an undated row under undated', () => {
    const r = buildUncollectibleReport([
      row({ id: 'a', hcp_number: '717', job_name: 'TLE HVAC', customer_name: 'The Learning Experience', revenue: 7502, uncollectible_at: '2026-10-07T03:30:00Z', uncollectible_reason: 'Theft of service.' }),
      row({ id: 'b', click_number: '008', job_name: 'Car wash', customer_name: 'Surf Thru', revenue: 250, uncollectible_at: '2026-02-01T12:00:00Z', uncollectible_reason: 'No response.' }),
      row({ id: 'c', hcp_number: '500', revenue: 1000, payments_made: 400, uncollectible_at: '2025-12-20T12:00:00Z' }),
      row({ id: 'd', hcp_number: '501', revenue: 100 }),
    ])
    expect(r.years.map((y) => [y.year, y.count, y.total])).toEqual([['undated', 1, 100], ['2026', 2, 7752], ['2025', 1, 600]])
    expect(r.years[1]!.lines.map((l) => l.number)).toEqual(['717', '008'])
    expect(r.years[1]!.lines[0]).toMatchObject({ ymd: '2026-10-06', customer: 'The Learning Experience', reason: 'Theft of service.' })
    expect(r.count).toBe(4)
    expect(r.total).toBe(8452)
  })

  it('the CSV has one line per bill, quotes a reason with a comma, and keeps cents', () => {
    const csv = uncollectibleReportCsv(buildUncollectibleReport([row({ id: 'a', hcp_number: '717', job_name: 'TLE', customer_name: 'TLE, Inc', revenue: 7502.5, uncollectible_at: '2026-10-07T03:30:00Z', uncollectible_reason: 'Refused, will not answer.' })]))
    expect(csv.split('\n')[0]).toBe('year,given_up_on,job_number,job,customer,open_dollars,reason')
    expect(csv.split('\n')[1]).toBe('2026,2026-10-06,717,TLE,"TLE, Inc",7502.50,"Refused, will not answer."')
  })
})
