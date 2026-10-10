/**
 * GC mode — design spike: the Follow up sheet (gcFollowUpSheet.ts). The people are the badge's,
 * one each; the drafts name what is missing, from me or the company, nudge or note, in the
 * company's language; sending and calling log on each ask.
 */
import { describe, expect, it } from 'vitest'
import {
  followUpCallActions,
  followUpCount,
  followUpDraft,
  followUpPeople,
  followUps,
  followUpSentActions,
  gcReducer,
  initialGcState,
  partnerReach,
  promisesToChase,
  smsHref,
  type GcAction,
  type GcState,
} from './gcModel'

const play = (s: GcState, actions: GcAction[]) => actions.reduce(gcReducer, s)
const person = (s: GcState, partnerId: string, also?: string) => {
  const p = followUpPeople(s, also).find((x) => x.partner.id === partnerId)
  if (!p) throw new Error(`no ${partnerId}`)
  return p
}

describe('the Follow up sheet', () => {
  it("holds exactly the badge's people, in its order, one each", () => {
    const s = initialGcState()
    const people = followUpPeople(s)
    expect(people.map((p) => p.partner.company)).toEqual(['Hillside Excavation', 'Tejas Power', 'Bexar Steel Erectors', 'Voltage Brothers', 'Pecan Valley Electric'])
    expect(followUpCount(people)).toBe(followUps(s).filter((f) => f.why !== 'waiting').length + promisesToChase(s))
  })

  it('puts what else they owe under it, unticked: Pecan Valley owes the waiver on draw 1', () => {
    const s = initialGcState()
    expect(person(s, 'pecanvalley').items.map((i) => [i.kind, i.due])).toEqual([
      ['insurance', true],
      ['waiver', false],
    ])
  })

  it('a company opened from its own card comes along, though the badge does not count it', () => {
    const s = initialGcState()
    const p = person(s, 'bluebonnet', 'bluebonnet')
    expect(p.items.map((i) => [i.kind, i.due, i.words.en.ask])).toEqual([['quote', false, 'Is it still on track?']])
    expect(followUpPeople(s).some((x) => x.partner.id === 'bluebonnet')).toBe(false)
  })

  it('sending logs a line on the quote, and a note on the company for the papers', () => {
    const s = initialGcState()
    const greg = person(s, 'hillside')
    const choice = { from: 'me' as const, via: 'text' as const, length: 'nudge' as const }
    const body = followUpDraft(greg, greg.items, choice, 'Robert Douglas').body
    const after = play(s, followUpSentActions(greg, greg.items, choice, body))
    const invite = after.projects.find((p) => p.id === 'boerne')?.packages.find((k) => k.id === 'site')?.invites.find((i) => i.partnerId === 'hillside')
    expect(invite?.contacts?.[0]).toMatchObject({ how: 'text', note: expect.stringMatching(/^Hi Greg, it's Robert at Click\./) })
    const marcus = person(s, 'pecanvalley')
    const mail = followUpSentActions(marcus, marcus.items.slice(0, 1), { from: 'company', via: 'email', length: 'nudge' }, 'Hello Marcus.')
    expect(mail).toEqual([{ type: 'logPartnerContact', partnerId: 'pecanvalley', note: 'Emailed about insurance certificate: From Click: Hello Marcus.' }])
  })

  it('a call logs what they said, and a day they gave becomes their promise', () => {
    const s = initialGcState()
    const greg = person(s, 'hillside')
    const after = play(s, followUpCallActions(greg, greg.items, 'Out at a job. Monday for sure.', '2026-10-05'))
    const invite = after.projects.find((p) => p.id === 'boerne')?.packages.find((k) => k.id === 'site')?.invites.find((i) => i.partnerId === 'hillside')
    expect(invite?.contacts?.[0]).toMatchObject({ how: 'call', note: 'Out at a job. Monday for sure.', promisedBy: '2026-10-05' })
    const sam = person(after, 'voltage')
    const kept = play(after, followUpCallActions(sam, sam.items, 'Renewing Monday.', '2026-10-06'))
    expect(kept.tradePromises?.find((p) => p.partnerId === 'voltage' && p.kind === 'insurance')?.by).toBe('2026-10-06')
    // The badge drops them: Greg gave a new day, Sam gave one for the certificate.
    expect(followUpCount(followUpPeople(kept))).toBe(followUpCount(followUpPeople(s)) - 2)
  })

  it('a made-up number and address stand in, and the text opens filled in', () => {
    const s = initialGcState()
    const reach = partnerReach(person(s, 'hillside').partner)
    expect(reach).toMatchObject({ name: 'Greg Paulk', first: 'Greg', email: 'greg@hillsideexcavation.example', madeUp: true })
    expect(reach.phone).toMatch(/^\(210\) 555-01\d\d$/)
    expect(smsHref('(210) 555-0161', 'Hi Greg')).toBe('sms:2105550161?&body=Hi%20Greg')
  })
})
