import { describe, it, expect } from 'vitest'
import {
  STICKY_MODAL_CLOSE_BUTTON_STYLE,
  phoneSafeMinWidth,
  stickyModalHeaderStyle,
  stickyModalPanelStyle,
} from './stickyModalHeaderStyle'

describe('stickyModalPanelStyle', () => {
  it('leaves no top padding — the inset belongs to the sticky bar', () => {
    // A bar sticking at top: 0 inside a padded scroller leaves a strip the
    // height of that padding where content scrolls through above the bar.
    expect(stickyModalPanelStyle(560).padding).toBe('0 1.5rem 1.5rem')
  })

  it('sizes by min(maxWidth, 100%) so a 375px phone is never overflowed', () => {
    const style = stickyModalPanelStyle(560)
    expect(style.width).toBe('min(560px, 100%)')
    expect(style.maxWidth).toBe(560)
    expect(style.boxSizing).toBe('border-box')
  })

  it('omits width entirely when the panel is sized some other way', () => {
    const style = stickyModalPanelStyle()
    expect(style.width).toBeUndefined()
    expect(style.maxWidth).toBeUndefined()
    expect(style.boxSizing).toBe('border-box')
  })

  it('honours an asymmetric inset', () => {
    expect(stickyModalPanelStyle(undefined, { x: '1.25rem', top: '1rem', bottom: '1rem' }).padding).toBe(
      '0 1.25rem 1rem',
    )
  })
})

describe('stickyModalHeaderStyle', () => {
  it('pins to the panel top edge and paints over scrolling content', () => {
    const style = stickyModalHeaderStyle()
    expect(style.position).toBe('sticky')
    expect(style.top).toBe(0)
    expect(style.zIndex).toBe(2)
    // Opaque, or the content scrolling underneath shows through.
    expect(style.background).toBe('var(--surface)')
    expect(style.borderBottom).toBe('1px solid var(--border)')
  })

  it('carries the panel top inset so nothing scrolls through above the bar', () => {
    const inset = { x: '1.25rem', top: '1rem', bottom: '1rem' }
    const panelTop = stickyModalPanelStyle(undefined, inset).padding?.toString().split(' ')[0]
    expect(panelTop).toBe('0')
    expect(stickyModalHeaderStyle(inset).padding).toBe('1rem 1.25rem 0.75rem')
  })

  it('cancels the panel side padding so the opaque bar spans full width', () => {
    expect(stickyModalHeaderStyle().margin).toBe('0 -1.5rem 1rem')
    expect(stickyModalHeaderStyle({ x: '1.25rem' }).margin).toBe('0 -1.25rem 1rem')
  })
})

describe('STICKY_MODAL_CLOSE_BUTTON_STYLE', () => {
  it('is at least a 44x44 tap target', () => {
    expect(STICKY_MODAL_CLOSE_BUTTON_STYLE.minWidth).toBeGreaterThanOrEqual(44)
    expect(STICKY_MODAL_CLOSE_BUTTON_STYLE.minHeight).toBeGreaterThanOrEqual(44)
    expect(STICKY_MODAL_CLOSE_BUTTON_STYLE.display).toBe('inline-flex')
  })

  it('never shrinks away next to a long modal title', () => {
    expect(STICKY_MODAL_CLOSE_BUTTON_STYLE.flexShrink).toBe(0)
  })
})

describe('phoneSafeMinWidth', () => {
  it('caps the floor at the viewport so a 400px panel fits a 375px phone', () => {
    expect(phoneSafeMinWidth(400)).toBe('min(400px, 100%)')
  })
})
