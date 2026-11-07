import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import type { Invitation } from '../emailIn/invitation'
import { DESK_WORDS, deskRead, deskReadOf, deskTitle, rowDesk, type DeskFacts } from './rowDesk'

// Every person here is made up. The facts are the New lane's own: the sort, the sender's kind, the active jobs by key,
// the box the line came in on, and what the reader read from an invitation.
const invite = (kind: Invitation['kind']): Invitation => ({ kind, project: 'Oak Hill Clinic', due: null, portal: null, cue: kind })

const row = (patch: Partial<DeskFacts>): DeskFacts => ({ sort: 'has', kind: 'customer', jobIds: [], mailbox: 'team', invitation: null, ...patch })

describe('rowDesk: which desk finishes a New row', () => {
  it('Bid it? is Estimating’s whatever the sender is, each invitation kind with its own why', () => {
    expect(rowDesk(row({ sort: 'bid', kind: 'unknown', mailbox: 'bids', invitation: invite('invitation') }))).toBe('estimating')
    expect(deskRead(row({ sort: 'bid', kind: 'customer', invitation: invite('addendum') }))?.why).toBe('An addendum to a bid.')
    expect(deskRead(row({ sort: 'bid', kind: 'customer', invitation: invite('solicitation') }))?.why).toBe('A solicitation from an agency.')
    expect(deskRead(row({ sort: 'bid', kind: 'customer', invitation: invite('prebid') }))?.why).toBe('A pre-bid notice.')
    expect(deskRead(row({ sort: 'bid', kind: 'customer', invitation: null }))?.why).toBe('An invitation to bid.')
  })

  it('Who is this? is nobody’s until sorted, on either box', () => {
    expect(rowDesk(row({ sort: 'who', kind: 'unknown', mailbox: 'team' }))).toBeNull()
    expect(rowDesk(row({ sort: 'who', kind: 'unknown', mailbox: 'bids' }))).toBeNull()
  })

  it('one of our own team, a supply house and a candidate are nobody’s', () => {
    for (const kind of ['team', 'supply_house', 'candidate'] as const) expect(rowDesk(row({ kind }))).toBeNull()
  })

  it('a trade partner and an architect are Estimating’s', () => {
    expect(deskRead(row({ kind: 'trade', mailbox: 'bids' }))).toEqual({ desk: 'estimating', why: 'A trade partner writes about a bid or a quote.' })
    expect(deskRead(row({ kind: 'arch', jobIds: ['project:p1'] }))).toEqual({ desk: 'estimating', why: 'An architect writes about the plans.' })
  })

  it('a customer, a lead or a sub on a Pipeline job is Dispatch’s, even beside a bid', () => {
    expect(deskRead(row({ sort: 'job', kind: 'customer', jobIds: ['bid:b1', 'pipeline:j1'] }))).toEqual({ desk: 'dispatch', why: 'Their job is on the Pipeline.' })
    expect(rowDesk(row({ kind: 'lead', jobIds: ['pipeline:j2'] }))).toBe('dispatch')
    expect(rowDesk(row({ kind: 'sub', jobIds: ['pipeline:j2'], mailbox: null }))).toBe('dispatch')
  })

  it('a customer whose only jobs are bids is Estimating’s', () => {
    expect(deskRead(row({ sort: 'job', kind: 'customer', jobIds: ['bid:b1', 'bid:b2'], mailbox: 'bids' }))).toEqual({ desk: 'estimating', why: 'Their job is a bid.' })
  })

  it('a customer on a GC project alone is nobody’s here: the GC desk is its own page', () => {
    expect(rowDesk(row({ kind: 'customer', jobIds: ['project:p1'], mailbox: 'bids' }))).toBeNull()
  })

  it('with no job under way, the box says it: bids@ is Estimating’s, the team line is Dispatch’s', () => {
    expect(deskRead(row({ kind: 'customer', jobIds: [], mailbox: 'bids' }))).toEqual({ desk: 'estimating', why: 'They wrote to bids@.' })
    expect(deskRead(row({ kind: 'customer', jobIds: [], mailbox: 'team' }))).toEqual({ desk: 'dispatch', why: 'A customer on the team line. Dispatch books the visit.' })
    expect(deskRead(row({ kind: 'lead', jobIds: [], mailbox: null }))).toEqual({ desk: 'dispatch', why: 'A lead on the team line. Dispatch books the visit.' })
    expect(deskRead(row({ kind: 'sub', jobIds: [], mailbox: 'team' }))).toEqual({ desk: 'dispatch', why: 'A sub on the team line. Dispatch schedules them.' })
  })

  it('a job key it cannot read places nothing by itself', () => {
    expect(deskRead(row({ kind: 'customer', jobIds: ['j1312'], mailbox: 'team' }))?.desk).toBe('dispatch')
  })

  it('the band’s hover is the word, then why', () => {
    expect(deskTitle({ desk: 'estimating', why: 'An invitation to bid.' })).toBe('Estimating · An invitation to bid.')
    expect(deskTitle({ desk: 'dispatch', why: 'Their job is on the Pipeline.' })).toBe('Dispatch · Their job is on the Pipeline.')
  })

  it('every why and every desk’s sentence is plain words', () => {
    const whys = [
      ...(['invitation', 'addendum', 'solicitation', 'prebid'] as const).map((k) => deskRead(row({ sort: 'bid', invitation: invite(k) }))!.why),
      deskRead(row({ kind: 'trade' }))!.why,
      deskRead(row({ kind: 'arch' }))!.why,
      deskRead(row({ kind: 'customer', jobIds: ['pipeline:j1'] }))!.why,
      deskRead(row({ kind: 'customer', jobIds: ['bid:b1'] }))!.why,
      deskRead(row({ kind: 'customer', mailbox: 'bids' }))!.why,
      ...(['customer', 'lead', 'sub'] as const).map((kind) => deskRead(row({ kind }))!.why),
      ...Object.values(DESK_WORDS).map((w) => w.does),
    ]
    for (const words of whys) expect(plainWordsFailures(words), words).toEqual([])
  })
})

