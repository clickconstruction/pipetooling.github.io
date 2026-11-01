import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { canOpenRoadmap, canSeeRoadmapNeedsYou, roadmapPath } from './roadmapVisibility'
import type { UserRole } from '../hooks/useAuth'

const ALL_ROLES: Array<UserRole | null> = ['dev', 'master_technician', 'assistant', 'controller', 'estimator', 'primary', 'superintendent', 'subcontractor', 'helpers', null]

describe('canOpenRoadmap — the Roadmap nav entry (journey-map Tier-2 #41)', () => {
  it('mirrors the RLS edit set: dev, master, assistant-like, primary — nobody else', () => {
    const open = ALL_ROLES.filter((r) => canOpenRoadmap(r, false))
    expect(open).toEqual(['dev', 'master_technician', 'assistant', 'controller', 'primary'])
  })

  it('helpers, subs, estimators, superintendents and an unresolved role have no door', () => {
    for (const r of ['estimator', 'superintendent', 'subcontractor', 'helpers', null] as const) {
      expect(canOpenRoadmap(r, false)).toBe(false)
    }
  })

  it('Farm Mode hides the door for every role, the owner included', () => {
    for (const r of ALL_ROLES) expect(canOpenRoadmap(r, true)).toBe(false)
  })
})

describe('canSeeRoadmapNeedsYou — the Needs-You card stays the owner’s', () => {
  it('dev only, and never under Farm Mode', () => {
    expect(ALL_ROLES.filter((r) => canSeeRoadmapNeedsYou(r, false))).toEqual(['dev'])
    expect(canSeeRoadmapNeedsYou('dev', true)).toBe(false)
  })

  it('is a strict subset of who can open the page', () => {
    for (const r of ALL_ROLES) {
      if (canSeeRoadmapNeedsYou(r, false)) expect(canOpenRoadmap(r, false)).toBe(true)
    }
  })
})

describe('roadmapPath', () => {
  it('builds the bare page, a roadmap, and a roadmap + view', () => {
    expect(roadmapPath()).toBe('/roadmap')
    expect(roadmapPath(null)).toBe('/roadmap')
    expect(roadmapPath('r1')).toBe('/roadmap?roadmap=r1')
    expect(roadmapPath('r1', 'plan')).toBe('/roadmap?roadmap=r1&view=plan')
  })

  it('URL-encodes the id', () => {
    expect(roadmapPath('a b')).toBe('/roadmap?roadmap=a+b')
  })
})

describe('the Roadmap door is the gear menu row above Partnerships (v2.6258)', () => {
  const layout = readFileSync(join(__dirname, '../components/Layout.tsx'), 'utf8')
  const gearStart = layout.indexOf('data-navtrack="gear-menu"')
  const gear = layout.slice(gearStart)

  it('the gear menu lists Roadmap, then Partnerships, for a dev who sees both', () => {
    expect(gearStart).toBeGreaterThan(0)
    const roadmap = gear.indexOf('to="/roadmap"')
    const partnerships = gear.indexOf('to="/partnerships"')
    expect(roadmap).toBeGreaterThan(0)
    expect(partnerships).toBeGreaterThan(roadmap)
    // Nothing but the Roadmap row sits between the two.
    expect(gear.slice(roadmap, partnerships).match(/<NavLink/g) ?? []).toHaveLength(1)
  })

  it('the row keeps the roadmap gate (canOpenRoadmap, never under Farm Mode) and the neighbours\' look', () => {
    const row = gear.slice(gear.lastIndexOf('{', gear.indexOf('to="/roadmap"')) - 40, gear.indexOf('to="/partnerships"'))
    expect(row).toMatch(/\{canShowRoadmapNav && \(/)
    expect(row).toMatch(/\{roadmapIcon\}\s*Roadmap/)
    expect(row).toMatch(/onClick=\{\(\) => setGearOpen\(false\)\}/)
    expect(layout).toMatch(/const canShowRoadmapNav = canOpenRoadmap\(role, farmModeActive\)/)
  })

  it('the header and the phone drawer (renderNavLinks) no longer carry the link', () => {
    const nav = layout.slice(layout.indexOf('function renderNavLinks('), gearStart)
    expect(nav).not.toMatch(/to="\/roadmap"/)
    expect(nav).not.toMatch(/>Roadmap</)
  })
})
