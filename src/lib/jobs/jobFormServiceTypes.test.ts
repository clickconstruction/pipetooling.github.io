import { describe, expect, it } from 'vitest'
import { pickDefaultServiceTypeId, visibleServiceTypesForJobForm } from './jobFormServiceTypes'
import type { JobFormServiceType } from './jobFormTypes'

const st = (id: string, name: string): JobFormServiceType => ({ id, name, color: null })
const types = [st('p', 'Plumbing'), st('e', 'Electrical'), st('h', 'HVAC')]

describe('pickDefaultServiceTypeId', () => {
  it('prefers Plumbing, then Electrical, then first; undefined when empty', () => {
    expect(pickDefaultServiceTypeId(types)).toBe('p')
    expect(pickDefaultServiceTypeId([st('e', 'Electrical'), st('h', 'HVAC')])).toBe('e')
    expect(pickDefaultServiceTypeId([st('h', 'HVAC'), st('x', 'Other')])).toBe('h')
    expect(pickDefaultServiceTypeId([st('only', 'Solo')])).toBe('only')
    expect(pickDefaultServiceTypeId([])).toBeUndefined()
  })
})

describe('visibleServiceTypesForJobForm', () => {
  it('returns all when no role columns', () => {
    expect(visibleServiceTypesForJobForm(types, null)).toEqual(types)
    expect(visibleServiceTypesForJobForm(types, { role: 'dev' })).toEqual(types)
  })
  it('filters an estimator to their allowed ids', () => {
    const out = visibleServiceTypesForJobForm(types, { role: 'estimator', estimator_service_type_ids: ['e'] })
    expect(out.map((t) => t.id)).toEqual(['e'])
  })
  it('falls back to all when the role filter matches nothing', () => {
    const out = visibleServiceTypesForJobForm(types, { role: 'primary', primary_service_type_ids: ['zzz'] })
    expect(out).toEqual(types)
  })
})
