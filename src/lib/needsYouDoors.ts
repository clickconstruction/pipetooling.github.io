import type { NeedsYouItem } from './dashboardNeedsYou'
import { CUSTOMER_MESSAGES_HREF } from './dashboardNeedsYou'
import { lienWindowHref, ownerRecordsHref } from './jobs/stagesDeepLinks'
import { roadmapPath } from './roadmapVisibility'
import { clausePaperHref } from './contracts/clauseRows'
import { GC_FOLLOW_UP_HREF } from './gc/links'
import { messagesThreadHref } from './messages/customerThread'
import type { NeedsYouHost } from './needsYouSources'
import type { UserRole } from '../hooks/useAuth'

/**
 * Where a Needs You line's button goes (v2.5771, punch list #146): one table for both hosts.
 *
 * Until v2.5771 each host held its own `if / else if` chain on `item.key`, and a line added to
 * one host's chain was not in the other's. `needsYouDoor` answers for every key the type
 * knows, so a new key with no door is a compile error (the `switch` is exhaustive), and the
 * two hosts differ only where the page differs: an in-place window, a station on the same
 * page, a modal the host owns. The host dispatches on `kind`; nothing here navigates.
 */
export type NeedsYouDoor =
  /** `navigate(href)`. */
  | { kind: 'href'; href: string }
  /** A window the host mounts over the card. */
  | { kind: 'window'; window: 'ar-deposits' | 'tally-team' | 'lien-unconditional' | 'lien-waivers-to-sign' | 'todays-sends' }
  /** The first draft test report in the Test report modal; `href` when there is none or no modal. */
  | { kind: 'test-report'; first: { jobId: string; reportId: string } | null; href: string }
  /** A station on the Quickfill page, or the Teams Inbox card on the Dashboard; `href` when the host cannot show it. */
  | { kind: 'station'; station: 'dispatch-inbox' | 'people-hours-new'; href: string }

export type NeedsYouSecondaryDoor =
  | { kind: 'href'; href: string }
  /** A nudge hook's own snooze or dismiss; the host owns the hook. */
  | { kind: 'nudge'; nudge: 'bulk-delete' | 'bulk-hours' | 'claim-dev' | 'robot-backlog' | 'robot-asleep'; action: 'snooze' | 'dismiss' }
  | null

/** What the doors read from the host's data: the first row of a pile, an id to land on. All optional; a door falls back to its page. */
export type NeedsYouDoorData = {
  role: UserRole | null
  staleClaimsFirstBidId?: string | null
  submittalFirstBidId?: Partial<Record<'submittal-lead-time' | 'submittal-sent-back' | 'submittal-unopened' | 'submittal-not-started', string | null>>
  returnedCheckIds?: string[] | null
  returnedCheckFirstJobId?: string | null
  testReportFirst?: { jobId: string; reportId: string } | null
  priceRequestsLateBidId?: string | null
  priceMatrixReadyBidId?: string | null
  contractClausePaperId?: string | null
  teamReviewFirstId?: string | null
  roadmapFirstId?: string | null
  robotAnsweredBidId?: string | null
  robotBlockedBidId?: string | null
  legalReviewKey?: string | null
  legalFirmActivityKey?: string | null
  demandDeadlineJobId?: string | null
  lienBatchGcId?: string | null
  ownerRecordsJobId?: string | null
  lienServeFirstJobId?: string | null
  bulkHoursTypist?: { actorId: string; actorName: string } | null
  customerWaitingInboxHref?: string | null
  /** The review ask (v2.5946): the first low answer's contact, whose thread the line opens. */
  lowRatingContactId?: string | null
}

const STAGES = '/jobs?tab=stages'
const LIEN_DESK = '/jobs?tab=stages&liendesk=1'

