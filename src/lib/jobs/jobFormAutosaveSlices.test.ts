import { describe, expect, it } from 'vitest'
import {
  buildBillingSliceJson,
  buildEditJobIdentityUpdatePayload,
  buildIdentitySliceJson,
  buildMaterialsSliceJson,
  buildTeamSliceJson,
  diffTeamMemberIds,
  fixtureInsertRows,
  identitySliceReadyToSave,
  materialInsertRows,
  paymentInsertRows,
  shouldDemotePaidJobToBilled,
  type JobIdentityFormFields,
} from './jobFormAutosaveSlices'
import type { FixtureRow, MaterialRow, PaymentRow } from './jobFormTypes'

function fixture(over: Partial<FixtureRow> = {}): FixtureRow {
  return { id: 'f1', name: 'Rough In', count: 1, line_unit_price: 100, line_description: '', invoice_id: null, ...over }
}

function payment(over: Partial<PaymentRow> = {}): PaymentRow {
  return {
    id: 'p1',
    amount: 50,
    paid_on: null,
    sent_on: null,
    note: null,
    payment_type: null,
    reference_number: null,
    invoice_id: null,
    mercury_transaction_id: null,
    ...over,
  }
}

function identity(over: Partial<JobIdentityFormFields> = {}): JobIdentityFormFields {
  return {
    hcpNumber: '123',
    clickNumber: '934',
    jobName: 'Antonio Hernandez',
    jobAddress: '263 Creekview Way',
    customerId: null,
    customerName: 'Antonio Hernandez',
    customerEmail: '',
    customerPhone: '',
    gcCustomerId: null,
    developmentId: null,
    googleDriveLink: '',
    jobPicturesLink: '',
    jobPlansLink: '',
    projectId: '',
    bidId: '',
    serviceTypeId: 'st-plumbing',
    accountManagerUserId: null,
    accountManagerRelationship: null,
    customerAddressId: null,
    ...over,
  }
}

describe('slice JSON builders', () => {
  it('billing JSON ignores row ids (delete+reinsert churn is not dirt)', () => {
    const a = buildBillingSliceJson([fixture({ id: 'x' })], [payment({ id: 'y' })])
    const b = buildBillingSliceJson([fixture({ id: 'z' })], [payment({ id: 'w' })])
    expect(a).toBe(b)
  })

  it('billing JSON changes when a money field changes', () => {
    const a = buildBillingSliceJson([fixture()], [])
    const b = buildBillingSliceJson([fixture({ line_unit_price: 101 })], [])
    expect(a).not.toBe(b)
  })

  it('identity JSON is trim-insensitive', () => {
    expect(buildIdentitySliceJson(identity({ jobName: ' Antonio Hernandez ' }))).toBe(
      buildIdentitySliceJson(identity()),
    )
  })

  it('materials JSON ignores ids, tracks content', () => {
    const rows: MaterialRow[] = [{ id: 'a', description: 'Pipe', amount: 10 }]
    expect(buildMaterialsSliceJson(rows)).toBe(buildMaterialsSliceJson([{ ...rows[0]!, id: 'b' }]))
    expect(buildMaterialsSliceJson(rows)).not.toBe(buildMaterialsSliceJson([{ ...rows[0]!, amount: 11 }]))
  })

  it('team JSON is order-insensitive', () => {
    expect(buildTeamSliceJson(['b', 'a'])).toBe(buildTeamSliceJson(['a', 'b']))
  })
})

