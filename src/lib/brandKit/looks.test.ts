import { describe, expect, it } from 'vitest'
import { drawKit, pipePath, placeRows, type KitPerson } from './draw'
import {
  DEFAULT_CARD_LOOKS, LOOK_IDS, THEMES, contrast, lookCounts, lookLayouts, lookReadability, parseCardLooks, resolveLook, serializeCardLooks, withDefaultLook, withLookSwitched,
} from './looks'
import { LAYOUTS } from './layouts'

const dale: KitPerson = { name: 'Dale Okafor', title: 'Master Plumber', email: 'dale@example.com', mobile: '(512) 555-0177', office: '(512) 555-0100', photo: { href: 'data:image/png;base64,AAAA', w: 400, h: 600, fx: 0.5, fy: 0.4, zoom: 1 } }

describe('every look', () => {
  it('keeps the bones: the same rows on the same baselines, the same ring, the same pipes on the footer', () => {
    const classic = lookLayouts('classic')
    for (const id of LOOK_IDS) {
      const look = lookLayouts(id)
      expect(placeRows(look.footer.words!, dale), id).toEqual(placeRows(classic.footer.words!, dale))
      expect(placeRows(look.back.words!, dale), id).toEqual(placeRows(classic.back.words!, dale))
      expect(look.footer.ring, id).toEqual(classic.footer.ring)
      expect(look.back.ring, id).toEqual(classic.back.ring)
      expect(look.footer.pipes!.map(pipePath), id).toEqual(classic.footer.pipes!.map(pipePath))
      expect(look.front.logo?.x, id).toBe(classic.front.logo?.x)
      expect(look.front.panels, id).toEqual(classic.front.panels)
    }
  })
  it('reads: every pair of its colours stands apart enough', () => {
    for (const id of LOOK_IDS) {
      for (const p of lookReadability(THEMES[id])) expect(p.ratio, `${id}: ${p.pair}`).toBeGreaterThanOrEqual(p.needs)
    }
  })
  it('draws in its own colours', () => {
    const yellow = drawKit(lookLayouts('navy-yellow').back, dale)
    expect(yellow).toContain('fill="#16283c"')
    expect(yellow).toContain('fill="#f6c700"')
    expect(yellow).not.toContain('#050708')
    const front = drawKit(lookLayouts('navy-yellow').front, null, { assets: { mark: 'm.png' } })
    expect(front).toContain('fill="#16283c">CLICK</text>')
    expect(drawKit(lookLayouts('navy-orange').front, null)).toContain('fill="#ffffff">CLICK</text>')
  })
  it('leaves the look in use exactly as it was', () => {
    expect(lookLayouts('classic').footer).toBe(LAYOUTS.footerReworked)
    expect(lookLayouts('classic').back).toBe(LAYOUTS.cardBackReworked)
    expect(lookLayouts('classic').front).toBe(LAYOUTS.cardFrontReworked)
    expect(LAYOUTS.cardBackReworked.ground).toBe('#050708')
    expect(LAYOUTS.cardFrontPipes.ground).toBe('#050708')
  })
  it('measures contrast as the standard does', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 5)
    expect(contrast('#ffffff', '#ffffff')).toBe(1)
  })
})

describe('which looks the company offers', () => {
  it('offers only the look in use until the owner says otherwise', () => {
    expect(parseCardLooks(null)).toEqual(DEFAULT_CARD_LOOKS)
    expect(parseCardLooks('not json')).toEqual(DEFAULT_CARD_LOOKS)
    expect(parseCardLooks('{"approved":[],"default":"navy-yellow"}')).toEqual(DEFAULT_CARD_LOOKS)
  })
  it('reads the setting back in the looks’ own order, dropping a look it does not know', () => {
    const s = parseCardLooks('{"approved":["navy-yellow","retired","classic","classic"],"default":"navy-yellow"}')
    expect(s).toEqual({ approved: ['classic', 'navy-yellow'], default: 'navy-yellow' })
    expect(parseCardLooks(serializeCardLooks(s))).toEqual(s)
  })
  it('keeps the default to a look that is on', () => {
    expect(parseCardLooks('{"approved":["classic","navy-orange"],"default":"navy-yellow"}').default).toBe('classic')
  })
  it('draws a person in their pick while it is offered, and in the default once it is not', () => {
    const on = parseCardLooks('{"approved":["classic","navy-orange"],"default":"classic"}')
    expect(resolveLook('navy-orange', on)).toBe('navy-orange')
    expect(resolveLook('navy-yellow', on)).toBe('classic')
    expect(resolveLook(null, on)).toBe('classic')
    expect(resolveLook('something else', on)).toBe('classic')
  })
  it('will not switch the default off, and switches a look on when it becomes the default', () => {
    const s = parseCardLooks('{"approved":["classic","navy-orange"],"default":"classic"}')
    expect(withLookSwitched(s, 'classic', false)).toBe(s)
    expect(withLookSwitched(s, 'navy-orange', false)).toEqual({ approved: ['classic'], default: 'classic' })
    expect(withLookSwitched(s, 'navy-yellow', true)).toEqual({ approved: ['classic', 'navy-orange', 'navy-yellow'], default: 'classic' })
    expect(withDefaultLook(s, 'navy-yellow')).toEqual({ approved: ['classic', 'navy-orange', 'navy-yellow'], default: 'navy-yellow' })
  })
  it('counts a pick that is switched off on the default', () => {
    const s = parseCardLooks('{"approved":["classic","navy-orange"],"default":"classic"}')
    expect(lookCounts([null, 'navy-orange', 'navy-yellow', 'classic', undefined], s)).toEqual({ classic: 4, 'navy-orange': 1, 'navy-yellow': 0 })
  })
})
