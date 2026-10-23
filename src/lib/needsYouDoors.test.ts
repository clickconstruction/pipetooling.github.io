import { describe, expect, it } from 'vitest'
import { NEEDS_YOU_RANK } from './dashboardNeedsYou'
import { needsYouDoor, needsYouSecondaryDoor, type NeedsYouDoorData } from './needsYouDoors'

const base: NeedsYouDoorData = { role: 'assistant' }
const keys = Object.keys(NEEDS_YOU_RANK) as Array<keyof typeof NEEDS_YOU_RANK>

describe('needsYouDoor · one table for both hosts (punch list #145)', () => {
  it('answers for every key the rank table knows, on both hosts', () => {
    for (const key of keys) {
      for (const host of ['dashboard', 'quickfill'] as const) {
        const door = needsYouDoor({ key }, base, host)
        expect(door, `${key} on ${host}`).toBeTruthy()
        if (door.kind === 'href') expect(door.href.startsWith('/')).toBe(true)
      }
    }
  })

  it('the five windows open in place on both hosts', () => {
    for (const key of ['ar-deposits', 'tally-team', 'lien-unconditional', 'lien-waivers-to-sign', 'todays-sends'] as const) {
      expect(needsYouDoor({ key }, base, 'dashboard')).toEqual({ kind: 'window', window: key })
      expect(needsYouDoor({ key }, base, 'quickfill')).toEqual({ kind: 'window', window: key })
    }
  })

  it('the clock sessions land on People → Hours from the Dashboard and on the People Hours station from Quickfill', () => {
    expect(needsYouDoor({ key: 'hours-approvals' }, base, 'dashboard')).toEqual({ kind: 'href', href: '/people?tab=hours&approvals=1' })
    expect(needsYouDoor({ key: 'hours-approvals' }, base, 'quickfill')).toEqual({ kind: 'station', station: 'people-hours-new', href: '/people?tab=hours&approvals=1' })
    expect(needsYouDoor({ key: 'typed-hours' }, base, 'quickfill')).toEqual({ kind: 'href', href: '/people?tab=hours&approvals=1&typed=1' })
  })

  it('the dispatch lines are the inbox station, with the viewer’s inbox as the fallback', () => {
    expect(needsYouDoor({ key: 'dispatch-requests-aged' }, base, 'quickfill')).toEqual({ kind: 'station', station: 'dispatch-inbox', href: '/dispatch-mode/inbox' })
    expect(needsYouDoor({ key: 'customer-waiting' }, { ...base, customerWaitingInboxHref: '/bids?tab=inbox' }, 'dashboard')).toEqual({ kind: 'station', station: 'dispatch-inbox', href: '/bids?tab=inbox' })
  })

  it('a returned check opens its case, the list with several, Edit Job before the cases load', () => {
    expect(needsYouDoor({ key: 'returned-check' }, { ...base, returnedCheckIds: ['tx-1'] }, 'quickfill')).toEqual({ kind: 'href', href: '/accounts-receivable?check=tx-1' })
    expect(needsYouDoor({ key: 'returned-check' }, { ...base, returnedCheckIds: ['tx-1', 'tx-2'] }, 'quickfill')).toEqual({ kind: 'href', href: '/accounts-receivable' })
    expect(needsYouDoor({ key: 'returned-check' }, { ...base, returnedCheckIds: [], returnedCheckFirstJobId: 'j-9' }, 'quickfill')).toEqual({ kind: 'href', href: '/jobs?tab=stages&edit=j-9&editFocus=payments' })
  })

  it('a test report asks for the modal with the first draft, the Stages board behind it', () => {
    expect(needsYouDoor({ key: 'test-reports-ready' }, { ...base, testReportFirst: { jobId: 'j-1', reportId: 'r-1' } }, 'quickfill')).toEqual({ kind: 'test-report', first: { jobId: 'j-1', reportId: 'r-1' }, href: '/jobs?tab=stages' })
  })

  it('the first row of a pile is the landing where one is known', () => {
    expect(needsYouDoor({ key: 'paid-claims-stale' }, { role: 'estimator', staleClaimsFirstBidId: 'b-1' }, 'dashboard')).toEqual({ kind: 'href', href: '/bids?tab=bid-board&bidId=b-1' })
    expect(needsYouDoor({ key: 'paid-claims-stale' }, { role: 'assistant', staleClaimsFirstBidId: 'b-1' }, 'dashboard')).toEqual({ kind: 'href', href: '/jobs?tab=stages' })
    expect(needsYouDoor({ key: 'submittal-sent-back' }, { ...base, submittalFirstBidId: { 'submittal-sent-back': 'b 2' } }, 'dashboard')).toEqual({ kind: 'href', href: '/bids?tab=submittals&bidId=b%202' })
    expect(needsYouDoor({ key: 'team-reviews' }, { ...base, teamReviewFirstId: 'u-1' }, 'dashboard')).toEqual({ kind: 'href', href: '/prospects?tab=team&stage=review&rate=u-1' })
    expect(needsYouDoor({ key: 'lien-notice-batch' }, { ...base, lienBatchGcId: 'gc-1' }, 'quickfill')).toEqual({ kind: 'href', href: '/jobs?tab=stages&gcnotice=gc-1' })
    expect(needsYouDoor({ key: 'lien-notice-batch' }, base, 'quickfill')).toEqual({ kind: 'href', href: '/jobs?tab=stages&liendesk=1' })
    expect(needsYouDoor({ key: 'bulk-hours' }, { ...base, bulkHoursTypist: { actorId: 'u-2', actorName: 'Rosa M' } }, 'dashboard')).toEqual({ kind: 'href', href: '/people?tab=hours&approvals=1&typed=1&typist=u-2&typistName=Rosa%20M' })
  })

  it('secondary links: snooze and dismiss go to the line’s nudge, the lien desk links to the pile', () => {
    expect(needsYouSecondaryDoor({ key: 'bulk-delete' }, 'snooze')).toEqual({ kind: 'nudge', nudge: 'bulk-delete', action: 'snooze' })
    expect(needsYouSecondaryDoor({ key: 'robot-asleep' }, 'dismiss')).toEqual({ kind: 'nudge', nudge: 'robot-asleep', action: 'dismiss' })
    expect(needsYouSecondaryDoor({ key: 'lien-notice-draft' }, 'missed')).toEqual({ kind: 'href', href: '/jobs?tab=stages&liendesk=1&liendeskPile=missed' })
    expect(needsYouSecondaryDoor({ key: 'lien-notice-draft' }, 'letter-two')).toEqual({ kind: 'href', href: '/jobs?tab=stages&liendesk=1&liendeskPile=sent' })
    expect(needsYouSecondaryDoor({ key: 'lien-notice-draft' }, 'snooze')).toBeNull()
    expect(needsYouSecondaryDoor({ key: 'tally-self' }, 'snooze')).toBeNull()
  })
})
