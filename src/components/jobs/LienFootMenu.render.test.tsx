// @vitest-environment jsdom
/**
 * The draft footer's small menu stands where it can be read whole (v2.7421; Taunya's find of 2026-11-15: *He already
 * okayed it ▾* opened with its left side cut off by the paper's pane).
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { LienFootMenu } from './LienFootMenu'
import type { LienFooterMenu } from '../../lib/jobs/lienFooterMenu'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const MENU: LienFooterMenu = {
  key: 'okayed',
  label: 'He already okayed it ▾',
  aria: 'He already okayed it. Pick how.',
  rows: [
    { key: 'word', label: 'Sam said to send it…', title: 'Sam already said to send it.' },
    { key: 'pen', label: 'He signed the paper…', title: 'He signed the printed paper with a pen.' },
  ],
}

const rect = (left: number, top: number, right: number, bottom: number) => ({ left, top, right, bottom, width: right - left, height: bottom - top, x: left, y: top, toJSON: () => ({}) }) as DOMRect

/** jsdom lays nothing out: hand the press, the menu and the pane their boxes as the desk measured them at 1440 px. */
function layout(press: DOMRect) {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    if (this.hasAttribute('data-lien-foot-menu-press')) return press
    if (this.hasAttribute('data-pane')) return rect(344, 141, 1416, 892)
    return rect(0, 0, 0, 0)
  })
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (this: HTMLElement) {
    return this.getAttribute('role') === 'menu' ? 260 : 0
  })
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (this: HTMLElement) {
    return this.getAttribute('role') === 'menu' ? 200 : 0
  })
  Object.defineProperty(document.documentElement, 'clientWidth', { configurable: true, value: 1440 })
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 900 })
}

function mount(onPick = vi.fn()) {
  render(
    <div data-pane style={{ overflowX: 'hidden', overflowY: 'hidden' }}>
      <LienFootMenu menu={MENU} onPick={onPick} style={{}} />
    </div>,
  )
  return { onPick, press: document.querySelector('[data-lien-foot-menu-press]') as HTMLButtonElement, list: () => document.querySelector('[role="menu"]') as HTMLElement | null }
}

describe('LienFootMenu · the menu stays inside what can show it (v2.7421)', () => {
  it('the first press of the footer opens its menu flush with its own left edge, over it, inside the pane that would cut it', () => {
    layout(rect(380, 841, 540, 870))
    const { press, list } = mount()
    expect(list()).toBeNull()
    fireEvent.click(press)
    const menu = list()!
    // It was pinned to the press's right edge and ran 64 px out of the pane on the left.
    expect(menu.style.right).toBe('')
    expect(menu.style.left).toBe('0px')
    expect(menu.getAttribute('data-lien-foot-menu-list')).toBe('over')
    expect(menu.style.bottom).toBe('calc(100% + 4px)')
    expect(menu.style.visibility).toBe('visible')
    expect(Array.from(menu.querySelectorAll('[role="menuitem"] strong')).map((s) => s.textContent)).toEqual(['Sam said to send it…', 'He signed the paper…'])
  })

  it('a press at the right end of the footer pulls its menu back inside the pane', () => {
    layout(rect(1250, 841, 1400, 870))
    const { press, list } = mount()
    fireEvent.click(press)
    // 1250 − 102 + 260 = 1408, 8 px inside the pane's right edge at 1416.
    expect(list()!.style.left).toBe('-102px')
  })

  it('a footer with no room over it opens its menu under the press', () => {
    layout(rect(380, 200, 540, 229))
    const { press, list } = mount()
    fireEvent.click(press)
    const menu = list()!
    expect(menu.getAttribute('data-lien-foot-menu-list')).toBe('under')
    expect(menu.style.top).toBe('calc(100% + 4px)')
    expect(menu.style.bottom).toBe('')
  })

  it('a row still runs its act and shuts the menu; Escape shuts it and nothing runs', () => {
    layout(rect(380, 841, 540, 870))
    const { press, list, onPick } = mount()
    fireEvent.click(press)
    fireEvent.click(document.querySelector('[data-lien-foot-menu-row="pen"]') as HTMLButtonElement)
    expect(onPick).toHaveBeenCalledWith('pen')
    expect(list()).toBeNull()
    fireEvent.click(press)
    expect(list()).not.toBeNull()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(list()).toBeNull()
    expect(onPick).toHaveBeenCalledTimes(1)
  })
})
