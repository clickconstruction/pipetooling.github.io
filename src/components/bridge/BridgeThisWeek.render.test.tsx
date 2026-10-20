// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { BridgeThisWeek } from './BridgeThisWeek'
import { buildThisWeek } from '../../lib/bridge/thisWeek'

describe('BridgeThisWeek', () => {
  it('numbers the moves with their levers and doors', () => {
    const moves = buildThisWeek({
      unbilledUsd: 228_000,
      unbilledCount: 14,
      lateReceipts: { count: 48, usd: 227_536 },
      pendingClosedHours: 585,
      pendingClosedSessions: 104,
      payrollWeeklyEstUsd: 7448,
      noContractJobs: [{ id: 'a', label: '912' }],
      assumedHalfJobs: 0,
      assumedHalfEarnedUsd: 0,
      fieldEarnedPerHour: 169,
      contributionMargin: 0.27,
      overheadPerDayUsd: 348,
      bidsDue: [],
      dayLabel: (ymd) => ymd,
    })
    renderWithProviders(<BridgeThisWeek moves={moves} />)
    expect(screen.getByTestId('bridge-move-bill').textContent).toContain('1Bill the finished work')
    expect(screen.getByText('+$228k owed to you')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Open Billing' }).getAttribute('href')).toBe('/jobs?tab=billing')
    expect(screen.getByRole('link', { name: 'Open approvals' }).getAttribute('href')).toBe('/people?tab=hours&approvals=1')
    expect(screen.getByText('+$52/day')).toBeTruthy()
  })
  it('says so with nothing to move', () => {
    renderWithProviders(<BridgeThisWeek moves={[]} />)
    expect(screen.getByText('nothing to move today')).toBeTruthy()
  })
})
