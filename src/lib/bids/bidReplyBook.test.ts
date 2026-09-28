/**
 * Bid Board → Reply book: the window's rules. The example that started it is the owner's:
 * a decline for a project over four hours from the office, signed "Thank you, Wendi".
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  BID_REPLY_BODY_MAX,
  BID_REPLY_KINDS,
  BID_REPLY_TITLE_MAX,
  EMPTY_BID_REPLY_DRAFT,
  bidReplyByline,
  bidReplyCopyText,
  bidReplyDraftProblem,
  bidReplyDraftToSave,
  bidReplyEntryToDraft,
  bidReplyKindCounts,
  bidReplyKindLabel,
  bidReplySignOffName,
  canEditBidReply,
  canPostBidReply,
  filterBidReplies,
  splitTrailingSignOff,
  type BidReplyEntry,
} from './bidReplyBook'

const DECLINE =
  'We are going to decline to bid on this project. As it is over 4 hours from the office, the amount we would have to add into the bid for travel time while remaining profitable would price us out of the running.'

function entry(over: Partial<BidReplyEntry> = {}): BidReplyEntry {
  return {
    id: 'r1',
    title: 'Declining: too far from the office',
    kind: 'declining',
    body: DECLINE,
    sign_with_sender: true,
    created_by: 'wendi',
    created_by_name: 'Wendi Example',
    created_at: '2026-09-28T15:00:00Z',
    updated_at: '2026-09-28T15:00:00Z',
    ...over,
  }
}

describe('the kinds', () => {
  it('are the table’s CHECK list, word for word', () => {
    const sql = readFileSync(join(process.cwd(), 'supabase/migrations/20260928144511_bid_reply_book.sql'), 'utf8')
    const m = /kind IN \(([^)]+)\)/.exec(sql)
    expect(m).not.toBeNull()
    const inSql = m![1]!.split(',').map((s) => s.trim().replace(/'/g, ''))
    expect(inSql).toEqual(BID_REPLY_KINDS.map((k) => k.key))
  })

  it('the limits are the table’s', () => {
    const sql = readFileSync(join(process.cwd(), 'supabase/migrations/20260928144511_bid_reply_book.sql'), 'utf8')
    expect(sql).toContain(`length(btrim(title)) BETWEEN 1 AND ${BID_REPLY_TITLE_MAX}`)
    expect(sql).toContain(`length(btrim(body)) BETWEEN 1 AND ${BID_REPLY_BODY_MAX}`)
  })

  it('a kind this client does not know reads as Other', () => {
    expect(bidReplyKindLabel('declining')).toBe('Declining')
    expect(bidReplyKindLabel('something_new')).toBe('Other')
    expect(bidReplyKindLabel(null)).toBe('Other')
  })

  it('counts every reply under its chip, an unknown kind under Other', () => {
    const counts = bidReplyKindCounts([entry(), entry({ id: 'r2' }), entry({ id: 'r3', kind: 'following_up' }), entry({ id: 'r4', kind: 'something_new' })])
    expect(counts).toEqual({ all: 4, declining: 2, following_up: 1, asking: 0, after_decision: 0, other: 1 })
  })
})

describe('who may do what', () => {
  it('the person who posted it changes it; another estimator does not', () => {
    expect(canEditBidReply(entry(), { userId: 'wendi', role: 'estimator' })).toBe(true)
    expect(canEditBidReply(entry(), { userId: 'alex', role: 'estimator' })).toBe(false)
  })

  it('a dev changes anybody’s; a master or an assistant does not', () => {
    expect(canEditBidReply(entry(), { userId: 'd', role: 'dev' })).toBe(true)
    expect(canEditBidReply(entry(), { userId: 'm', role: 'master_technician' })).toBe(false)
    expect(canEditBidReply(entry(), { userId: 'a', role: 'assistant' })).toBe(false)
  })

  it('a reply whose author is gone is a dev’s to change, nobody else’s', () => {
    const orphan = entry({ created_by: null })
    expect(canEditBidReply(orphan, { userId: 'wendi', role: 'estimator' })).toBe(false)
    expect(canEditBidReply(orphan, { userId: null, role: 'estimator' })).toBe(false)
    expect(canEditBidReply(orphan, { userId: 'd', role: 'dev' })).toBe(true)
  })

  it('training mode copies and nothing else', () => {
    expect(canPostBidReply({ userId: 'wendi', role: 'estimator', readOnly: true })).toBe(false)
    expect(canEditBidReply(entry(), { userId: 'wendi', role: 'estimator', readOnly: true })).toBe(false)
    expect(canEditBidReply(entry(), { userId: 'd', role: 'dev', readOnly: true })).toBe(false)
    expect(canPostBidReply({ userId: 'wendi', role: 'estimator' })).toBe(true)
    expect(canPostBidReply({ userId: null, role: 'estimator' })).toBe(false)
  })
})

describe('search and the kind chips', () => {
  const book = [
    entry(),
    entry({ id: 'r2', title: 'Following up: a week after we sent', kind: 'following_up', body: 'Has the project been awarded yet?', created_by_name: 'Alex Example' }),
    entry({ id: 'r3', title: 'Asking for the plumbing sheets', kind: 'asking', body: 'Could you send them?', created_by_name: 'Alex Example' }),
  ]

  it('a blank search and All keep the book as it is', () => {
    expect(filterBidReplies(book, { query: '   ', kind: 'all' }).map((e) => e.id)).toEqual(['r1', 'r2', 'r3'])
  })

  it('reads what it is for, the wording and who posted it', () => {
    expect(filterBidReplies(book, { query: 'PLUMBING', kind: 'all' }).map((e) => e.id)).toEqual(['r3'])
    expect(filterBidReplies(book, { query: 'travel time', kind: 'all' }).map((e) => e.id)).toEqual(['r1'])
    expect(filterBidReplies(book, { query: 'alex', kind: 'all' }).map((e) => e.id)).toEqual(['r2', 'r3'])
  })

  it('a chip and a search narrow together', () => {
    expect(filterBidReplies(book, { query: 'alex', kind: 'asking' }).map((e) => e.id)).toEqual(['r3'])
    expect(filterBidReplies(book, { query: 'alex', kind: 'declining' })).toEqual([])
  })
})

describe('the sign-off', () => {
  it('signs with the first name', () => {
    expect(bidReplySignOffName('Wendi Example')).toBe('Wendi')
    expect(bidReplySignOffName('  Alex  ')).toBe('Alex')
    expect(bidReplySignOffName(null)).toBe('')
  })

  it('takes the owner’s example apart: the wording, and "Thank you, Wendi"', () => {
    expect(splitTrailingSignOff(`${DECLINE} \n\nThank you,\nWendi`)).toEqual({ body: DECLINE, signOff: 'Thank you, Wendi' })
  })

  it('knows the usual closings, with or without a name, on Windows line ends too', () => {
    expect(splitTrailingSignOff('We will pass.\n\nThanks,\nAlex Example').body).toBe('We will pass.')
    expect(splitTrailingSignOff('We will pass.\r\n\r\nBest regards,\r\nAlex').body).toBe('We will pass.')
    expect(splitTrailingSignOff('We will pass.\nSincerely').body).toBe('We will pass.')
    expect(splitTrailingSignOff('We will pass.\n\nThank you!').body).toBe('We will pass.')
  })

  it('leaves wording alone when it does not end in a closing', () => {
    expect(splitTrailingSignOff(DECLINE)).toEqual({ body: DECLINE, signOff: null })
    expect(splitTrailingSignOff('Thank you for the invitation to bid.\nWe will pass on this one.')).toEqual({
      body: 'Thank you for the invitation to bid.\nWe will pass on this one.',
      signOff: null,
    })
    // A last line that is a sentence is not a name.
    expect(splitTrailingSignOff('We will pass.\nThanks,\nPlease keep us on your list for the next one, and the one after.').signOff).toBeNull()
  })

  it('wording that is only a closing is kept', () => {
    expect(splitTrailingSignOff('Thank you,\nWendi')).toEqual({ body: 'Thank you,\nWendi', signOff: null })
  })

  it('a copy is signed by whoever copies it, never by the author', () => {
    expect(bidReplyCopyText(entry(), 'Alex Example')).toBe(`${DECLINE}\n\nThank you,\nAlex`)
    expect(bidReplyCopyText(entry(), 'Wendi Example')).toBe(`${DECLINE}\n\nThank you,\nWendi`)
  })

  it('with no name on the account the copy ends at the closing', () => {
    expect(bidReplyCopyText(entry(), null)).toBe(`${DECLINE}\n\nThank you,`)
  })

  it('a reply that is not signed is copied as written', () => {
    expect(bidReplyCopyText(entry({ sign_with_sender: false, body: 'Plans are in the project folder.' }), 'Alex')).toBe('Plans are in the project folder.')
  })
})

describe('a draft', () => {
  it('is saved trimmed, without the sign-off it was pasted with', () => {
    expect(bidReplyDraftToSave({ title: '  Declining: too far from the office ', kind: 'declining', body: `\n${DECLINE}\n\nThank you,\nWendi\n`, signWithSender: true })).toEqual({
      title: 'Declining: too far from the office',
      kind: 'declining',
      body: DECLINE,
      sign_with_sender: true,
    })
  })

  it('keeps its own closing when copies are not signed', () => {
    expect(bidReplyDraftToSave({ title: 't', kind: 'other', body: 'We will pass.\n\nThank you,\nThe estimating team', signWithSender: false }).body).toBe(
      'We will pass.\n\nThank you,\nThe estimating team',
    )
  })

  it('says what is missing, in order', () => {
    expect(bidReplyDraftProblem(EMPTY_BID_REPLY_DRAFT)).toBe('Say what the reply is for.')
    expect(bidReplyDraftProblem({ ...EMPTY_BID_REPLY_DRAFT, title: 'Declining' })).toBe('Add the wording.')
    expect(bidReplyDraftProblem({ ...EMPTY_BID_REPLY_DRAFT, title: 'Declining', body: DECLINE })).toBeNull()
  })

  it('holds the table’s limits', () => {
    expect(bidReplyDraftProblem({ ...EMPTY_BID_REPLY_DRAFT, title: 'x'.repeat(BID_REPLY_TITLE_MAX + 1), body: 'b' })).toContain('120 characters')
    expect(bidReplyDraftProblem({ ...EMPTY_BID_REPLY_DRAFT, title: 't', body: 'x'.repeat(BID_REPLY_BODY_MAX + 1) })).toBe('The wording is 4,001 characters; the most is 4,000.')
    expect(bidReplyDraftProblem({ ...EMPTY_BID_REPLY_DRAFT, title: 'x'.repeat(BID_REPLY_TITLE_MAX), body: 'x'.repeat(BID_REPLY_BODY_MAX) })).toBeNull()
  })

  it('opens a reply for editing as it was saved', () => {
    expect(bidReplyEntryToDraft(entry({ kind: 'something_new', sign_with_sender: false }))).toEqual({
      title: 'Declining: too far from the office',
      kind: 'other',
      body: DECLINE,
      signWithSender: false,
    })
  })
})

describe('the byline', () => {
  it('says You on your own, the name on anyone else’s', () => {
    expect(bidReplyByline(entry(), 'wendi')).toBe('You · Sep 28')
    expect(bidReplyByline(entry(), 'alex')).toBe('Wendi Example · Sep 28')
  })

  it('reads the company’s day, not UTC’s', () => {
    // 02:30 UTC on the 29th is 9:30 PM on the 28th in Chicago.
    expect(bidReplyByline(entry({ created_at: '2026-09-29T02:30:00Z', updated_at: '2026-09-29T02:30:00Z' }), 'alex')).toBe('Wendi Example · Sep 28')
  })

  it('says when it was edited', () => {
    expect(bidReplyByline(entry({ updated_at: '2026-09-30T16:00:00Z' }), 'alex')).toBe('Wendi Example · Sep 28 · edited Sep 30')
  })

  it('a reply whose author is gone keeps the name it was posted under', () => {
    expect(bidReplyByline(entry({ created_by: null }), 'alex')).toBe('Wendi Example · Sep 28')
    expect(bidReplyByline(entry({ created_by: null, created_by_name: '' }), null)).toBe('Someone no longer here · Sep 28')
  })
})
