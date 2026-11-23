// @vitest-environment jsdom
/**
 * The tab bar under the new phone layout (`lib/phoneLayout`): the same tabs with their words, each 52 px
 * tall, where the bar's own minimum was 60 px. Off, the bar is the bar it was. The phone's inset at the
 * foot is the bar's own padding either way.
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { PHONE_TABS_MIN_HEIGHT_PX } from '../../lib/phoneLayout/phoneBar'
import { DISPATCH_MODE_FOOTER_HEIGHT_PX, DispatchModeFooter } from './DispatchModeFooter'

vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' }, role: 'helpers' }) }))
vi.mock('../../hooks/useOnScreenKeyboardOpen', () => ({ useOnScreenKeyboardOpen: () => false }))
vi.mock('../../lib/navClickTelemetry', () => ({ recordNavClick: vi.fn() }))

function draw(props: { variant: 'job' | 'dispatch'; compact?: boolean; dock?: boolean }) {
  const { container } = render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <DispatchModeFooter
        variant={props.variant}
        compact={props.compact}
        inboxBadgeCount={3}
        showPoTab={props.variant === 'dispatch' && !props.dock}
        slots={props.dock ? ['jobs', 'schedule', 'quickfill', 'inbox'] : null}
        onOpenMore={props.dock ? () => {} : undefined}
      />
    </MemoryRouter>,
  )
  const nav = container.querySelector('nav') as HTMLElement
  const tabs = Array.from(nav.querySelectorAll('button')) as HTMLElement[]
  return { container, nav, tabs }
}

afterEach(cleanup)

describe('the tab bar, compact', () => {
  it.each([
    ['job', false],
    ['dispatch', false],
    ['dispatch', true],
  ] as const)('%s tabs (role dock: %s): the same tabs, words and badge, each 52 px tall', (variant, dock) => {
    const plain = draw({ variant, dock })
    const plainNames = plain.tabs.map((t) => t.getAttribute('aria-label'))
    const plainWords = plain.tabs.map((t) => t.textContent)
    cleanup()

    const { nav, tabs } = draw({ variant, dock, compact: true })
    expect(tabs.map((t) => t.getAttribute('aria-label'))).toEqual(plainNames)
    expect(tabs.map((t) => t.textContent)).toEqual(plainWords)
    expect(plainWords.every((w) => (w ?? '').length > 0)).toBe(true)
    expect(nav.getAttribute('data-compact')).toBe('true')
    // The tabs hold the height, so the bar is their 52 px, its line and the phone's inset under them.
    expect(nav.style.minHeight).toBe('')
    for (const tab of tabs) expect(tab.style.minHeight).toBe(`${PHONE_TABS_MIN_HEIGHT_PX}px`)
    expect(PHONE_TABS_MIN_HEIGHT_PX).toBeGreaterThanOrEqual(52)
  })

  it('off, the bar is the bar it was: its 60 px minimum, and no tab holds a height of its own', () => {
    for (const compact of [false, undefined]) {
      const { nav, tabs } = draw({ variant: 'job', compact })
      expect(nav.hasAttribute('data-compact')).toBe(false)
      expect(nav.style.minHeight).toBe(`${DISPATCH_MODE_FOOTER_HEIGHT_PX}px`)
      for (const tab of tabs) expect(tab.style.minHeight).toBe('')
      cleanup()
    }
  })

  it('off and on draw the same elements: only the sizes differ', () => {
    const shape = (root: HTMLElement) => root.innerHTML.replace(/ style="[^"]*"/g, '').replace(/ data-compact="true"/g, '')
    const off = shape(draw({ variant: 'job' }).container)
    cleanup()
    const on = shape(draw({ variant: 'job', compact: true }).container)
    expect(on).toBe(off)
  })

  it('keeps the phone’s inset at the foot as the bar’s own padding, in both sizes', () => {
    // jsdom drops `env()` from a style, so this reads the source: one padding, on the bar, not behind `compact`.
    const src = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), 'DispatchModeFooter.tsx'), 'utf8')
    expect(src.match(/paddingBottom: 'env\(safe-area-inset-bottom\)'/g)).toHaveLength(1)
    expect(src).not.toMatch(/compact \? [^\n]*safe-area/)
  })
})
