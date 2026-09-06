import { describe, expect, it } from 'vitest'
import { BID_SENT_DATE_RULE, earliestSentDate, restampConfirmMessage, sentDateAfterLaneStamp, sentDateAfterLedgerWrite } from './bidSentDate'
import { bidSentTelemetryTarget } from './bidSentTelemetry'

const TODAY = '2026-09-06'

describe('bidSentDate — one rule for the sent date', () => {
  it('states the rule once', () => {
    expect(BID_SENT_DATE_RULE).toMatch(/earliest successful send/)
  })

  it('null → the first lane wins (room, hand or ledger alike)', () => {
    expect(sentDateAfterLaneStamp(null, TODAY)).toEqual({ next: TODAY, write: true })
    expect(sentDateAfterLedgerWrite([{ bid_version_id: 'v1', sent_on: TODAY, value: null }], null)).toBe(TODAY)
  })

  it('hand-stamp first, room send later: the hand date stays and nothing is written (J13-F2)', () => {
    const hand = '2026-08-06'
    const afterRoom = sentDateAfterLaneStamp(hand, TODAY)
    expect(afterRoom).toEqual({ next: hand, write: false })
  })

  it('room send first, then a ledger send: the earlier day stands', () => {
    const room = '2026-08-27' // the room's first link send wrote a ledger row that day
    const rows = [
      { bid_version_id: 'v1', sent_on: room, value: null },
      { bid_version_id: 'v2', sent_on: TODAY, value: null }, // Mark sent to another GC today
    ]
    expect(sentDateAfterLedgerWrite(rows, room)).toBe(room)
    // The Cover Letter's client-side mirror asks the same question and gets the same answer.
    expect(sentDateAfterLaneStamp(room, TODAY)).toEqual({ next: room, write: false })
  })

  it('a later lane never moves a recorded date later — but an earlier true send moves it earlier', () => {
    // A hand stamp typed after the room sent last week: the room's day is the send.
    expect(sentDateAfterLaneStamp('2026-09-01', '2026-08-25')).toEqual({ next: '2026-08-25', write: true })
    expect(earliestSentDate(['2026-09-01', null, '', '2026-08-25T00:00:00Z'])).toBe('2026-08-25')
    expect(earliestSentDate([null, undefined, ''])).toBeNull()
  })

  it('the re-stamp is an explicit act: it moves the date to today, and only then', () => {
    expect(sentDateAfterLaneStamp('2026-08-06', TODAY, { explicit: true })).toEqual({ next: TODAY, write: true })
    expect(sentDateAfterLaneStamp(TODAY, TODAY, { explicit: true })).toEqual({ next: TODAY, write: false })
    expect(restampConfirmMessage('2026-08-06', TODAY)).toBe(
      'This bid is already marked sent 8/6. Move its sent date to today (9/6)? The board, the Followup lenses and the weekly sent counts all read this date.',
    )
  })

  it('versioned bids: the ledger is the record — earliest row; null once the last row is un-sent', () => {
    const rows = [
      { bid_version_id: 'v1', sent_on: '2026-08-20', value: null },
      { bid_version_id: 'v2', sent_on: '2026-08-12', value: null },
    ]
    expect(sentDateAfterLedgerWrite(rows)).toBe('2026-08-12')
    // A legacy hand date that predates every row is folded in (the bid did leave then)…
    expect(sentDateAfterLedgerWrite(rows, '2026-08-01')).toBe('2026-08-01')
    // …a later hand date is not (the ledger row is the earlier truth).
    expect(sentDateAfterLedgerWrite(rows, '2026-08-30')).toBe('2026-08-12')
    // Un-send everything → back to Unsent / Working, whatever the bid used to say.
    expect(sentDateAfterLedgerWrite([], '2026-08-01')).toBeNull()
  })

  it('telemetry target names the lane', () => {
    expect(bidSentTelemetryTarget('room')).toBe('#lane=room')
    expect(bidSentTelemetryTarget('hand')).toBe('#lane=hand')
    expect(bidSentTelemetryTarget('ledger')).toBe('#lane=ledger')
  })
})
