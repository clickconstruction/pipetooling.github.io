import { describe, expect, it } from 'vitest'
import { PORTAL_ONE_COLUMN, PORTAL_UNNAMED_GRID, portalFitCss } from './tradePortalFit'
import { ONE_COLUMN } from '../messages/pageFit'

describe('the trade portal’s pages fit their shell (finding 334)', () => {
  const css = portalFitCss('[data-trade-portal]')

  it('names the one column for every grid inside the shell that names none', () => {
    expect(PORTAL_ONE_COLUMN).toBe('minmax(0, 1fr)')
    // The same column Messages took for the same fault.
    expect(PORTAL_ONE_COLUMN).toBe(ONE_COLUMN)
    expect(css).toContain(`[data-trade-portal] ${PORTAL_UNNAMED_GRID} { grid-template-columns: minmax(0, 1fr); }`)
  })

  it('reads a grid by its drawn style, and leaves one that names its columns or flows sideways', () => {
    expect(PORTAL_UNNAMED_GRID).toBe('[style*="display: grid"]:not([style*="grid-template"]):not([style*="grid-auto"])')
  })

  it('holds the file picker to the card it stands in', () => {
    expect(css).toContain('[data-trade-portal] input[type="file"] { max-width: 100%; }')
  })

  it('reaches nothing outside the shell, and is marked important nowhere', () => {
    for (const rule of css.split('}').map((r) => r.trim()).filter(Boolean)) expect(rule.startsWith('[data-trade-portal] ')).toBe(true)
    expect(css).not.toContain('!important')
  })
})
