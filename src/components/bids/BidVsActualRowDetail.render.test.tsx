// @vitest-environment jsdom
/**
 * A Bid vs actual row opened (v2.5046): the job's burn by section as its Costs tab reads it, for
 * the dollar roles, and earned value by stage for everyone, with the lines that name no stage
 * named. The verdict comes from the kernel; the stage read is stubbed.
 */
import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { stageEarnedValue } from '../../lib/bids/stageEarnedValue'
import { bidVsActualJobVerdict } from '../../lib/bids/bidVsActualBurn'
import type { JobChargesTimelineInputs } from '../../hooks/useJobChargesTimelineInputs'

let stageState: { loading: boolean; failed: boolean; ev: ReturnType<typeof stageEarnedValue> | null } = { loading: false, failed: false, ev: null }
vi.mock('../../hooks/useJobStageEarnedValue', () => ({ useJobStageEarnedValue: () => stageState }))

import { BidVsActualRowDetail } from './BidVsActualRowDetail'

const day = (d: number) => `2026-09-${String(d).padStart(2, '0')}`
const inputs: JobChargesTimelineInputs = {
  chargeEvents: [
    ...[1, 2, 3, 4, 5].map((d) => ({ source: 'team_labor' as const, dateKey: day(d), amount: 1_800, label: 'crew' })),
    { source: 'supply_house' as const, dateKey: day(2), amount: 6_000, label: 'Ferguson' },
    { source: 'sub_labor' as const, dateKey: day(4), amount: 1_500, label: 'sub' },
  ],
  valueEvents: [{ dateKey: day(5), percent: 50, label: 'report', kind: 'report' }],
  paymentEvents: [],
  revenue: 41_550,
  fallbackPercent: 40,
  teamHours: 240,
  cardChargesExcluded: false,
}
const verdict = bidVsActualJobVerdict({ inputs, budgetRow: { kind: 'bid', labor_hours: 300, labor_rate: 35, labor_usd: 10_500, materials_usd: 9_000, subs_usd: 2_000, other_usd: 500, total_direct_usd: 22_000, completeness: { usable: true } }, status: 'working', bidNumber: '76', todayYmd: '2026-09-12' })

describe('BidVsActualRowDetail', () => {
  it('the dollar roles read the job’s burn by section, as its Costs tab does', () => {
    stageState = { loading: false, failed: false, ev: stageEarnedValue({ bidHoursByStage: null, lines: [], recordedHours: 240 }) }
    render(<BidVsActualRowDetail jobId="j879" bidId="b76" recordedHours={240} verdict={verdict} showDollars />)
    const materials = screen.getByTestId('bva-section-materials')
    expect(within(materials).getByText('$6,000')).toBeTruthy()
    expect(within(materials).getByText('$12,000')).toBeTruthy() // $6,000 at 50% done
    expect(within(materials).getByText('$9,000')).toBeTruthy()
    expect(within(materials).getByText('67% of the bid figure · ahead of the work')).toBeTruthy() // 67% spent at 50% done
    expect(screen.getByTestId('bva-direct-margin').textContent).toBe('$8,550 · 21%')
    expect(screen.getByTestId('bva-stage-ev').textContent).toContain('the bid carries no hours by stage')
  })
  it('earned value by stage, with the lines that name no stage named; no dollars without wages', () => {
    stageState = {
      loading: false,
      failed: false,
      ev: stageEarnedValue({ bidHoursByStage: { rough: 120, top: 60, trim: 20 }, lines: [{ name: 'Rough in', weightPct: 50, progressPct: 100 }, { name: 'Top out', weightPct: 30, progressPct: null }, { name: 'Plumbing per plans', weightPct: 20, progressPct: 40 }], recordedHours: 150 }),
    }
    render(<BidVsActualRowDetail jobId="j879" bidId="b76" recordedHours={150} verdict={verdict} showDollars={false} />)
    expect(screen.queryByTestId('bva-sections')).toBeNull()
    expect(screen.getByTestId('bva-stage-ev').textContent).toContain('120 h earned of 200 h bid · 150 h recorded · 1.25× the hours earned')
    expect(within(screen.getByTestId('bva-stage-rough')).getByText('100%')).toBeTruthy()
    expect(within(screen.getByTestId('bva-stage-top')).getByText('not reported')).toBeTruthy()
    expect(within(screen.getByTestId('bva-stage-trim')).getByText('no line names it')).toBeTruthy()
    expect(screen.getByTestId('bva-stage-unmapped').textContent).toBe('Lines that name no stage, left out: Plumbing per plans')
  })
  it('today’s data: staged lines with no report say so; a costs read in flight or failed says that', () => {
    stageState = { loading: false, failed: false, ev: stageEarnedValue({ bidHoursByStage: { rough: 40 }, lines: [{ name: 'Rough in', weightPct: 100, progressPct: null }], recordedHours: 12 }) }
    const { rerender } = render(<BidVsActualRowDetail jobId="j1" bidId="b1" recordedHours={12} verdict={null} showDollars />)
    expect(screen.getByText('Reading the job’s costs…'.replace('’', "'"))).toBeTruthy()
    expect(screen.getByTestId('bva-stage-ev').textContent).toContain('no stage progress reported')
    rerender(<BidVsActualRowDetail jobId="j1" bidId="b1" recordedHours={12} verdict="error" showDollars />)
    expect(screen.getByText("The job's costs could not be read.")).toBeTruthy()
    stageState = { loading: false, failed: true, ev: null }
    rerender(<BidVsActualRowDetail jobId="j1" bidId="b1" recordedHours={12} verdict="error" showDollars />)
    expect(screen.getByTestId('bva-stage-ev').textContent).toContain('the stages could not be read')
  })
})
