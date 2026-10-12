import { describe, expect, it } from 'vitest'
import { factJobKeys, railJobKeys } from './factJobs'

const people = [
  { id: 'c-elena', customerId: 'cust-cibolo', gcCompanyId: null },
  { id: 'c-jonah', customerId: 'cust-marsh', gcCompanyId: null },
  { id: 'c-greg', customerId: null, gcCompanyId: 'gc-hillside' },
  { id: 'c-unknown', customerId: null, gcCompanyId: null },
]

describe('the jobs a person is on by the facts', () => {
  it('reads a customer’s projects in each of its three roles, and a trade partner’s asks', () => {
    const keys = factJobKeys(people, {
      projects: [
        { project_id: 'p1', customer_id: 'cust-cibolo', property_owner_customer_id: null, architect_customer_id: 'cust-marsh' },
        { project_id: 'p2', customer_id: null, property_owner_customer_id: 'cust-cibolo', architect_customer_id: null },
        { project_id: 'p3', customer_id: 'cust-other', property_owner_customer_id: null, architect_customer_id: 'cust-marsh' },
      ],
      invites: [
        { company_id: 'gc-hillside', project_id: 'p1' },
        { company_id: 'gc-hillside', project_id: 'p1' },
        { company_id: 'gc-hillside', project_id: 'p3' },
      ],
    })
    expect(keys).toEqual({
      'c-elena': ['project:p1', 'project:p2'],
      'c-jonah': ['project:p1', 'project:p3'],
      'c-greg': ['project:p1', 'project:p3'],
      'c-unknown': [],
    })
  })

  it('the rail reads the office’s ties first, then the facts’ jobs not tied', () => {
    expect(railJobKeys({ jobIds: ['bid:b1', 'project:p2'] }, ['project:p1', 'project:p2', 'project:p1'])).toEqual(['bid:b1', 'project:p2', 'project:p1'])
    expect(railJobKeys({ jobIds: [] })).toEqual([])
  })
})
