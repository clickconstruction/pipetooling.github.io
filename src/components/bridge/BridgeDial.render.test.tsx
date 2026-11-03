// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
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
    const reading = buildDialReading(input, 'bill', 22_000, { spec, todayYmd: '2026-10-10', dayLabel: (y) => y })
    const onChange = vi.fn()
    renderWithProviders(<BridgeDial reading={reading} moved={false} onChange={onChange} onReset={() => {}} />)
    expect(screen.getByTestId('bridge-dial-value').textContent).toBe('$22k/wk')
    expect(screen.getAllByTestId('bridge-dial-mark').map((m) => m.textContent)).toEqual(['today', 'above here Build is the link', 'a second biller from here', 'the pile stops growing'])
    expect(screen.getByTestId('bridge-dial-the-link').textContent).toContain('Bill is the weakest link')
    expect(screen.queryByTestId('bridge-dial-reset')).toBeNull()
    fireEvent.change(screen.getByRole('slider'), { target: { value: '40000' } })
    expect(onChange).toHaveBeenCalledWith(40_000)
  })
  it('lets the slider, the number and the spark wrap under each other on a phone (v2.6421)', () => {
    // jsdom lays nothing out, so this pins the row's rule: a fixed 240 px grid column collapsed the slider to
    // nothing at 375 and ran the spark 49 px past the screen. The slider grows, the spark never does.
    const spec = dialSpec(input, 'bill', { perUnitUsd: 233_000 / 15 })!
    const reading = buildDialReading(input, 'bill', 22_000, { spec, todayYmd: '2026-10-10', dayLabel: (y) => y })
    renderWithProviders(<BridgeDial reading={reading} moved={false} onChange={() => {}} onReset={() => {}} />)
    const row = screen.getByRole('slider').closest('div')!.parentElement!.parentElement as HTMLElement
    expect(row.style.display).toBe('flex')
    expect(row.style.flexWrap).toBe('wrap')
    const [slider, value, spark] = Array.from(row.children) as [HTMLElement, HTMLElement, HTMLElement]
    expect(slider.style.flex).toBe('1 1 220px')
    expect(value.contains(screen.getByTestId('bridge-dial-value'))).toBe(true)
    expect(spark.querySelector('svg')).not.toBeNull()
    expect(spark.style.flex).toBe('0 1 240px')
    expect(spark.style.maxWidth).toBe('100%')
  })
  describe('the marks', () => {
    afterEach(() => vi.restoreAllMocks())
    /** jsdom lays nothing out, so the track and each label answer with a width: the track `trackPx`, a label 4.6 px a character. */
    const measure = (trackPx: number) =>
      vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
        const width = this.dataset.testid === 'bridge-dial-mark' ? (this.textContent?.length ?? 0) * 4.6 : this.querySelector('[data-testid="bridge-dial-mark"]') ? trackPx : 0
        return { x: 0, y: 0, top: 0, left: 0, bottom: 0, right: width, width, height: 0, toJSON: () => ({}) } as DOMRect
      })
    const draw = () => {
      const spec = dialSpec(input, 'bill', { perUnitUsd: 233_000 / 15 })!
      const reading = buildDialReading(input, 'bill', 22_000, { spec, todayYmd: '2026-10-10', dayLabel: (y) => y })
      renderWithProviders(<BridgeDial reading={reading} moved={false} onChange={() => {}} onReset={() => {}} />)
      const marks = screen.getAllByTestId('bridge-dial-mark')
      return { rows: marks.map((m) => m.dataset.row), track: marks[0]!.parentElement!.parentElement as HTMLElement }
    }
    it('lays the labels into rows by their measured widths, and the track grows past two rows on a phone', () => {
      measure(328)
      const { rows, track } = draw()
      expect(new Set(rows).size).toBeGreaterThan(2)
      expect(track.style.height).toBe(`${28 + 13 * new Set(rows).size}px`)
    })
    it('keeps a desk track at its two-row height', () => {
      measure(740)
      const { rows, track } = draw()
      expect(new Set(rows).size).toBeLessThanOrEqual(2)
      expect(track.style.height).toBe('54px')
    })
  })
})
