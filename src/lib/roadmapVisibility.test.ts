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
