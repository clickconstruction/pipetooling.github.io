// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { BridgeBreakdownPanel } from './BridgeBreakdownPanel'
import { buildNetPanel } from '../../lib/bridge/netCashPanels'

describe('BridgeBreakdownPanel', () => {
  it('draws the waterfall, the sources with their doors, and the closing line', () => {
    const p = buildNetPanel({
      history: [
        { ymd: '2026-08-15', offset: -56, cashUsd: 50_000, arUsd: 344_600, apUsd: 243_200, netUsd: 151_400 },
        { ymd: '2026-10-10', offset: 0, cashUsd: 32_000, arUsd: 332_000, apUsd: 250_000, netUsd: 114_000 },
      ],
      startLabel: 'Aug 15',
      bankUsd: 390,
      typedRolledUsd: 32_100,
      typedLabel: 'Sep 3',
      pendingClosedHours: 585,
      paperProfitUsd: 54_600,
      billingLagUsd: 98_100,
      costGapUsd: -6100,
    })!
    renderWithProviders(<BridgeBreakdownPanel title="What moved it, Aug 15 to today" sub="the three parts" bars={p.waterfall} sources={p.sources} closing={p.paper} testId="bridge-net-panel" />)
    expect(screen.getByTestId('bridge-net-panel-waterfall')).toBeTruthy()
    expect(screen.getByTestId('bridge-net-panel-closing').textContent).toContain('Against the paper')
    expect(screen.getByRole('link', { name: 'Sort' }).getAttribute('href')).toBe('/banking')
    expect(screen.getByText(/the bank reads \$390/)).toBeTruthy()
  })
})
