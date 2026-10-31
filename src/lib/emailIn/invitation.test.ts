/**
 * Punch list #223 PR 3 (v2.6222): an invitation to bid read from an email. Four made-up mails: a GC's platform
 * invitation, a county's solicitation, an addendum, and a person writing about a job. Nothing here is a real row.
 */
import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { CUE_LINES, dayIn, dueIn, dueWords, invitation, invitationFacts, invitationOf, openInvitation, portalLink, projectFromSubject, timeIn } from './invitation'

const AT = '2026-10-29T14:02:00Z'

const PLATFORM = {
  subject: 'Invitation to Bid: Oak Hill Clinic, Boerne - Plumbing',
  text: [
    'Dale Ferris at Ridgeway Builders has invited you to bid on Oak Hill Clinic, Boerne.',
    '',
    'Trade: Plumbing',
    'Bids are due Thursday, November 12 at 2:00 PM CST.',
    'View the project and download plans: https://app.buildingconnected.com/projects/abc123',
    '',
    'To stop receiving invitations from this contractor, update your preferences.',
  ].join('\n'),
  links: ['https://www.google.com/maps/place/Boerne', 'https://app.buildingconnected.com/projects/abc123'],
  at: AT,
}

const AGENCY = {
  subject: 'Solicitation Notice: RFP 27-031 Plumbing Repairs, Various Campuses',
  text: 'Bexar County Purchasing has posted a new solicitation.\nDue Date: 11/20/2026 10:00 AM\nSee the bid room: https://bexar.bonfirehub.com/opportunities/1182',
  links: ['https://bexar.bonfirehub.com/opportunities/1182'],
  at: AT,
}

const ADDENDUM = {
  subject: 'Addendum 2 - Oak Hill Clinic, Boerne',
  text: 'Addendum 2 is posted. The bid date is unchanged.',
  links: [],
  at: AT,
}

const PERSON = {
  subject: 'Boerne Retail Shell, steel',
  text: 'Attached is our number for the shell, 212,400 with a six week lead. Call with questions.',
  links: [],
  at: AT,
}

