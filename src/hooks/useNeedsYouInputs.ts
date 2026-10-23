import { useMemo } from 'react'
import type { UserRole } from './useAuth'
import { TALLY_STALE_MIN_AGE_DAYS } from '../lib/tallyStaleMinAgeDays'
import { useTallyUnlinkedCounts } from './useTallyUnlinkedCounts'
import { useArBankUnallocatedCount } from './useArBankUnallocatedCount'
import { useStaleTallyStaffFollowUp } from './useStaleTallyStaffFollowUp'
import { useJobFollowupNudge } from './useJobFollowupNudge'
import { JOB_FOLLOWUP_IDLE_DAYS } from '../lib/jobs/jobFollowupQueue'
import { useTeamReviewsDue } from './useTeamReviewsDue'
import { useRoadmapNeedsNameNudges } from './useRoadmapNeedsNameNudges'
import { buildNeedsYouItems, CUSTOMER_MESSAGES_LINE_ON, type NeedsYouInputs, type NeedsYouItem } from '../lib/dashboardNeedsYou'
import { useCustomerWaitingOptional } from '../contexts/CustomerWaitingContext'
import { summarizeCustomerWaiting } from '../lib/customerWaiting'
import { useGcReviewWeekNudge } from './useGcReviewWeekNudge'
import { gcReviewNudgeState, gcReviewWeekdayIndex } from '../lib/jobs/gcReviewCertification'
import { useLostBidNudge } from './useLostBidNudge'
import { useBidFollowupsDue } from './useBidFollowupsDue'
import { useMyStaleClaims } from './useMyStaleClaims'
import { useMyMoney } from './useMyMoney'
import { staleClaimLine } from '../lib/jobs/paidClaims'
import { useBulkDeleteNudge } from './useBulkDeleteNudge'
import { useBulkHoursNudge } from './useBulkHoursNudge'
import { useBidAuditsPendingCount } from './useBidAuditsPendingCount'
import { useRobotLockedShadows } from './useRobotLockedShadows'
import { useSpecSectionUncodedCount } from './useSpecSectionUncodedCount'
import { useLienReleasesOwedNudge } from './useLienReleasesOwedNudge'
import { useStatementRoundNudge } from './useStatementRoundNudge'
import { useDemandDeadlinesNudge } from './useDemandDeadlinesNudge'
import { useJobContractsNudge } from './useJobContractsNudge'
import { useUnpricedWorkOrders } from './useUnpricedWorkOrders'
import { useCapacityUnderNudge } from './useCapacityUnderNudge'
import { useJobAccountEvidenceGapsNudge } from './useJobAccountEvidenceGapsNudge'
import { useSupplyMoveWindowNudge } from './useSupplyMoveWindowNudge'
import { useVehicleRecordGapsNudge } from './useVehicleRecordGapsNudge'
import { usePriceMatrixReadyNudge } from './usePriceMatrixReadyNudge'
import { usePriceRequestsLateNudge } from './usePriceRequestsLateNudge'
import { useGcFollowUpNeeds } from './useGcFollowUpNeeds'
import { useCustomerMessagesCounts } from './useCustomerMessagesCounts'
import { useTodaysSends } from './useTodaysSends'
import { useClauseNeeds } from './useClauseNeeds'
import { useRobotBacklogNudge } from './useRobotBacklogNudge'
import { useRobotSilenceNudge } from './useRobotSilenceNudge'
import { useRobotAnsweredNudge } from './usePlanQuestions'
import { answeredLine } from '../lib/bids/planQuestions'
import { useLegalReviewNudge } from './useLegalReviewNudge'
import { useLegalFirmActivityNudge } from './useLegalFirmActivityNudge'
import { useOwnerRecordsSignedNudge } from './useOwnerRecordsSignedNudge'
import { useTestReportsReadyNudge } from './useTestReportsReadyNudge'
import { useBankReturnedPaymentsNudge } from './useBankReturnedPaymentsNudge'
import { useSubmittalsNudge } from './useSubmittalsNudge'
import { useLienWatchNudge } from './useLienWatchNudge'
import { useDocsmitSettings } from './useDocsmitSettings'
import { todayYmdInAppTz } from '../utils/dateUtils'
import { useLienDeskData } from './useLienDeskData'
import { CLAIM_DEV_LOOKBACK_DAYS, useClaimDevAttemptsNudge } from './useClaimDevAttemptsNudge'
import { HOURS_APPROVALS_MIN_AGE_DAYS, usePendingHoursApprovalsNudge } from './usePendingHoursApprovalsNudge'
import { useTypedHoursWaitingNudge } from './useTypedHoursWaitingNudge'
import { LABEL_APPROVALS_MIN_AGE_DAYS, usePendingLabelApprovalsNudge } from './usePendingLabelApprovalsNudge'
import { usePendingHrReportsNudge } from './usePendingHrReportsNudge'
import { DISPATCH_REQUEST_AGE, DISPATCH_REQUESTS_MIN_AGE_DAYS, HR_PENDING_REPORT_AGE, HR_REPORTS_MIN_AGE_DAYS } from '../lib/ageState'
import type { DispatchAgingSummary } from '../lib/dispatchInboxAging'
import { useLienSignatureLanes } from './useLienSignatureLanes'
import { useZzTestJobsHidden } from '../lib/jobs/zzTestJobSwitch'
import { isNeedsYouOfficeRole, needsYouSourceGates, type NeedsYouHost } from '../lib/needsYouSources'
import type { NeedsYouDoorData } from '../lib/needsYouDoors'

