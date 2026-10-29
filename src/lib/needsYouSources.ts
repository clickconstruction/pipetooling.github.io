import type { UserRole } from '../hooks/useAuth'
import { isAssistantLike } from './subcontractorLikeRole'
import { canAccessBanking } from './bankingAccess'
import { canWorkRobotAudits } from './bids/bidAudits'
import { canOpenGcProjects } from './gc/access'
import { canRoleSeeArBankUnallocatedDashboardBanner } from '../hooks/useArBankUnallocatedCount'

/**
 * Which Needs You sources a host reads for a role (v2.5771, punch list #146).
 *
 * `buildNeedsYouItems` is one builder with two hosts, the Dashboard card and Quickfill's
 * Needs you station. Until v2.5771 each host wired its own hooks and passed its own flags,
 * and the Quickfill host fell 24 sources behind the Dashboard's: nine office lines an
 * assistant works never reached the page the office works from. This table is the one home
 * of every source's gate, read by `useNeedsYouInputs` for both hosts, and
 * `needsYouSources.test.ts` holds the rule: a source the Dashboard enables for an office
 * role, Quickfill enables too, unless this file names the station that carries it or the
 * reason it is held back.
 */
export type NeedsYouHost = 'dashboard' | 'quickfill'

export type NeedsYouSource =
  | 'tally'
  | 'tallyStaff'
  | 'arBank'
  | 'lostBids'
  | 'bidFollowups'
  | 'staleClaims'
  | 'myMoney'
  | 'teamReviews'
  | 'roadmap'
  | 'gcReview'
  | 'statementRound'
  | 'bulkDelete'
  | 'bulkHours'
  | 'claimDev'
  | 'robotAudits'
  | 'robotBlocked'
  | 'd22'
  | 'hoursApprovals'
  | 'hrReports'
  | 'labelApprovals'
  | 'lien'
  | 'lienWaiversToSign'
  | 'contracts'
  | 'unpricedWorkOrders'
  | 'jobFollowups'
  | 'staleOpen'
  | 'capacityUnder'
  | 'jobAccountGaps'
  | 'supplyMoveWindow'
  | 'vehicleRecordGaps'
  | 'priceMatrix'
  | 'gcFollowUp'
  | 'contractClauses'
  | 'robotBacklog'
  | 'robotSilence'
  | 'legalReview'
  | 'legalFirmActivity'
  | 'testReports'
  | 'bankReturned'
  | 'submittals'
  | 'customerWaiting'
  | 'dispatchAged'
  // v2.6098 (punch list #178): the Customers line and Today's sends, sources of their own so the Messages station can carry them.
  | 'customerMessages'
  | 'todaysSends'

export const NEEDS_YOU_SOURCES: readonly NeedsYouSource[] = [
  'tally',
  'tallyStaff',
  'arBank',
  'lostBids',
  'bidFollowups',
  'staleClaims',
  'myMoney',
  'teamReviews',
  'roadmap',
  'gcReview',
  'statementRound',
  'bulkDelete',
  'bulkHours',
  'claimDev',
  'robotAudits',
  'robotBlocked',
  'd22',
  'hoursApprovals',
  'hrReports',
  'labelApprovals',
  'lien',
  'lienWaiversToSign',
  'contracts',
  'unpricedWorkOrders',
  'jobFollowups',
  'staleOpen',
  'capacityUnder',
  'jobAccountGaps',
  'supplyMoveWindow',
  'vehicleRecordGaps',
  'priceMatrix',
  'gcFollowUp',
  'contractClauses',
  'robotBacklog',
  'robotSilence',
  'legalReview',
  'legalFirmActivity',
  'testReports',
  'bankReturned',
  'submittals',
  'customerWaiting',
  'dispatchAged',
  'customerMessages',
  'todaysSends',
]

/** The office set: the owner, the assistant and the controller. Most company lines are theirs. */
export function isNeedsYouOfficeRole(role: UserRole | null | undefined): boolean {
  return role === 'dev' || role === 'master_technician' || isAssistantLike(role)
}

/**
 * Sources Quickfill does not read because one of its own stations already carries the work.
 * The value is the station's id, so the test and the docs can name it.
 */
