import { describe, expect, it } from 'vitest'
import {
  customerRoleForLead,
  daysUntil,
  gcWorkCounts,
  jobDueWords,
  jobToHandOn,
  lostOwnerLead,
  newProjectSeedFromLead,
  orderJobs,
  orderLeadsBySoonestBid,
  shortDay,
  soonestOpenBid,
  type ProspectJob,
} from './gcLeadLane'

const job = (over: Partial<ProspectJob> & { id: string }): ProspectJob => ({
  prospect_id: 'p-1',
  name: 'Retail shell',
  address: null,
  sq_ft: null,
  size_note: null,
  plans_link: null,
  bid_due: null,
  status: 'open',
  won_by: null,
  note: null,
  created_at: '2026-10-01',
  ...over,
})

const today = '2026-10-15'

describe('gcLeadLane: a lead’s jobs', () => {
  it('orders open jobs by bid day with none last, then asked, lost, dropped, stably', () => {
    const jobs = [
      job({ id: 'd', status: 'dropped' }),
      job({ id: 'b', bid_due: '2026-11-10' }),
      job({ id: 'l', status: 'lost' }),
      job({ id: 'n' }),
      job({ id: 'a', bid_due: '2026-11-03' }),
      job({ id: 'k', status: 'asked' }),
    ]
    expect(orderJobs(jobs).map((j) => j.id)).toEqual(['a', 'b', 'n', 'k', 'l', 'd'])
  })

  it('words the day: due, today, late, no day, asked, lost, dropped', () => {
    expect(jobDueWords(job({ id: 'x', bid_due: '2026-11-03' }), today)).toEqual({ main: 'Nov 3', note: 'bids due · 19 days', tone: 'due' })
    expect(jobDueWords(job({ id: 'x', bid_due: '2026-10-16' }), today).note).toBe('bids due · 1 day')
    expect(jobDueWords(job({ id: 'x', bid_due: '2026-10-15' }), today)).toEqual({ main: 'Oct 15', note: 'bids due today', tone: 'due' })
    expect(jobDueWords(job({ id: 'x', bid_due: '2026-10-12' }), today)).toEqual({ main: 'Oct 12', note: 'bids were due 3 days ago', tone: 'late' })
    expect(jobDueWords(job({ id: 'x', bid_due: '2026-10-14' }), today).note).toBe('bids were due a day ago')
    expect(jobDueWords(job({ id: 'x' }), today)).toEqual({ main: 'when they say', note: 'no bid day yet', tone: 'quiet' })
    expect(jobDueWords(job({ id: 'x', status: 'asked' }), today)).toEqual({ main: 'asked us', note: 'they asked us to bid', tone: 'quiet' })
    expect(jobDueWords(job({ id: 'x', status: 'lost', won_by: 'Keller Build' }), today)).toEqual({ main: 'lost', note: 'to Keller Build', tone: 'lost' })
    expect(jobDueWords(job({ id: 'x', status: 'lost' }), today).note).toBe('to another builder')
    expect(jobDueWords(job({ id: 'x', status: 'dropped' }), today).main).toBe('dropped')
  })

  it('reads days and short days', () => {
    expect(daysUntil('2026-11-03', today)).toBe(19)
    expect(daysUntil('2026-10-01', today)).toBe(-14)
    expect(shortDay('2026-01-09')).toBe('Jan 9')
    expect(shortDay('spring')).toBe('spring')
  })

  it('finds the soonest open bid and the job to hand on', () => {
    const jobs = [job({ id: 'a', bid_due: '2026-11-10' }), job({ id: 'b', bid_due: '2026-11-03', status: 'lost' }), job({ id: 'c', bid_due: '2026-11-05' })]
    expect(soonestOpenBid(jobs)).toBe('2026-11-05')
    expect(jobToHandOn(jobs)?.id).toBe('c')
    expect(soonestOpenBid([job({ id: 'n' })])).toBeNull()
    expect(jobToHandOn([job({ id: 'n' })])?.id).toBe('n')
    expect(jobToHandOn([job({ id: 'l', status: 'lost' })])).toBeNull()
  })

  it('orders leads by the soonest open bid, then never called, then the caller’s order', () => {
    const leads = [{ id: 'p-late' }, { id: 'p-none' }, { id: 'p-soon' }, { id: 'p-none-called' }]
    const jobs = {
      'p-late': [job({ id: 'x', bid_due: '2026-12-01' })],
      'p-soon': [job({ id: 'y', bid_due: '2026-11-03' }), job({ id: 'z', bid_due: '2026-10-20', status: 'lost' })],
      'p-none-called': [job({ id: 'w' })],
    }
    expect(orderLeadsBySoonestBid(leads, jobs, new Set(['p-none-called'])).map((l) => l.id)).toEqual(['p-soon', 'p-late', 'p-none', 'p-none-called'])
  })
})

