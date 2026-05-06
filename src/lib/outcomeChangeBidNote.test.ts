import { describe, expect, it } from 'vitest'
import {
  buildOutcomeChangeBidNoteBody,
  formatOutcomeForBidNote,
  normalizedOutcomePayload,
  resolveActorDisplayName,
} from './outcomeChangeBidNote'

describe('formatOutcomeForBidNote', () => {
  it('formats known outcomes and null', () => {
    expect(formatOutcomeForBidNote('won')).toBe('Won')
    expect(formatOutcomeForBidNote('lost')).toBe('Lost')
    expect(formatOutcomeForBidNote('started_or_complete')).toBe('Started or Complete')
    expect(formatOutcomeForBidNote(null)).toBe('Not set')
  })
})

describe('resolveActorDisplayName', () => {
  it('prefers profile name then email', () => {
    expect(resolveActorDisplayName('Jane', null)).toBe('Jane')
    expect(resolveActorDisplayName('  Bob  ', null)).toBe('Bob')
    expect(resolveActorDisplayName(null, 'a@b.com')).toBe('a@b.com')
    expect(resolveActorDisplayName(null, null)).toBe('Unknown user')
    expect(resolveActorDisplayName('', undefined)).toBe('Unknown user')
  })
})

describe('normalizedOutcomePayload', () => {
  it('maps form outcome to stored shape', () => {
    expect(normalizedOutcomePayload('won')).toBe('won')
    expect(normalizedOutcomePayload('lost')).toBe('lost')
    expect(normalizedOutcomePayload('started_or_complete')).toBe('started_or_complete')
    expect(normalizedOutcomePayload('')).toBe(null)
  })
})

describe('buildOutcomeChangeBidNoteBody', () => {
  it('builds transition line with actor', () => {
    expect(
      buildOutcomeChangeBidNoteBody({
        previousOutcome: null,
        nextOutcome: 'won',
        actorDisplayName: 'Alex Example',
      }),
    ).toBe('Win/Loss changed from Not set to Won. Changed by Alex Example.')
  })

  it('shows loss reason when outcome is lost', () => {
    expect(
      buildOutcomeChangeBidNoteBody({
        previousOutcome: 'won',
        nextOutcome: 'lost',
        actorDisplayName: 'Pat',
        lossReason: '  Price ',
      }).includes('Loss reason: Price'),
    ).toBe(true)
  })

  it('omit loss reason trim empty', () => {
    expect(
      buildOutcomeChangeBidNoteBody({
        previousOutcome: null,
        nextOutcome: 'lost',
        actorDisplayName: 'Pat',
        lossReason: '   ',
      }),
    ).not.toContain('Loss reason')
  })
})
