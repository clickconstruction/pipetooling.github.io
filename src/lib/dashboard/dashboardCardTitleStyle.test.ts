import { describe, expect, it } from 'vitest'
import { DASHBOARD_CARD_BOX, DASHBOARD_CARD_TITLE_STYLE, dashboardCardHeadStyle } from './dashboardCardTitleStyle'

const ORANGE_EDGE = '4px solid #f97316'

describe('dashboardCardHeadStyle', () => {
  it('reaches the edges of the common card and keeps the row as wide as it was', () => {
    const style = dashboardCardHeadStyle({ card: DASHBOARD_CARD_BOX, below: '0.75rem', closed: false })
    expect(style.margin).toBe('-0.85rem -1rem 0.75rem')
    // The side padding is the card's own, less the 4px edge on the left, so the title's row is no narrower.
    expect(style.padding).toBe('0.3rem 1rem 0.3rem calc(1rem - 4px)')
    expect(style.borderLeft).toBe(ORANGE_EDGE)
    expect(style.borderRadius).toBe('7px 7px 0 0')
    expect(style.borderBottom).toBe('1px solid var(--border)')
  })

  it('follows a card with its own padding and corner', () => {
    const style = dashboardCardHeadStyle({ card: { top: '0.7rem', side: '0.9rem', radius: 12 }, below: '0.5rem', closed: false })
    expect(style.margin).toBe('-0.7rem -0.9rem 0.5rem')
    expect(style.borderRadius).toBe('11px 11px 0 0')
  })

  it('fills a folded card to its bottom edge, with every corner rounded and no rule under it', () => {
    const style = dashboardCardHeadStyle({ card: DASHBOARD_CARD_BOX, below: '0.5rem', closed: true })
    expect(style.margin).toBe('-0.85rem -1rem -0.85rem')
    expect(style.borderRadius).toBe(7)
    expect(style.borderBottom).toBeUndefined()
    expect(style.borderLeft).toBe(ORANGE_EDGE)
  })

  it('stays square, with a rule above and below, when it is not the first line of its card', () => {
    const style = dashboardCardHeadStyle({ card: { top: null, side: '1.25rem', radius: 10 }, below: '0.75rem', closed: false })
    expect(style.margin).toBe('0 -1.25rem 0.75rem')
    expect(style.borderRadius).toBeUndefined()
    expect(style.borderTop).toBe('1px solid var(--border)')
    expect(style.borderBottom).toBe('1px solid var(--border)')
  })

  it('stands by itself, as the Edit Job heading does, where a section has no card', () => {
    const style = dashboardCardHeadStyle({ card: null, below: '0.5rem', closed: false })
    expect(style.margin).toBeUndefined()
    expect(style.marginBottom).toBe('0.5rem')
    expect(style.borderRadius).toBe(6)
    // React writes a style's keys in order: the orange edge must come after the whole border, or the border wins.
    const keys = Object.keys(style)
    expect(keys.indexOf('borderLeft')).toBeGreaterThan(keys.indexOf('border'))
    expect(style.borderLeft).toBe(ORANGE_EDGE)
  })

  it('draws every head on the same tint, at a height a thumb can hit', () => {
    for (const card of [DASHBOARD_CARD_BOX, null]) {
      const style = dashboardCardHeadStyle({ card, below: '0', closed: false })
      expect(style.background).toBe('var(--bg-muted)')
      expect(style.minHeight).toBe('2.75rem')
    }
  })

  it('keeps the title at the size the cards had, in the strong text tone', () => {
    expect(DASHBOARD_CARD_TITLE_STYLE.fontSize).toBe('1.125rem')
    expect(DASHBOARD_CARD_TITLE_STYLE.color).toBe('var(--text-strong)')
    expect(DASHBOARD_CARD_TITLE_STYLE.margin).toBe(0)
  })
})
