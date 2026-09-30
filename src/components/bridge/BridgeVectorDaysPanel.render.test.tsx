// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { BridgeVectorDaysPanel } from './BridgeVectorDaysPanel'
import { buildVectorGrid } from '../../lib/bridge/vectorDays'
import type { VectorSession } from '../../lib/bridge/vectors'

const field = (userId: string, workDate: string, hours: number, jobId: string): VectorSession => ({ userId, workDate, hours, jobId, onBid: false, officeJob: false, approved: true, pending: false })

function grid(sessions: VectorSession[]) {
  return buildVectorGrid({
    zoom: 'days',
    anchorYmd: '2026-09-14',
    todayYmd: '2026-09-30',
    mode: 'approved',
    people: [
      { userId: 'u1', name: 'Abraham', role: 'helpers', archived: false },
      { userId: 'u2', name: 'Tristen', role: 'helpers', archived: false },
    ],
    wages: [
      { userId: 'u1', fieldWage: 40, officeWage: null, isSalary: false },
      { userId: 'u2', fieldWage: 38, officeWage: null, isSalary: false },
    ],
    sessions,
    ratePerHourByJob: new Map([
      ['j-good', 92],
      ['j-low', 31],
    ]),
    assumedHalfJobs: new Set(['j-low']),
    jobLabels: new Map([
      ['j-good', 'J878 Shavano dental'],
      ['j-low', 'J1044 Cielo Vista'],
    ]),
  })
}

const noop = () => {}

describe('BridgeVectorDaysPanel', () => {
  it('draws a row per field person, a green and a red day, the week sums and the Field crew row', () => {
    const g = grid([field('u1', '2026-09-01', 8, 'j-good'), field('u2', '2026-09-01', 8, 'j-low'), { userId: 'u2', workDate: '2026-09-02', hours: 6, jobId: 'j-office', onBid: false, officeJob: true, approved: true, pending: false }])
    renderWithProviders(<BridgeVectorDaysPanel grid={g} periodLabel="September 2026" isCurrent canPrev canNext={false} onPrev={noop} onNext={noop} loading={false} error={null} />)
    expect(screen.getByTestId('bridge-vector-days')).toBeTruthy()
    expect(screen.getAllByTestId('vector-day-row')).toHaveLength(2)
    const cells = screen.getAllByTestId('vector-day-cell')
    expect(cells.map((c) => c.textContent)).toEqual(['+416', '−56'])
    expect(cells[1]?.getAttribute('title')).toContain('J1044 Cielo Vista: 8h at $31/h ≈ no % complete')
    expect(screen.getByText('6h')).toBeTruthy() // the office day, hours only
    expect(screen.getByText('Field crew')).toBeTruthy()
    expect(screen.getByText('September 2026')).toBeTruthy()
    expect(screen.getByText('so far')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Abraham' }).getAttribute('href')).toContain('2026-09-01')
  })

  it('says so when the period has no field hours, and shows the error when the load failed', () => {
    const { rerender } = renderWithProviders(<BridgeVectorDaysPanel grid={grid([])} periodLabel="August 2026" isCurrent={false} canPrev canNext onPrev={noop} onNext={noop} loading={false} error={null} />)
    expect(screen.getByText('No approved field hours in this period yet.')).toBeTruthy()
    rerender(<BridgeVectorDaysPanel grid={null} periodLabel="August 2026" isCurrent={false} canPrev canNext onPrev={noop} onNext={noop} loading={false} error="boom" />)
    expect(screen.getByText('boom')).toBeTruthy()
  })
})
