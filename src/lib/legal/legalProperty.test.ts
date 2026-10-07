/**
 * Property per job (punch list #85, item 6): the packet's Property record is the
 * property each job stands on — the record the job names and its owner override —
 * never the payer's address list, and each job's lien clock runs from its own kind.
 */
import { describe, expect, it } from 'vitest'
import { makeInvoice, makeJob } from '../../test/renderSmokeMocks'
import { sampleLegalPortalResponse } from '../../../supabase/functions/_shared/customerSampleFixtures'
import type { CustomerAddressRow } from '../jobs/lienProperty'
import type { JobWithDetails } from '../../types/jobWithDetails'
import { buildLegalPacket, groupCollectionsByPayer, type LegalAccountSummary, type LegalPacketInput } from './legalPacket'
import { buildMatterPacket, parseLegalPortalPayload, portalFeeModel } from './legalPortalPayload'
import { NO_PROPERTY_RECORD_GAP, propertyKindCell, propertyKindWords, propertySourceNote, resolveLegalJobProperties } from './legalProperty'

const TODAY = '2026-10-05'

function addr(over: Partial<CustomerAddressRow>): CustomerAddressRow {
  return { id: 'a', customer_id: 'c', address: '', county: '', county_source: null, legal_description: '', owner_mode: '', owner_name: '', owner_company: '', owner_mailing_address: '', parcel_id: '', parcel_source: null, parcel_tax_year: null, parcel_looked_up_at: null, homestead: false, property_kind: '', is_primary: false, note: null, sequence_order: 0, created_at: null, updated_at: null, ...over } as unknown as CustomerAddressRow
}
// The GC's two offices: on the payer's customer record, never a job site.
const gcOffices = [
  addr({ id: 'gc-office', customer_id: 'gc-1', address: '410 Sample Commerce Dr, Austin, TX 78744', county: 'Travis', owner_company: 'Sample Contracting', property_kind: 'non_residential' }),
  addr({ id: 'gc-yard', customer_id: 'gc-1', address: '9 Yard Rd, Manor, TX', county: 'Travis' }),
]
const storeSite = addr({ id: 'store', customer_id: 'owner-1', address: '1200 Sample Pkwy, Kyle, TX', county: 'Hays', legal_description: 'Lot 4, Block B, Sample Commons', owner_mode: 'building_owner', owner_company: 'Old Owner LLC', owner_mailing_address: 'PO Box 9', parcel_id: 'R12345', property_kind: 'non_residential' })
const houseSite = addr({ id: 'house', customer_id: 'owner-2', address: '88 Oak Hollow, Buda, TX', county: 'Hays', owner_mode: 'owner', owner_name: 'Jordan Example', owner_mailing_address: '88 Oak Hollow', property_kind: 'residential' })

function gcJob(p: Partial<Record<string, unknown>>): JobWithDetails {
  return makeJob({ status: 'billed', collections_at: '2026-09-01T15:00:00Z', gc_customer_id: 'gc-1', gcCustomer: { id: 'gc-1', name: 'Sample Contracting' }, ...p })
}
const store = gcJob({ id: 'j-store', hcp_number: '1042', job_address: '1200 Sample Pkwy, Kyle, TX', customer_address_id: 'store', invoices: [makeInvoice({ id: 'i1', amount: 9_000, status: 'billed', billed_at: '2026-08-10T15:00:00Z' })] })
const house = gcJob({ id: 'j-house', hcp_number: '1189', job_address: '88 Oak Hollow, Buda, TX', customer_address_id: 'house', invoices: [makeInvoice({ id: 'i2', amount: 3_000, status: 'billed', billed_at: '2026-08-12T15:00:00Z' })] })
const session = (jobId: string, day: string) => ({ jobId, workDate: day, clockedInAt: `${day}T13:00:00Z`, clockedOutAt: `${day}T21:00:00Z`, hasGps: true, approved: true, disqualified: false })

function packetFor(jobs: JobWithDetails[], over: Partial<LegalPacketInput> = {}) {
  const account = groupCollectionsByPayer(jobs, new Map(), TODAY)[0] as LegalAccountSummary
  return buildLegalPacket({ todayYmd: TODAY, account, customer: null, contacts: [], contactEntries: [], addresses: gcOffices, contracts: [], signedEstimates: [], demandLetters: [], lienFilings: [], promises: [], promiseOutcomes: [], chaseTouches: [], reports: [], clockSessions: [session('j-store', '2026-08-05'), session('j-house', '2026-08-05')], threadNotes: [], users: [], ...over })
}

describe('a GC-paid matter', () => {
  const p = packetFor([store, house], { jobAddresses: [storeSite, houseSite], jobOwners: [{ job_id: 'j-store', owner_mode: 'building_owner', owner_name: '', company_name: 'Sample Holdings LLC', mailing_address: 'PO Box 1' }] })

  it('lists the properties the jobs stand on, never the GC\'s offices, each with its jobs', () => {
    expect(p.account.properties.map((x) => [x.jobLabels, x.address, x.county, x.owner, x.source])).toEqual([
      [['1042'], '1200 Sample Pkwy, Kyle, TX', 'Hays', 'Sample Holdings LLC', 'linked'],
      [['1189'], '88 Oak Hollow, Buda, TX', 'Hays', 'Jordan Example', 'linked'],
    ])
    expect(p.account.properties.some((x) => x.address.includes('Sample Commerce'))).toBe(false)
  })
  it('lets the job\'s owner override win, as on the lien paper', () => {
    const line = p.account.jobs.find((j) => j.jobId === 'j-store')!.property
    expect(line).toEqual(expect.objectContaining({ owner: 'Sample Holdings LLC', ownerSource: 'job_override', lienReady: true, gaps: [] }))
  })
  it('runs each job\'s lien clock from its own kind: the house\'s notice is a month earlier than the store\'s', () => {
    const clock = Object.fromEntries(p.paper.lienClock.map((c) => [c.jobLabel, c.noticeDeadline]))
    expect(clock['1189']).toBe('2026-10-15') // residential: 15th of the 2nd month after August
    expect(clock['1042']).toBe('2026-11-16') // non-residential: 15th of the 3rd month, a Sunday, so Monday
  })
})

