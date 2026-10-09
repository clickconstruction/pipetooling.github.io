import { describe, expect, it } from 'vitest'
import { isPickableServiceType, pickableServiceTypes } from './serviceTypePickers'

describe('the service types a person may pick', () => {
  it('leaves out a billing-only type and keeps the rest in order, a type with no flag read included', () => {
    const types = [
      { id: 'p', name: 'Plumbing', billing_only: false },
      { id: 'gc', name: 'General contracting', billing_only: true },
      { id: 'e', name: 'Electrical' },
      { id: 'h', name: 'HVAC', billing_only: null },
    ]
    expect(pickableServiceTypes(types).map((t) => t.id)).toEqual(['p', 'e', 'h'])
    expect(isPickableServiceType({ billing_only: true })).toBe(false)
  })
})
