import { describe, expect, it } from 'vitest'
import { allApprovedLine, noProductWords, reviewerNames, theirCallBoard, whoAnsweredLine } from './theirCallBoard'

const row = (id: string, tag: string, o: Partial<{ status: string; review_decision: string | null; review_note: string | null; submitted_label: string | null; submitted_model: string | null }> = {}) => ({ id, tag, status: 'proposed', review_decision: null as string | null, review_note: null as string | null, submitted_label: `${tag} product` as string | null, submitted_model: null as string | null, ...o })
const part = (id: string, label: string, seq: number, review_decision: string | null = null, review_note: string | null = null, on_submittal = true) => ({ id, label, sequence_order: seq, on_submittal, review_decision, review_note })

// The SpaceX draft in small: one fixture with a part rejected, one answered as a whole, two waiting, one with no product.
const lav = row('lav', 'LAV-1', { review_decision: 'rejected' })
const mop = row('mop', '12" DEEP MOP SINK', { review_decision: 'revise', review_note: 'resubmit in white', submitted_label: 'FIAT MSB2424100' })
const dwh = row('dwh', 'DWH-1')
const fco = row('fco', 'FCO')
const sink = row('sink', 'UTILITY SINK', { status: 'missing', submitted_label: null })
const wc = row('wc', 'WC-1', { review_decision: 'approved' })
const rows = [dwh, lav, sink, fco, wc, mop]
const parts = new Map([['lav', [part('tsl', 'TSL.MON.B.38.2.PS1.BK MONOLITH B SERIES', 1), part('faucet', 'TOTO T25S51E#CP', 2, 'rejected', ' TEL145 '), part('grid', 'HYDRAPRO H20008', 3, 'rejected', null, false)]]])

describe('theirCallBoard', () => {
  const board = theirCallBoard(rows, parts)

  it('one cell a fixture, grouped: approved, sent back, waiting, then no product', () => {
    expect(board.cells.map((c) => `${c.tag}:${c.state}`)).toEqual(['WC-1:approved', 'LAV-1:sentBack', '12" DEEP MOP SINK:sentBack', 'DWH-1:waiting', 'FCO:waiting', 'UTILITY SINK:noProduct'])
    expect(board.counts).toEqual({ approved: 1, sentBack: 2, waiting: 2, noProduct: 1 })
    expect(board.allApproved).toBe(false)
  })

  it('a fixture sent back names the parts the reviewer marked, in their words; an order-only part is never named', () => {
    expect(board.sentBack[0]).toMatchObject({ tag: 'LAV-1', parts: [{ key: 'faucet', head: 'TOTO T25S51E#CP', tone: 'rejected', word: 'Rejected', note: 'TEL145' }] })
    expect(board.sentBack[0]?.item).toBe(lav)
  })

  it('an answer given on the row as a whole names its product and the row’s note', () => {
    expect(board.sentBack[1]?.parts).toEqual([{ key: 'mop', head: 'FIAT MSB2424100', tone: 'revise', word: 'Revise', note: 'resubmit in white' }])
    expect(board.sentBackParts).toBe(2)
  })

  it('waiting is every fixture with a product and no answer; a fixture with no product is set apart', () => {
    expect(board.waiting).toEqual([dwh, fco])
    expect(board.noProduct).toEqual([sink])
  })

  it('every fixture with a product approved is all approved, whatever has no product', () => {
    const done = theirCallBoard([wc, row('ur', 'UR-1', { review_decision: 'approved' }), sink])
    expect(done.allApproved).toBe(true)
    expect(theirCallBoard([dwh]).allApproved).toBe(false)
    expect(theirCallBoard([]).cells).toEqual([])
  })

  it('an untagged row reads as an accessory', () => {
    expect(theirCallBoard([row('a', '  ')]).cells[0]?.tag).toBe('Accessory')
  })
})

describe('who answered', () => {
  const answer = (o: Partial<{ review_decision: string | null; reviewed_by_name: string | null; reviewed_at: string | null; decision_source: string; decision_entered_by_name: string | null }> = {}) => ({ review_decision: 'rejected' as string | null, reviewed_by_name: 'structura' as string | null, reviewed_at: '2026-10-02T15:00:00Z' as string | null, decision_source: 'entered', decision_entered_by_name: 'Wendi' as string | null, ...o })

  it('answers typed in by the office say who answered and who typed', () => {
    expect(whoAnsweredLine([answer(), answer(), answer({ review_decision: null })])).toBe('structura answered. Wendi typed the answers in on Oct 2.')
  })

  it('answers given on the link say so, with the last day', () => {
    expect(whoAnsweredLine([answer({ reviewed_by_name: 'Dana Whitfield', decision_source: 'room', decision_entered_by_name: null, reviewed_at: '2026-10-09T15:00:00Z' }), answer({ reviewed_by_name: 'Dana Whitfield', decision_source: 'room', reviewed_at: '2026-10-08T15:00:00Z' })])).toBe('Dana Whitfield answered on the review link, last on Oct 9.')
  })

  it('a mix counts the typed ones', () => {
    expect(whoAnsweredLine([answer(), answer({ decision_source: 'room' }), answer({ decision_source: 'room', reviewed_by_name: 'Dana Whitfield' })])).toBe('structura and Dana Whitfield answered. Wendi typed in 1 of the 3 answers. The last came on Oct 2.')
  })

  it('nothing answered says nothing, and the reviewer has no name yet', () => {
    expect(whoAnsweredLine([answer({ review_decision: null })])).toBe('')
    expect(reviewerNames([answer({ review_decision: null })])).toBe('the reviewer')
    expect(reviewerNames([answer()])).toBe('structura')
  })

  it('all approved says so in one line that points on', () => {
    expect(allApprovedLine(13, [answer({ review_decision: 'approved', reviewed_at: '2026-10-09T15:00:00Z' })])).toBe('All 13 approved by structura on Oct 9. Nothing is left to do here. Order them in step 8.')
  })
})

describe('noProductWords', () => {
  it('names the fixtures with nothing to answer', () => {
    expect(noProductWords(['UTILITY SINK'])).toBe('UTILITY SINK has no product yet, so there is nothing for them to answer.')
    expect(noProductWords(['FD', 'UTILITY SINK'])).toBe('FD and UTILITY SINK have no product yet, so there is nothing for them to answer.')
    expect(noProductWords([])).toBe('')
  })
})
