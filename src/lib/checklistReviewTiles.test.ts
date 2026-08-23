import { describe, expect, it } from 'vitest'
import { missedTileCaption, outstandingTileCaption, reviewTileTone, signOffTileCaption } from './checklistReviewTiles'

describe('review tiles', () => {
  it('sign-off caption', () => {
    expect(signOffTileCaption(0)).toEqual({ text: '✓ nothing waiting', ok: true })
    expect(signOffTileCaption(6).ok).toBe(false)
    expect(signOffTileCaption(null).text).toBe('…')
  })
  it('outstanding caption joins range · people · oldest', () => {
    expect(outstandingTileCaption('One-offs', 5, 118)).toEqual({ text: 'one-offs · 5 people · oldest 118 days', ok: false })
    expect(outstandingTileCaption('One-offs', 1, 1).text).toBe('one-offs · 1 person · oldest 1 day')
    expect(outstandingTileCaption('Next day', 2, null).text).toBe('next day · 2 people')
    expect(outstandingTileCaption('One-offs', 0, null)).toEqual({ text: '✓ all clear', ok: true })
  })
  it('missed caption lists weekdays in week order, deduped', () => {
    expect(missedTileCaption([])).toEqual({ text: '✓ clean so far', ok: true })
    expect(missedTileCaption(['2026-08-20', '2026-08-18', '2026-08-20']).text).toBe('Tue, Thu')
  })
  it('tones', () => {
    expect(reviewTileTone('signoff', 0)).toBe('zero')
    expect(reviewTileTone('signoff', 3)).toBe('blue')
    expect(reviewTileTone('outstanding', 14)).toBe('red')
    expect(reviewTileTone('missed', 2)).toBe('amber')
    expect(reviewTileTone('missed', null)).toBe('zero')
  })
})
