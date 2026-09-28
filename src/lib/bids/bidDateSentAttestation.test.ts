import { describe, expect, it } from 'vitest'
import type { BidDateSentAttestationPayload } from '../../types/bidDateSentAttestation'
import {
  BID_DATE_SENT_ATTESTATION_NULLS,
  BID_DATE_SENT_ATTESTATION_REQUIRED_MESSAGE,
  bidDateSentAttestationMerge,
  bidDateSentAttestationPromptDate,
  bidDateSentAttestationSaveError,
  bidDateSentInputDropsPending,
  buildBidDateSentAttestationPayload,
  type BidDateSentAttestationState,
} from './bidDateSentAttestation'

const CONFIRMED: BidDateSentAttestationPayload = buildBidDateSentAttestationPayload({
  userId: 'user-1',
  confirmedAt: '2026-09-27T15:00:00.000Z',
  ackEmailAt: null,
  ackPhoneAt: null,
  ackHonestyAt: null,
})

function state(over: Partial<BidDateSentAttestationState>): BidDateSentAttestationState {
  return { bidDateSent: '', serverBidDateSent: null, pending: null, pendingForDate: null, ...over }
}

describe('bidDateSentAttestationMerge — the columns a save writes', () => {
  it('an empty date clears all eight stamps', () => {
    expect(bidDateSentAttestationMerge(state({ bidDateSent: '' }))).toEqual(BID_DATE_SENT_ATTESTATION_NULLS)
    expect(bidDateSentAttestationMerge(state({ bidDateSent: '   ', serverBidDateSent: '2026-09-01' }))).toEqual(BID_DATE_SENT_ATTESTATION_NULLS)
    expect(Object.keys(BID_DATE_SENT_ATTESTATION_NULLS)).toHaveLength(8)
  })

  it('an empty date clears the stamps even with a checklist held', () => {
    expect(bidDateSentAttestationMerge(state({ bidDateSent: '', pending: CONFIRMED, pendingForDate: '2026-09-27' }))).toEqual(BID_DATE_SENT_ATTESTATION_NULLS)
  })

  it('hands back a copy of the nulls, never the constant', () => {
    const merge = bidDateSentAttestationMerge(state({ bidDateSent: '' }))
    expect(merge).not.toBe(BID_DATE_SENT_ATTESTATION_NULLS)
  })

  it('an unchanged date writes no stamps — the saved ones stay', () => {
    expect(bidDateSentAttestationMerge(state({ bidDateSent: '2026-09-01', serverBidDateSent: '2026-09-01' }))).toEqual({})
  })

  it('reads the saved date by its first ten characters', () => {
    expect(bidDateSentAttestationMerge(state({ bidDateSent: '2026-09-01', serverBidDateSent: '2026-09-01T00:00:00+00:00' }))).toEqual({})
  })

  it('an unchanged date ignores a checklist held for it', () => {
    expect(bidDateSentAttestationMerge(state({ bidDateSent: '2026-09-01', serverBidDateSent: '2026-09-01', pending: CONFIRMED, pendingForDate: '2026-09-01' }))).toEqual({})
  })

  it('a changed date confirmed for that date writes the confirmed stamps', () => {
    const merge = bidDateSentAttestationMerge(state({ bidDateSent: '2026-09-27', serverBidDateSent: '2026-09-01', pending: CONFIRMED, pendingForDate: '2026-09-27' }))
    expect(merge).toEqual(CONFIRMED)
    expect(merge).not.toBe(CONFIRMED)
  })

  it('a first date on a new bid writes the confirmed stamps', () => {
    expect(bidDateSentAttestationMerge(state({ bidDateSent: '2026-09-27', serverBidDateSent: null, pending: CONFIRMED, pendingForDate: '2026-09-27' }))).toEqual(CONFIRMED)
  })

  it('a changed date with no checklist writes no stamps', () => {
    expect(bidDateSentAttestationMerge(state({ bidDateSent: '2026-09-27', serverBidDateSent: '2026-09-01' }))).toEqual({})
  })

  it('a checklist confirmed for another date does not count', () => {
    expect(bidDateSentAttestationMerge(state({ bidDateSent: '2026-09-27', serverBidDateSent: '2026-09-01', pending: CONFIRMED, pendingForDate: '2026-09-26' }))).toEqual({})
  })
})

