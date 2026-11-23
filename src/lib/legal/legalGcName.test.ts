/**
 * v2.8315 (punch list #85, a review residual): a job whose GC is not the matter's payer read the word *GC* on
 * the portal, because the GC's name was looked up only among the payers.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { gcCustomerFor, gcIdsToRead } from '../../../supabase/functions/_shared/legalGcName'
import { payerForJob } from './legalPacket'

const payers = [{ id: 'c-owner', name: 'Alvarado Holdings LLC' }, { id: 'c-gc-a', name: 'Brazos Ridge Contracting' }]
const jobs = [
  { id: 'j1', gc_customer_id: 'c-gc-a' },
  { id: 'j2', gc_customer_id: 'c-gc-b' },
  { id: 'j3', gc_customer_id: 'c-gc-b' },
  { id: 'j4', gc_customer_id: null },
]

describe('a job’s GC by name', () => {
  it('reads only the GCs the payers’ rows do not hold, each once', () => {
    expect(gcIdsToRead(jobs, payers)).toEqual(['c-gc-b'])
    expect(gcIdsToRead(jobs, [...payers, { id: 'c-gc-b', name: 'Hill Country Builders' }])).toEqual([])
    expect(gcIdsToRead([], payers)).toEqual([])
  })

  it('names a GC who is the payer and one who is not, and is null with no GC', () => {
    const others = [{ id: 'c-gc-b', name: ' Hill Country Builders ' }]
    expect(gcCustomerFor(jobs[0]!, payers, others)).toEqual({ id: 'c-gc-a', name: 'Brazos Ridge Contracting' })
    expect(gcCustomerFor(jobs[1]!, payers, others)).toEqual({ id: 'c-gc-b', name: 'Hill Country Builders' })
    expect(gcCustomerFor(jobs[3]!, payers, others)).toBeNull()
  })

  it('the packet’s account then reads the name, where it read the word GC', () => {
    const job = { customer_id: 'c-owner', customer_name: 'Alvarado Holdings LLC', gc_customer_id: 'c-gc-b' }
    // Before: looked up among the payers alone.
    expect(payerForJob({ ...job, gcCustomer: gcCustomerFor(job, payers, []) as never }).name).toBe('GC')
    // After: the other GCs' names are read too.
    expect(payerForJob({ ...job, gcCustomer: gcCustomerFor(job, payers, [{ id: 'c-gc-b', name: 'Hill Country Builders' }]) as never }).name).toBe('Hill Country Builders')
  })

  it('a GC the read did not find keeps its id with no name, and still reads GC', () => {
    expect(gcCustomerFor(jobs[1]!, payers, [])).toEqual({ id: 'c-gc-b', name: null })
    expect(gcCustomerFor(jobs[1]!, payers, [{ id: 'c-gc-b', name: '  ' }])).toEqual({ id: 'c-gc-b', name: null })
  })
})

describe('legal-portal reads the other GCs’ names and the owner’s call', () => {
  const src = readFileSync('supabase/functions/legal-portal/index.ts', 'utf8')
  it('looks a job’s GC up through the helper, with the names read apart', () => {
    expect(src).toContain('const otherGcIds = gcIdsToRead(jobs, customers)')
    expect(src).toContain("admin.from('customers').select('id, name').in('id', otherGcIds)")
    expect(src).toContain('gcCustomer: gcCustomerFor(j, customers, otherGcs),')
    expect(src).not.toContain('customers.find((c) => c.id === j.gc_customer_id)')
  })
  it('reads the notice items’ fields in one place, for the owner’s call, and hands the rows to the shape', () => {
    expect(src).toContain("select(LIEN_BOOK_OWNER_CALL_SELECT).in('job_id', jobIds).eq('kind', 'notice_53_056').is('voided_at', null)")
    expect(src).toContain('ownerCallItems: ownerCallRes.error ? [] : (ownerCallRes.data ?? []),')
    expect(src).toContain('withSampleOwnerFacts(sampleLegalPortalResponse(')
  })
})
