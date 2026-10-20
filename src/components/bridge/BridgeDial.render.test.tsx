// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { BridgeDial } from './BridgeDial'
import { buildDialReading, dialSpec } from '../../lib/bridge/dial'
import type { StageFlowInput } from '../../lib/bridge/stageFlow'

const input: StageFlowInput = {
  market: null,
  sales: null,
  fieldPerWeekUsd: 35_000,
  build: { pileUsd: 362_000, pileCount: 28, inPerWeekUsd: 49_000, outPerWeekUsd: 35_000, knownJobs: 28, guessUsd: 0, guessJobs: 0 },
  bill: { pileUsd: 233_000, pileCount: 15, inPerWeekUsd: 34_000, outPerWeekUsd: 22_000 },
  collect: { pileUsd: 332_000, pileCount: 49, inPerWeekUsd: 22_000, outPerWeekUsd: 46_000, lateCount: 49 },
  heldLinkId: null,
}

describe('BridgeDial', () => {
  it('draws the slider, the marks, the value and the three readings, and reports a change', () => {
    const spec = dialSpec(input, 'bill', { perUnitUsd: 233_000 / 15 })!
    const reading = buildDialReading(input, 'bill', 22_000, { spec, todayYmd: '2026-10-10', dayLabel: (y) => y, fieldHoursPerWeek: null })
    const onChange = vi.fn()
    renderWithProviders(<BridgeDial reading={reading} moved={false} onChange={onChange} onReset={() => {}} />)
    expect(screen.getByTestId('bridge-dial-value').textContent).toBe('$22k/wk')
    expect(screen.getAllByTestId('bridge-dial-mark').map((m) => m.textContent)).toEqual(['today', 'above here Build is the link', 'a second biller from here', 'the pile stops growing'])
    expect(screen.getByTestId('bridge-dial-the-link').textContent).toContain('Bill is the weakest link')
    expect(screen.queryByTestId('bridge-dial-reset')).toBeNull()
    fireEvent.change(screen.getByRole('slider'), { target: { value: '40000' } })
    expect(onChange).toHaveBeenCalledWith(40_000)
  })
})
