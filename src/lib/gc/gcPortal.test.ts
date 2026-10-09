/**
 * GC mode's customer portal (O7c): what a GC job's customer sees (`gcPortalJobs`), whose press it is (`gcPortalOwns`),
 * and the database's refusals in their words (`gcPortalRefusalWords`), from supabase/functions/_shared/gcPortal.ts.
 */
import { describe, expect, it } from 'vitest'
import { gcPortalJobs, gcPortalOwns, gcPortalRefusalWords, type GcPortalRows } from '../../../supabase/functions/_shared/gcPortal'

const rows = (over: Partial<GcPortalRows> = {}): GcPortalRows => ({
  projects: [
    { id: 'p-shell', name: 'Retail Shell', customer_id: 'owner' },
    { id: 'p-clinic', name: 'Clinic', customer_id: 'owner' },
    { id: 'p-bid', name: 'Still bidding', customer_id: 'owner' },
    { id: 'p-other', name: 'Someone else’s', customer_id: 'other' },
  ],
  gc: [
    { project_id: 'p-shell', stage: 'building' },
    { project_id: 'p-clinic', stage: 'closed' },
    { project_id: 'p-bid', stage: 'bidding' },
    { project_id: 'p-other', stage: 'building' },
  ],
  changeOrders: [
    { id: 'co-3', project_id: 'p-shell', number: 3, description: ' A larger water heater ', price: '1000', days: 0, sent_on: '2026-10-07', status: 'sent' },
    { id: 'co-2', project_id: 'p-shell', number: 2, description: 'A floor box', price: -500, days: 2, sent_on: '2026-10-06', status: 'sent' },
    { id: 'co-1', project_id: 'p-shell', number: 1, description: 'Signed already', price: 900, days: 0, sent_on: '2026-09-01', status: 'signed' },
    { id: 'co-9', project_id: 'p-bid', number: 1, description: 'Not ours yet', price: 100, days: 0, sent_on: '2026-10-01', status: 'sent' },
    { id: 'co-8', project_id: 'p-other', number: 1, description: 'Not theirs', price: 100, days: 0, sent_on: '2026-10-01', status: 'sent' },
  ],
  acceptances: [{ project_id: 'p-clinic', accepted_on: '2026-10-02', how: 'portal' }],
  payApps: [
    { project_id: 'p-shell', number: 1, final: false, work_to_date: '40000' },
    { project_id: 'p-shell', number: 2, final: false, work_to_date: '99999.6' },
    { project_id: 'p-clinic', number: 1, final: false, work_to_date: 50000 },
  ],
  contractNow: { 'p-shell': 100000, 'p-clinic': 50000 },
  ...over,
})

describe('the GC section of a customer’s portal', () => {
  it('shows their won jobs, each change order waiting on them in order, and the work to accept once every line is billed', () => {
    expect(gcPortalJobs(rows(), 'owner')).toEqual([
      { projectId: 'p-clinic', name: 'Clinic', changeOrders: [], canAccept: false, accepted: { on: '2026-10-02', how: 'portal' } },
      {
        projectId: 'p-shell',
        name: 'Retail Shell',
        changeOrders: [
          { id: 'co-2', number: 2, description: 'A floor box', price: -500, days: 2, sentOn: '2026-10-06' },
          { id: 'co-3', number: 3, description: 'A larger water heater', price: 1000, days: 0, sentOn: '2026-10-07' },
        ],
        canAccept: true,
        accepted: null,
      },
    ])
  })

  it('offers Accept the work only when the last progress bill covers the price today, half a dollar’s slack', () => {
    const short = rows({ payApps: [{ project_id: 'p-shell', number: 2, final: false, work_to_date: 99_999.4 }] })
    expect(gcPortalJobs(short, 'owner').find((j) => j.projectId === 'p-shell')?.canAccept).toBe(false)
    // A final pay application is not a progress bill; no price read, no Accept.
    const finalOnly = rows({ payApps: [{ project_id: 'p-shell', number: 3, final: true, work_to_date: 100_000 }] })
    expect(gcPortalJobs(finalOnly, 'owner').find((j) => j.projectId === 'p-shell')?.canAccept).toBe(false)
    expect(gcPortalJobs(rows({ contractNow: {} }), 'owner').find((j) => j.projectId === 'p-shell')?.canAccept).toBe(false)
  })

  it('leaves out a job with nothing to answer, and anyone else’s', () => {
    const quiet = rows({ changeOrders: [], acceptances: [], payApps: [] })
    expect(gcPortalJobs(quiet, 'owner')).toEqual([])
    expect(gcPortalJobs(rows(), 'other').map((j) => j.projectId)).toEqual(['p-other'])
  })

  it('takes a press only on the link’s own customer’s project', () => {
    expect(gcPortalOwns({ customer_id: 'owner' }, 'owner')).toBe(true)
    expect(gcPortalOwns({ customer_id: 'other' }, 'owner')).toBe(false)
    expect(gcPortalOwns({ customer_id: null }, 'owner')).toBe(false)
    expect(gcPortalOwns(null, 'owner')).toBe(false)
  })

  it('says the database’s refusals to the customer in their words', () => {
    expect(gcPortalRefusalWords('Change order 2 is not waiting on the customer.')).toBe('That change order is already answered.')
    expect(gcPortalRefusalWords('They accepted the work on Oct 7.')).toBe('The work is already accepted.')
    expect(gcPortalRefusalWords('Bill every line first. They accept the work once our pay applications have billed all of it.')).toBe('The work can be accepted once every line of it is billed.')
    expect(gcPortalRefusalWords('Keep the reason to one short line.')).toBe('Keep the reason to one short line.')
    expect(gcPortalRefusalWords('Only a job we won is accepted.')).toBe('That job cannot be accepted here.')
    expect(gcPortalRefusalWords('permission denied for table gc_change_orders')).toBe('Something went wrong. Please try again, or call our office.')
  })
})
