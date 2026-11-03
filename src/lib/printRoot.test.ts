import { describe, expect, it } from 'vitest'
import { LETTER_PRINTABLE_PX, printRootCss } from './printRoot'

describe('printRootCss', () => {
  const css = printRootCss('on-site-manifest')

  it('is print-only, on Letter with half-inch margins', () => {
    expect(css.startsWith('@media print {')).toBe(true)
    expect(css.trim().endsWith('}')).toBe(true)
    expect(css).toContain('@page { size: letter; margin: 0.5in; }')
    expect(LETTER_PRINTABLE_PX).toEqual({ width: 720, height: 960 })
  })

  it('takes every other child of the body out of the layout, so a wide page behind cannot shrink the paper', () => {
    expect(css).toContain('body > *:not(.on-site-manifest) { display: none !important; }')
    expect(css).not.toContain('visibility: hidden')
  })

  it('prints the root in the normal flow, so its sheets paginate', () => {
    const root = css.slice(css.indexOf('.on-site-manifest {'))
    expect(root).toContain('position: static !important')
    expect(root).toContain('display: block !important')
    expect(root).toContain('height: auto !important')
    expect(root).toContain('overflow: visible !important')
  })

  it('lets go of the body the scroll lock pins, or the print stops at the first sheet', () => {
    expect(css).toContain('html.scroll-locked body { position: static !important; overflow: visible !important;')
  })

  it('refuses anything but a plain class name', () => {
    expect(() => printRootCss('.on-site-manifest')).toThrow(/plain class name/)
    expect(() => printRootCss('a b')).toThrow()
    expect(() => printRootCss('')).toThrow()
    expect(printRootCss('on-site-labels')).toContain('body > *:not(.on-site-labels)')
  })
})
