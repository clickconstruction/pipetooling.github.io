// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { BridgeMondaySheet } from './BridgeMondaySheet'
import { buildMondaySheet } from '../../lib/bridge/mondaySheet'
import { cashLight, netPositionLight } from '../../lib/bridge/headline'

describe('BridgeMondaySheet', () => {
  it('draws the three tiles, the moves and the people, and the email button calls back', () => {
    const sheet = buildMondaySheet({
      todayLabel: 'Fri Oct 10',
      weekLabel: 'Oct 4–10',
      headline: null,
      net: netPositionLight({ deltaUsd: -37_400, todayUsd: 114_000, startLabel: 'Aug 15', paperProfitUsd: 54_600, billingLagUsd: 98_100 }),
      cash: cashLight({ lowestUsd: 15_400, lowestLabel: 'Oct 12', floorUsd: 5000, clearsFloor: true, daysUnderFloor: 0, typedLabel: null, typedDaysAgo: null, synced: true }),
      netRows: [{ label: 'Finished, unbilled', value: '$228k' }],
      cashRows: [],
      moves: [{ key: 'bill', title: 'Bill the finished work', why: '$228k not yet billed', lever: '+$228k owed to you', leverTone: 'green', door: null }],
      people: ['Malachi · 40h · +$5.6k'],
    })
    const onEmail = vi.fn()
    renderWithProviders(<BridgeMondaySheet sheet={sheet} emailing={false} onEmail={onEmail} onFull={() => {}} mailNote={null} />)
    expect(screen.getByTestId('sheet-tile-red').textContent).toContain('down $37.4k since Aug 15')
    expect(screen.getByTestId('sheet-tile-green').textContent).toContain('lowest point $15.4k on Oct 12')
    expect(screen.getByText('Finished, unbilled')).toBeTruthy()
    expect(screen.getByText('Bill the finished work')).toBeTruthy()
    expect(screen.getByText('Malachi · 40h · +$5.6k')).toBeTruthy()
    fireEvent.click(screen.getByTestId('sheet-email-me'))
    expect(onEmail).toHaveBeenCalledTimes(1)
  })
})
