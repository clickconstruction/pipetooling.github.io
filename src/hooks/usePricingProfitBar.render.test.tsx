// @vitest-environment jsdom
/**
 * "Where the profit lives" as a hook (region P2 of the Pricing map). Pins the seam: the pin
 * lets go on a click outside the bar or on Escape, and holds on a click inside; the legend's
 * fold is read from the device and written back.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { usePricingProfitBar } from './usePricingProfitBar'

function Probe() {
  const b = usePricingProfitBar()
  return (
    <div>
      <div data-testid="state">{`pin:${b.wbBarPinnedId ?? 'none'} · hover:${b.wbBarHover ?? 'none'}@${b.wbBarTipLeft} · legend:${b.wbLegendCollapsed ? 'folded' : 'open'}`}</div>
      <div data-profit-bar>
        <button type="button" onClick={() => b.setWbBarPinnedId('c1')}>pin c1</button>
        <button type="button" onClick={() => b.toggleLegend()}>fold</button>
        <button type="button" onClick={() => { b.setWbBarHover(2); b.setWbBarTipLeft(140) }}>hover 2</button>
        <span>inside the bar</span>
      </div>
      <p>somewhere else</p>
    </div>
  )
}

beforeEach(() => window.localStorage.clear())
afterEach(() => cleanup())

const state = () => screen.getByTestId('state').textContent

describe('usePricingProfitBar', () => {
  it('starts with nothing pinned or hovered and the legend open', () => {
    render(<Probe />)
    // first paint
    expect(state()).toBe('pin:none · hover:none@0 · legend:open')
  })

  it('a click inside the bar keeps the pin; a click outside lets go', () => {
    render(<Probe />)
    fireEvent.click(screen.getByText('pin c1'))
    expect(state()).toContain('pin:c1')
    fireEvent.mouseDown(screen.getByText('inside the bar'))
    expect(state()).toContain('pin:c1')
    fireEvent.mouseDown(screen.getByText('somewhere else'))
    expect(state()).toContain('pin:none')
  })

  it('Escape lets go of the pin; another key does not', () => {
    render(<Probe />)
    fireEvent.click(screen.getByText('pin c1'))
    fireEvent.keyDown(document, { key: 'Enter' })
    expect(state()).toContain('pin:c1')
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(state()).toContain('pin:none')
  })

  it('the hover and its tooltip position are held as set', () => {
    render(<Probe />)
    fireEvent.click(screen.getByText('hover 2'))
    expect(state()).toContain('hover:2@140')
  })

  it('folding the legend is remembered on the device, and read back on the next mount', () => {
    const { unmount } = render(<Probe />)
    fireEvent.click(screen.getByText('fold'))
    expect(state()).toContain('legend:folded')
    expect(window.localStorage.getItem('wbProfitLegendCollapsed_v1')).toBe('1')
    unmount()
    render(<Probe />)
    // first paint
    expect(state()).toContain('legend:folded')
    fireEvent.click(screen.getByText('fold'))
    expect(window.localStorage.getItem('wbProfitLegendCollapsed_v1')).toBe('0')
  })

  it('stops listening once it unmounts', () => {
    const { unmount } = render(<Probe />)
    fireEvent.click(screen.getByText('pin c1'))
    unmount()
    expect(() => {
      fireEvent.mouseDown(document.body)
      fireEvent.keyDown(document, { key: 'Escape' })
    }).not.toThrow()
  })
})
