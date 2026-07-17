import { describe, expect, it } from 'vitest'
import {
  bucketMyBidCustomerContactsFromOthers,
  bucketMyBidSubmissionsFromOthers,
  buildMyBidRows,
  collectMyBidNoteAuthorIds,
  formatRelativeCompactAgo,
  isMyBidStreamUnread,
  myBidRolesForUser,
  truncateMyBidNotePreview,
  type MyBidBaseRow,
  type MyBidCustomerContactRow,
  type MyBidSubmissionEntryRow,
} from './dashboardMyBids'

const NOW = new Date('2026-07-17T12:00:00Z')

const entry = (over: Partial<MyBidSubmissionEntryRow>): MyBidSubmissionEntryRow => ({
  id: 'e1',
  bid_id: 'bid-1',
  created_at: '2026-07-17T10:00:00Z',
  created_by: 'other-user',
  notes: 'a note',
  occurred_at: '2026-07-17',
  contact_method: null,
  ...over,
})

const contact = (over: Partial<MyBidCustomerContactRow>): MyBidCustomerContactRow => ({
  id: 'c1',
  customer_id: 'cust-1',
  created_at: '2026-07-17T10:00:00Z',
  created_by: 'other-user',
  details: 'a contact',
  contact_date: '2026-07-17',
  contact_method: null,
  ...over,
})

const baseRow = (over: Partial<MyBidBaseRow>): MyBidBaseRow => ({
  id: 'bid-1',
  project_name: 'Project One',
  bid_due_date: '2026-07-20',
  bid_date_sent: null,
  outcome: null,
  customer_id: 'cust-1',
  estimator_id: 'me',
  account_manager_id: null,
  service_type: { name: 'Plumbing' },
  ...over,
})

describe('formatRelativeCompactAgo', () => {
  it('returns em dash for null', () => {
    expect(formatRelativeCompactAgo(null, NOW)).toBe('—')
  })

  it('returns "just now" for future timestamps and under a minute', () => {
    expect(formatRelativeCompactAgo('2026-07-17T12:05:00Z', NOW)).toBe('just now')
    expect(formatRelativeCompactAgo('2026-07-17T11:59:30Z', NOW)).toBe('just now')
  })

  it('formats minutes, hours, days, and weeks compactly', () => {
    expect(formatRelativeCompactAgo('2026-07-17T11:35:00Z', NOW)).toBe('25m ago')
    expect(formatRelativeCompactAgo('2026-07-17T07:00:00Z', NOW)).toBe('5h ago')
    expect(formatRelativeCompactAgo('2026-07-14T12:00:00Z', NOW)).toBe('3d ago')
    expect(formatRelativeCompactAgo('2026-06-26T12:00:00Z', NOW)).toBe('3w ago')
  })

  it('falls back to a short date at 5+ weeks', () => {
    expect(formatRelativeCompactAgo('2026-05-01T12:00:00Z', NOW)).toMatch(/^[A-Z][a-z]{2} \d{1,2}, \d{2}$/)
  })
})

describe('truncateMyBidNotePreview', () => {
  it('returns empty string for null/blank text', () => {
    expect(truncateMyBidNotePreview(null, 90)).toBe('')
    expect(truncateMyBidNotePreview('   ', 90)).toBe('')
  })

  it('trims and passes short text through; adds ellipsis past max', () => {
    expect(truncateMyBidNotePreview('  hello  ', 90)).toBe('hello')
    expect(truncateMyBidNotePreview('abcdef', 6)).toBe('abcdef')
    expect(truncateMyBidNotePreview('abcdefg', 6)).toBe('abcdef…')
  })
})

describe('bucketMyBidSubmissionsFromOthers', () => {
  it('drops own notes and rows missing author or created_at', () => {
    const map = bucketMyBidSubmissionsFromOthers(
      [
        entry({ id: 'mine', created_by: 'me' }),
        entry({ id: 'anon', created_by: null }),
        entry({ id: 'undated', created_at: null }),
        entry({ id: 'keep' }),
      ],
      'me',
    )
    expect([...map.keys()]).toEqual(['bid-1'])
    expect(map.get('bid-1')!.map((e) => e.id)).toEqual(['keep'])
  })

  it('sorts newest first with id-desc tiebreak', () => {
    const map = bucketMyBidSubmissionsFromOthers(
      [
        entry({ id: 'a', created_at: '2026-07-17T09:00:00Z' }),
        entry({ id: 'b', created_at: '2026-07-17T10:00:00Z' }),
        entry({ id: 'c', created_at: '2026-07-17T10:00:00Z' }),
      ],
      'me',
    )
    expect(map.get('bid-1')!.map((e) => e.id)).toEqual(['c', 'b', 'a'])
  })
})

describe('bucketMyBidCustomerContactsFromOthers', () => {
  it('buckets per customer, newest first, dropping own contacts', () => {
    const map = bucketMyBidCustomerContactsFromOthers(
      [
        contact({ id: 'x', customer_id: 'cust-2', created_at: '2026-07-16T10:00:00Z' }),
        contact({ id: 'y', customer_id: 'cust-2', created_at: '2026-07-17T10:00:00Z' }),
        contact({ id: 'z', created_by: 'me' }),
      ],
      'me',
    )
    expect(map.has('cust-1')).toBe(false)
    expect(map.get('cust-2')!.map((c) => c.id)).toEqual(['y', 'x'])
  })
})

