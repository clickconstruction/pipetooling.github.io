// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { BridgeVectorsPanel } from './BridgeVectorsPanel'
import { BridgeVectorDaysPanel } from './BridgeVectorDaysPanel'
import { buildVectors } from '../../lib/bridge/vectors'
import { buildVectorGrid } from '../../lib/bridge/vectorDays'
import type { VectorSession } from '../../lib/bridge/vectors'

const people = [
  { userId: 'u1', name: 'Abraham', role: 'superintendent', archived: false },
  { userId: 'u2', name: 'Paige', role: 'helpers', archived: false },
  { userId: 'u3', name: 'Taunya', role: 'assistant', archived: false },
]
const wages = [
  { userId: 'u1', fieldWage: 40, officeWage: null, isSalary: false },
  { userId: 'u2', fieldWage: 30, officeWage: null, isSalary: false },
  { userId: 'u3', fieldWage: null, officeWage: 28, isSalary: false },
]
const rates = new Map([['j1', 100]])
const s = (userId: string, workDate: string, hours: number, pending = false): VectorSession => ({ userId, workDate, hours, jobId: 'j1', onBid: false, officeJob: false, approved: !pending, pending })
const noop = () => {}

describe('BridgeVectorsPanel groups', () => {
  it('draws Field and Office & estimators with a subtotal each', () => {
    const v = buildVectors({ weekStart: '2026-10-04', weekEnd: '2026-10-10', people, wages, sessions: [s('u1', '2026-10-06', 8), s('u2', '2026-10-07', 8, true)], ratePerHourByJob: rates, invoiceSends: [{ userId: 'u3', ymd: '2026-10-06', usd: 22_600 }], payments: [], pctUpdates: [], fieldReports: [], bidsSent: [], bidsWon: [], assumedHalfJobs: new Set() })
    renderWithProviders(<BridgeVectorsPanel vectors={v} weekLabel="Oct 4–10" isCurrentWeek canPrev canNext={false} onPrev={noop} onNext={noop} loading={false} error={null} />)
    expect(screen.getByTestId('bridge-vectors-group-field').textContent).toContain('Field')
    expect(screen.getByTestId('bridge-vectors-group-office').textContent).toContain('Office & estimators')
    expect(screen.getByTestId('bridge-vectors-subtotal-field').textContent).toContain('Field')
    expect(screen.getByTestId('bridge-vectors-subtotal-office').textContent).toContain('$22.6k')
  })
})

describe('BridgeVectorDaysPanel reading', () => {
  it('switches the cells from profit to revenue and cost', () => {
    const grid = buildVectorGrid({ zoom: 'days', anchorYmd: '2026-09-01', todayYmd: '2026-09-30', mode: 'approved', people, wages, sessions: [s('u1', '2026-09-08', 10)], ratePerHourByJob: rates })
    const onReading = vi.fn()
    const { rerender } = renderWithProviders(<BridgeVectorDaysPanel grid={grid} zoom="days" onZoom={noop} mode="approved" onMode={noop} reading="profit" onReading={onReading} periodLabel="September 2026" isCurrent canPrev canNext={false} onPrev={noop} onNext={noop} loading={false} error={null} />)
    expect(screen.getByTestId('vector-reading')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Cost' }))
    expect(onReading).toHaveBeenCalledWith('cost')
    rerender(<BridgeVectorDaysPanel grid={grid} zoom="days" onZoom={noop} mode="approved" onMode={noop} reading="cost" onReading={onReading} periodLabel="September 2026" isCurrent canPrev canNext={false} onPrev={noop} onNext={noop} loading={false} error={null} />)
    // 10h × $40 = $400 of wages on the day
    expect(screen.getAllByTestId('vector-day-cell').some((c) => c.textContent === '400')).toBe(true)
    rerender(<BridgeVectorDaysPanel grid={grid} zoom="days" onZoom={noop} mode="approved" onMode={noop} reading="revenue" onReading={onReading} periodLabel="September 2026" isCurrent canPrev canNext={false} onPrev={noop} onNext={noop} loading={false} error={null} />)
    expect(screen.getAllByTestId('vector-day-cell').some((c) => c.textContent === '1k')).toBe(true)
  })
})
