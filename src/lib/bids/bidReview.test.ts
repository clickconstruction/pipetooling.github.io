import { describe, expect, it } from 'vitest'
import { bidReviewFields, buildBidReviewPatch, buildBidReviewedNoteBody, reviewStampLabel, reviewStampTooltip } from './bidReview'

const fmt = (iso: string) => `d(${iso.slice(0, 10)})`

describe('bidReviewFields — read the stamp without lying about its presence', () => {
  it('returns null when the row predates the columns', () => {
    expect(bidReviewFields({ id: 'b1', bid_value: 5 })).toBeNull()
  })
  it('returns the three fields, nulls filled, when the column is on the row', () => {
    expect(bidReviewFields({ reviewed_at: null })).toEqual({ reviewed_at: null, reviewed_by: null, review_note: null })
    expect(bidReviewFields({ reviewed_at: '2026-09-09T20:00:00Z', reviewed_by: 'u1', review_note: 'ok' })).toEqual({
      reviewed_at: '2026-09-09T20:00:00Z',
      reviewed_by: 'u1',
      review_note: 'ok',
    })
  })
})

describe('buildBidReviewedNoteBody — the ledger line', () => {
  it('names the reviewer and carries the notes on a second line', () => {
    expect(buildBidReviewedNoteBody({ actorDisplayName: 'Wendi', note: ' margins look thin on trim ' })).toBe('Reviewed by Wendi.\nNotes: margins look thin on trim')
  })
  it('omits the notes line when there are none, and never names nobody', () => {
    expect(buildBidReviewedNoteBody({ actorDisplayName: 'Wendi', note: '' })).toBe('Reviewed by Wendi.')
    expect(buildBidReviewedNoteBody({ actorDisplayName: '  ', note: null })).toBe('Reviewed by Unknown user.')
  })
})

describe('reviewStampLabel / reviewStampTooltip', () => {
  it('reads "by <who> · <when>", falling back to the date alone', () => {
    expect(reviewStampLabel({ reviewed_at: '2026-09-09T20:00:00Z', reviewerName: 'Wendi' }, fmt)).toBe('by Wendi · d(2026-09-09)')
    expect(reviewStampLabel({ reviewed_at: '2026-09-09T20:00:00Z', reviewerName: null }, fmt)).toBe('d(2026-09-09)')
    expect(reviewStampLabel({ reviewed_at: null, reviewerName: 'Wendi' }, fmt)).toBeNull()
  })
  it('the tooltip adds the notes when present', () => {
    expect(reviewStampTooltip({ reviewed_at: '2026-09-09T20:00:00Z', reviewerName: 'Wendi', review_note: 'ok' }, fmt)).toBe('Reviewed by Wendi · d(2026-09-09). Notes: ok')
    expect(reviewStampTooltip({ reviewed_at: '2026-09-09T20:00:00Z', reviewerName: 'Wendi', review_note: '  ' }, fmt)).toBe('Reviewed by Wendi · d(2026-09-09).')
  })
})

describe('buildBidReviewPatch — the write', () => {
  it('stamps who and when, and stores a trimmed note or null', () => {
    expect(buildBidReviewPatch({ userId: 'u1', note: '  fine ', nowIso: 'T' })).toEqual({ reviewed_at: 'T', reviewed_by: 'u1', review_note: 'fine' })
    expect(buildBidReviewPatch({ userId: 'u1', note: '', nowIso: 'T' })).toEqual({ reviewed_at: 'T', reviewed_by: 'u1', review_note: null })
  })
})