describe('collectMyBidNoteAuthorIds', () => {
  it('collects distinct author ids across both maps', () => {
    const bids = bucketMyBidSubmissionsFromOthers(
      [entry({ id: 'a', created_by: 'u1' }), entry({ id: 'b', created_by: 'u2' })],
      'me',
    )
    const contacts = bucketMyBidCustomerContactsFromOthers([contact({ created_by: 'u2' })], 'me')
    expect([...collectMyBidNoteAuthorIds(bids, contacts)].sort()).toEqual(['u1', 'u2'])
  })
})

describe('isMyBidStreamUnread', () => {
  it('is read when there is no latest note', () => {
    expect(isMyBidStreamUnread(undefined, null)).toBe(false)
  })

  it('is unread when the watermark is missing or empty', () => {
    expect(isMyBidStreamUnread('2026-07-17T10:00:00Z', null)).toBe(true)
    expect(isMyBidStreamUnread('2026-07-17T10:00:00Z', '')).toBe(true)
  })

  it('compares latest note vs watermark', () => {
    expect(isMyBidStreamUnread('2026-07-17T10:00:00Z', '2026-07-17T09:00:00Z')).toBe(true)
    expect(isMyBidStreamUnread('2026-07-17T10:00:00Z', '2026-07-17T10:00:00Z')).toBe(false)
    expect(isMyBidStreamUnread('2026-07-17T10:00:00Z', '2026-07-17T11:00:00Z')).toBe(false)
  })
})

describe('myBidRolesForUser', () => {
  it('classifies estimator / account manager / both, defaulting to estimator', () => {
    expect(myBidRolesForUser('me', 'me', 'me')).toBe('both')
    expect(myBidRolesForUser('me', 'me', null)).toBe('estimator')
    expect(myBidRolesForUser('me', null, 'me')).toBe('account_manager')
    expect(myBidRolesForUser('me', 'someone-else', null)).toBe('estimator')
  })
})

describe('buildMyBidRows', () => {
  it('builds unread flags, others lists with author labels, and field mapping', () => {
    const bidLists = bucketMyBidSubmissionsFromOthers(
      [entry({ id: 'e-new', created_at: '2026-07-17T10:00:00Z', created_by: 'u1', notes: 'note text' })],
      'me',
    )
    const custLists = bucketMyBidCustomerContactsFromOthers(
      [contact({ id: 'c-old', created_at: '2026-07-15T10:00:00Z', created_by: 'u2' })],
      'me',
    )
    const rows = buildMyBidRows({
      baseRows: [baseRow({})],
      readStateRows: [
        {
          bid_id: 'bid-1',
          last_seen_bid_submission_at: '2026-07-16T00:00:00Z',
          last_seen_customer_contact_at: '2026-07-16T00:00:00Z',
        },
      ],
      bidListsFromOthers: bidLists,
      customerListsFromOthers: custLists,
      authorLabelById: new Map([['u1', 'Alice']]),
      userId: 'me',
    })
    expect(rows).toHaveLength(1)
    const r = rows[0]!
    expect(r.service_type_name).toBe('Plumbing')
    expect(r.myBidRoles).toBe('estimator')
    expect(r.unreadBidNotes).toBe(true)
    expect(r.unreadCustomerNotes).toBe(false)
    expect(r.othersBidUpdates).toEqual([
      {
        id: 'e-new',
        text: 'note text',
        createdAt: '2026-07-17T10:00:00Z',
        occurredAt: '2026-07-17',
        contactMethod: undefined,
        authorLabel: 'Alice',
      },
    ])
    expect(r.othersCustomerUpdates[0]!.authorLabel).toBeUndefined()
  })

  it('skips customer unread entirely when the bid has no customer, and defaults service type to empty', () => {
    const custLists = bucketMyBidCustomerContactsFromOthers([contact({})], 'me')
    const rows = buildMyBidRows({
      baseRows: [baseRow({ id: 'bid-2', customer_id: null, service_type: null })],
      readStateRows: [],
      bidListsFromOthers: new Map(),
      customerListsFromOthers: custLists,
      authorLabelById: new Map(),
      userId: 'me',
    })
    expect(rows[0]!.unreadBidNotes).toBe(false)
    expect(rows[0]!.unreadCustomerNotes).toBe(false)
    expect(rows[0]!.othersCustomerUpdates).toEqual([])
    expect(rows[0]!.service_type_name).toBe('')
  })

  it('treats a bid with no read-state row as unread when others have posted', () => {
    const bidLists = bucketMyBidSubmissionsFromOthers([entry({})], 'me')
    const rows = buildMyBidRows({
      baseRows: [baseRow({})],
      readStateRows: [],
      bidListsFromOthers: bidLists,
      customerListsFromOthers: new Map(),
      authorLabelById: new Map(),
      userId: 'me',
    })
    expect(rows[0]!.unreadBidNotes).toBe(true)
  })
})