export const QUICKFILL_CARRIED_BY_STATION: Readonly<Partial<Record<NeedsYouSource, string>>> = {
  jobFollowups: 'job-followups',
  gcReview: 'gc-weekly-review',
  // v2.5841 (punch list #176, change 4): the People Hours station counts the same approvals queue and the Dispatch inbox
  // station is the same inbox; each counted twice in the round until then.
  hoursApprovals: 'people-hours-new',
  dispatchAged: 'dispatch-inbox',
  // v2.6093 (punch list #178, D's PR 4): the Job follow-ups station's Idle lane is the same idle queue, the Follow-ups
  // deck's card in place; the Dashboard keeps its line.
  staleOpen: 'job-followups',
  // v2.6098 (punch list #178, D's PR 7): the Messages station is Follow up's lanes with the Texts ledger folded in, so the
  // people waiting on us and the texts the morning run prepared are counted once in the round; the Dashboard keeps both lines.
  customerMessages: 'messages',
  todaysSends: 'messages',
}

/**
 * Sources held off Quickfill on purpose, each with the reason. The role may allow the work;
 * the reason says why the billing desk is not where it is done.
 */
export const QUICKFILL_HELD_BACK: Readonly<Partial<Record<NeedsYouSource, string>>> = {
  robotAudits: 'a takeoff judgement, the estimator’s; a fast fill-in would make it faster to get wrong',
  d22: 'the ledger-teaching roles pin Division 22 codes from the Pricing tab',
  submittals: 'the estimator builds Rev 1 from the picks; the office is told on the Dashboard',
}

/** Whether a role on a host reads a source. The role gates are the Dashboard host’s of v2.5759, moved here. */
export function needsYouSourceEnabled(source: NeedsYouSource, role: UserRole | null, host: NeedsYouHost): boolean {
  if (host === 'quickfill' && (source in QUICKFILL_CARRIED_BY_STATION || source in QUICKFILL_HELD_BACK)) return false
  const office = isNeedsYouOfficeRole(role)
  switch (source) {
    case 'tally':
      return role != null
    case 'tallyStaff':
    case 'statementRound':
    case 'hoursApprovals':
    case 'lien':
    case 'contracts':
    case 'unpricedWorkOrders':
    case 'jobFollowups':
    case 'staleOpen':
    case 'capacityUnder':
    case 'jobAccountGaps':
    case 'supplyMoveWindow':
    case 'legalFirmActivity':
    case 'testReports':
    case 'bankReturned':
    case 'gcReview':
      return office
    case 'arBank':
      return canRoleSeeArBankUnallocatedDashboardBanner(role)
    case 'lostBids':
    case 'staleClaims':
      return office || role === 'estimator' || role === 'primary'
    case 'bidFollowups':
      return office || role === 'estimator'
    case 'myMoney':
      return role === 'estimator' || role === 'primary'
    case 'teamReviews':
    case 'roadmap':
    case 'bulkDelete':
    case 'bulkHours':
    case 'claimDev':
    case 'contractClauses':
    case 'customerWaiting':
    case 'dispatchAged':
      // The hook or the builder gates these itself (a reviewer, the dev, an approver, a group member).
      return role != null
    case 'robotAudits':
    case 'robotBlocked':
      return canWorkRobotAudits(role)
    case 'd22':
      return role === 'dev' || role === 'estimator'
    case 'hrReports':
    case 'robotBacklog':
    case 'legalReview':
      return role === 'dev'
    case 'labelApprovals':
      return canAccessBanking(role)
    case 'lienWaiversToSign':
    case 'robotSilence':
      return role === 'dev' || role === 'master_technician'
    case 'vehicleRecordGaps':
      return role === 'dev' || isAssistantLike(role)
    case 'priceMatrix':
    case 'submittals':
      return office || role === 'estimator'
    case 'gcFollowUp':
    case 'customerMessages':
    case 'todaysSends':
      // The GC office team, as the lines were gated through `gcFollowUp` until v2.6098.
      return canOpenGcProjects(role)
  }
}

/** Every source's gate for a role on a host, as one record. */
export function needsYouSourceGates(role: UserRole | null, host: NeedsYouHost): Record<NeedsYouSource, boolean> {
  const out = {} as Record<NeedsYouSource, boolean>
  for (const s of NEEDS_YOU_SOURCES) out[s] = needsYouSourceEnabled(s, role, host)
  return out
}
