import { describe, expect, it } from 'vitest'
import { buildRailRow, buildRailSections, normaliseKind, type RailFacts, type RailPersonInput } from './deskRailAttention'

const facts: RailFacts = {
  pendingByUserId: { u1: { count: 23, hours: 136.6 } },
  unsentDocsByName: { Isiah: 1 },
  expiringByName: { 'Michael A': 1 },
  expiredByName: { 'Texas R & A Electrical': 2 },
  portalOnPersonIds: new Set(['p-dv']),
}

function p(x: Partial<RailPersonInput> & { name: string }): RailPersonInput {
  return { userId: null, personId: 'p', kind: 'helper', archived: false, ...x }
}

describe('buildRailRow', () => {
  it('stacks reasons into one badge and escalates to red on expired paperwork', () => {
    expect(buildRailRow(p({ name: 'Isiah', userId: 'u1' }), facts)).toMatchObject({ attention: 'amber', badge: '23 · doc', reasons: ['23 sessions waiting', '1 document unsent'] })
    expect(buildRailRow(p({ name: 'Texas R & A Electrical', kind: 'sub' }), facts)).toMatchObject({ attention: 'red', badge: 'exp!' })
    expect(buildRailRow(p({ name: 'Grace', userId: 'u9', personId: null, kind: 'assistant' }), facts)).toMatchObject({ attention: 'amber', badge: 'id', reasons: ['no roster row'] })
    expect(buildRailRow(p({ name: 'Bryan', userId: 'u8', personId: null, kind: 'primary' }), facts).attention).toBe('green')
  })

  it('emits structured chips, and a live portal is a blue signal that never raises attention', () => {
    const isiah = buildRailRow(p({ name: 'Isiah', userId: 'u1' }), facts)
    expect(isiah.signals).toEqual([
      { key: 'pending', label: '23 waiting', tone: 'amber' },
      { key: 'unsent', label: '1 doc unsent', tone: 'amber' },
    ])
    const dv = buildRailRow(p({ name: 'DV Mechanical', kind: 'sub', personId: 'p-dv' }), facts)
    expect(dv.attention).toBe('green')
    expect(dv.signals).toEqual([{ key: 'portal', label: 'portal on', tone: 'blue' }])
  })
})

describe('buildRailSections', () => {
  it('lists attention first (red before amber), groups by kind in the house order, and searches by name', () => {
    const people = [
      p({ name: 'Isiah', userId: 'u1' }),
      p({ name: 'Darren', userId: 'u2' }),
      p({ name: 'Texas R & A Electrical', kind: 'sub' }),
      p({ name: 'Malachi', kind: 'master_technician', userId: 'u3' }),
      p({ name: 'Edgar', kind: 'sub', archived: true }),
    ]
    const r = buildRailSections(people, facts, '')
    expect(r.attention.map((x) => x.name)).toEqual(['Texas R & A Electrical', 'Isiah'])
    expect(r.sections.map((s) => s.label)).toEqual(['Master Technicians', 'Helpers', 'Subcontractors'])
    expect(r.archived.map((x) => x.name)).toEqual(['Edgar'])
    expect(buildRailSections(people, facts, 'dar').sections.flatMap((s) => s.rows.map((x) => x.name))).toEqual(['Darren'])
  })

  it('normalises role names to kinds', () => {
    expect(normaliseKind('helpers')).toBe('helper')
    expect(normaliseKind('subcontractor')).toBe('sub')
    expect(normaliseKind('controller')).toBe('controller')
  })
})
