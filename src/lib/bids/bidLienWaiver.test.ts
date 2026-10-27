import { describe, expect, it } from 'vitest'
import {
  BID_LIEN_WAIVER_COMPANY_DEFAULT,
  BID_LIEN_WAIVER_HOLD_HEAD,
  BID_LIEN_WAIVER_HOLD_LINE,
  bidLienReleaseChip,
  bidLienReleaseFields,
  bidLienReleaseForPaper,
  bidLienReleaseHistory,
  bidLienReleaseInsert,
  bidLienWaiverCodeDoorShown,
  bidLienWaiverCodeDoorWords,
  bidLienWaiverLeader,
  bidLienWaiverOutputsHeld,
  bidLienWaiverPaper,
  bidLienWaiverPayor,
  bidLienWaiverPrefill,
  bidLienWaiverSamePaper,
  canSendUnconditionalFromBid,
  leaderInitials,
  type BidLienReleaseRow,
} from './bidLienWaiver'
import { plainWordsFailures } from '../plainWords'

describe('bidLienWaiverPrefill', () => {
  it('fills the payor from the GC first, the customer second', () => {
    expect(bidLienWaiverPayor({ bids_gc_builders: { name: 'Southern Post' }, customers: { name: 'Take 5' } })).toBe('Southern Post')
    expect(bidLienWaiverPayor({ bids_gc_builders: null, customers: { name: 'Take 5' } })).toBe('Take 5')
    expect(bidLienWaiverPayor({})).toBe('')
  })

  it('prefills the amount from agreed value over bid value, as a money input string', () => {
    const f = bidLienWaiverPrefill({ agreed_value: 38625, bid_value: 40000 }, '2026-10-26')
    expect(f.amount).toBe('38625.00')
    expect(bidLienWaiverPrefill({ bid_value: 1234.5 }, '2026-10-26').amount).toBe('1234.50')
    expect(bidLienWaiverPrefill({}, '2026-10-26').amount).toBe('')
  })

  it('joins project name and address with an em dash and dates both boxes today', () => {
    const f = bidLienWaiverPrefill({ project_name: 'Take 5 Seguin', address: '380 TX-123, Seguin, TX 78155' }, '2026-10-26')
    expect(f.projectDescription).toBe('Take 5 Seguin — 380 TX-123, Seguin, TX 78155')
    expect(f.throughDate).toBe('2026-10-26')
    expect(f.signedDate).toBe('2026-10-26')
    expect(f.companyName).toBe(BID_LIEN_WAIVER_COMPANY_DEFAULT)
    expect(bidLienWaiverPrefill({ project_name: 'Take 5 Seguin' }, '2026-10-26').projectDescription).toBe('Take 5 Seguin')
  })
})

describe('bidLienWaiverPaper', () => {
  it("draws the kernel's own words for the chosen form", () => {
    const fields = bidLienWaiverPrefill({ project_name: 'Take 5 Seguin', address: '380 TX-123', agreed_value: 34825, bids_gc_builders: { name: 'Southern Post' } }, '2026-10-26')
    const conditional = bidLienWaiverPaper('conditional_progress', fields)
    expect(conditional.title).toBe('Conditional Waiver and Release on Progress Payment')
    expect(conditional.paragraphs.join(' ')).toContain('Upon receipt by the undersigned of a check from Southern Post in the sum of $34,825.00')
    const unconditional = bidLienWaiverPaper('unconditional_progress', fields)
    expect(unconditional.paragraphs.join(' ')).toContain('This release does not affect any retainage, pending change orders, or disputed claims for extra work.')
    expect(unconditional.foot.company).toBe(BID_LIEN_WAIVER_COMPANY_DEFAULT)
  })
})

describe('the leader gate', () => {
  it('holds unconditional outputs for everyone but the leaders and the controller', () => {
    expect(canSendUnconditionalFromBid('master_technician')).toBe(true)
    expect(canSendUnconditionalFromBid('controller')).toBe(true)
    expect(canSendUnconditionalFromBid('dev')).toBe(true)
    expect(canSendUnconditionalFromBid('estimator')).toBe(false)
    expect(canSendUnconditionalFromBid('assistant')).toBe(false)
    expect(canSendUnconditionalFromBid(null)).toBe(false)
    expect(bidLienWaiverOutputsHeld('unconditional_progress', 'estimator')).toBe(true)
    expect(bidLienWaiverOutputsHeld('unconditional_final', 'estimator')).toBe(true)
    expect(bidLienWaiverOutputsHeld('unconditional_progress', 'master_technician')).toBe(false)
    expect(bidLienWaiverOutputsHeld('conditional_progress', 'estimator')).toBe(false)
    expect(bidLienWaiverOutputsHeld('conditional_final', 'estimator')).toBe(false)
  })
})

