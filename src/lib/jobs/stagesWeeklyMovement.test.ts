import { describe, expect, it } from 'vitest'
import {
  buildWeeklyMovement,
  buildWeeklyMovementReportHtml,
  chicagoWeekdayLabel,
  mondayOfWeekYmd,
  weekLabel,
  type JobStatusEventLite,
  type WeeklyJobLite,
} from './stagesWeeklyMovement'

const JOBS: WeeklyJobLite[] = [
  { id: 'j1', hcp_number: '948', click_number: '', job_name: 'Connect sink', job_address: '12803 El Dorado', revenue: 3850 },
  { id: 'j2', hcp_number: '', click_number: '77', job_name: 'Spec house', job_address: '', revenue: 18200 },
  { id: 'j3', hcp_number: '729', click_number: '', job_name: 'SVP Round Rock', job_address: '1200 Kenney Fort', revenue: 745 },
]
const USERS = [
  { id: 'u1', name: 'Taunya' },
  { id: 'u2', name: 'Robert' },
]

function ev(over: Partial<JobStatusEventLite> & { id: string }): JobStatusEventLite {
  return {
    job_id: 'j1',
    from_status: 'working',
    to_status: 'ready_to_bill',
    changed_at: '2026-08-05T15:00:00Z', // Wed Central
    changed_by_user_id: 'u1',
    ...over,
  }
}

describe('week math', () => {
  it('mondayOfWeekYmd lands on Monday for any day of the week', () => {
    expect(mondayOfWeekYmd('2026-08-06')).toBe('2026-08-03') // Thu → Mon
    expect(mondayOfWeekYmd('2026-08-03')).toBe('2026-08-03') // Mon → itself
    expect(mondayOfWeekYmd('2026-08-09')).toBe('2026-08-03') // Sun → prior Mon
  })

  it('weekLabel spells the range, repeating the month only across a boundary', () => {
    expect(weekLabel('2026-08-03')).toBe('Aug 3 – 9')
    expect(weekLabel('2026-08-31')).toBe('Aug 31 – Sep 6')
  })

  it('chicagoWeekdayLabel uses the Central day, not UTC', () => {
    // 01:30Z Wednesday = Tuesday evening Central.
    expect(chicagoWeekdayLabel('2026-08-05T01:30:00Z')).toBe('Tue')
    expect(chicagoWeekdayLabel('garbage')).toBe('?')
  })
})

describe('buildWeeklyMovement', () => {
  it('buckets forward moves by destination in pipeline order with distinct-job totals', () => {
    const data = buildWeeklyMovement(
      [
        ev({ id: 'e1', job_id: 'j1', to_status: 'ready_to_bill' }),
        ev({ id: 'e2', job_id: 'j2', from_status: 'ready_to_bill', to_status: 'billed', changed_by_user_id: 'u2' }),
        ev({ id: 'e3', job_id: 'j3', from_status: 'billed', to_status: 'paid', changed_by_user_id: null }),
        // j1 moves twice into RTB in one week — 2 entries, 1 distinct job, revenue counted once.
        ev({ id: 'e4', job_id: 'j1', to_status: 'ready_to_bill', changed_at: '2026-08-06T15:00:00Z' }),
      ],
      JOBS,
      USERS,
    )
    expect(data.sections.map((s) => s.toStatus)).toEqual(['ready_to_bill', 'billed', 'paid'])
    const rtb = data.sections[0]!
    expect(rtb.entries).toHaveLength(2)
    expect(rtb.jobCount).toBe(1)
    expect(rtb.total).toBe(3850)
    expect(data.sections[1]!.entries[0]!.moverName).toBe('Robert')
    expect(data.sections[2]!.entries[0]!.moverName).toBe('Automatic')
    expect(data.moveCount).toBe(4)
    expect(data.jobCount).toBe(3)
  })

  it('backward transitions land in sendBacks with from → to labels', () => {
    const data = buildWeeklyMovement(
      [ev({ id: 'e1', from_status: 'ready_to_bill', to_status: 'working' })],
      JOBS,
      USERS,
    )
    expect(data.sections).toHaveLength(0)
    expect(data.sendBacks).toHaveLength(1)
    expect(data.sendBacks[0]!.fromLabel).toBe('Ready to Bill')
    expect(data.sendBacks[0]!.toLabel).toBe('Working')
  })

  it('renders display numbers via the effective number and survives unknown jobs', () => {
    const data = buildWeeklyMovement(
      [ev({ id: 'e1', job_id: 'j2', to_status: 'billed', from_status: 'ready_to_bill' }), ev({ id: 'e2', job_id: 'ghost' })],
      JOBS,
      USERS,
    )
    expect(data.sections.find((s) => s.toStatus === 'billed')?.entries[0]?.display).toBe('77 · Spec house')
    const rtb = data.sections.find((s) => s.toStatus === 'ready_to_bill')
    expect(rtb?.entries[0]?.display).toBe('—')
    expect(rtb?.entries[0]?.revenue).toBe(0)
  })

  it('print HTML carries sections, send-backs, and totals', () => {
    const data = buildWeeklyMovement(
      [
        ev({ id: 'e1', to_status: 'billed', from_status: 'ready_to_bill' }),
        ev({ id: 'e2', from_status: 'billed', to_status: 'working', job_id: 'j3' }),
      ],
      JOBS,
      USERS,
    )
    const html = buildWeeklyMovementReportHtml(data, 'Aug 3 – 9')
    expect(html).toContain('Weekly movement — Aug 3 – 9')
    expect(html).toContain('Moved to Billed')
    expect(html).toContain('Sent back')
    expect(html).toContain('Billed → Working')
    expect(html).toContain('$3,850.00')
  })
})
