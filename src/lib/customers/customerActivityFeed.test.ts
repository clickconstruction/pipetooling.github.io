import { describe, expect, it } from 'vitest'
import {
  buildCustomerActivityFeed,
  filterActivityFeed,
  type ActivityFeedInputs,
} from './customerActivityFeed'

function inputs(p: Partial<ActivityFeedInputs>): ActivityFeedInputs {
  return {
    jobs: [],
    statusEvents: [],
    threadNotes: [],
    estimates: [],
    dispatchRequests: [],
    customerContacts: [],
    userNames: {},
    ...p,
  }
}

const JOB = {
  id: 'j1',
  label: '941',
  jobName: 'Door repair',
  createdAt: '2026-08-01T10:00:00Z',
  invoices: [{ id: 'i1', status: 'billed', amount: 1883.03, billed_at: '2026-08-10T15:00:00Z' }],
  payments: [{ invoice_id: 'i1', amount: 500, paid_on: '2026-08-12' }],
}

describe('buildCustomerActivityFeed', () => {
  it('merges all sources sorted newest-first with stable keys', () => {
    const feed = buildCustomerActivityFeed(
      inputs({
        jobs: [JOB],
        statusEvents: [
          {
            id: 's1',
            job_id: 'j1',
            from_status: 'ready_to_bill',
            to_status: 'billed',
            changed_at: '2026-08-10T14:59:00Z',
            changed_by_user_id: 'u1',
          },
        ],
        threadNotes: [
          { id: 'n1', job_id: 'j1', body: 'Hold trim until countertops land.', created_at: '2026-08-11T09:00:00Z', author_user_id: 'u2' },
        ],
        userNames: { u1: 'Roxi', u2: 'Wendi' },
      }),
    )
    expect(feed.map((e) => e.kind)).toEqual(['payment', 'note', 'invoice_billed', 'status', 'job_created'])
    expect(feed.map((e) => e.key)).toEqual(['payment:j1:0', 'note:n1', 'invoice:i1', 'status:s1', 'job:j1'])
    const status = feed.find((e) => e.kind === 'status')!
    expect(status.title).toBe('Ready to Bill → Billed Awaiting Payment')
    expect(status.actorName).toBe('Roxi')
    expect(status.jobLabel).toBe('941')
    const note = feed.find((e) => e.kind === 'note')!
    expect(note.title).toBe('Note on 941')
    expect(note.detail).toBe('Hold trim until countertops land.')
    expect(note.actorName).toBe('Wendi')
    expect(feed.find((e) => e.kind === 'invoice_billed')!.title).toBe('Invoice billed — $1,883.03')
    expect(feed.find((e) => e.kind === 'payment')!.title).toBe('Payment received — $500')
    expect(feed.find((e) => e.kind === 'job_created')!.detail).toBe('Door repair')
  })

  it('estimates stamp created plus their latest decided/sent state', () => {
    const feed = buildCustomerActivityFeed(
      inputs({
        estimates: [
          {
            id: 'e1',
            estimate_number: 118,
            title: 'Softener install',
            status: 'customer_accepted',
            total_cents: 230000,
            created_at: '2026-08-01T00:00:00Z',
            sent_at: '2026-08-02T00:00:00Z',
            updated_at: '2026-08-09T00:00:00Z',
          },
          {
            id: 'e2',
            estimate_number: 121,
            title: 'Tankless',
            status: 'draft',
            total_cents: 894000,
            created_at: '2026-08-16T00:00:00Z',
            sent_at: null,
            updated_at: '2026-08-16T00:00:00Z',
          },
        ],
      }),
    )
    expect(feed.map((e) => e.title)).toEqual([
      'Estimate #121 created — $8,940',
      'Estimate #118 accepted',
      'Estimate #118 created — $2,300',
    ])
    expect(feed.every((e) => e.family === 'money')).toBe(true)
  })

  it('dispatch and customer-contact events carry their families; filter works', () => {
    const feed = buildCustomerActivityFeed(
      inputs({
        jobs: [{ ...JOB, invoices: [], payments: [] }],
        dispatchRequests: [
          { id: 'd1', job_ledger_id: 'j1', title: 'Get gate code', status: 'closed', created_at: '2026-08-05T00:00:00Z' },
        ],
        customerContacts: [
          { id: 'c1', contact_date: '2026-08-06', contact_method: 'phone', details: 'Asked about invoice', created_by: 'u1' },
        ],
        userNames: { u1: 'Robert' },
      }),
    )
    const dispatch = feed.find((e) => e.kind === 'dispatch')!
    expect(dispatch.title).toBe('Dispatch task (closed)')
    expect(dispatch.family).toBe('jobs')
    const contact = feed.find((e) => e.kind === 'contact')!
    expect(contact.title).toBe('Customer note (phone)')
    expect(contact.actorName).toBe('Robert')
    expect(filterActivityFeed(feed, 'notes').map((e) => e.kind)).toEqual(['contact'])
    expect(filterActivityFeed(feed, 'jobs').map((e) => e.kind)).toEqual(['dispatch', 'job_created'])
    expect(filterActivityFeed(feed, 'all')).toHaveLength(feed.length)
  })
})
