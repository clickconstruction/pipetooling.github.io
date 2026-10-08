/**
 * Main's own tests for what the Portal lane's P1b-i moved to `portal.ts` and `planQuestions.ts`: a company's asks sorted by
 * where they stand, the day it said a quote would come, its vetting and its promises, a pre-bid meeting, the quote's due day,
 * the questions it may read and the invitation. The spike's tests of these play the prototype's reducer and stay there; the
 * cases here read the same made-up data (`schedule/testState.ts`) or build the little they need.
 */
import { describe, expect, it } from 'vitest'
import { questionsCloseOn, questionState, questionsFor, quotesWantedOn } from './planQuestions'
import { bidRanOut, inviteMessage, linkNeverOpened, portalAsks, portalPreBid, portalPromiseLine, portalPromises, portalQuestions, portalQuoteDue, portalVetting } from './portal'
import { initialGcState } from './schedule/testState'
import type { GcProject, GcState, Partner } from './types'

const state = initialGcState()
const project = (s: GcState, id: string): GcProject => {
  const p = s.projects.find((x) => x.id === id)
  if (!p) throw new Error(`no project ${id}`)
  return p
}
const partner = (s: GcState, id: string): Partner => {
  const p = s.partners.find((x) => x.id === id)
  if (!p) throw new Error(`no partner ${id}`)
  return p
}
const asks = (id: string) => portalAsks(state, id).map((a) => `${a.project.id} ${a.kind}`)

describe('a company’s asks', () => {
  it('sorts Brightline into one ask still bidding and one job', () => {
    expect(asks('brightline')).toEqual(['boerne bidding', 'helotes job'])
  })

  it('puts the job Voltage lost on Helotes, and the ask Comal passed on, where they ended', () => {
    expect(asks('voltage')).toEqual(['boerne bidding', 'helotes lost'])
    expect(asks('comal')).toEqual(['boerne passed'])
  })

  it('marks a quote priced on old plans, a line the office could not read, and the day a company said its quote would come', () => {
    const one = (id: string) => portalAsks(state, id)[0]!
    expect([one('coolbreeze').stale, one('alamo').unclear.length, one('hillside').promise?.by]).toEqual([true, 1, '2026-09-30'])
    expect(asks('redline')).toEqual([])
  })
})

describe('the day a company gave us', () => {
  it('reads a passed day as late, in both languages', () => {
    const invite = project(state, 'boerne').packages.flatMap((k) => k.invites).find((i) => i.partnerId === 'hillside')!
    expect(portalPromiseLine(invite, state.today, 'Click')).toEqual({
      text: 'You told Click your quote would come by Wed Sep 30. That day passed 2 days ago. Send your quote or give a new day.',
      late: true,
    })
    expect(portalPromiseLine(invite, state.today, 'Click', 'es')?.text).toBe(
      'Le dijo a Click que su cotización llegaría a más tardar el mié 30 sep. Esa fecha pasó hace 2 días. Envíe su cotización o dé un nuevo día.',
    )
  })

  it('says a number ran out the day after its last good day', () => {
    const bid = { amount: 1, basedOnRev: 0, submittedOn: '2026-09-01', note: '', includes: {}, plugs: {}, goodForDays: 30 }
    expect([bidRanOut(bid, '2026-10-01'), bidRanOut(bid, '2026-10-02')]).toEqual([false, true])
    expect(bidRanOut({ ...bid, goodForDays: undefined }, '2027-01-01')).toBe(false)
  })

  it('flags no one in the made-up data, where every company asked has used its portal', () => {
    expect(state.partners.map((p) => linkNeverOpened(state, p.id)).filter(Boolean)).toEqual([])
  })
})