describe('insert-row payload builders', () => {
  it('paymentInsertRows drops non-positive amounts and renumbers sequence', () => {
    const rows = paymentInsertRows('job1', [payment({ amount: 0 }), payment({ id: 'p2', amount: 25, note: ' hi ' })])
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ job_id: 'job1', amount: 25, sequence_order: 0, note: 'hi' })
  })

  it('fixtureInsertRows drops unnamed rows and nulls non-positive prices', () => {
    const rows = fixtureInsertRows('job1', [
      fixture({ name: '  ', line_description: 'scope only' }),
      fixture({ id: 'f2', name: 'Top Out', line_unit_price: 0, invoice_id: 'inv1' }),
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      job_id: 'job1',
      name: 'Top Out',
      sequence_order: 0,
      line_unit_price: null,
      invoice_id: 'inv1',
    })
  })

  it('materialInsertRows keeps description-only and amount-only rows, drops empty', () => {
    const rows = materialInsertRows('job1', [
      { id: 'a', description: '', amount: 0 },
      { id: 'b', description: 'Gas line parts', amount: 0 },
      { id: 'c', description: '', amount: 12.5 },
    ])
    expect(rows.map((r) => r.sequence_order)).toEqual([0, 1])
    expect(rows[0]).toMatchObject({ description: 'Gas line parts', amount: 0 })
    expect(rows[1]).toMatchObject({ description: '', amount: 12.5 })
  })
})

describe('buildEditJobIdentityUpdatePayload', () => {
  const customers = [
    { id: 'c-mine', name: 'Antonio Hernandez', master_user_id: 'master-1' },
    { id: 'c-other', name: 'Antonio Hernandez', master_user_id: 'master-2' },
  ]

  it('keeps the existing owner and resolves the customer by name under it', () => {
    const payload = buildEditJobIdentityUpdatePayload({
      fields: identity({ customerId: 'c-other' }),
      existingJobMasterUserId: 'master-1',
      projectMasterUserId: null,
      customers,
      developments: [],
    })
    expect(payload.master_user_id).toBe('master-1')
    // cross-master explicit pick falls back to the name match under the job master
    expect(payload.customer_id).toBe('c-mine')
  })

  it('follows a linked project owner', () => {
    const payload = buildEditJobIdentityUpdatePayload({
      fields: identity({ projectId: 'proj-9' }),
      existingJobMasterUserId: 'master-1',
      projectMasterUserId: 'master-2',
      customers,
      developments: [],
    })
    expect(payload.master_user_id).toBe('master-2')
    expect(payload.project_id).toBe('proj-9')
  })

  it('nulls blank optionals and never carries money columns', () => {
    const payload = buildEditJobIdentityUpdatePayload({
      fields: identity({ customerEmail: '  ' }),
      existingJobMasterUserId: 'master-1',
      projectMasterUserId: null,
      customers: [],
      developments: [],
    })
    expect(payload.customer_email).toBeNull()
    expect('revenue' in payload).toBe(false)
    expect('payments_made' in payload).toBe(false)
  })
})

describe('identitySliceReadyToSave', () => {
  it('requires job name, address, and service type', () => {
    expect(identitySliceReadyToSave(identity())).toBe(true)
    expect(identitySliceReadyToSave(identity({ jobName: ' ' }))).toBe(false)
    expect(identitySliceReadyToSave(identity({ jobAddress: '' }))).toBe(false)
    expect(identitySliceReadyToSave(identity({ serviceTypeId: '' }))).toBe(false)
  })
})

describe('diffTeamMemberIds', () => {
  it('computes adds and removes', () => {
    expect(diffTeamMemberIds(['a', 'b'], ['b', 'c'])).toEqual({ toAdd: ['a'], toRemove: ['c'] })
  })

  it('is empty when membership matches regardless of order', () => {
    expect(diffTeamMemberIds(['a', 'b'], ['b', 'a'])).toEqual({ toAdd: [], toRemove: [] })
  })
})

describe('shouldDemotePaidJobToBilled', () => {
  it('fires only for paid jobs with more than a cent due', () => {
    expect(shouldDemotePaidJobToBilled('paid', 100, 99.98)).toBe(true)
    expect(shouldDemotePaidJobToBilled('paid', 100, 99.99)).toBe(false)
    expect(shouldDemotePaidJobToBilled('paid', 100, 100)).toBe(false)
    expect(shouldDemotePaidJobToBilled('billed', 100, 0)).toBe(false)
  })
})
