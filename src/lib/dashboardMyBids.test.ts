import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from './plainWords'
import {
  bucketMyBidCustomerContactsFromOthers,
  bucketMyBidSubmissionsFromOthers,
  buildMyBidRows,
  buildMyBidsCard,
  collectMyBidNoteAuthorIds,
  formatRelativeCompactAgo,
  groupMyBids,
  isMyBidOffTheBoard,
  isMyBidStreamUnread,
  MY_BID_STATE_GLOSS,
  MY_BID_STATES,
  MY_BID_STATE_WORDS,
  MY_BIDS_CUT_WORDS,
  MY_BIDS_HIDDEN_GLOSS,
  MY_BIDS_DASHBOARD_ROW_LIMIT,
  MY_BIDS_NOT_LOST_FILTER,
  MY_BIDS_ON_THE_BOARD_FILTER,
  MY_BIDS_READ_ORDER,
  myBidGroupLabel,
  myBidHiddenHereOnlyWords,
  myBidHiddenWords,
  myBidHiddenWrite,
  myBidsHiddenInReadState,
  myBidsHiddenStorageKey,
  myBidsLocalIdsToMove,
  myBidIsPutAway,
  myBidState,
  myBidWhen,
  myBidsReadIsCut,
  myBidRolesForUser,
  myBidsStartsOpen,
  truncateMyBidNotePreview,
  type MyBidBaseRow,
  type MyBidCustomerContactRow,
  type MyBidRow,
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

describe('myBidsStartsOpen', () => {
  it('folds the card for a primary', () => {
    expect(myBidsStartsOpen('primary')).toBe(false)
  })

  it('opens it for every other role that has the card', () => {
    for (const role of ['dev', 'master_technician', 'assistant', 'controller', 'estimator']) {
      expect(myBidsStartsOpen(role)).toBe(true)
    }
  })

  it('reads a role that has not arrived as open, so the card folds only once primary hydrates', () => {
    expect(myBidsStartsOpen(null)).toBe(true)
    expect(myBidsStartsOpen(undefined)).toBe(true)
  })
})

describe('myBidState — the Bid Board\'s rule (punch list #426)', () => {
  it('reads the answer before the sent date, so a won bid with no sent date is Won', () => {
    expect(myBidState({ outcome: 'won', bid_date_sent: null })).toBe('won')
    expect(myBidState({ outcome: 'started_or_complete', bid_date_sent: null })).toBe('startedOrComplete')
  })

  it('with no answer, the sent date decides', () => {
    expect(myBidState({ outcome: null, bid_date_sent: null })).toBe('unsent')
    expect(myBidState({ outcome: null, bid_date_sent: '2026-11-03' })).toBe('pending')
  })

  it('a lost bid that slips through reads as its sent date says, never a fifth state', () => {
    expect(myBidState({ outcome: 'lost', bid_date_sent: '2026-11-03' })).toBe('pending')
    expect(myBidState({ outcome: 'lost', bid_date_sent: null })).toBe('unsent')
  })

  it('has the board\'s words for every state, in the order a person works them', () => {
    expect(MY_BID_STATES.map((s) => MY_BID_STATE_WORDS[s])).toEqual(['Unsent', 'Not yet won or lost', 'Won', 'Started or Complete'])
  })
})

describe('isMyBidOffTheBoard', () => {
  it('an adopted bid is off, whatever its state', () => {
    expect(isMyBidOffTheBoard({ outcome: 'won', bid_date_sent: '2026-11-03', adopted_into_bid_id: 'other' })).toBe(true)
  })

  it('an archived bid is off only while it is unsent, as on the board', () => {
    const archived = '2026-05-11T15:00:00Z'
    expect(isMyBidOffTheBoard({ outcome: null, bid_date_sent: null, working_board_archived_at: archived })).toBe(true)
    expect(isMyBidOffTheBoard({ outcome: null, bid_date_sent: '2026-11-03', working_board_archived_at: archived })).toBe(false)
    expect(isMyBidOffTheBoard({ outcome: 'won', bid_date_sent: null, working_board_archived_at: archived })).toBe(false)
  })

  it('a bid with neither mark stays', () => {
    expect(isMyBidOffTheBoard({ outcome: null, bid_date_sent: null })).toBe(false)
  })
})

describe('groupMyBids', () => {
  const bid = (id: string, over: Partial<{ outcome: string | null; bid_date_sent: string | null; bid_due_date: string | null }>) => ({
    id,
    outcome: null,
    bid_date_sent: null,
    bid_due_date: null,
    ...over,
  })

  it('unsent bids run oldest due date first, with no due date last', () => {
    const g = groupMyBids([bid('none', {}), bid('late', { bid_due_date: '2026-04-08' }), bid('soon', { bid_due_date: '2026-11-26' })])
    expect(g.unsent.map((b) => b.id)).toEqual(['late', 'soon', 'none'])
  })

  it('every other state runs newest sent first', () => {
    const g = groupMyBids([
      bid('p-old', { bid_date_sent: '2026-09-01' }),
      bid('p-new', { bid_date_sent: '2026-11-20' }),
      bid('w-old', { outcome: 'won', bid_date_sent: '2026-02-07' }),
      bid('w-new', { outcome: 'won', bid_date_sent: '2026-06-17' }),
      bid('s', { outcome: 'started_or_complete', bid_date_sent: '2026-01-05' }),
    ])
    expect(g.pending.map((b) => b.id)).toEqual(['p-new', 'p-old'])
    expect(g.won.map((b) => b.id)).toEqual(['w-new', 'w-old'])
    expect(g.startedOrComplete.map((b) => b.id)).toEqual(['s'])
    expect(g.unsent).toEqual([])
  })

  it('leaves the list it was given untouched', () => {
    const list = [bid('b', { bid_due_date: '2026-11-26' }), bid('a', { bid_due_date: '2026-04-08' })]
    groupMyBids(list)
    expect(list.map((b) => b.id)).toEqual(['b', 'a'])
  })
})

describe('the read', () => {
  it('keeps what is not lost and what the board still lists', () => {
    expect(MY_BIDS_NOT_LOST_FILTER).toBe('outcome.is.null,outcome.neq.lost')
    expect(MY_BIDS_ON_THE_BOARD_FILTER).toBe('working_board_archived_at.is.null,outcome.not.is.null,bid_date_sent.not.is.null')
  })

  it('sorts the bids with no answer first, each pile newest first, so a cut falls on the oldest decided bids', () => {
    expect(MY_BIDS_READ_ORDER).toEqual([
      { column: 'outcome', ascending: false, nullsFirst: true },
      { column: 'created_at', ascending: false, nullsFirst: false },
    ])
  })

  it('says it was cut only when it came back full', () => {
    expect(myBidsReadIsCut(MY_BIDS_DASHBOARD_ROW_LIMIT - 1)).toBe(false)
    expect(myBidsReadIsCut(MY_BIDS_DASHBOARD_ROW_LIMIT)).toBe(true)
  })
})

describe('myBidWhen — the value line of a bid (punch list #426, step 2)', () => {
  const TODAY = new Date(2026, 10, 23, 9)
  const bid = (over: Partial<{ bid_due_date: string | null; bid_date_sent: string | null; outcome: string | null; created_at: string | null }>) => ({
    bid_due_date: null,
    bid_date_sent: null,
    outcome: null,
    created_at: null,
    ...over,
  })

  it('an unsent bid past its due date is red and counts the days', () => {
    expect(myBidWhen(bid({ bid_due_date: '2026-04-08' }), TODAY)).toEqual({ label: 'Due', value: 'Wed 4/8', tail: '229 days past due', late: true, tone: 'red' })
    expect(myBidWhen(bid({ bid_due_date: '2026-11-22' }), TODAY).tail).toBe('1 day past due')
  })

  it('an unsent bid due today or within three days is amber, and later than that is grey', () => {
    expect(myBidWhen(bid({ bid_due_date: '2026-11-23' }), TODAY)).toMatchObject({ value: 'Mon 11/23', tail: 'today', late: false, tone: 'amber' })
    expect(myBidWhen(bid({ bid_due_date: '2026-11-26' }), TODAY)).toMatchObject({ tail: 'in 3 days', tone: 'amber' })
    expect(myBidWhen(bid({ bid_due_date: '2026-11-24' }), TODAY).tail).toBe('in 1 day')
    expect(myBidWhen(bid({ bid_due_date: '2026-12-02' }), TODAY)).toMatchObject({ tail: 'in 9 days', tone: 'gray' })
  })

  it('an unsent bid with no due date reads its days on the board, red after 14', () => {
    expect(myBidWhen(bid({ created_at: '2026-11-17T15:00:00Z' }), TODAY)).toEqual({ label: null, value: 'No due date', tail: '6 days on the board', late: false, tone: 'gray' })
    expect(myBidWhen(bid({ created_at: '2026-11-04T15:00:00Z' }), TODAY)).toMatchObject({ tail: '19 days on the board', late: true, tone: 'red' })
    expect(myBidWhen(bid({}), TODAY)).toMatchObject({ value: 'No due date', tail: null, tone: 'gray' })
  })

  it('every other state reads its sent date and is never red, whatever its due date', () => {
    expect(myBidWhen(bid({ bid_due_date: '2026-04-08', bid_date_sent: '2026-11-20' }), TODAY)).toEqual({ label: 'Sent', value: 'Fri 11/20', tail: '3 days ago', late: false, tone: 'gray' })
    expect(myBidWhen(bid({ outcome: 'won', bid_date_sent: '2026-11-23' }), TODAY).tail).toBe('today')
    expect(myBidWhen(bid({ outcome: 'won' }), TODAY)).toEqual({ label: null, value: 'No sent date', tail: null, late: false, tone: 'gray' })
  })
})

describe('buildMyBidsCard', () => {
  const TODAY = new Date(2026, 10, 23, 9)
  const row = (id: string, over: Partial<MyBidRow> = {}): MyBidRow => ({
    id,
    project_name: id,
    bid_due_date: null,
    bid_date_sent: null,
    outcome: null,
    created_at: null,
    service_type_name: 'Plumbing',
    myBidRoles: 'estimator',
    unreadBidNotes: false,
    unreadCustomerNotes: false,
    othersBidUpdates: [],
    othersCustomerUpdates: [],
    ...over,
  })

  it('draws the states that hold a bid, in the board\'s order, and Unsent always', () => {
    const card = buildMyBidsCard([row('w', { outcome: 'won', bid_date_sent: '2026-06-17' }), row('p', { bid_date_sent: '2026-11-20' })], new Set(), TODAY)
    expect(card.groups.map((g) => [g.heading, g.bids.length])).toEqual([
      ['Unsent', 0],
      ['Not yet won or lost', 1],
      ['Won', 1],
    ])
    expect(card.shown).toBe(2)
  })

  it('counts the unsent bids past due and the bids with unread updates', () => {
    const card = buildMyBidsCard(
      [row('late', { bid_due_date: '2026-04-08' }), row('none', { created_at: '2026-11-04T15:00:00Z' }), row('p', { bid_date_sent: '2026-11-20', unreadBidNotes: true })],
      new Set(),
      TODAY,
    )
    expect(card.groups[0]).toMatchObject({ heading: 'Unsent', pastDue: 1 })
    expect(card.groups[1]?.unread.map((b) => b.id)).toEqual(['p'])
    expect(myBidGroupLabel(card.groups[0]!)).toBe('Unsent, 2 bids, 1 past due')
    expect(myBidGroupLabel(card.groups[1]!)).toBe('Not yet won or lost, 1 bid, 1 unread')
  })

  it('a hidden bid leaves its group and the title\'s count, and waits in Hidden', () => {
    const card = buildMyBidsCard([row('a'), row('b', { bid_date_sent: '2026-11-20' })], new Set(['b']), TODAY)
    expect(card.shown).toBe(1)
    expect(card.groups.map((g) => g.heading)).toEqual(['Unsent'])
    expect(card.hidden.map((b) => b.id)).toEqual(['b'])
  })

  it('a hidden bid with unread updates shows in its group until they are read', () => {
    const unread = row('b', { unreadCustomerNotes: true })
    expect(myBidIsPutAway(unread, new Set(['b']))).toBe(false)
    expect(myBidIsPutAway({ ...unread, unreadCustomerNotes: false }, new Set(['b']))).toBe(true)
    const card = buildMyBidsCard([unread], new Set(['b']), TODAY)
    expect(card.groups[0]?.bids.map((x) => x.id)).toEqual(['b'])
    expect(card.hidden).toEqual([])
  })

  it('a stored hidden id the read no longer holds counts for nothing', () => {
    const card = buildMyBidsCard([row('a')], new Set(['gone-1', 'gone-2']), TODAY)
    expect(card.hidden).toEqual([])
    expect(card.shown).toBe(1)
  })

  it('says the trade only when the bids span more than one', () => {
    expect(buildMyBidsCard([row('a'), row('b')], new Set(), TODAY).showTrade).toBe(false)
    expect(buildMyBidsCard([row('a'), row('b', { service_type_name: 'HVAC' })], new Set(), TODAY).showTrade).toBe(true)
    expect(buildMyBidsCard([row('a'), row('b', { service_type_name: '' })], new Set(), TODAY).showTrade).toBe(false)
  })
})

describe('the card\'s own words', () => {
  it('are plain words', () => {
    for (const words of [...Object.values(MY_BID_STATE_GLOSS), MY_BIDS_HIDDEN_GLOSS, MY_BIDS_CUT_WORDS]) expect(plainWordsFailures(words), words).toEqual([])
    expect(myBidHiddenWords('88 Quarry Rd Ste 100')).toBe('Hidden: 88 Quarry Rd Ste 100.')
  })
})

describe('the hide that follows the person (punch list #426, step 6)', () => {
  it('reads the hidden bids from the person\'s rows: hidden_at set, and no other', () => {
    const rows = [
      { bid_id: 'a', hidden_at: '2026-11-20T15:00:00Z' },
      { bid_id: 'b', hidden_at: null },
      { bid_id: 'c' },
    ]
    expect([...myBidsHiddenInReadState(rows)]).toEqual(['a'])
  })

  it('moves the ids this device kept that are on the card and not hidden there yet, once each', () => {
    expect(myBidsLocalIdsToMove(['a', 'gone', 'b', 'a', 'c'], ['a', 'b', 'c'], new Set(['c']))).toEqual(['a', 'b'])
    expect(myBidsLocalIdsToMove([], ['a'], new Set())).toEqual([])
  })

  it('writes the hide or the show and names no read mark', () => {
    expect(myBidHiddenWrite('me', 'b1', '2026-11-23T16:00:00.000Z', '2026-11-23T16:00:00.000Z')).toEqual({
      user_id: 'me',
      bid_id: 'b1',
      hidden_at: '2026-11-23T16:00:00.000Z',
      updated_at: '2026-11-23T16:00:00.000Z',
    })
    expect(myBidHiddenWrite('me', 'b1', null, '2026-11-23T16:00:00.000Z').hidden_at).toBeNull()
  })

  it('keeps the browser key the hides lived under, and says when a hide stayed on the device', () => {
    expect(myBidsHiddenStorageKey('me')).toBe('dashboard_my_bids_hidden_me')
    expect(myBidHiddenHereOnlyWords('You do not have access to save this.')).toBe('Hidden on this device only: You do not have access to save this.')
  })
})

