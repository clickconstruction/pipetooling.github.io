import { describe, expect, it } from 'vitest'
import { ORG_DEFAULT_ROLE_GROUPS, groupValue, orgDefaultBool, orgDefaultOptions, ORG_DEFAULTS, resolveOrgDefault } from './orgDefaults'

const rows = [
  { key: 'jobs.stages.mobile_cards', role: '*', value: 'false' },
  { key: 'jobs.stages.mobile_cards', role: 'subcontractor', value: 'true' },
  { key: 'billing.stripe_mode', role: '*', value: 'test' },
]

describe('resolveOrgDefault (T5-08)', () => {
  it('device → role → everyone → fallback', () => {
    expect(resolveOrgDefault('jobs.stages.mobile_cards', 'subcontractor', rows, 'false')).toEqual({ value: 'false', source: 'device' })
    expect(resolveOrgDefault('jobs.stages.mobile_cards', 'subcontractor', rows, null)).toEqual({ value: 'true', source: 'role' })
    expect(resolveOrgDefault('jobs.stages.mobile_cards', 'assistant', rows, null)).toEqual({ value: 'false', source: 'everyone' })
    expect(resolveOrgDefault('tally.payroll_auto_apply', 'dev', rows, null)).toEqual({ value: 'false', source: 'fallback' })
    expect(resolveOrgDefault('jobs.stages.mobile_cards', 'dev', null, null)).toEqual({ value: 'auto', source: 'fallback' })
  })
  it('ignores values a key cannot take', () => {
    expect(resolveOrgDefault('billing.stripe_mode', 'dev', [{ key: 'billing.stripe_mode', role: '*', value: 'auto' }], 'bogus')).toEqual({ value: 'live', source: 'fallback' })
    expect(resolveOrgDefault('billing.stripe_mode', 'dev', rows, null)).toEqual({ value: 'test', source: 'everyone' })
  })
})

describe('helpers', () => {
  it('bool values resolve to on/off, "auto" hands back the decision', () => {
    expect(orgDefaultBool('true')).toBe(true)
    expect(orgDefaultBool('false')).toBe(false)
    expect(orgDefaultBool('auto')).toBeNull()
  })
  it('every role is in exactly one group', () => {
    const all = [...ORG_DEFAULT_ROLE_GROUPS.field.roles, ...ORG_DEFAULT_ROLE_GROUPS.office.roles]
    expect(new Set(all).size).toBe(9)
  })
  it('groupValue reports one value or mixed', () => {
    expect(groupValue('jobs.stages.mobile_cards', 'office', rows)).toBe('')
    expect(groupValue('jobs.stages.mobile_cards', 'field', rows)).toBe('mixed')
    expect(groupValue('billing.stripe_mode', 'field', [{ key: 'billing.stripe_mode', role: 'subcontractor', value: 'live' }, { key: 'billing.stripe_mode', role: 'helpers', value: 'live' }, { key: 'billing.stripe_mode', role: 'superintendent', value: 'live' }])).toBe('live')
  })
  it('options carry a "no default" first', () => {
    expect(orgDefaultOptions(ORG_DEFAULTS['tally.payroll_auto_apply'])[0]!.value).toBe('')
    expect(orgDefaultOptions(ORG_DEFAULTS['billing.stripe_mode']).map((o) => o.value)).toEqual(['', 'live', 'test'])
  })
})