describe('bidDateSentAttestationSaveError — what refuses a save', () => {
  it('an empty date saves', () => {
    expect(bidDateSentAttestationSaveError(state({ bidDateSent: '' }))).toBeNull()
    expect(bidDateSentAttestationSaveError(state({ bidDateSent: '', serverBidDateSent: '2026-09-01' }))).toBeNull()
  })

  it('an unchanged date saves', () => {
    expect(bidDateSentAttestationSaveError(state({ bidDateSent: '2026-09-01', serverBidDateSent: '2026-09-01T00:00:00Z' }))).toBeNull()
  })

  it('a changed date nobody confirmed is refused', () => {
    expect(bidDateSentAttestationSaveError(state({ bidDateSent: '2026-09-27', serverBidDateSent: '2026-09-01' }))).toBe(BID_DATE_SENT_ATTESTATION_REQUIRED_MESSAGE)
  })

  it('a first date on a new bid nobody confirmed is refused', () => {
    expect(bidDateSentAttestationSaveError(state({ bidDateSent: '2026-09-27' }))).toBe(BID_DATE_SENT_ATTESTATION_REQUIRED_MESSAGE)
  })

  it('a checklist for another date is refused', () => {
    expect(bidDateSentAttestationSaveError(state({ bidDateSent: '2026-09-27', serverBidDateSent: '2026-09-01', pending: CONFIRMED, pendingForDate: '2026-09-26' }))).toBe(BID_DATE_SENT_ATTESTATION_REQUIRED_MESSAGE)
  })

  it('a date with a checklist date but no checklist is refused', () => {
    expect(bidDateSentAttestationSaveError(state({ bidDateSent: '2026-09-27', pending: null, pendingForDate: '2026-09-27' }))).toBe(BID_DATE_SENT_ATTESTATION_REQUIRED_MESSAGE)
  })

  it('a changed date confirmed for that date saves', () => {
    expect(bidDateSentAttestationSaveError(state({ bidDateSent: '2026-09-27', serverBidDateSent: '2026-09-01', pending: CONFIRMED, pendingForDate: '2026-09-27' }))).toBeNull()
  })

  it('agrees with the merge: a save that passes with a changed date always carries stamps', () => {
    const dates = ['', '2026-09-01', '2026-09-27']
    for (const bidDateSent of dates) {
      for (const serverBidDateSent of [null, ...dates]) {
        for (const pendingForDate of [null, '2026-09-01', '2026-09-27']) {
          for (const pending of [null, CONFIRMED]) {
            const s = state({ bidDateSent, serverBidDateSent, pending, pendingForDate })
            const changed = bidDateSent !== '' && bidDateSent !== (serverBidDateSent ?? '')
            if (changed && bidDateSentAttestationSaveError(s) == null) {
              expect(bidDateSentAttestationMerge(s)).toEqual(CONFIRMED)
            }
          }
        }
      }
    }
  })
})

describe('bidDateSentAttestationPromptDate — when the checklist opens', () => {
  const base = { modalOpen: false, proposedRaw: '2026-09-27', baseline: '2026-09-01', pending: null, pendingForDate: null }

  it('opens for a date that differs from the saved one', () => {
    expect(bidDateSentAttestationPromptDate(base)).toBe('2026-09-27')
  })

  it('opens for a first date', () => {
    expect(bidDateSentAttestationPromptDate({ ...base, baseline: '' })).toBe('2026-09-27')
  })

  it('normalizes what was typed', () => {
    expect(bidDateSentAttestationPromptDate({ ...base, proposedRaw: '2026-09-27T12:00:00Z' })).toBe('2026-09-27')
  })

  it('stays shut while it is already open', () => {
    expect(bidDateSentAttestationPromptDate({ ...base, modalOpen: true })).toBeNull()
  })

  it('stays shut for an empty field', () => {
    expect(bidDateSentAttestationPromptDate({ ...base, proposedRaw: '' })).toBeNull()
    expect(bidDateSentAttestationPromptDate({ ...base, proposedRaw: null })).toBeNull()
  })

  it('stays shut for the saved date', () => {
    expect(bidDateSentAttestationPromptDate({ ...base, proposedRaw: '2026-09-01' })).toBeNull()
  })

  it('stays shut for a date already confirmed', () => {
    expect(bidDateSentAttestationPromptDate({ ...base, pending: CONFIRMED, pendingForDate: '2026-09-27' })).toBeNull()
  })

  it('opens again when the confirmed date is another one', () => {
    expect(bidDateSentAttestationPromptDate({ ...base, pending: CONFIRMED, pendingForDate: '2026-09-26' })).toBe('2026-09-27')
  })
})