describe('deskReadOf — the same rule from a sender and a line, for Needs a reply and the folded card (PR 2 of #258)', () => {
  it('reads the kind and the jobs from the contact and the box from the line, and an invitation only when the line carries one', () => {
    expect(deskReadOf({ kind: 'customer', jobIds: [] }, { mailbox: 'team' })).toEqual({ desk: 'dispatch', why: 'A customer on the team line. Dispatch books the visit.' })
    expect(deskReadOf({ kind: 'customer', jobIds: ['pipeline:j1312'] }, { mailbox: 'bids' })).toEqual({ desk: 'dispatch', why: 'Their job is on the Pipeline.' })
    expect(deskReadOf({ kind: 'lead' }, { mailbox: 'bids' })).toEqual({ desk: 'estimating', why: 'They wrote to bids@.' })
    expect(deskReadOf({ kind: 'trade' }, null)).toEqual({ desk: 'estimating', why: 'A trade partner writes about a bid or a quote.' })
    expect(deskReadOf({ kind: 'unknown' }, { mailbox: 'bids' })).toBeNull()
    expect(deskReadOf({ kind: 'team' }, { mailbox: 'team' })).toBeNull()
    expect(deskReadOf({ kind: 'unknown' }, { mailbox: 'bids', invitation: invite('addendum') })).toEqual({ desk: 'estimating', why: 'An addendum to a bid.' })
    // A malformed invitation on the line is no invitation.
    expect(deskReadOf({ kind: 'unknown' }, { mailbox: 'bids', invitation: { kind: 'party' } })).toBeNull()
    expect(deskReadOf({ kind: 'customer', jobIds: null }, undefined)).toEqual({ desk: 'dispatch', why: 'A customer on the team line. Dispatch books the visit.' })
  })
})
