// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { BridgeWaits } from './BridgeWaits'
import { buildReflexes, otherLevers } from '../../lib/bridge/waits'
import { buildFixSizes } from '../../lib/bridge/fixSizes'
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
    // With no sizes passed, the rows are as they were.
    expect(screen.queryByTestId('bridge-waits-size-overhead')).toBeNull()
    expect(screen.queryByTestId('bridge-waits-bids-due')).toBeNull()
  })

  it('says what the two fixes it can size are worth, and lists the bids due with their door (v2.6840)', () => {
    const reflexes = buildReflexes({ stageInput: input, fieldHoursPerWeek: 300, fieldPeople: 7 })
    // Made-up numbers and names.
    const sizes = buildFixSizes({ fieldEarnedPerHour: 72, contributionMargin: 0.7, overheadPerDayUsd: 1_150, bidsDue: [{ id: 'b1', label: 'Ridgeway Builders, lot 9', bidValueUsd: 63_000, dueYmd: '2026-11-14' }], dayLabel: () => 'Nov 14' })
    renderWithProviders(<BridgeWaits reflexes={reflexes} activeId={null} line={null} levers={otherLevers('bill')} onPress={() => {}} onReset={() => {}} sizes={sizes} />)
    expect(screen.getByTestId('bridge-waits-size-fieldday').textContent).toBe('+$58 a dayOne more day a week, at $72 an hour earned.')
    expect(screen.getByTestId('bridge-waits-size-overhead').textContent).toBe('+$115 a dayA tenth of $1,150 a day.')
    // The two the app cannot size stay bare.
    expect(screen.queryByTestId('bridge-waits-size-plumber')).toBeNull()
    expect(screen.queryByTestId('bridge-waits-size-bids')).toBeNull()
    const bids = screen.getByTestId('bridge-waits-bids-due')
    expect(bids.textContent).toContain('Ridgeway Builders, lot 9$63k, due Nov 14+$735 a day')
    expect(bids.textContent).toContain('A win is spread over 60 days of work.')
    expect(screen.getByRole('link', { name: 'Bids ›' }).getAttribute('href')).toBe('/bids')
  })
})
