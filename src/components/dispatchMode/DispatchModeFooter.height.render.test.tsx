// @vitest-environment jsdom
/**
 * The tab bar publishes its measured height (v2.8035): the press bar, the page's padding and every window
 * that stops above the bar sit on `--app-tab-bar`, so none floats over a strip of the page on a phone with
 * a home indicator, where the bar is shorter than its 60 px minimum plus the inset.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { APP_TAB_BAR_VAR } from '../../lib/bottomChrome'
import { DispatchModeFooter } from './DispatchModeFooter'

vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' }, role: 'helpers' }) }))
vi.mock('../../hooks/useOnScreenKeyboardOpen', () => ({ useOnScreenKeyboardOpen: () => false }))
vi.mock('../../lib/navClickTelemetry', () => ({ recordNavClick: vi.fn() }))

const published = () => document.documentElement.style.getPropertyValue(APP_TAB_BAR_VAR)

/** jsdom has no layout: stand a measured box in for the tab bar's. */
function measureAs(height: () => number) {
  return vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const h = this.hasAttribute('data-app-bottom-chrome') ? height() : 0
    return { x: 0, y: 0, top: 0, left: 0, right: 0, bottom: h, width: 0, height: h, toJSON: () => ({}) } as DOMRect
  })
}

function draw(variant: 'job' | 'dispatch' = 'job') {
  return render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <DispatchModeFooter variant={variant} />
    </MemoryRouter>,
  )
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  document.documentElement.style.removeProperty(APP_TAB_BAR_VAR)
})

describe("the tab bar's measured height", () => {
  it('an iPhone with a home indicator: the bar stands 83.78 px tall and publishes 83, never the 94 of the old sum', () => {
    measureAs(() => 83.78)
    draw()
    expect(published()).toBe('83px')
  })

  it('a browser with no inset: the 60 px minimum is the height', () => {
    measureAs(() => 60)
    draw('dispatch')
    expect(published()).toBe('60px')
  })

  it('a turned phone: the height is read again on a resize', () => {
    let h = 83.78
    measureAs(() => h)
    draw()
    expect(published()).toBe('83px')
    h = 70.78
    window.dispatchEvent(new Event('resize'))
    expect(published()).toBe('70px')
  })

  it('with no layout it publishes nothing, and the chrome keeps its fallback', () => {
    measureAs(() => 0)
    draw()
    expect(published()).toBe('')
  })

  it('takes its height back when it leaves', () => {
    measureAs(() => 83.78)
    const { unmount } = draw()
    expect(published()).toBe('83px')
    unmount()
    expect(published()).toBe('')
  })
})
