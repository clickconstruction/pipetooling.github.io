import { describe, expect, it } from 'vitest'
import { filterViewAsPeople, IMITABLE_ROLES, missingSampleRoles, sampleAccountPassword, sampleAccountsByRole, sampleEmailForRole, sampleNameForRole, switchChipsFor, VIEW_AS_ROLE_ORDER } from './viewAs'

describe('the sample accounts', () => {
  it('names and addresses a sample by its role, never a dev', () => {
    expect(IMITABLE_ROLES).not.toContain('dev')
    expect(IMITABLE_ROLES).toContain('assistant')
    expect(sampleEmailForRole('master_technician')).toBe('sample-master-technician@samples.pipetooling.local')
    expect(sampleNameForRole('assistant')).toMatch(/^Sample /)
  })
  it('finds the live sample per role and the roles still missing one', () => {
    const users = [
      { id: 'a', role: 'assistant', is_sample: true },
      { id: 'b', role: 'estimator', is_sample: true, archived_at: '2026-09-01' },
      { id: 'c', role: 'estimator', is_sample: false },
      { id: 'd', role: 'helpers', is_sample: true },
    ]
    const by = sampleAccountsByRole(users)
    expect([...by.keys()]).toEqual(['assistant', 'helpers'])
    const missing = missingSampleRoles(users)
    expect(missing).toContain('estimator')
    expect(missing).not.toContain('assistant')
    expect(missing).not.toContain('dev')
    expect(missing.length).toBe(IMITABLE_ROLES.length - 2)
  })
  it('mints a long throwaway password', () => {
    let i = 0
    const p = sampleAccountPassword(() => ((i += 7) % 100) / 100)
    expect(p).toHaveLength(28)
    expect(sampleAccountPassword()).not.toBe(sampleAccountPassword())
  })
})

describe('the door (v2.3608)', () => {
  it('orders every imitable role once, leaders first', () => {
    expect([...VIEW_AS_ROLE_ORDER].sort()).toEqual([...IMITABLE_ROLES].sort())
    expect(VIEW_AS_ROLE_ORDER[0]).toBe('master_technician')
  })
  it('names the switches an account carries on top of its role', () => {
    expect(switchChipsFor({ role: 'assistant' })).toEqual([])
    expect(switchChipsFor({ role: 'assistant', read_only: true, team_prospects_access: true })).toEqual(['training mode', 'Hiring'])
    expect(switchChipsFor({ role: 'estimator', estimator_prospects_access: true })).toEqual(['estimator prospects'])
    expect(switchChipsFor({ role: 'assistant', estimator_prospects_access: true })).toEqual([])
  })
  it('searches people by name, email or role, every word', () => {
    const people = [
      { id: '1', name: 'Wendi Ortiz', email: 'wendi@x.com', role: 'estimator' },
      { id: '2', name: 'Taunya', email: 't@x.com', role: 'assistant' },
    ]
    expect(filterViewAsPeople(people, '').map((p) => p.id)).toEqual(['1', '2'])
    expect(filterViewAsPeople(people, 'wen').map((p) => p.id)).toEqual(['1'])
    expect(filterViewAsPeople(people, 'ASSIST').map((p) => p.id)).toEqual(['2'])
    expect(filterViewAsPeople(people, 'wendi assistant')).toEqual([])
  })
})
