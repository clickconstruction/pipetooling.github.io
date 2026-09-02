import { describe, expect, it } from 'vitest'
import {
  buildJobFormUndoSnapshot,
  invoiceSetKey,
  jobFormUndoAvailable,
  sanitizeRestoredFixtureLinks,
} from './jobFormUndo'
import { buildBillingSliceJson, buildIdentitySliceJson, type JobIdentityFormFields } from './jobFormAutosaveSlices'
import type { FixtureRow } from './jobFormTypes'

const identity: JobIdentityFormFields = {
  hcpNumber: '123',
  clickNumber: '900',
  jobName: 'Job',
  jobAddress: '1 Main St',
  customerId: null,
  customerName: 'Cust',
  customerEmail: '',
  customerPhone: '',
  gcCustomerId: null,
  developmentId: null,
  googleDriveLink: '',
  jobPicturesLink: '',
  jobPlansLink: '',
  projectId: '',
  bidId: '',
  serviceTypeId: 'st-1',
    accountManagerUserId: null,
    accountManagerRelationship: null,
    customerAddressId: null,
}

const fixture = (over: Partial<FixtureRow> = {}): FixtureRow => ({
  id: 'f1',
  name: 'Rough In',
  count: 1,
  line_unit_price: 100,
  line_description: '',
  invoice_id: null,
  ...over,
})

function snap() {
  return buildJobFormUndoSnapshot({
    identity,
    fixtures: [fixture()],
    payments: [],
    materials: [{ id: 'm1', description: 'Pipe', amount: 5 }],
    teamMemberIds: ['u1'],
  })
}

describe('buildJobFormUndoSnapshot', () => {
  it('deep-copies rows so later state mutation cannot corrupt the snapshot', () => {
    const fixtures = [fixture()]
    const s = buildJobFormUndoSnapshot({ identity, fixtures, payments: [], materials: [], teamMemberIds: [] })
    fixtures[0]!.name = 'CHANGED'
    expect(s.fixtures[0]!.name).toBe('Rough In')
    expect(s.identity).not.toBe(identity)
  })

  it('captures slice JSONs matching the live builders', () => {
    const s = snap()
    expect(s.jsons.billing).toBe(buildBillingSliceJson([fixture()], []))
    expect(s.jsons.identity).toBe(buildIdentitySliceJson(identity))
  })
})

describe('jobFormUndoAvailable', () => {
  it('is false with no snapshot and false when nothing changed', () => {
    const s = snap()
    expect(jobFormUndoAvailable(null, s.jsons)).toBe(false)
    expect(jobFormUndoAvailable(s, { ...s.jsons })).toBe(false)
  })

  it('is true when any one slice differs', () => {
    const s = snap()
    expect(jobFormUndoAvailable(s, { ...s.jsons, team: '["u1","u2"]' })).toBe(true)
    expect(jobFormUndoAvailable(s, { ...s.jsons, billing: 'x' })).toBe(true)
  })
})

describe('sanitizeRestoredFixtureLinks', () => {
  it('keeps links to existing invoices and clears stale ones', () => {
    const rows = [fixture({ id: 'a', invoice_id: 'inv-live' }), fixture({ id: 'b', invoice_id: 'inv-deleted' })]
    const out = sanitizeRestoredFixtureLinks(rows, new Set(['inv-live']))
    expect(out.map((r) => r.invoice_id)).toEqual(['inv-live', null])
  })

  it('returns fresh row objects, never the inputs', () => {
    const rows = [fixture()]
    const out = sanitizeRestoredFixtureLinks(rows, new Set())
    expect(out[0]).not.toBe(rows[0])
  })
})

describe('invoiceSetKey', () => {
  it('is order-insensitive and distinguishes different sets', () => {
    expect(invoiceSetKey(['b', 'a'])).toBe(invoiceSetKey(['a', 'b']))
    expect(invoiceSetKey(['a'])).not.toBe(invoiceSetKey(['a', 'b']))
  })
})