describe('invitation', () => {
  it('reads a platform’s invitation: the kind, the project, the due day and time, the platform’s page', () => {
    const inv = invitation(PLATFORM)!
    expect(inv.kind).toBe('invitation')
    expect(inv.project).toBe('Oak Hill Clinic, Boerne - Plumbing')
    expect(inv.due).toEqual({ date: '2026-11-12', time: '14:00' })
    expect(inv.portal).toEqual({ label: 'BuildingConnected', url: 'https://app.buildingconnected.com/projects/abc123' })
    expect(inv.cue).toBe('invitation to bid')
  })

  it('reads an agency’s solicitation with a numeric due date', () => {
    const inv = invitation(AGENCY)!
    expect(inv.kind).toBe('solicitation')
    expect(inv.project).toBe('RFP 27-031 Plumbing Repairs, Various Campuses')
    expect(inv.due).toEqual({ date: '2026-11-20', time: '10:00' })
    expect(inv.portal?.label).toBe('Bonfire')
  })

  it('reads an addendum, its number stripped from the project', () => {
    const inv = invitation(ADDENDUM)!
    expect(inv.kind).toBe('addendum')
    expect(inv.project).toBe('Oak Hill Clinic, Boerne')
    expect(inv.due).toBeNull()
    expect(inv.portal).toBeNull()
  })

  it('reads a person writing about a job as none', () => {
    expect(invitation(PERSON)).toBeNull()
  })

  it('takes a cue in the body only beside a platform’s page or a subject about a bid', () => {
    const body = 'You are invited to bid on the Lakeline shell.\nPlans are on PlanHub.'
    expect(invitation({ subject: 'Hello', text: body, links: [], at: AT })).toBeNull()
    expect(invitation({ subject: 'Hello', text: body, links: ['https://app.planhub.com/p/9'], at: AT })?.kind).toBe('invitation')
    expect(invitation({ subject: 'Lakeline shell bid', text: body, links: [], at: AT })?.kind).toBe('invitation')
    // Past the first lines, a cue is a signature or a footer, not the mail.
    const deep = `${Array.from({ length: CUE_LINES }, (_, i) => `line ${i + 1}`).join('\n')}\nInvitation to bid`
    expect(invitation({ subject: 'Lakeline shell bid', text: deep, links: [], at: AT })).toBeNull()
  })

  it('strips the subject down to the project', () => {
    expect(projectFromSubject('Re: [ITB] Fire Station 9 Make Ready', 'itb')).toBe('Fire Station 9 Make Ready')
    expect(projectFromSubject('Fwd: Invitation to Bid - Lakeline shell via PlanHub', 'invitation to bid')).toBe('Lakeline shell')
    expect(projectFromSubject('RFP', 'rfp')).toBeNull()
  })

  it('finds the platform among the links and skips the footer’s', () => {
    expect(portalLink(['https://www.facebook.com/x', 'https://subs.planhub.com/p/1'])?.label).toBe('PlanHub')
    expect(portalLink(['https://example.com/plans'])).toBeNull()
    expect(portalLink(['not a link'])).toBeNull()
  })

  it('reads days and times in the words the platforms use', () => {
    expect(dayIn('Thursday, November 12, 2026', AT)).toBe('2026-11-12')
    expect(dayIn('Nov 12th', AT)).toBe('2026-11-12')
    expect(dayIn('11/12', AT)).toBe('2026-11-12')
    expect(dayIn('1/8', AT)).toBe('2027-01-08')
    expect(dayIn('Feb 30', AT)).toBeNull()
    expect(timeIn('2:00 PM')).toBe('14:00')
    expect(timeIn('2pm')).toBe('14:00')
    expect(timeIn('12:00 AM')).toBe('00:00')
    expect(timeIn('14:30')).toBe('14:30')
    expect(timeIn('noon')).toBe('12:00')
    expect(timeIn('the 30th')).toBeNull()
    expect(dueIn('Proposals due no later than Friday, December 4 at 3:00 p.m.', AT)).toEqual({ date: '2026-12-04', time: '15:00' })
    expect(dueIn('Bid deadline: 12/04/26', AT)).toEqual({ date: '2026-12-04', time: null })
    expect(dueIn('Bids are due the 30th.', AT)).toBeNull()
  })

  it('says the facts in words', () => {
    expect(dueWords({ date: '2026-11-12', time: '14:00' })).toBe('Thu Nov 12 at 2:00 PM')
    expect(dueWords({ date: '2026-11-12', time: null })).toBe('Thu Nov 12')
    expect(invitationFacts(invitation(PLATFORM)!)).toBe('Invitation to bid, due Thu Nov 12 at 2:00 PM, on BuildingConnected')
    expect(invitationFacts({ kind: 'addendum', due: null, portal: null })).toBe('Addendum')
  })

  it('asks Bid it? only of a line in, by email, unanswered and on no bid', () => {
    const inv = invitation(PLATFORM)!
    expect(openInvitation({ direction: 'in', channel: 'email', invitation: inv })).toBe(inv)
    expect(openInvitation({ direction: 'out', channel: 'email', invitation: inv })).toBeNull()
    expect(openInvitation({ direction: 'in', channel: 'text', invitation: inv })).toBeNull()
    expect(openInvitation({ direction: 'in', channel: 'email', invitation: { ...inv, answer: { what: 'kept', at: AT, by: null } } })).toBeNull()
    expect(openInvitation({ direction: 'in', channel: 'email', invitation: inv, jobId: 'bid:b1' })).toBeNull()
    expect(openInvitation({ direction: 'in', channel: 'email', invitation: inv, jobId: 'pipeline:j1' })).toBe(inv)
    expect(openInvitation({ direction: 'in', channel: 'email', invitation: null })).toBeNull()
  })

  it('reads a row’s jsonb back, and nothing else as one', () => {
    const inv = invitation(PLATFORM)!
    expect(invitationOf(JSON.parse(JSON.stringify(inv)))).toEqual({ ...inv, answer: null })
    expect(invitationOf({ ...inv, answer: { what: 'bid', at: AT, by: 'u1', bid_id: 'b1' } })?.answer?.what).toBe('bid')
    expect(invitationOf(null)).toBeNull()
    expect(invitationOf({ kind: 'party' })).toBeNull()
    expect(invitationOf('invitation')).toBeNull()
  })

  it('writes plain words', () => {
    for (const words of [invitationFacts(invitation(PLATFORM)!), dueWords({ date: '2026-11-12', time: '14:00' })]) expect(plainWordsFailures(`${words}.`)).toEqual([])
  })
})
