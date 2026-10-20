// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { BridgeWaits } from './BridgeWaits'
import { buildReflexes, otherLevers } from '../../lib/bridge/waits'
import type { StageFlowInput } from '../../lib/bridge/stageFlow'

const input: StageFlowInput = {
  market: { bidsInvited: 20, bidsInvitedUsd: 2_400_000, estimatesRequested: 25, estimatesRequestedUsd: 64_000, weeks: 8 },
  sales: null,
  fieldPerWeekUsd: 35_000,
  build: { pileUsd: 362_000, pileCount: 28, inPerWeekUsd: 49_000, outPerWeekUsd: 35_000, knownJobs: 28, guessUsd: 0, guessJobs: 0 },
  bill: { pileUsd: 233_000, pileCount: 15, inPerWeekUsd: 34_000, outPerWeekUsd: 22_000 },
  collect: null,
  heldLinkId: null,
}

describe('BridgeWaits', () => {
  it('lists the four presses, shows the active line, and opens the levers', () => {
    const reflexes = buildReflexes({ stageInput: input, fieldHoursPerWeek: 300, fieldPeople: 7 })
    const onPress = vi.fn()
    renderWithProviders(<BridgeWaits reflexes={reflexes} activeId="plumber" line={{ text: 'Hire another plumber: the link did not move.', tone: 'amber' }} levers={otherLevers('bill')} onPress={onPress} onReset={() => {}} />)
    expect(screen.getByTestId('bridge-waits-line').textContent).toBe('Hire another plumber: the link did not move.')
    expect(screen.getByTestId('bridge-waits-reset')).toBeTruthy()
    fireEvent.click(screen.getByTestId('bridge-waits-overhead'))
    expect(onPress).toHaveBeenCalledWith('overhead')
    fireEvent.click(screen.getByRole('button', { name: "The other links' levers" }))
    expect(screen.getByTestId('bridge-waits-levers').textContent).toContain('more bids out, referrals')
    expect(screen.getByTestId('bridge-waits-levers').textContent).not.toContain('bill and collect')
  })
})