describe('vetting and promises', () => {
  const base = partner(state, 'voltage')

  it('says where a company new to us stands', () => {
    const vet = (vetting: Partner['vetting']) => portalVetting({ ...base, vetting })
    expect(vet(undefined)).toEqual({ state: 'known', words: null })
    expect(vet({ status: 'new' })).toEqual({ state: 'send', words: 'not sent yet' })
    expect(vet({ status: 'new', form: { license: 'TECL 1', insurance: 'Acme', yearsInBusiness: 4, references: 'Two', pastJobs: 'Some', sentOn: '2026-10-01' } })).toEqual({
      state: 'checking',
      words: 'Click is checking it · sent Oct 1',
    })
    expect(vet({ status: 'approved', limit: 50000 })).toEqual({ state: 'approved', words: 'approved for jobs up to $50,000 each' })
    expect(vet({ status: 'declined' })).toEqual({ state: 'declined', words: 'Click cannot work with you right now' })
  })

  it('lists a company’s open promises, the soonest first, and drops one kept', () => {
    const s: GcState = {
      ...state,
      tradePromises: [
        { id: 'p2', partnerId: 'voltage', kind: 'w9', what: 'the W-9', by: '2026-10-09', madeOn: '2026-10-01', from: 'trade' },
        { id: 'p1', partnerId: 'voltage', kind: 'insurance', what: 'the renewed insurance certificate', by: '2026-10-05', madeOn: '2026-10-01', from: 'office' },
        { id: 'p3', partnerId: 'voltage', kind: 'insurance', what: 'an old one', by: '2026-09-01', madeOn: '2026-08-20', from: 'office', keptOn: '2026-08-30' },
        { id: 'p4', partnerId: 'tejas', kind: 'w9', what: 'the W-9', by: '2026-10-03', madeOn: '2026-10-01', from: 'trade' },
      ],
    }
    expect(portalPromises(s, 'voltage').map((r) => [r.p.id, r.tone])).toEqual([
      ['p1', 'plain'],
      ['p2', 'plain'],
    ])
  })
})

describe('the pre-bid meeting', () => {
  it('invites the companies still on a trade, says who runs it, and says nothing once we lost', () => {
    const boerne = { ...project(state, 'boerne'), preBid: { on: '2026-10-06', at: '09:00', place: 'On site', host: 'us' as const, mandatory: true, attended: null } }
    const s: GcState = { ...state, projects: state.projects.map((p) => (p.id === 'boerne' ? boerne : p)) }
    const pb = portalPreBid(s, boerne, 'voltage')
    expect([pb?.mandatory, pb?.held, pb?.host, pb?.rule, pb?.after]).toEqual([true, false, 'Run by Click.', 'You have to come to quote this project.', 'Bring your questions about the plans.'])
    expect(portalPreBid(s, boerne, 'comal')).toBeNull()
    expect(portalPreBid(s, { ...boerne, lostOn: '2026-10-01' }, 'voltage')).toBeNull()
  })
})

describe('questions about the plans, in the prototype’s shape', () => {
  const boerne = project(state, 'boerne')

  it('closes questions and wants quotes three days before our bid is due, only while we bid', () => {
    expect([questionsCloseOn(boerne), quotesWantedOn(boerne), portalQuoteDue(boerne)]).toEqual(['2026-10-05', '2026-10-05', '2026-10-05'])
    expect(questionsCloseOn({ ...boerne, stage: 'building' })).toBeNull()
  })

  it('shows a company its own question, and another company only an answer sent to it', () => {
    expect(questionsFor(boerne, 'elec').map((q) => q.id)).toEqual(['q-elec-1'])
    expect(portalQuestions(boerne, 'elec', 'brightline').map((r) => [r.q.id, r.mine])).toEqual([['q-elec-1', true]])
    const q = boerne.questions.find((x) => x.id === 'q-elec-1')!
    expect(questionState(q)).toBe(q.answer !== null ? 'answered' : q.sentToArchitectOn ? 'with the architect' : 'asked')
  })
})

describe('the invitation (the Ask window’s preview)', () => {
  it('asks a company to quote its trade by the day we want quotes, on the set out that day', () => {
    const boerne = project(state, 'boerne')
    const elec = boerne.packages.find((k) => k.id === 'elec')!
    const invite = elec.invites.find((i) => i.partnerId === 'voltage')!
    const m = inviteMessage(boerne, elec, invite, partner(state, 'voltage'), 'en')
    expect([m.key, m.subject]).toEqual(['elec-voltage:invite', 'Click Construction asks you to quote Electrical on Boerne Retail Shell'])
    expect(m.lines.slice(1)).toEqual([
      'We would like your quote for Electrical on Boerne Retail Shell.',
      '1420 River Rd, Boerne. 8,400 sq ft shell, three tenant bays.',
      'Your quote is due Mon Oct 5.',
      'Plans to price: Bid set, issued Sep 18.',
      'Your quote should cover these lines.',
    ])
    expect(m.scope).toEqual(['Service and gear', 'Panels and feeders', 'Lighting', 'Fire alarm', 'Site lighting'])
    expect(inviteMessage(boerne, elec, { ...invite, id: 'draft', invitedOn: '2026-10-02' }, partner(state, 'voltage'), 'en').key).toBe('draft:invite')
  })
})
