import { describe, expect, it } from 'vitest'
import { lienDeskFooterHome } from './lienDeskFooterHome'

describe('lienDeskFooterHome', () => {
  it('a computer: the footer is the pane column’s pinned bottom row and the pane scrolls above it', () => {
    const h = lienDeskFooterHome(false)
    expect(h.in).toBe('pane')
    expect(h.column?.gridTemplateRows).toBe('minmax(0, 1fr) auto')
    expect(h.column?.minHeight).toBe(0)
    expect(h.column?.overflow).toBe('hidden')
  })

  it('a phone: the footer stays the desk’s, right after the fold bar, with no column around the pane', () => {
    const h = lienDeskFooterHome(true)
    expect(h.in).toBe('desk')
    expect(h.column).toBeNull()
  })
})
