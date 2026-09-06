import { describe, expect, it } from 'vitest'
import { portalGlobeTint, portalGlobeTitle, portalGlobeTone } from './portalGlobeTint'
import type { PortalGlobeInitialState } from './portalLinkState'

const ALL_STATES: PortalGlobeInitialState[] = ['unminted', 'active', 'off', 'legacy-active']

describe('portalGlobeTint — the ONE state→colour map (B18 / J21-F3)', () => {
  it('maps every modal state to a tone; a live link is active whether merged or legacy', () => {
    expect(portalGlobeTone('unminted')).toBe('unminted')
    expect(portalGlobeTone('active')).toBe('active')
    expect(portalGlobeTone('legacy-active')).toBe('active')
    expect(portalGlobeTone('off')).toBe('off')
    expect(portalGlobeTone(null)).toBe('unknown')
    expect(portalGlobeTone(undefined)).toBe('unknown')
  })

  it('active and never-minted are no longer pixel-identical; off stays red; unloaded stays neutral', () => {
    const colors = new Map(ALL_STATES.map((s) => [s, portalGlobeTint(s).color]))
    expect(colors.get('active')).not.toBe(colors.get('unminted'))
    expect(colors.get('active')).not.toBe(colors.get('off'))
    expect(colors.get('unminted')).not.toBe(colors.get('off'))
    expect(colors.get('active')).toBe(colors.get('legacy-active'))
    expect(portalGlobeTint('off').color).toBe('var(--text-red-600)')
    expect(portalGlobeTint(null).color).toBe('var(--text-muted)')
  })

  it('uses theme tokens only (light/dark both work; red is the token, not a hex)', () => {
    for (const s of [...ALL_STATES, null]) expect(portalGlobeTint(s).color).toMatch(/^var\(--/)
  })

  it('is a pure function of state — the customer globe and the sub globe cannot disagree', () => {
    for (const s of ALL_STATES) expect(portalGlobeTint(s)).toEqual(portalGlobeTint(s))
  })

  it('titles read in trade language and say the state', () => {
    expect(portalGlobeTitle('Knight Contracting', 'active')).toBe("Knight Contracting's portal — portal is live")
    expect(portalGlobeTitle('Knight Contracting', 'unminted')).toBe("Knight Contracting's portal — no portal link yet")
    expect(portalGlobeTitle('Knight Contracting', 'off')).toBe("Knight Contracting's portal — portal is turned off")
    expect(portalGlobeTitle('Knight Contracting', null)).toBe("Knight Contracting's portal")
  })
})