/**
 * Every Needs You source, read once for either host (v2.5771, punch list #145).
 *
 * The Dashboard card and Quickfill's Needs you station call this hook with their `host`, and
 * `needsYouSourceGates` says which sources each host reads for the role — so the two cannot
 * drift apart by one host forgetting a hook. The hook returns the items the builder made,
 * the inputs it was given (the render smokes read them), the data the doors need
 * (`needsYouDoor`) and the handles the hosts' windows use (queues, refetches, snoozes).
 * `enabled: false` (the Dashboard's `hideBanners`) reads nothing.
 */
export type NeedsYouInputsOptions = {
  authUserId: string | undefined
  role: UserRole | null
  host: NeedsYouHost
  /** False reads nothing: the Dashboard's `hideBanners`. */
  enabled?: boolean
  /** Open dispatch requests past the min age, summarised by the page from its inbox rows. */
  dispatchAged?: DispatchAgingSummary | null
  /** Quickfill passes false when the page has no Dispatch inbox station to open. */
  dispatchAgedEnabled?: boolean
}

export function useNeedsYouInputs(opts: NeedsYouInputsOptions) {
  const { authUserId, role, host, dispatchAged = null } = opts
  const enabled = (opts.enabled ?? true) && Boolean(authUserId)
  const gates = needsYouSourceGates(role, host)
  const on = (source: keyof typeof gates): boolean => enabled && gates[source]
  const officeEligible = isNeedsYouOfficeRole(role)

  // Customer Waiting (v2.3248): the Layout-level subscription; null outside the provider.
  const customerWaitingCtx = useCustomerWaitingOptional()
  const customerWaiting = customerWaitingCtx && customerWaitingCtx.eligible ? summarizeCustomerWaiting(customerWaitingCtx.rows) : null
  /** ZZ test jobs off the nudges and the Lien desk's count for every role but a dev who shows them (punch list #61). */
  const hideZzTestJobs = useZzTestJobsHidden(role)

  // One hook feeds the tally badge, the Needs You card and the /tally header (v2.2896).
  const { unlinked: tallyUnlinkedCount, staleUnlinked: tallyStaleUnlinkedCount } = useTallyUnlinkedCounts(on('tally'))
  const lostBids = useLostBidNudge(on('lostBids'))
  const { due: bidFollowupsDue } = useBidFollowupsDue(on('bidFollowups'))
  const staleClaimsEnabled = on('staleClaims')
  const { stale: staleClaims } = useMyStaleClaims(staleClaimsEnabled, authUserId)
  const myMoneyEnabled = on('myMoney')
  const { lens: myMoneyLens, rollup: myMoneyRollup } = useMyMoney(myMoneyEnabled)
  const myMoneyInput = useMemo(() => (myMoneyLens && myMoneyRollup ? { open: myMoneyLens.open, rollup: myMoneyRollup, pastWord: myMoneyLens.pastWord, stale: myMoneyLens.stale } : null), [myMoneyLens, myMoneyRollup])
  const staleClaimsInput = useMemo(() => (staleClaims.length ? { count: staleClaims.length, firstLine: staleClaimLine(staleClaims[0]!, todayYmdInAppTz()) } : null), [staleClaims])
  const tallyStaff = useStaleTallyStaffFollowUp(TALLY_STALE_MIN_AGE_DAYS)
  const arBankEnabled = on('arBank')
  const arBank = useArBankUnallocatedCount({ enabled: arBankEnabled, authUserId, authRole: role })
  const { overdue: teamReviewsOverdue, cadenceDays: teamReviewCadenceDays } = useTeamReviewsDue(on('teamReviews') ? authUserId : undefined)
  const { nudges: roadmapNudges } = useRoadmapNeedsNameNudges(on('roadmap') ? authUserId : undefined, role)
  const gcReviewEnabled = on('gcReview')
  const { status: gcReviewStatus } = useGcReviewWeekNudge(gcReviewEnabled)
  const gcReviewNudge = gcReviewStatus != null ? gcReviewNudgeState(gcReviewStatus) : null
  const statementRoundEnabled = on('statementRound')
  const { nudge: statementRound } = useStatementRoundNudge(statementRoundEnabled)
  const bulkDelete = useBulkDeleteNudge(on('bulkDelete') ? authUserId : undefined)
  const bulkHours = useBulkHoursNudge(on('bulkHours') ? authUserId : undefined)
  const claimDev = useClaimDevAttemptsNudge(on('claimDev') ? authUserId : undefined)

  // Robot audits (v2.2573): the auditing roles. The blocked line (punch list #145) rides the same read but its own gate.
  const robotAuditsEnabled = on('robotAudits')
  const robotBlockedEnabled = on('robotBlocked')
  const { pending: robotAuditsPending, questions: robotQuestionsWaiting, plansAsks: robotBlocked } = useBidAuditsPendingCount(robotAuditsEnabled || robotBlockedEnabled)
  const { locked: robotLockedShadows } = useRobotLockedShadows(robotAuditsEnabled)
  const robotAnsweredNudge = useRobotAnsweredNudge(robotAuditsEnabled, robotAuditsEnabled ? authUserId : undefined)
  const robotAnswered = answeredLine(robotAnsweredNudge.rows, robotAnsweredNudge.bidNumberOf)
  const d22UncodedEnabled = on('d22')
  const { uncoded: d22UncodedCount } = useSpecSectionUncodedCount(d22UncodedEnabled)

  const hoursApprovalsEnabled = on('hoursApprovals')
  const { approvals: hoursApprovals } = usePendingHoursApprovalsNudge(hoursApprovalsEnabled)
  const { typedHours } = useTypedHoursWaitingNudge(hoursApprovalsEnabled)
  const hrReportsEnabled = on('hrReports')
  const { aged: hrReportsAged } = usePendingHrReportsNudge(hrReportsEnabled)
  const labelApprovalsEnabled = on('labelApprovals')
  const { approvals: labelApprovals } = usePendingLabelApprovalsNudge(labelApprovalsEnabled)

  // The lien set (v2.2582 …): the office works the desk; the leader signs and approves.
  const lienEnabled = on('lien')
  const lienReleases = useLienReleasesOwedNudge(lienEnabled, hideZzTestJobs)
  const lienWaiversToSignEnabled = on('lienWaiversToSign')
  const lienSignature = useLienSignatureLanes(lienWaiversToSignEnabled)
  const lienWaiversToSign = lienWaiversToSignEnabled ? { count: lienSignature.lanes.toSign.length, total: lienSignature.lanes.toSign.reduce((sum, r) => sum + Number(r.amount ?? 0), 0) } : null
  const { overdue: demandDeadlineOverdue } = useDemandDeadlinesNudge(lienEnabled, hideZzTestJobs, authUserId)
  const { watch: lienWatch } = useLienWatchNudge(lienEnabled, hideZzTestJobs)
  const docsmit = useDocsmitSettings()
  const { data: lienDeskData } = useLienDeskData(lienEnabled, todayYmdInAppTz(), { light: true, hideZzTestJobs })
  const ownerRecordsSignedEnabled = lienEnabled
  const { signed: ownerRecordsSigned } = useOwnerRecordsSignedNudge(ownerRecordsSignedEnabled, hideZzTestJobs, authUserId)

  const contractNudgeEnabled = on('contracts')
  const { nudge: contractNudge } = useJobContractsNudge(contractNudgeEnabled)
  const unpricedWorkOrdersEnabled = on('unpricedWorkOrders')
  const { unpriced: unpricedWorkOrders } = useUnpricedWorkOrders(unpricedWorkOrdersEnabled)
  // The quiet jobs (v2.2487) and the idle ones (v2.5512): one fetch, the deck's kernel. Quickfill's own
  // station carries the quiet jobs; the idle line is the deck's and rides the same read.
  const jobFollowupsEnabled = on('jobFollowups')
  const staleOpenEnabled = on('staleOpen')
  const jobFollowup = useJobFollowupNudge(jobFollowupsEnabled || staleOpenEnabled, { userId: authUserId, hideZzTestJobs })
  const staleOpen = jobFollowup.idle ? { ...jobFollowup.idle, minIdleDays: JOB_FOLLOWUP_IDLE_DAYS } : null
  const capacityUnderEnabled = on('capacityUnder')
  const { streak: capacityUnder } = useCapacityUnderNudge(capacityUnderEnabled, authUserId)
  const jobAccountGapsEnabled = on('jobAccountGaps')
  const { gaps: jobAccountGaps, reload: reloadJobAccountGaps } = useJobAccountEvidenceGapsNudge(jobAccountGapsEnabled)
  const supplyMoveWindowEnabled = on('supplyMoveWindow')
  const { moveWindow: supplyMoveWindow } = useSupplyMoveWindowNudge(supplyMoveWindowEnabled)
  const vehicleRecordGapsEnabled = on('vehicleRecordGaps')
  const { gaps: vehicleRecordGaps, reload: reloadVehicleRecords } = useVehicleRecordGapsNudge(vehicleRecordGapsEnabled)
  const priceMatrixEnabled = on('priceMatrix')
  const { ready: priceMatrixReady } = usePriceMatrixReadyNudge(priceMatrixEnabled)
  const { late: priceRequestsLate } = usePriceRequestsLateNudge(priceMatrixEnabled)
  const gcFollowUpEnabled = on('gcFollowUp')
  const gcFollowUp = useGcFollowUpNeeds(gcFollowUpEnabled)
  const customerMessagesEnabled = CUSTOMER_MESSAGES_LINE_ON && gcFollowUpEnabled
  const customerMessages = useCustomerMessagesCounts(customerMessagesEnabled)
  const todaysSendsEnabled = gcFollowUpEnabled
  const todaysSends = useTodaysSends(todaysSendsEnabled)
  const contractClausesEnabled = on('contractClauses')
  const { rows: contractClauses } = useClauseNeeds(contractClausesEnabled)
  const robotBacklogEnabled = on('robotBacklog')
  const robotBacklogNudge = useRobotBacklogNudge(robotBacklogEnabled, robotBacklogEnabled ? authUserId : undefined)
  const robotSilenceEnabled = on('robotSilence')
  const robotSilenceNudge = useRobotSilenceNudge(robotSilenceEnabled, robotSilenceEnabled ? authUserId : undefined)
  const legalReviewEnabled = on('legalReview')
  const { review: legalReview } = useLegalReviewNudge(legalReviewEnabled)
  const legalFirmActivityEnabled = on('legalFirmActivity')
  const { activity: legalFirmActivity } = useLegalFirmActivityNudge(legalFirmActivityEnabled)
  const testReportsEnabled = on('testReports')
  const testReportsNudge = useTestReportsReadyNudge(testReportsEnabled, hideZzTestJobs, authUserId)
  const bankReturnedEnabled = on('bankReturned')
  const bankReturnedNudge = useBankReturnedPaymentsNudge(bankReturnedEnabled, hideZzTestJobs, authUserId)
  const submittalsEnabled = on('submittals')
  const submittalsNudge = useSubmittalsNudge(submittalsEnabled)

  const inputs: NeedsYouInputs = {
    role,
    arBankUnallocatedCount: arBank.count,
    arBankEnabled,
    tallyStaleUnlinkedCount,
    tallyUnlinkedCount,
    tallyStaffStalePeopleCount: tallyStaff.peopleCount,
    tallyStaffStaleTxCount: tallyStaff.transactionCount,
    tallyStaffEligible: on('tallyStaff'),
    tallyMinAgeDays: TALLY_STALE_MIN_AGE_DAYS,
    lostBidNudge: lostBids.nudge,
    lostBidNudgeLoading: lostBids.loading,
    bidFollowupsDue,
    teamReviewsOverdue,
    teamReviewCadenceDays,
    roadmapNudges,
    jobFollowupsEnabled,
    jobFollowupCount: jobFollowup.count,
    jobFollowupStageCounts: jobFollowup.stageCounts,
    gcReviewEnabled,
    statementRoundEnabled,
    statementRound,
    gcReviewStatus,
    gcReviewNudge,
    gcReviewIsWednesday: gcReviewWeekdayIndex() === 3,
    bulkDeleteAlerts: bulkDelete.visibleAlerts,
    bulkHoursAlerts: bulkHours.visibleAlerts,
    claimDevRefusedCount: claimDev.visibleCount,
    claimDevLookbackDays: CLAIM_DEV_LOOKBACK_DAYS,
    robotAuditsEnabled,
    robotAuditsPending,
    robotQuestionsWaiting,
    robotLockedShadows,
    d22UncodedEnabled,
    d22UncodedCount,
    lienUnconditionalEnabled: lienEnabled,
    lienUnconditionalOwed: lienReleases.owed,
    lienWaiversToSignEnabled,
    lienWaiversToSign,
    contractNudgeEnabled,
    contractNudge,
    unpricedWorkOrdersEnabled,
    unpricedWorkOrders,
    staleOpenEnabled,
    staleOpen,
    capacityUnderEnabled,
    capacityUnder,
    jobAccountGapsEnabled,
    jobAccountGaps,
    supplyMoveWindowEnabled,
    supplyMoveWindow,
    vehicleRecordGapsEnabled,
    vehicleRecordGaps,
    priceMatrixEnabled,
    priceMatrixReady,
    priceRequestsLateEnabled: priceMatrixEnabled,
    priceRequestsLate,
    staleClaimsEnabled,
    staleClaims: staleClaimsInput,
    myMoneyEnabled,
    myMoney: myMoneyInput,
    gcFollowUpEnabled,
    gcFollowUp,
    customerMessagesEnabled,
    customerMessages,
    todaysSendsEnabled,
    todaysSends: todaysSends.need,
    contractClausesEnabled,
    contractClauses,
    robotBacklogEnabled,
    robotBacklog: robotBacklogNudge.backlog,
    robotSilenceEnabled,
    robotSilence: robotSilenceNudge.silence,
    robotBlockedEnabled,
    robotBlocked,
    robotAnswered,
    legalReviewEnabled,
    legalReview,
    legalFirmActivityEnabled,
    legalFirmActivity,
    testReportsEnabled,
    testReportsReady: testReportsNudge.drafts,
    bankReturnedEnabled,
    bankReturned: bankReturnedNudge.returned,
    bankReturnCases: bankReturnedNudge.cases,
    todayYmd: todayYmdInAppTz(),
    submittalsEnabled,
    submittalNudge: submittalsNudge.nudge,
    demandDeadlineEnabled: lienEnabled,
    demandDeadlineOverdue,
    lienWatchEnabled: lienEnabled,
    lienWatch,
    docsmitCreditEnabled: lienEnabled && docsmit.setUp,
    docsmitCredit: docsmit.loaded ? { ...docsmit.credit, warn: docsmit.settings.creditWarn, nowIso: new Date().toISOString() } : null,
    lienDeskEnabled: lienEnabled,
    lienDesk: lienDeskData?.summary ?? null,
    lienDeskLeader: role === 'dev' || role === 'master_technician',
    ownerRecordsSignedEnabled,
    ownerRecordsSigned,
    hoursApprovalsEnabled,
    hoursApprovals,
    hoursApprovalsMinAgeDays: HOURS_APPROVALS_MIN_AGE_DAYS,
    typedHoursEnabled: hoursApprovalsEnabled,
    typedHours,
    labelApprovalsEnabled,
    labelApprovals,
    labelApprovalsMinAgeDays: LABEL_APPROVALS_MIN_AGE_DAYS,
    customerWaitingEnabled: on('customerWaiting') && customerWaitingCtx != null,
    customerWaiting,
    dispatchAgedEnabled: on('dispatchAged') && (opts.dispatchAgedEnabled ?? true),
    dispatchAged,
    dispatchMinAgeDays: DISPATCH_REQUESTS_MIN_AGE_DAYS,
    dispatchRedDays: DISPATCH_REQUEST_AGE.redDays,
    hrReportsEnabled,
    hrReportsAged,
    hrReportsMinAgeDays: HR_REPORTS_MIN_AGE_DAYS,
    hrReportsRedDays: HR_PENDING_REPORT_AGE.redDays,
  }

  const items: NeedsYouItem[] = buildNeedsYouItems(inputs)

  const submittal = submittalsNudge.nudge
  const doorData: NeedsYouDoorData = {
    role,
    staleClaimsFirstBidId: staleClaims[0]?.bidId ?? null,
    submittalFirstBidId: {
      'submittal-lead-time': submittal?.leadTime.first?.bidId ?? null,
      'submittal-sent-back': submittal?.sentBack.first?.bidId ?? null,
      'submittal-unopened': submittal?.unopened.first?.bidId ?? null,
      'submittal-not-started': submittal?.notStarted.first?.bidId ?? null,
    },
    returnedCheckIds: bankReturnedNudge.cases?.map((c) => c.mercury_transaction_id) ?? null,
    returnedCheckFirstJobId: bankReturnedNudge.returned?.first?.jobId ?? null,
    testReportFirst: testReportsNudge.drafts?.first ? { jobId: testReportsNudge.drafts.first.jobId, reportId: testReportsNudge.drafts.first.reportId } : null,
    priceRequestsLateBidId: priceRequestsLate?.first.bidId ?? null,
    priceMatrixReadyBidId: priceMatrixReady?.first.bidId ?? null,
    contractClausePaperId: contractClauses[0]?.proposal.paperId ?? null,
    teamReviewFirstId: teamReviewsOverdue[0]?.id ?? null,
    roadmapFirstId: roadmapNudges[0]?.roadmapId ?? null,
    robotAnsweredBidId: robotAnswered?.firstBidId ?? null,
    robotBlockedBidId: robotBlocked.first?.bidId ?? null,
    legalReviewKey: legalReview?.firstKey ?? null,
    legalFirmActivityKey: legalFirmActivity?.firstKey ?? null,
    demandDeadlineJobId: demandDeadlineOverdue?.jobIds[0] ?? null,
    lienBatchGcId: lienDeskData?.summary.leader.batches?.[0]?.gcId ?? null,
    ownerRecordsJobId: ownerRecordsSigned?.first.jobId ?? null,
    lienServeFirstJobId: [...(lienWatch?.serveDue ?? [])].sort((a, b) => a.serveDue.localeCompare(b.serveDue))[0]?.jobId ?? null,
    bulkHoursTypist: bulkHours.visibleAlerts?.[0] ? { actorId: bulkHours.visibleAlerts[0].actorId, actorName: bulkHours.visibleAlerts[0].actorName } : null,
    customerWaitingInboxHref: customerWaitingCtx?.inboxHref ?? null,
  }

  return {
    items,
    inputs,
    doorData,
    officeEligible,
    /** The hosts' windows and nudges: what a press opens, what a close refetches, what a secondary link snoozes. */
    handles: {
      tallyUnlinkedCount,
      arBankUnallocatedCount: arBank.count,
      refetchArBankUnallocatedCount: arBank.refetch,
      refetchStaleTallyStaffFollowUp: tallyStaff.refetch,
      lienReleaseQueue: lienReleases.queue,
      refetchLienReleasesOwed: lienReleases.refetch,
      lienWaiversToSignRows: lienSignature.lanes.toSign,
      refetchLienSignatureLanes: lienSignature.refetch,
      reloadTodaysSends: todaysSends.reload,
      reloadLostBids: lostBids.reload,
      reloadVehicleRecords,
      reloadJobAccountGaps,
      reloadTestReports: testReportsNudge.reload,
      contractNudge,
      gcReviewStatus,
      gcReviewNudge,
      bulkDelete,
      bulkHours,
      claimDev,
      robotBacklogNudge,
      robotSilenceNudge,
    },
  }
}

export type NeedsYouHandles = ReturnType<typeof useNeedsYouInputs>['handles']
