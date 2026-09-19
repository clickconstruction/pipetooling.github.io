import { describe, expect, it } from 'vitest'
import { IMITABLE_ROLES, missingSampleRoles, sampleAccountPassword, sampleAccountsByRole, sampleEmailForRole, sampleNameForRole } from './viewAs'

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
