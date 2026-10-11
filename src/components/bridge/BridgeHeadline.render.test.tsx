// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { BridgeHeadline } from './BridgeHeadline'
import { buildHeadline, cashLight, netPositionLight } from '../../lib/bridge/headline'
import { buildVectorGrid } from '../../lib/bridge/vectorDays'
import type { VectorSession } from '../../lib/bridge/vectors'

const TODAY = '2026-10-10'
const s = (workDate: string, hours: number, pending = false): VectorSession => ({ userId: 'u1', workDate, hours, jobId: 'j1', onBid: false, officeJob: false, approved: !pending, pending })
function headline(sessions: VectorSession[]) {
  const common = { zoom: 'weeks' as const, anchorYmd: TODAY, todayYmd: TODAY, people: [{ userId: 'u1', name: 'Abraham', role: 'helpers', archived: false }], wages: [{ userId: 'u1', fieldWage: 40, officeWage: null, isSalary: false }], sessions, ratePerHourByJob: new Map([['j1', 100]]) }
  return buildHeadline({ recorded: buildVectorGrid({ ...common, mode: 'recorded' }), approved: buildVectorGrid({ ...common, mode: 'approved' }) })
}
const net = netPositionLight({ deltaUsd: -37_400, todayUsd: 114_000, startLabel: 'Aug 15', paperProfitUsd: 54_600, billingLagUsd: 98_100 })
const cash = cashLight({ lowestUsd: 15_400, lowestLabel: 'Oct 12', floorUsd: 5000, clearsFloor: true, daysUnderFloor: 0, typedLabel: 'Sep 3', typedDaysAgo: 37 })

describe('BridgeHeadline', () => {
  it('leads with this week on recorded time, marks the waiting hours, and draws the lights', () => {
    renderWithProviders(<BridgeHeadline headline={headline([s('2026-10-06', 10), s('2026-10-07', 10, true), s('2026-09-22', 10)])} loading={false} error={null} net={net} cash={cash} />)
    expect(screen.getByTestId('bridge-headline-number').textContent).toContain('+$1.2k')
    expect(screen.getByTestId('bridge-headline-number').textContent).toContain('≈')
    expect(screen.getByText(/10h of this week's hours still wait on approval/)).toBeTruthy()
    expect(screen.getByTestId('bridge-headline-verdict').textContent).toMatch(/Contribution ran \$600 to \$600 a week/)
    expect(screen.getByTestId('bridge-light-red').textContent).toContain('down $37.4k since Aug 15')
    expect(screen.getByTestId('bridge-light-amber').textContent).toContain('typed Sep 3, 37 days ago')
    expect(screen.getByTestId('bridge-headline-bars').textContent).toContain('Aug 16')
  })

  it('reads while the weeks load, with the lights already there', () => {
    renderWithProviders(<BridgeHeadline headline={null} loading error={null} net={netPositionLight(null)} cash={cashLight(null)} />)
    expect(screen.getByText(/Reading the last 13 pay weeks/)).toBeTruthy()
    expect(screen.getAllByText('not read yet')).toHaveLength(2)
  })
})