describe('bidDateSentInputDropsPending — typing in the date field', () => {
  it('emptying the field drops the checklist, held or not', () => {
    expect(bidDateSentInputDropsPending({ value: '', baseline: '2026-09-01', pendingForDate: '2026-09-27' })).toBe(true)
    expect(bidDateSentInputDropsPending({ value: '', baseline: '', pendingForDate: null })).toBe(true)
  })

  it('nothing held, nothing to drop', () => {
    expect(bidDateSentInputDropsPending({ value: '2026-09-27', baseline: '2026-09-01', pendingForDate: null })).toBe(false)
    expect(bidDateSentInputDropsPending({ value: '2026-09-01', baseline: '2026-09-01', pendingForDate: null })).toBe(false)
  })

  it('typing the confirmed date again keeps the checklist', () => {
    expect(bidDateSentInputDropsPending({ value: '2026-09-27', baseline: '2026-09-01', pendingForDate: '2026-09-27' })).toBe(false)
  })

  it('going back to the saved date drops it', () => {
    expect(bidDateSentInputDropsPending({ value: '2026-09-01', baseline: '2026-09-01', pendingForDate: '2026-09-27' })).toBe(true)
  })

  it('a third date drops it', () => {
    expect(bidDateSentInputDropsPending({ value: '2026-09-28', baseline: '2026-09-01', pendingForDate: '2026-09-27' })).toBe(true)
  })
})

describe('buildBidDateSentAttestationPayload — the eight stamps', () => {
  it('stamps every line with the confirm time when none was ticked earlier', () => {
    expect(CONFIRMED).toEqual({
      bid_date_sent_attested_at: '2026-09-27T15:00:00.000Z',
      bid_date_sent_attested_by: 'user-1',
      bid_date_sent_ack_email_at: '2026-09-27T15:00:00.000Z',
      bid_date_sent_ack_email_by: 'user-1',
      bid_date_sent_ack_phone_at: '2026-09-27T15:00:00.000Z',
      bid_date_sent_ack_phone_by: 'user-1',
      bid_date_sent_ack_honesty_at: '2026-09-27T15:00:00.000Z',
      bid_date_sent_ack_honesty_by: 'user-1',
    })
  })

  it('a line ticked earlier keeps its own time', () => {
    const payload = buildBidDateSentAttestationPayload({
      userId: 'user-2',
      confirmedAt: '2026-09-27T15:00:00.000Z',
      ackEmailAt: '2026-09-27T14:58:00.000Z',
      ackPhoneAt: null,
      ackHonestyAt: '2026-09-27T14:59:30.000Z',
    })
    expect(payload.bid_date_sent_attested_at).toBe('2026-09-27T15:00:00.000Z')
    expect(payload.bid_date_sent_ack_email_at).toBe('2026-09-27T14:58:00.000Z')
    expect(payload.bid_date_sent_ack_phone_at).toBe('2026-09-27T15:00:00.000Z')
    expect(payload.bid_date_sent_ack_honesty_at).toBe('2026-09-27T14:59:30.000Z')
  })

  it('writes the same eight columns the clear writes', () => {
    expect(Object.keys(CONFIRMED).sort()).toEqual(Object.keys(BID_DATE_SENT_ATTESTATION_NULLS).sort())
  })
})