describe('gcLeadLane: Asked us hands on, and a lost project sends back', () => {
  it('seeds New project from an owner lead and its job, as a customer made now or one on file', () => {
    const lead = { company_name: 'Hill Country Developers', contact_name: 'Dana Whitlock', company_role: 'developer' }
    const j = job({ id: 'j', name: 'Retail shell', address: '4400 FM 1431, Cedar Park', sq_ft: 12000, size_note: 'one story', bid_due: '2026-11-03', plans_link: 'https://planhub.example/x' })
    expect(newProjectSeedFromLead(lead, j, 'c-9')).toEqual({
      name: 'Retail shell',
      address: '4400 FM 1431, Cedar Park',
      customerId: 'c-9',
      ownerName: '',
      architectId: null,
      architectName: '',
      bidDue: '2026-11-03',
      sqFt: 12000,
      sizeNote: 'one story',
      customerRole: 'owner',
      plansLink: 'https://planhub.example/x',
    })
    expect(newProjectSeedFromLead(lead, null, null).ownerName).toBe('Hill Country Developers')
    expect(newProjectSeedFromLead({ ...lead, company_role: 'gc' }, null, 'c-1').customerRole).toBe('gc')
    expect(customerRoleForLead('ownersRep')).toBe('ownersRep')
  })

  it('seeds an architect lead as the firm that drew the plans, the owner left blank', () => {
    const seed = newProjectSeedFromLead({ company_name: 'Studio Bexar', contact_name: null, company_role: 'architect' }, null, 'c-2')
    expect(seed.architectId).toBe('c-2')
    expect(seed.customerId).toBeNull()
    expect(seed.ownerName).toBe('')
    expect(newProjectSeedFromLead({ company_name: 'Studio Bexar', contact_name: null, company_role: 'architect' }, null, null).architectName).toBe('Studio Bexar')
  })

  it('writes the lost owner as a GC lead with the job marked lost', () => {
    const out = lostOwnerLead(
      { name: 'Comal ISD field house', address: '100 Field Rd, New Braunfels', sqFt: 8000, sizeNote: '', customerRole: 'ownersRep', lostOn: '2026-10-09', wonBy: 'Keller Build' },
      { id: 'c-5', name: 'Comal ISD facilities', phone: '(830) 555-0100', email: null, address: null },
      { userId: 'u-1', masterUserId: 'm-1' },
    )
    expect(out.prospect).toMatchObject({
      kind: 'gc_lead',
      company_name: 'Comal ISD facilities',
      phone_number: '(830) 555-0100',
      email: null,
      notes: 'Lost Comal ISD field house on Oct 9 to Keller Build.',
      source: 'A lost bid',
      company_role: 'ownersRep',
      customer_id: 'c-5',
      created_by: 'u-1',
      master_user_id: 'm-1',
    })
    expect(out.job).toEqual({ name: 'Comal ISD field house', address: '100 Field Rd, New Braunfels', sq_ft: 8000, size_note: null, status: 'lost', won_by: 'Keller Build', note: null })
  })

  it('counts GC work in flight', () => {
    expect(
      gcWorkCounts([
        { stage: 'bidding', lostOn: null },
        { stage: 'bidding', lostOn: '2026-10-09' },
        { stage: 'buyout', lostOn: null },
        { stage: 'building', lostOn: null },
        { stage: 'closed', lostOn: null },
      ]),
    ).toEqual({ bidding: 1, buyout: 1, building: 1, lost: 1 })
  })
})
