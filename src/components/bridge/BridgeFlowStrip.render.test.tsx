// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { BridgeFlowStrip } from './BridgeFlowStrip'
import { buildFlowStrip } from '../../lib/bridge/flowStrip'
import type { StageFlow, StageId, StageReading } from '../../lib/bridge/stageFlow'

// Made-up paces and piles.
const stage = (id: StageId, name: string, weeks: number | null): StageReading => ({ id, name, object: '', action: '', readable: true, pile: { headline: '', sub: [], usd: null, guessShare: 0 }, flow: [], weeks, weeksText: '', badge: '', tone: 'plain', isLink: false })
const flow: StageFlow = { stages: [stage('market', 'Market', null), stage('sales', 'Sales', null), stage('build', 'Build', 4.2), stage('bill', 'Bill', 7.5), stage('collect', 'Collect', 2.6)], linkId: 'bill', nominatedId: 'bill', heldStands: false, pairId: null }
const strip = buildFlowStrip(flow, { market: 44_000, sales: 36_000, build: 33_000, bill: 19_000, collect: 26_000 })

describe('BridgeFlowStrip', () => {
  it('draws the five steps as one pipe with a press on each, and opens the pressed step', () => {
    const onOpen = vi.fn()
    renderWithProviders(<BridgeFlowStrip strip={strip} onOpen={onOpen} />)
    const section = screen.getByTestId('bridge-flow-strip')
    expect(section.getAttribute('aria-label')).toBe('The five steps as one pipe. Bill is lit.')
    // One outline for the pipe, a red run on the lit step, and a block on each of the three piles.
    expect(section.querySelectorAll('polygon').length).toBe(1)
    expect(section.querySelectorAll('rect[fill="#dc2626"]').length).toBe(1)
    expect(section.querySelectorAll('rect').length).toBe(4)
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['Market$44k asked', 'Sales$36k sold', 'Build$33k built4 weeks wait', 'Bill$19k billed8 weeks wait', 'Collect$26k paid3 weeks wait'])
    expect(screen.getByTestId('bridge-flow-strip-legend').textContent).toBe('Dollars a week. A block is work waiting in front of a step.')
    // The press says the whole reading to a screen reader, and hands back its step.
    const bill = screen.getByRole('button', { name: 'Bill. $19k billed a week. 8 weeks of work wait in front of it. The slowest step. Open its desk.' })
    fireEvent.click(bill)
    expect(onOpen).toHaveBeenCalledWith('bill')
  })

  it('draws a step that does not read faint, with its words', () => {
    renderWithProviders(<BridgeFlowStrip strip={buildFlowStrip({ ...flow, linkId: null }, { build: 33_000 })} onOpen={() => {}} />)
    expect(screen.getByTestId('bridge-strip-market').textContent).toBe('Marketnot read')
    expect(screen.getByTestId('bridge-flow-strip').querySelectorAll('rect[fill="#dc2626"]').length).toBe(0)
  })
})
