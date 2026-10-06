import { describe, expect, it } from 'vitest'
import { CUSTOMER_ROLES, customerRoleWords } from './customerRole'

describe('who we work for', () => {
  it('has words for the owner, another general contractor and an owner’s rep, and reads an unknown role as the owner', () => {
    expect(CUSTOMER_ROLES.map((r) => r.role)).toEqual(['owner', 'gc', 'ownersRep'])
    expect(customerRoleWords('gc').them).toBe('the general contractor')
    expect(customerRoleWords('ownersRep').customer).toBe("The owner's rep we work for")
    expect(customerRoleWords(undefined).label).toBe('The owner')
  })
})
