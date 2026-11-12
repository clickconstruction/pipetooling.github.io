// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { BridgeFlowStripDown } from './BridgeFlowStripDown'
import { buildFlowStrip } from '../../lib/bridge/flowStrip'
import type { MarketWorth } from '../../lib/bridge/bidWins'
import type { StageFlow, StageId, StageReading } from '../../lib/bridge/stageFlow'

// Made-up paces and piles.
const stage = (id: StageId, name: string, weeks: number | null): StageReading => ({ id, name, object: '', action: '', readable: true, pile: { headline: '', sub: [], usd: null, guessShare: 0 }, flow: [], weeks, weeksText: '', badge: '', tone: 'plain', isLink: false })
const flow: StageFlow = { stages: [stage('market', 'Market', null), stage('sales', 'Sales', null), stage('build', 'Build', 4.2), stage('bill', 'Bill', 7.5), stage('collect', 'Collect', 2.6)], linkId: 'bill', nominatedId: 'bill', heldStands: false, pairId: null }
const strip = buildFlowStrip(flow, { market: 160_000, sales: 36_000, build: 33_000, bill: 19_000, collect: 26_000 })
const market: MarketWorth = {
  perWeekUsd: 9_000,
  pace: 'worth $9k a week',
  parts: ['bids $6k at 4% won', 'estimates $3k at 60% won'],
  detail: ['Bids: $150k went out a week over the last 8 weeks.', 'Estimates: won by dollars is 60%.'],
}

describe('BridgeFlowStripDown', () => {
  it('draws the five steps as one pipe running down, with a press on each row', () => {
    const onOpen = vi.fn()
    renderWithProviders(<BridgeFlowStripDown strip={strip} onOpen={onOpen} />)
    const section = screen.getByTestId('bridge-flow-strip')
    expect(section.getAttribute('aria-label')).toBe('The five steps as one pipe. Bill is lit.')
    // One outline for the pipe and a red run on the lit step.
    expect(section.querySelectorAll('polygon').length).toBe(1)
    expect(section.querySelectorAll('rect[fill="#dc2626"]').length).toBe(1)
    expect(screen.getByTestId('bridge-flow-strip-legend').textContent).toBe('Dollars a week. A bar is work waiting in front of a step.')
    // Until Market's worth is read its row says what was bid, and there is no working to open.
    expect(screen.getByTestId('bridge-strip-market').textContent).toBe('Marketbid $160k a week')
    expect(screen.queryByTestId('bridge-strip-market-toggle')).toBeNull()
    expect(screen.getByTestId('bridge-strip-bill').textContent).toBe('Bill, the slowest stepbilled $19k a week8 weeks wait')
    // The press says the whole reading to a screen reader, and hands back its step.
    fireEvent.click(screen.getByRole('button', { name: 'Bill. $19k billed a week. 8 weeks of work wait in front of it. The slowest step. Open its desk.' }))
    expect(onOpen).toHaveBeenCalledWith('bill')
  })

  it('reads Market at what it is worth, with its two parts and the working behind one press', () => {
    renderWithProviders(<BridgeFlowStripDown strip={strip} onOpen={() => {}} market={market} />)
    expect(screen.getByTestId('bridge-strip-market').textContent).toBe('Marketworth $9k a weekbids $6k at 4% wonestimates $3k at 60% won')
    expect(screen.getByRole('button', { name: 'Market. Worth $9k a week. Open its desk.' })).toBeTruthy()
    // The working is closed until it is asked for.
    expect(screen.queryByTestId('bridge-strip-market-detail')).toBeNull()
    const toggle = screen.getByTestId('bridge-strip-market-toggle')
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    expect(Array.from(screen.getByTestId('bridge-strip-market-detail').querySelectorAll('li')).map((li) => li.textContent)).toEqual(market.detail)
  })

  it('keeps the dollars bid on Market’s row when its worth cannot be read', () => {
    renderWithProviders(<BridgeFlowStripDown strip={strip} onOpen={() => {}} market={{ perWeekUsd: null, pace: 'not read yet', parts: [], detail: [] }} />)
    expect(screen.getByTestId('bridge-strip-market').textContent).toBe('Marketbid $160k a week')
    expect(screen.queryByTestId('bridge-strip-market-toggle')).toBeNull()
  })
})
