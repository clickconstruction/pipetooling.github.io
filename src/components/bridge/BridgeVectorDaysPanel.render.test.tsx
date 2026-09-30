// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { BridgeVectorDaysPanel } from './BridgeVectorDaysPanel'
import { buildVectorGrid } from '../../lib/bridge/vectorDays'
import type { VectorSession } from '../../lib/bridge/vectors'

const field = (userId: string, workDate: string, hours: number, jobId: string): VectorSession => ({ userId, workDate, hours, jobId, onBid: false, officeJob: false, approved: true, pending: false })

function grid(sessions: VectorSession[], zoom: 'days' | 'weeks' | 'months' = 'days', prior?: Map<string, number>, mode: 'approved' | 'recorded' = 'approved') {
  return buildVectorGrid({
    priorRatePerHourByJob: prior,
    zoom,
    anchorYmd: zoom === 'days' ? '2026-09-14' : '2026-09-30',
    todayYmd: '2026-09-30',
    mode,
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
    renderWithProviders(<BridgeVectorDaysPanel grid={g} zoom="days" onZoom={noop} mode="approved" onMode={noop} periodLabel="September 2026" isCurrent canPrev canNext={false} onPrev={noop} onNext={noop} loading={false} error={null} />)
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
    const { rerender } = renderWithProviders(<BridgeVectorDaysPanel grid={grid([])} zoom="days" onZoom={noop} mode="approved" onMode={noop} periodLabel="August 2026" isCurrent={false} canPrev canNext onPrev={noop} onNext={noop} loading={false} error={null} />)
    expect(screen.getByText('No approved field hours in this period yet — Recorded time shows the hours still waiting on approval.')).toBeTruthy()
    rerender(<BridgeVectorDaysPanel grid={null} zoom="days" onZoom={noop} mode="approved" onMode={noop} periodLabel="August 2026" isCurrent={false} canPrev canNext onPrev={noop} onNext={noop} loading={false} error="boom" />)
    expect(screen.getByText('boom')).toBeTruthy()
  })

  it('the Weeks and Months zooms draw a period cell per pay week or month, and the zoom row reports the pick', () => {
    const sessions = [field('u1', '2026-09-01', 8, 'j-good'), field('u2', '2026-09-08', 8, 'j-low')]
    const picks: string[] = []
    const { rerender } = renderWithProviders(<BridgeVectorDaysPanel grid={grid(sessions, 'weeks')} zoom="weeks" onZoom={(z) => picks.push(z)} mode="approved" onMode={noop} periodLabel="Jul 5 – Oct 3" isCurrent canPrev canNext={false} onPrev={noop} onNext={noop} loading={false} error={null} />)
    expect(screen.getAllByTestId('vector-period-cell').map((c) => c.textContent)).toEqual(['+416', '≈−56'])
    expect(screen.getByText('13 wk')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Weeks' }).getAttribute('aria-pressed')).toBe('true')
    screen.getByRole('button', { name: 'Months' }).click()
    expect(picks).toEqual(['months'])
    rerender(<BridgeVectorDaysPanel grid={grid(sessions, 'months')} zoom="months" onZoom={noop} mode="approved" onMode={noop} periodLabel="Oct 2025 – Sep 2026" isCurrent canPrev canNext={false} onPrev={noop} onNext={noop} loading={false} error={null} />)
    expect(screen.getAllByTestId('vector-period-cell')).toHaveLength(2)
    expect(screen.getByText('12 mo')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Previous 12 months' })).toBeTruthy()
  })

  it('the Why line counts red days by job, a click opens the card with the verdict and the doors, and ↻ marks a flipped day', () => {
    const sessions = [field('u2', '2026-09-01', 8, 'j-low'), field('u2', '2026-09-02', 8, 'j-low'), field('u2', '2026-09-03', 8, 'j-good'), field('u1', '2026-09-01', 8, 'j-good')]
    renderWithProviders(<BridgeVectorDaysPanel grid={grid(sessions, 'days', new Map([['j-low', 60]]))} zoom="days" onZoom={noop} mode="approved" onMode={noop} periodLabel="September 2026" isCurrent canPrev canNext={false} onPrev={noop} onNext={noop} loading={false} error={null} />)
    const why = screen.getAllByTestId('vector-why').map((w) => w.textContent)
    expect(why).toEqual(['no red days', '2 red · all on J1044, no %'])
    expect(screen.getAllByTestId('vector-flip')).toHaveLength(2) // both J1044 days were green at last week's $60
    expect(screen.queryByTestId('vector-cell-card')).toBeNull()
    const red = screen.getAllByTestId('vector-day-cell').find((c) => c.textContent?.startsWith('−'))
    if (!red) throw new Error('no red cell')
    fireEvent.click(red)
    const card = screen.getByTestId('vector-cell-card')
    expect(card.textContent).toContain('Tristen · Tue Sep 1')
    expect(screen.getByTestId('vector-verdict').textContent).toContain('Red because J1044 Cielo Vista earns $31 an hour and Tristen costs $38.')
    expect(screen.getByTestId('vector-verdict').textContent).toContain('↻ Re-priced this week')
    expect(screen.getByRole('link', { name: 'Open J1044' }).getAttribute('href')).toBe('/jobs?tab=stages&stagesJob=j-low')
    expect(screen.getByRole('link', { name: 'Set % complete' }).getAttribute('href')).toBe('/jobs?tab=job-summary&job=j-low')
    expect(screen.getByRole('link', { name: 'This day on People → Review' }).getAttribute('href')).toContain('2026-09-01')
    fireEvent.click(red) // a second click on the same cell closes the card
    expect(screen.queryByTestId('vector-cell-card')).toBeNull()
  })

  it('recorded time draws a pending day dashed and says so; approved only leaves it out and names the switch', () => {
    const sessions = [{ ...field('u1', '2026-09-28', 8, 'j-good'), approved: false, pending: true }]
    const modes: string[] = []
    const { rerender } = renderWithProviders(<BridgeVectorDaysPanel grid={grid(sessions, 'days', undefined, 'recorded')} zoom="days" onZoom={noop} mode="recorded" onMode={(m) => modes.push(m)} periodLabel="September 2026" isCurrent canPrev canNext={false} onPrev={noop} onNext={noop} loading={false} error={null} />)
    const cell = screen.getByTestId('vector-day-cell')
    expect(cell.textContent).toBe('+416')
    expect(cell.style.borderStyle).toBe('dashed')
    expect(cell.getAttribute('title')).toContain('8h not yet approved')
    expect(screen.getByText('was each person\'s day worth it · field people · recorded time, pending dashed')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Recorded time' }).getAttribute('aria-pressed')).toBe('true')
    screen.getByRole('button', { name: 'Approved only' }).click()
    expect(modes).toEqual(['approved'])
    rerender(<BridgeVectorDaysPanel grid={grid(sessions, 'days', undefined, 'approved')} zoom="days" onZoom={noop} mode="approved" onMode={noop} periodLabel="September 2026" isCurrent canPrev canNext={false} onPrev={noop} onNext={noop} loading={false} error={null} />)
    expect(screen.queryByTestId('vector-day-cell')).toBeNull()
    expect(screen.getByText('No approved field hours in this period yet — Recorded time shows the hours still waiting on approval.')).toBeTruthy()
  })
})

