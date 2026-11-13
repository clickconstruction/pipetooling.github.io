import { describe, expect, it } from 'vitest'
import { proposeJobCustomerLinks, type UnlinkedJobInput } from './matchUnlinkedJobs'

const CUSTOMERS = [
  { id: 'c-johnny', name: 'Johnny Inglow' },
  { id: 'c-kestrin', name: 'Kestrin Contracting' },
  { id: 'c-mary', name: 'Mary Elwin' },
  { id: 'c-dunmere', name: 'RLC- Dunmere Mallin' },
  { id: 'c-al', name: 'Al Bo' }, // norm "al bo" (5 chars) — too short for prefix matching
]

function job(p: Partial<UnlinkedJobInput> & { id: string }): UnlinkedJobInput {
  return { customer_name: null, job_name: null, hcp_number: null, click_number: null, ...p }
}

describe('proposeJobCustomerLinks', () => {
  it('matches customer_name exactly, groups jobs by name, keeps sample labels', () => {
    const groups = proposeJobCustomerLinks(
      [
        job({ id: 'j1', customer_name: 'Johnny Inglow', hcp_number: '941' }),
        job({ id: 'j2', customer_name: 'johnny  inglow!', hcp_number: '877' }),
      ],
      CUSTOMERS,
    )
    expect(groups).toHaveLength(1)
    expect(groups[0]).toMatchObject({
      confidence: 'customer_name',
      proposedCustomerId: 'c-johnny',
      jobIds: ['j1', 'j2'],
      sampleLabels: ['941', '877'],
    })
  })

  it('falls back to exact job-name match, then unique long-prefix match', () => {
    const groups = proposeJobCustomerLinks(
      [
        job({ id: 'j1', job_name: 'Kestrin Contracting' }),
        job({ id: 'j2', job_name: 'Mary Elwin (to be paid by DLF)' }),
        job({ id: 'j3', job_name: 'Al Bo something' }), // prefix too short — no proposal
      ],
      CUSTOMERS,
    )
    expect(groups.map((g) => [g.displayName, g.confidence, g.proposedCustomerId])).toEqual([
      ['Kestrin Contracting', 'job_name', 'c-kestrin'],
      ['Mary Elwin (to be paid by DLF)', 'prefix', 'c-mary'],
      ['Al Bo something', 'none', null],
    ])
  })

  it('aliases get no proposal; ambiguous names get no proposal', () => {
    const twoJohns = [...CUSTOMERS, { id: 'c-johnny2', name: 'Johnny Inglow' }]
    const groups = proposeJobCustomerLinks(
      [job({ id: 'j1', customer_name: 'Johnny Inglow' }), job({ id: 'j2', job_name: 'Dunmere Mallin' })],
      twoJohns,
    )
    const johnny = groups.find((g) => g.displayName === 'Johnny Inglow')!
    expect(johnny.confidence).toBe('none')
    expect(johnny.proposedCustomerId).toBeNull()
    const dunmere = groups.find((g) => g.displayName === 'Dunmere Mallin')!
    expect(dunmere.confidence).toBe('none')
  })

  it('sorts by confidence tier then group size', () => {
    const groups = proposeJobCustomerLinks(
      [
        job({ id: 'j1', job_name: 'Unknown Person' }),
        job({ id: 'j2', customer_name: 'Mary Elwin' }),
        job({ id: 'j3', job_name: 'Kestrin Contracting' }),
        job({ id: 'j4', job_name: 'Kestrin Contracting' }),
      ],
      CUSTOMERS,
    )
    expect(groups.map((g) => g.confidence)).toEqual(['customer_name', 'job_name', 'none'])
    expect(groups[1]!.jobIds).toHaveLength(2)
  })
})

describe('ownership-aware grouping', () => {
  it('splits a name into separate groups per job owner and carries jobMasterUserId', () => {
    const groups = proposeJobCustomerLinks(
      [
        job({ id: 'j1', customer_name: 'Mary Elwin', master_user_id: 'm-robert' }),
        job({ id: 'j2', customer_name: 'Mary Elwin', master_user_id: 'm-malachi' }),
      ],
      CUSTOMERS,
    )
    expect(groups).toHaveLength(2)
    expect(new Set(groups.map((g) => g.jobMasterUserId))).toEqual(new Set(['m-robert', 'm-malachi']))
    expect(groups.every((g) => g.proposedCustomerId === 'c-mary')).toBe(true)
  })
})
