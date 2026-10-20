// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { BridgeStages } from './BridgeStages'
import { BridgeRule } from './BridgeRule'
import { buildStageFlow } from '../../lib/bridge/stageFlow'

describe('BridgeStages', () => {
  it('draws the five cards with the link in red and the unread ones saying so', () => {
    const flow = buildStageFlow({
      market: null, sales: null, fieldPerWeekUsd: null, bill: { pileUsd: 233_000, pileCount: 15, inPerWeekUsd: 34_000, outPerWeekUsd: 22_000 },
      collect: { pileUsd: 332_000, pileCount: null, inPerWeekUsd: 22_000, outPerWeekUsd: 46_000, lateCount: 49 },
      build: null,
      heldLinkId: null,
    })
    const onPick = vi.fn()
    renderWithProviders(<BridgeStages flow={flow} pickedId="bill" onPick={onPick} />)
    expect(screen.getByTestId('bridge-stage-badge-bill').textContent).toBe('the weakest link')
    expect(screen.getByTestId('bridge-stage-badge-collect').textContent).toBe('moves with Bill')
    expect(screen.getByTestId('bridge-stage-badge-build').textContent).toBe('not readable yet')
    expect(screen.getByText('10.6 weeks to bill what is already finished')).toBeTruthy()
    expect(screen.getByText('49 invoices late')).toBeTruthy()
    expect(screen.getByTestId('bridge-stage-bill').getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByTestId('bridge-stage-collect'))
    expect(onPick).toHaveBeenCalledWith('collect')
  })
})

describe('BridgeRule', () => {
  it('opens the long rule on press', () => {
    renderWithProviders(<BridgeRule />)
    expect(screen.queryByTestId('bridge-rule-popover')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Why this rule' }))
    expect(screen.getByTestId('bridge-rule-popover').textContent).toContain('A business is only as good as its weakest link')
    expect(screen.getByTestId('bridge-rule-popover').textContent).toContain('5 · Beware of inertia')
  })
})
