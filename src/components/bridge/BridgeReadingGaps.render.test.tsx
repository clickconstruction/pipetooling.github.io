// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { BridgeReadingGaps } from './BridgeReadingGaps'
import { buildReadingGaps } from '../../lib/bridge/readingGaps'

describe('BridgeReadingGaps', () => {
  it('lists each gap with its chip, what it moves and its door', () => {
    const gaps = buildReadingGaps({
      pendingClosedHours: 585,
      pendingClosedSessions: 104,
      headlineRecordedUsd: 38_300,
      headlineApprovedUsd: 9700,
      bankUsd: 390,
      typedRolledUsd: 32_100,
      typedLabel: 'Sep 3',
      typedDaysAgo: 37,
      assumedHalfJobs: 6,
      assumedHalfEarnedUsd: 20_341,
      noContractJobs: [{ id: 'a', label: '912' }],
      unattributedNoncard: 1151,
      unlinkedCard: 35,
      overheadPerDayUsd: 348,
      bidsNoValue: 0,
    })
    renderWithProviders(<BridgeReadingGaps gaps={gaps} />)
    expect(screen.getByText('585h unapproved')).toBeTruthy()
    expect(screen.getByTestId('bridge-gap-unapproved').textContent).toContain('moves the headline from +$9.7k to ≈ +$38.3k this week')
    expect(screen.getByRole('link', { name: 'Approve' }).getAttribute('href')).toBe('/people?tab=hours&approvals=1')
    expect(screen.getAllByRole('link', { name: 'Sort' })).toHaveLength(3)
    expect(screen.getByTestId('bridge-reading-gaps').firstChild?.textContent).toContain('biggest mover first')
  })
  it('says so when there is nothing to fix', () => {
    renderWithProviders(<BridgeReadingGaps gaps={[]} />)
    expect(screen.getByText(/nothing makes the page read low or thin today/)).toBeTruthy()
  })
})
