// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { BridgeProfitPanel } from './BridgeProfitPanel'
import { buildProfitPanel } from '../../lib/bridge/profitPanel'

describe('BridgeProfitPanel', () => {
  it('draws the warning first, then the day, the waterfall, break-even, the weeks, and the sources behind a press', () => {
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
    renderWithProviders(<BridgeProfitPanel panel={panel} />)
    // The warning stands first, then what a day keeps.
    const section = screen.getByTestId('bridge-profit-panel')
    expect(section.textContent?.indexOf('Reads low for now.')).toBeLessThan(section.textContent?.indexOf('short after every cost') ?? -1)
    expect(screen.getByTestId('bridge-profit-warn').textContent).toBe('Reads low for now. 585 hours still wait on approval. With them it reads about $2,981 a day.')
    expect(screen.getByTestId('bridge-profit-left').textContent).toContain('−$2,033')
    expect(screen.getByTestId('bridge-profit-trend')).toBeTruthy()
    expect(screen.getByTestId('bridge-profit-waterfall')).toBeTruthy()
    expect(screen.getByTestId('bridge-profit-breakeven').textContent).toContain('Break-even')
    // Where each number comes from waits behind its own press.
    expect(screen.queryByTestId('bridge-profit-sources')).toBeNull()
    fireEvent.click(screen.getByTestId('bridge-profit-sources-toggle'))
    expect(screen.getAllByRole('link', { name: 'Approve ›' })[0]!.getAttribute('href')).toBe('/people?tab=hours&approvals=1')
  })
})
