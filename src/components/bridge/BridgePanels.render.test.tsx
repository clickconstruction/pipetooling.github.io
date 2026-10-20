// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { BridgeOwedPanel } from './BridgeOwedPanel'
import { BridgeHoursPanel } from './BridgeHoursPanel'
import { buildOwedPanel } from '../../lib/bridge/owedPanel'
import { buildHoursPanel } from '../../lib/bridge/hoursPanel'
import { buildVectorGrid } from '../../lib/bridge/vectorDays'
import type { VectorSession } from '../../lib/bridge/vectors'

describe('BridgeOwedPanel', () => {
  it('draws the two bar sets, the waterfall and the sources, and closes', () => {
    const panel = buildOwedPanel({
      todayYmd: '2026-10-10',
      cashUsd: 390,
      ar: { total: 190_000, count: 2, items: [{ amount: 86_000, dateYmd: '2026-10-01' }, { amount: 104_000, dateYmd: '2026-08-25' }] },
      arCollections: { total: 17_500, count: 4 },
      ap: { total: 251_000, supplyTotal: 118_000, payrollTotal: 48_000, subLaborTotal: 63_000, upcomingTotal: 22_000 },
      unbilled: { total: 233_000, count: 15 },
      bills: [{ ymd: '2026-10-10', usd: 17_090, label: 'supply' }],
      noContractJobs: 6,
      noPctJobs: 36,
      pendingClosedHours: 585,
      unattributedNoncard: 1151,
      dayLabel: (y) => y,
    })
    const onClose = vi.fn()
    renderWithProviders(<BridgeOwedPanel panel={panel} onClose={onClose} />)
    expect(screen.getByTestId('bridge-owed-aging').textContent).toContain('31–60 days')
    expect(screen.getByTestId('bridge-owed-due').textContent).toContain('this week')
    expect(screen.getByTestId('bridge-owed-waterfall')).toBeTruthy()
    expect(screen.getByTestId('bridge-owed-late').textContent).toContain('Late: $104k on 1 invoice')
    expect(screen.getByRole('link', { name: 'Open Collections' }).getAttribute('href')).toBe('/jobs?tab=collections')
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

describe('BridgeHoursPanel', () => {
  it('draws the stack, the waterfall, the sources and the rule line', () => {
    const TODAY = '2026-10-10'
    const people = [{ userId: 'u1', name: 'Abraham', role: 'helpers', archived: false }]
    const wages = [{ userId: 'u1', fieldWage: 40, officeWage: null, isSalary: false }]
    const s = (workDate: string, hours: number, pending = false): VectorSession => ({ userId: 'u1', workDate, hours, jobId: 'j1', onBid: false, officeJob: false, approved: !pending, pending })
    const common = { zoom: 'weeks' as const, anchorYmd: TODAY, todayYmd: TODAY, people, wages, sessions: [s('2026-10-06', 10), s('2026-10-07', 12, true)], ratePerHourByJob: new Map([['j1', 100]]) }
    const panel = buildHoursPanel({ recorded: buildVectorGrid({ ...common, mode: 'recorded' }), approved: buildVectorGrid({ ...common, mode: 'approved' }), officeByWeek: new Map([['2026-10-04', 9]]), todayYmd: TODAY, pendingClosedHours: 12, pendingClosedSessions: 1, officeBidHours7d: 9, jobsWorked: 1, noContractJobs: 0, fieldEarnedPerHour: 100, thisWeekRecordedUsd: 1340, weekLabel: (w) => w })
    renderWithProviders(<BridgeHoursPanel panel={panel} onClose={() => {}} />)
    expect(screen.getByTestId('bridge-hours-stack')).toBeTruthy()
    expect(screen.getByTestId('bridge-hours-waterfall')).toBeTruthy()
    expect(screen.getByTestId('bridge-hours-rule').textContent).toContain('the page reads 10h')
    expect(screen.getAllByRole('link', { name: 'Approve' })[0]!.getAttribute('href')).toBe('/people?tab=hours&approvals=1')
  })
})