export function needsYouDoor(item: Pick<NeedsYouItem, 'key'>, d: NeedsYouDoorData, host: NeedsYouHost): NeedsYouDoor {
  const href = (h: string): NeedsYouDoor => ({ kind: 'href', href: h })
  switch (item.key) {
    case 'ar-deposits':
      return { kind: 'window', window: 'ar-deposits' }
    case 'tally-self':
      return href('/tally?tab=transactions')
    case 'tally-team':
      return { kind: 'window', window: 'tally-team' }
    case 'todays-sends':
      return { kind: 'window', window: 'todays-sends' }
    case 'rating-low':
      // The review ask (v2.5946): the first low answer's thread, where the app's line and the call land.
      return href(d.lowRatingContactId ? messagesThreadHref(d.lowRatingContactId) : '/messages')
    case 'lost-bids':
      return href('/bids?tab=why-we-lost')
    case 'bid-followups':
      return href('/bids?tab=call-queue')
    case 'money-on-my-bids':
      return href('/bids?tab=money')
    case 'paid-claims-stale':
      // The estimator's door is the won bid's Job block; the office's the Pipeline.
      return href(d.role === 'estimator' && d.staleClaimsFirstBidId ? `/bids?tab=bid-board&bidId=${d.staleClaimsFirstBidId}` : d.role === 'estimator' ? '/bids?tab=bid-board' : STAGES)
    case 'job-followups':
      return href('/jobs?tab=stages&followups=1')
    case 'contract-missing':
      return href('/jobs?tab=stages&contractSweep=1')
    case 'contract-stale':
      return href('/jobs?tab=stages&contract=sent')
    case 'work-orders-unpriced':
      return href('/jobs?tab=subs&wof=drafts')
    case 'jobs-stale-open':
      return href('/jobs?tab=stages&followups=idle')
    case 'capacity-under':
      return href('/jobs?tab=job-summary&view=capacity')
    case 'job-account-missing':
      return href('/materials?tab=job-accounts&filter=no_account')
    case 'job-account-window':
      return href('/materials?tab=supply-houses&list=movable')
    case 'vehicle-records-missing':
      return href('/people?tab=vehicles')
    case 'submittal-lead-time':
    case 'submittal-sent-back':
    case 'submittal-unopened':
    case 'submittal-not-started': {
      const bidId = d.submittalFirstBidId?.[item.key]
      return href(bidId ? `/bids?tab=submittals&bidId=${encodeURIComponent(bidId)}` : '/bids?tab=submittals')
    }
    case 'returned-check': {
      // v2.4325: the case in Accounts Receivable; before the cases load, Edit Job → ③ Payments received.
      const ids = d.returnedCheckIds ?? []
      if (ids.length === 1) return href(`/accounts-receivable?check=${encodeURIComponent(ids[0]!)}`)
      if (ids.length > 1) return href('/accounts-receivable')
      return href(d.returnedCheckFirstJobId ? `/jobs?tab=stages&edit=${encodeURIComponent(d.returnedCheckFirstJobId)}&editFocus=payments` : STAGES)
    }
    case 'test-reports-ready':
      return { kind: 'test-report', first: d.testReportFirst ?? null, href: STAGES }
    case 'price-requests-late':
      return href(d.priceRequestsLateBidId ? `/bids?tab=pricing&bidId=${d.priceRequestsLateBidId}` : '/bids?tab=pricing')
    case 'price-matrix-ready':
      return href(d.priceMatrixReadyBidId ? `/bids?tab=pricing&bidId=${d.priceMatrixReadyBidId}` : '/bids?tab=pricing')
    case 'gc-follow-up':
      return href(GC_FOLLOW_UP_HREF)
    case 'customer-messages':
      return href(CUSTOMER_MESSAGES_HREF)
    case 'contract-clauses':
      return href(d.contractClausePaperId ? clausePaperHref(d.contractClausePaperId) : '/settings?tab=settings-clauses')
    case 'team-reviews':
      return href(`/prospects?tab=team&stage=review${d.teamReviewFirstId ? `&rate=${d.teamReviewFirstId}` : ''}`)
    case 'roadmap-needs-person':
      return href(roadmapPath(d.roadmapFirstId ?? undefined, d.roadmapFirstId ? 'plan' : null))
    case 'gc-review-weekly':
      return href('/jobs?tab=stages&gcReview=1')
    case 'statement-round':
      return href('/jobs?tab=stages&round=1')
    case 'bulk-delete':
      return href('/settings?tab=settings-data#settings-recently-deleted')
    case 'claim-dev':
      return href('/settings?tab=settings-advanced-tools#settings-claim-code')
    case 'robot-audits':
      return href('/bids?tab=audits')
    case 'robot-locked':
      return href('/bids?tab=robot-board')
    case 'robot-backlog':
    case 'robot-asleep':
      return href('/bids?tab=robot-console')
    case 'robot-answered':
      return href(d.robotAnsweredBidId ? `/bids?tab=submission-followup&bidId=${d.robotAnsweredBidId}&plans=1` : '/bids?tab=bid-board')
    case 'robot-blocked':
      return href(d.robotBlockedBidId ? `/bids?tab=bid-board&bidId=${d.robotBlockedBidId}&robot=needs` : '/bids?tab=robot-board')
    case 'legal-review':
      return href(`/jobs?tab=stages&legal=${encodeURIComponent(d.legalReviewKey ?? '1')}`)
    case 'legal-firm-activity':
      return href(`/jobs?tab=stages&legal=${encodeURIComponent(d.legalFirmActivityKey ?? '1')}&legalTab=fees`)
    case 'd22-uncoded':
      return href('/bids?tab=pricing&d22audit=1')
    case 'lien-unconditional':
      return { kind: 'window', window: 'lien-unconditional' }
    case 'lien-waivers-to-sign':
      return { kind: 'window', window: 'lien-waivers-to-sign' }
    case 'demand-deadline':
      return href(d.demandDeadlineJobId ? lienWindowHref(d.demandDeadlineJobId, 'demand') : STAGES)
    case 'lien-notice-batch':
      return href(d.lienBatchGcId ? `/jobs?tab=stages&gcnotice=${encodeURIComponent(d.lienBatchGcId)}` : LIEN_DESK)
    case 'lien-notice-sign':
    case 'docsmit-credit':
      return href(`${LIEN_DESK}&liendeskPile=ready`)
    case 'lien-window-missed':
      return href(`${LIEN_DESK}&liendeskPile=missed`)
    case 'lien-notice-approve':
      return href(`${LIEN_DESK}&liendeskPile=awaiting`)
    case 'lien-notice-draft':
      return href(LIEN_DESK)
    case 'lien-file-window':
      return href(`${LIEN_DESK}&kind=affidavit`)
    case 'lien-suit-year':
      return href(`${LIEN_DESK}&kind=timeline`)
    case 'lien-tracking-owed':
      return href(`${LIEN_DESK}&liendeskPile=sent`)
    case 'owner-records-signed':
      return href(d.ownerRecordsJobId ? ownerRecordsHref(d.ownerRecordsJobId) : LIEN_DESK)
    case 'lien-serve-copy':
      return href(d.lienServeFirstJobId ? lienWindowHref(d.lienServeFirstJobId, 'affidavit') : STAGES)
    case 'hours-approvals':
      // On Quickfill the People Hours station on the same page carries the approvals (punch list #146, the owner's call 1).
      return host === 'quickfill' ? { kind: 'station', station: 'people-hours-new', href: '/people?tab=hours&approvals=1' } : href('/people?tab=hours&approvals=1')
    case 'typed-hours':
      return href('/people?tab=hours&approvals=1&typed=1')
    case 'bulk-hours': {
      const t = d.bulkHoursTypist
      return href(`/people?tab=hours&approvals=1&typed=1${t ? `&typist=${encodeURIComponent(t.actorId)}&typistName=${encodeURIComponent(t.actorName)}` : ''}`)
    }
    case 'label-approvals':
      return href('/banking?tab=accounting')
    case 'dispatch-requests-aged':
      return { kind: 'station', station: 'dispatch-inbox', href: '/dispatch-mode/inbox' }
    case 'customer-waiting':
      return { kind: 'station', station: 'dispatch-inbox', href: d.customerWaitingInboxHref ?? '/dispatch-mode/inbox' }
    case 'hr-reports-pending':
      return href('/people?tab=hr')
  }
}

export function needsYouSecondaryDoor(item: Pick<NeedsYouItem, 'key'>, key: string): NeedsYouSecondaryDoor {
  const action = key === 'snooze' ? 'snooze' : key === 'dismiss' ? 'dismiss' : null
  if (item.key === 'bulk-delete' || item.key === 'bulk-hours' || item.key === 'claim-dev' || item.key === 'robot-backlog' || item.key === 'robot-asleep') {
    return action ? { kind: 'nudge', nudge: item.key, action } : null
  }
  if (item.key === 'lien-notice-draft' && key === 'missed') return { kind: 'href', href: `${LIEN_DESK}&liendeskPile=missed` }
  // Letter two is sent from a notice's Sent row (v2.4561).
  if (item.key === 'lien-notice-draft' && key === 'letter-two') return { kind: 'href', href: `${LIEN_DESK}&liendeskPile=sent` }
  return null
}