describe('jobs without a linked record', () => {
  it('two jobs at one property share a line', () => {
    const twin = gcJob({ id: 'j-twin', hcp_number: '1043', job_address: '1200 Sample Pkwy, Kyle, TX', customer_address_id: 'store' })
    const { properties } = resolveLegalJobProperties([store, twin], { labelOf: (id) => (id === 'j-store' ? '1042' : '1043'), jobAddresses: [storeSite], payerAddresses: [], owners: [] })
    expect(properties).toHaveLength(1)
    expect(properties[0]?.jobLabels).toEqual(['1042', '1043'])
  })
  it('an exact address match on the payer\'s record is used and said as matched; no match is the job address with a gap the desk can fix', () => {
    const direct = makeJob({ id: 'j-d', hcp_number: '700', job_address: ' 15054 State Hwy 71,  Bee Cave, TX ', customer_id: 'tle', customer_name: 'TLE', status: 'billed', collections_at: '2026-09-01T15:00:00Z' })
    const loose = makeJob({ id: 'j-l', hcp_number: '701', job_address: '1 Nowhere Ln', customer_id: 'tle', customer_name: 'TLE', status: 'billed', collections_at: '2026-09-01T15:00:00Z' })
    const tleSite = addr({ id: 'tle-site', customer_id: 'tle', address: '15054 State Hwy 71, Bee Cave, TX', county: 'Travis', property_kind: 'non_residential' })
    const pk = packetFor([direct, loose], { addresses: [tleSite] })
    const byJob = Object.fromEntries(pk.account.jobs.map((j) => [j.label, j.property]))
    expect(byJob['700']).toEqual(expect.objectContaining({ source: 'matched', county: 'Travis' }))
    expect(byJob['701']).toEqual(expect.objectContaining({ source: 'job_address', address: '1 Nowhere Ln' }))
    expect(byJob['701']?.gaps[0]).toBe(NO_PROPERTY_RECORD_GAP)
    expect(pk.gaps.find((g) => g.label === 'No property record linked to 701')).toEqual(expect.objectContaining({ jobId: 'j-l', fix: 'lien_instruments' }))
    expect(pk.exhibits.find((x) => x.title === 'Property record')?.count).toBe(1)
  })
  it('says the kind in the firm\'s words', () => {
    expect([propertyKindWords('residential'), propertyKindWords('non_residential'), propertyKindWords('')]).toEqual(['residential', 'non-residential', ''])
  })
})

describe('the firm\'s payload', () => {
  const company = { name: 'Click Plumbing and Electrical', cityLine: 'Kyle, TX', licenseLine: '', phone: '(512) 555-0100', email: 'office@example.com' }
  it('an older function\'s payload (no new fields) parses and builds, each job matched to the payer\'s record by its address, never linked', () => {
    const raw = sampleLegalPortalResponse(company, TODAY) as { matters: Array<Record<string, unknown>> }
    const m = { ...raw.matters[0], jobs: (raw.matters[0]!.jobs as Array<Record<string, unknown>>).map((j) => ({ ...j, customer_address_id: 'gone' })) }
    delete (m as Record<string, unknown>).jobAddresses
    const payload = parseLegalPortalPayload({ ...raw, matters: [m] })!
    expect(payload.matters[0]?.jobAddresses).toEqual([])
    expect(payload.matters[0]?.jobOwners).toEqual([])
    const p = buildMatterPacket(payload.matters[0]!, TODAY, portalFeeModel(payload))!
    expect(p.account.properties).toHaveLength(1)
    expect(p.account.properties[0]?.source).toBe('matched')
  })
  it('a new function\'s records reach the packet: the job\'s own record and override', () => {
    const raw = sampleLegalPortalResponse(company, TODAY) as { matters: Array<Record<string, unknown>> }
    const job0 = (raw.matters[0]!.jobs as Array<Record<string, unknown>>)[0]!
    const m = { ...raw.matters[0], jobs: [{ ...job0, customer_address_id: 'store' }], jobAddresses: [storeSite, { junk: true }], jobOwners: [{ job_id: job0.id, owner_mode: 'building_owner', owner_name: '', company_name: 'Sample Holdings LLC', mailing_address: 'PO Box 1' }, { nope: 1 }] }
    const payload = parseLegalPortalPayload({ ...raw, matters: [m] })!
    expect(payload.matters[0]?.jobAddresses).toHaveLength(1)
    expect(payload.matters[0]?.jobOwners).toHaveLength(1)
    const p = buildMatterPacket(payload.matters[0]!, TODAY, portalFeeModel(payload))!
    expect(p.account.jobs[0]?.property).toEqual(expect.objectContaining({ county: 'Hays', owner: 'Sample Holdings LLC', source: 'linked' }))
  })
})

describe('the source and the kind, said (integration pass)', () => {
  it('a matched record says it is not linked; an unknown kind says which calendar runs', () => {
    expect(propertySourceNote('matched')).toBe('matched by address, not linked')
    expect(propertySourceNote('job_address')).toBe('no property record linked')
    expect(propertySourceNote('linked')).toBe('')
    expect(propertyKindCell('')).toMatch(/^kind unknown · commercial dates shown/)
    expect(propertyKindCell('residential')).toBe('residential')
    expect(propertyKindCell('commercial')).toBe('non-residential')
  })
})
