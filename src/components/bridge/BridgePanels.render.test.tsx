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

// The panels ask one thing of the screen: is it a phone. The tests answer for it.
let phoneViewport = false
vi.mock('../../hooks/useIsMobile', () => ({ useIsMobile: () => phoneViewport }))

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

describe('the chart panels on a phone (v2.8279)', () => {
  const owed = () =>
    buildOwedPanel({
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
  /** The words of a sources table, cell by cell, in the order they are drawn. */
  const cells = (testId: string) => Array.from(screen.getByTestId(testId).querySelectorAll(':scope > span > *, :scope > span:not([style*="contents"])')).map((el) => el.textContent)

  it('Money owed at a desk keeps its two columns and its four-column sources table, door last', () => {
    phoneViewport = false
    const { unmount } = renderWithProviders(<BridgeOwedPanel panel={owed()} onClose={() => {}} />)
    expect(screen.getByTestId('bridge-owed-panel').style.gridTemplateColumns).toBe('minmax(0, 2fr) minmax(260px, 1fr)')
    const table = screen.getByTestId('bridge-owed-sources')
    expect(table.style.gridTemplateColumns).toBe('90px minmax(0, 1.1fr) minmax(0, 1fr) auto')
    expect(table.getAttribute('data-stacked')).toBe('false')
    expect(table.textContent).toContain('what can be wrong')
    const row = cells('bridge-owed-sources')
    expect(row.slice(0, 4)).toEqual(['input', 'read from', 'what can be wrong', ''])
    expect(row[4]).toBe('owed to you')
    expect(row[7]).toBe('Open Billing')
    unmount()
  })

  it('Money owed on a phone is one column, and a source is its name with its door, then two lines', () => {
    phoneViewport = true
    try {
      const { unmount } = renderWithProviders(<BridgeOwedPanel panel={owed()} onClose={() => {}} />)
      const section = screen.getByTestId('bridge-owed-panel')
      expect(section.style.gridTemplateColumns).toBe('minmax(0, 1fr)')
      // No track of the panel keeps a fixed width a phone cannot give.
      expect(section.innerHTML).not.toContain('minmax(260px')
      expect(section.innerHTML).not.toContain('90px')
      const table = screen.getByTestId('bridge-owed-sources')
      expect(table.style.gridTemplateColumns).toBe('minmax(0, 1fr) auto')
      expect(table.getAttribute('data-stacked')).toBe('true')
      expect(table.textContent).not.toContain('what can be wrong')
      const row = cells('bridge-owed-sources')
      expect(row[0]).toBe('owed to you')
      expect(row[1]).toBe('Open Billing')
      // Every source and every door is still there.
      expect(screen.getByRole('link', { name: 'Open Collections' }).getAttribute('href')).toBe('/jobs?tab=collections')
      expect(screen.getAllByRole('link')).toHaveLength(owed().sources.length)
      unmount()
    } finally {
      phoneViewport = false
    }
  })

  it('Crew hours on a phone is cut the same way', () => {
    phoneViewport = true
    try {
      const TODAY = '2026-10-10'
      const people = [{ userId: 'u1', name: 'Abraham', role: 'helpers', archived: false }]
      const wages = [{ userId: 'u1', fieldWage: 40, officeWage: null, isSalary: false }]
      const s = (workDate: string, hours: number, pending = false): VectorSession => ({ userId: 'u1', workDate, hours, jobId: 'j1', onBid: false, officeJob: false, approved: !pending, pending })
      const common = { zoom: 'weeks' as const, anchorYmd: TODAY, todayYmd: TODAY, people, wages, sessions: [s('2026-10-06', 10), s('2026-10-07', 12, true)], ratePerHourByJob: new Map([['j1', 100]]) }
      const panel = buildHoursPanel({ recorded: buildVectorGrid({ ...common, mode: 'recorded' }), approved: buildVectorGrid({ ...common, mode: 'approved' }), officeByWeek: new Map([['2026-10-04', 9]]), todayYmd: TODAY, pendingClosedHours: 12, pendingClosedSessions: 1, officeBidHours7d: 9, jobsWorked: 1, noContractJobs: 0, fieldEarnedPerHour: 100, thisWeekRecordedUsd: 1340, weekLabel: (w) => w })
      renderWithProviders(<BridgeHoursPanel panel={panel} onClose={() => {}} />)
      const section = screen.getByTestId('bridge-hours-panel')
      expect(section.style.gridTemplateColumns).toBe('minmax(0, 1fr)')
      expect(section.innerHTML).not.toContain('minmax(260px')
      expect(screen.getByTestId('bridge-hours-sources').getAttribute('data-stacked')).toBe('true')
      expect(screen.getAllByRole('link', { name: 'Approve' })[0]!.getAttribute('href')).toBe('/people?tab=hours&approvals=1')
      expect(screen.getByTestId('bridge-hours-rule').textContent).toContain('the page reads 10h')
    } finally {
      phoneViewport = false
    }
  })
})
