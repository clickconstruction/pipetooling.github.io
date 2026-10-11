// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { BridgeProfitPanel } from './BridgeProfitPanel'
import { buildProfitPanel } from '../../lib/bridge/profitPanel'

describe('BridgeProfitPanel', () => {
  it('draws the four parts and closes', () => {
    const panel = buildProfitPanel({
      windowStart: '2026-09-27',
      todayYmd: '2026-10-10',
      earnedByDay: new Map([
        ['2026-09-28', 6000],
        ['2026-10-05', 2000],
      ]),
      directByDay: new Map([
        ['2026-09-28', 3000],
        ['2026-10-05', 3000],
      ]),
      overheadByDay: new Map([['2026-09-29', 348]]),
      speed: { days: 14, earnedPerDay: 1730, directPerDay: 3415, overheadPerDay: 348, climbPerDay: -2033 },
      contributionMargin: 0.27,
      totals: { earnedUsd: 274_000, fieldLaborUsd: 99_000, materialsUsd: 75_000, subLaborUsd: 25_000, overheadUsd: 18_000 },
      waitingWeeks: new Set(['2026-10-04']),
      pendingClosedHours: 585,
      unlinkedCard: 35,
      unattributedNoncard: 1151,
      fieldEarnedPerHour: 120,
      weekLabel: (s) => s,
    })
    const onClose = vi.fn()
    renderWithProviders(<BridgeProfitPanel panel={panel} onClose={onClose} />)
    expect(screen.getByTestId('bridge-profit-trend')).toBeTruthy()
    expect(screen.getByTestId('bridge-profit-waterfall')).toBeTruthy()
    expect(screen.getByTestId('bridge-profit-note').textContent).toContain('a reading, not a result')
    expect(screen.getByTestId('bridge-profit-breakeven').textContent).toContain('Break-even')
    expect(screen.getAllByRole('link', { name: 'Approve' })[0]!.getAttribute('href')).toBe('/people?tab=hours&approvals=1')
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
