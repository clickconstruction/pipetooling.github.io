import { describe, expect, it } from 'vitest'
import { APPROVERS, MSA, MSA_CLAUSES, ROSA, idsFrom } from '../test/fixtures/clauseBookDemo'
import { clauseNeeds, editClause, type ClauseNeedRow, type ClauseProposal } from './contracts/approval'
import { NEEDS_YOU_RANK, buildNeedsYouItems, type NeedsYouInputs } from './dashboardNeedsYou'

/**
 * Contracts and clauses (Messages, cut 4c, v2.5285): the clause changes waiting on a controller's or a dev's approval, as
 * one Needs you line. Its own file, as the GC Follow up line has: two cards' tests at the shared file's end conflict.
 */
function inputs(overrides: Partial<NeedsYouInputs> = {}): NeedsYouInputs {
  return {
    role: 'controller',
    arBankUnallocatedCount: 0,
    arBankEnabled: false,
    tallyStaleUnlinkedCount: 0,
    tallyStaffStalePeopleCount: 0,
    tallyStaffStaleTxCount: 0,
    tallyStaffEligible: false,
    tallyMinAgeDays: 2,
    lostBidNudge: null,
    lostBidNudgeLoading: false,
    teamReviewsOverdue: [],
    teamReviewCadenceDays: 30,
    roadmapNudges: [],
    jobFollowupsEnabled: false,
    jobFollowupCount: 0,
    jobFollowupStageCounts: null,
    gcReviewEnabled: false,
    gcReviewStatus: null,
    gcReviewNudge: null,
    gcReviewIsWednesday: false,
    bulkDeleteAlerts: null,
    claimDevRefusedCount: null,
    claimDevLookbackDays: 7,
    robotAuditsEnabled: false,
    robotAuditsPending: 0,
    robotLockedShadows: null,
    d22UncodedEnabled: false,
    d22UncodedCount: 0,
    lienUnconditionalEnabled: false,
    lienUnconditionalOwed: null,
    lienWaiversToSignEnabled: false,
    lienWaiversToSign: null,
    demandDeadlineEnabled: false,
    demandDeadlineOverdue: null,
    lienWatchEnabled: false,
    lienWatch: null,
    hoursApprovalsEnabled: false,
    hoursApprovals: null,
    hoursApprovalsMinAgeDays: 3,
    labelApprovalsEnabled: false,
    labelApprovals: null,
    labelApprovalsMinAgeDays: 3,
    ...overrides,
  }
}

const book = { paper: MSA, clauses: MSA_CLAUSES }
const proposed = (en: string, at: string): ClauseProposal => {
  const r = editClause(book, { kind: 'edit', clauseId: 'msa-2', en, es: '', scope: 'all' }, ROSA, { at, why: 'the insurer asked for it', approvers: APPROVERS, newId: idsFrom(at) })
  if (r.kind !== 'proposed') throw new Error('expected a proposal')
  return r.proposal
}
const rows = (n: number): ClauseNeedRow[] =>
  clauseNeeds('controller', Array.from({ length: n }, (_, i) => proposed(`Insurance: version ${i + 2}.`, `2026-10-1${i}T15:00:00Z`)), [book], { approvers: APPROVERS, when: (at) => at.slice(0, 10) })
const card = (over: Partial<NeedsYouInputs>) => buildNeedsYouItems(inputs({ contractClausesEnabled: true, ...over })).find((i) => i.key === 'contract-clauses')

describe('contract-clauses (Messages, cut 4c)', () => {
  it('says the one change in the kernel’s words, under Contracts', () => {
    expect(card({ contractClauses: rows(1) })).toMatchObject({
      severity: 'amber',
      kicker: 'Contracts',
      title: 'Rosa changed clause 2 of the master agreement.',
      figure: '1',
      actionLabel: 'Review',
    })
  })

  it('counts several', () => {
    expect(card({ contractClauses: rows(3) })).toMatchObject({ title: '3 clause changes wait on your approval', figure: '3' })
  })

  it('sits in the revenue chasing tier, beside GC Follow up', () => {
    expect(NEEDS_YOU_RANK['contract-clauses']).toBe(NEEDS_YOU_RANK['gc-follow-up'])
  })

  it('shows nothing when off, loading or with nothing waiting', () => {
    expect(card({ contractClausesEnabled: false, contractClauses: rows(1) })).toBeUndefined()
    expect(card({ contractClauses: null })).toBeUndefined()
    expect(card({ contractClauses: [] })).toBeUndefined()
  })
})