describe('the waivers recorded on the bid (v2.5958)', () => {
  const fields = { ...bidLienWaiverPrefill({ project_name: 'Take 5 Seguin', address: '380 TX-123', agreed_value: 34825, bids_gc_builders: { name: 'Southern Post' } }, '2026-10-26'), throughDate: '2026-09-21', signerName: 'Malachi Whites', signerTitle: 'Owner' }
  const row = (over: Partial<BidLienReleaseRow> = {}): BidLienReleaseRow =>
    ({
      id: 'r1',
      bid_id: 'bid-1',
      job_id: null,
      form_type: 'unconditional_progress',
      amount: 34825,
      status: 'issued',
      fields: { ...fields },
      through_date: '2026-09-21',
      signed_date: '2026-10-26',
      created_at: '2026-10-26T19:00:00Z',
      signed_at: null,
      sent_to_customer_at: null,
      voided_at: null,
      ...over,
    }) as unknown as BidLienReleaseRow

  it('reads a row back as the eight boxes, the columns filling a box the snapshot lacks', () => {
    expect(bidLienReleaseFields(row())).toEqual(fields)
    const bare = bidLienReleaseFields(row({ fields: {} as never }))
    expect(bare.amount).toBe('34825')
    expect(bare.throughDate).toBe('2026-09-21')
    expect(bare.signerName).toBe('')
  })

  it('is the same paper when the form and every printed box match, trimmed', () => {
    expect(bidLienWaiverSamePaper('unconditional_progress', fields, row())).toBe(true)
    expect(bidLienWaiverSamePaper('unconditional_progress', { ...fields, amount: ' 34825.00 ' }, row())).toBe(true)
    expect(bidLienWaiverSamePaper('unconditional_progress', { ...fields, amount: '30000.00' }, row())).toBe(false)
    expect(bidLienWaiverSamePaper('conditional_progress', fields, row())).toBe(false)
    // A final form prints no through date, so a different one does not part two final papers.
    expect(bidLienWaiverSamePaper('unconditional_final', { ...fields, throughDate: '2026-01-01' }, row({ form_type: 'unconditional_final' }))).toBe(true)
  })

  it('finds the recorded paper: live only, a signed one before a newer unsigned one', () => {
    const signed = row({ id: 'signed', status: 'signed', signed_at: '2026-10-26T19:14:00Z', created_at: '2026-10-26T19:00:00Z' })
    const newer = row({ id: 'newer', created_at: '2026-10-26T20:00:00Z' })
    const voided = row({ id: 'voided', status: 'signed', voided_at: '2026-10-26T21:00:00Z' })
    expect(bidLienReleaseForPaper([newer, signed, voided], 'unconditional_progress', fields)?.id).toBe('signed')
    expect(bidLienReleaseForPaper([newer, row({ id: 'older', created_at: '2026-10-25T20:00:00Z' })], 'unconditional_progress', fields)?.id).toBe('newer')
    expect(bidLienReleaseForPaper([voided], 'unconditional_progress', fields)).toBeNull()
    expect(bidLienReleaseHistory([row({ id: 'a', created_at: '2026-10-01T15:00:00Z' }), voided, newer]).map((r) => r.id)).toEqual(['newer', 'a'])
  })

  it('says where each waiver stands under Already on this bid', () => {
    const conditional = row({ form_type: 'conditional_progress', amount: 30400, created_at: '2026-10-01T15:00:00Z', sent_to_customer_at: '2026-10-01T16:00:00Z' })
    expect(bidLienReleaseChip(conditional)).toEqual({ label: 'Conditional · progress — $30,400 · sent Oct 1', tone: 'sent' })
    expect(bidLienReleaseChip(row())).toEqual({ label: 'Unconditional · progress — $34,825 · waits for his signature', tone: 'waiting' })
    expect(bidLienReleaseChip(row({ status: 'signed', signed_at: '2026-10-26T19:14:00Z' }))).toEqual({ label: 'Unconditional · progress — $34,825 · signed Oct 26', tone: 'signed' })
    expect(bidLienReleaseChip(row({ status: 'signed', signed_at: '2026-10-26T19:14:00Z', sent_to_customer_at: '2026-10-27T15:00:00Z' })).label).toBe('Unconditional · progress — $34,825 · signed Oct 26 · sent Oct 27')
    expect(bidLienReleaseChip(row({ form_type: 'conditional_final', amount: 3800.5 }))).toEqual({ label: 'Conditional · final — $3,800.50 · made Oct 26', tone: 'made' })
  })

  it('names the leader the Signed by box names, else the company signer, else the first leader', () => {
    const leaders = [
      { id: 'm1', name: 'Malachi Whites' },
      { id: 'm2', name: 'Sample Leader' },
    ]
    expect(bidLienWaiverLeader(leaders, ' sample leader ', 'Malachi Whites')?.id).toBe('m2')
    expect(bidLienWaiverLeader(leaders, 'Someone Else', 'malachi whites')?.id).toBe('m1')
    expect(bidLienWaiverLeader(leaders, '', null)?.id).toBe('m1')
    expect(bidLienWaiverLeader([], 'Malachi Whites', null)).toBeNull()
    expect(leaderInitials('Malachi Whites')).toBe('MW')
    expect(leaderInitials('Malachi D. Whites')).toBe('MW')
    expect(leaderInitials('Robert')).toBe('R')
    expect(leaderInitials('  ')).toBe('?')
  })

  it('opens the code door for a held assistant or estimator, and no one else', () => {
    expect(bidLienWaiverCodeDoorShown('unconditional_progress', 'estimator')).toBe(true)
    expect(bidLienWaiverCodeDoorShown('unconditional_final', 'assistant')).toBe(true)
    expect(bidLienWaiverCodeDoorShown('conditional_progress', 'estimator')).toBe(false)
    expect(bidLienWaiverCodeDoorShown('unconditional_progress', 'master_technician')).toBe(false)
    expect(bidLienWaiverCodeDoorShown('unconditional_progress', 'primary')).toBe(false)
    expect(bidLienWaiverCodeDoorShown('unconditional_progress', null)).toBe(false)
    expect(BID_LIEN_WAIVER_HOLD_LINE.startsWith(BID_LIEN_WAIVER_HOLD_HEAD)).toBe(true)
  })

  it('words the code door after board 3, in plain words', () => {
    const w = bidLienWaiverCodeDoorWords('Malachi Whites')
    expect(w.title).toBe('Malachi is with you?')
    expect(w.button).toBe('Sign with his code')
    expect(w.askLink).toBe('Ask him to send it himself ›')
    for (const line of [w.title, w.line, w.askLine]) expect(plainWordsFailures(line), line).toEqual([])
  })

  it('mints the paper issued and unsigned, on the bid, with the boxes as they print', () => {
    const insert = bidLienReleaseInsert('bid-1', 'unconditional_final', { ...fields, amount: '$34,825.004' }, 'u-wendi', '2026-10-26T19:00:00Z')
    expect(insert).toEqual({
      bid_id: 'bid-1',
      job_id: null,
      form_type: 'unconditional_final',
      amount: 34825,
      through_date: null,
      signed_date: '2026-10-26',
      fields: { ...fields, amount: '$34,825.004' },
      status: 'issued',
      minted_at: '2026-10-26T19:00:00Z',
      created_by: 'u-wendi',
    })
    expect(bidLienReleaseInsert('bid-1', 'unconditional_progress', fields, 'u', 'now').through_date).toBe('2026-09-21')
    expect(bidLienReleaseInsert('bid-1', 'conditional_progress', { ...fields, amount: 'abc' }, 'u', 'now').amount).toBe(0)
  })

  it('draws a signed paper with his name and the day under the line', () => {
    const paper = bidLienWaiverPaper('unconditional_progress', fields, { printedName: 'Malachi Whites', signedYmd: '2026-10-26' })
    expect(paper.foot.name).toBe('Malachi Whites')
    expect(paper.foot.signed).toBe('Signed October 26, 2026')
    expect(bidLienWaiverPaper('unconditional_progress', fields).foot.signed).toBeNull()
  })
})
