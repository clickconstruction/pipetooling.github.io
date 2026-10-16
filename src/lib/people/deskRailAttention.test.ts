import { describe, expect, it } from 'vitest'
import { buildRailRow, buildRailSections, normaliseKind, railUnsentReason, type RailFacts, type RailPersonInput } from './deskRailAttention'
import { buildRowNeeds } from './rowNeeds'

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

describe('rail ↔ Users-tab unsent gloss (J32-adj-1)', () => {
  it('the rail reason and the Users row chip say the same words for the same unsentDocsByName count', () => {
    const f: RailFacts = { ...facts, unsentDocsByName: { Isiah: 2 } }
    const rail = buildRailRow(p({ name: 'Isiah', userId: 'u1' }), f)
    const row = buildRowNeeds({ person: { name: 'Isiah', userId: 'u1', personId: 'p', kind: 'helper', archived: false }, facts: f, signingLight: 'green' })
    const paperwork = row.needs.find((n) => n.key === 'paperwork')
    expect(rail.reasons).toContain(railUnsentReason(2))
    expect(paperwork?.long).toContain(railUnsentReason(2))
    expect(paperwork?.short).toBe('2 unsent')
    expect(rail.signals.find((s) => s.key === 'unsent')?.label).toBe('2 unsent')
  })
})

describe('buildRailRow', () => {
  it('stacks reasons into one badge and escalates to red on expired paperwork; hours alone stay green', () => {
    expect(buildRailRow(p({ name: 'Isiah', userId: 'u1' }), facts)).toMatchObject({ attention: 'amber', badge: '23 · doc', reasons: ['23 sessions waiting', '1 contract never sent'] })
    // v2.2818: sessions waiting are a queue, not an alarm — badge and reason, no dot.
    expect(buildRailRow(p({ name: 'Only Hours', userId: 'u1', personId: 'p-oh' }), { ...facts, unsentDocsByName: {} })).toMatchObject({ attention: 'green', badge: '23', reasons: ['23 sessions waiting'] })
    expect(buildRailRow(p({ name: 'Texas R & A Electrical', kind: 'sub' }), facts)).toMatchObject({ attention: 'red', badge: 'exp!' })
    expect(buildRailRow(p({ name: 'Grace', userId: 'u9', personId: null, kind: 'assistant' }), facts)).toMatchObject({ attention: 'amber', badge: 'id', reasons: ['no roster row'] })
    expect(buildRailRow(p({ name: 'Bryan', userId: 'u8', personId: null, kind: 'primary' }), facts).attention).toBe('green')
  })

  it('emits structured chips, and a live portal is a blue signal that never raises attention', () => {
    const isiah = buildRailRow(p({ name: 'Isiah', userId: 'u1' }), facts)
    expect(isiah.signals).toEqual([
      { key: 'pending', label: '23 waiting', tone: 'gray' },
      { key: 'unsent', label: '1 unsent', tone: 'amber' },
    ])
    const dv = buildRailRow(p({ name: 'DV Mechanical', kind: 'sub', personId: 'p-dv' }), facts)
    expect(dv.attention).toBe('green')
    expect(dv.signals).toEqual([{ key: 'portal', label: 'portal on', tone: 'blue' }])
  })
})

describe('the bench (v2.2860)', () => {
  it('a benched sub gets one gray chip and their paperwork nags pause; sessions waiting still count', () => {
    const f: RailFacts = { ...facts, benchPersonIds: new Set(['p-tx']) }
    const tx = buildRailRow(p({ name: 'Texas R & A Electrical', kind: 'sub', personId: 'p-tx' }), f)
    expect(tx.attention).toBe('green')
    expect(tx.signals).toEqual([{ key: 'bench', label: 'on the bench', tone: 'gray' }])
    expect(tx.reasons).toEqual(['on the bench'])
    const busy = buildRailRow(p({ name: 'Isiah', userId: 'u1', personId: 'p-isiah', kind: 'sub' }), { ...f, benchPersonIds: new Set(['p-isiah']) })
    expect(busy.attention).toBe('green')
    expect(busy.signals.map((s) => s.key)).toEqual(['pending', 'bench'])
    expect(busy.reasons).toEqual(['23 sessions waiting', 'on the bench'])
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
    expect(r.sections.map((s) => s.label)).toEqual(['Leaders', 'Helpers', 'Subcontractors'])
    expect(r.archived.map((x) => x.name)).toEqual(['Edgar'])
    expect(buildRailSections(people, facts, 'dar').sections.flatMap((s) => s.rows.map((x) => x.name))).toEqual(['Darren'])
  })

  it('normalises role names to kinds', () => {
    expect(normaliseKind('helpers')).toBe('helper')
    expect(normaliseKind('subcontractor')).toBe('sub')
    expect(normaliseKind('controller')).toBe('controller')
  })
})

describe('training on the rail (punch list #111, v2.5568)', () => {
  const withTraining: RailFacts = {
    ...facts,
    trainingByUserId: {
      'u-dana': { tone: 'red', label: 'training due', long: 'OSHA 30 refresher not done' },
      'u-luis': { tone: 'amber', label: 'training lapsed', long: 'OSHA 30 refresher lapsed Oct 3, 2026' },
    },
  }
  it('a course not done is a red chip that moves the dot; a lapsed one is amber and moves it only when nothing is red', () => {
    const dana = buildRailRow(p({ name: 'Dana', userId: 'u-dana' }), withTraining)
    expect(dana.attention).toBe('red')
    expect(dana.signals.find((s) => s.key === 'training')).toEqual({ key: 'training', label: 'training due', tone: 'red' })
    expect(dana.reasons).toContain('OSHA 30 refresher not done')
    expect(dana.badge).toContain('trn')
    const luis = buildRailRow(p({ name: 'Luis', userId: 'u-luis' }), withTraining)
    expect(luis.attention).toBe('amber')
    expect(luis.signals.find((s) => s.key === 'training')?.label).toBe('training lapsed')
    const expiredAndLapsed = buildRailRow(p({ name: 'Texas R & A Electrical', userId: 'u-luis' }), withTraining)
    expect(expiredAndLapsed.attention).toBe('red')
  })
  it('a person with no training fact, or no account, gets no chip', () => {
    expect(buildRailRow(p({ name: 'Priya', userId: 'u-priya' }), withTraining).signals.some((s) => s.key === 'training')).toBe(false)
    expect(buildRailRow(p({ name: 'Dana' }), withTraining).signals.some((s) => s.key === 'training')).toBe(false)
  })
  it('the Users row carries the same chip under Paperwork, with the verb that clears it', () => {
    const row = buildRowNeeds({ person: p({ name: 'Dana', userId: 'u-dana' }), facts: withTraining, signingLight: 'green' })
    const need = row.needs.find((n) => n.key === 'training')
    expect(need).toMatchObject({ subject: 'paperwork', tone: 'red', short: 'training due', long: 'OSHA 30 refresher not done.', verb: 'Ask them to take it', door: 'paperwork' })
    expect(row.attention).toBe('red')
    const lapsed = buildRowNeeds({ person: p({ name: 'Luis', userId: 'u-luis' }), facts: withTraining, signingLight: 'green' })
    expect(lapsed.needs.find((n) => n.key === 'training')?.verb).toBe('Ask them to take it again')
    expect(lapsed.attention).toBe('amber')
  })
})
