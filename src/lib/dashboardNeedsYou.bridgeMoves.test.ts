import { describe, expect, it } from 'vitest'
import { myMovesNeed, parseMyMoves } from './bridge/callPeople'
import { NEEDS_YOU_RANK, buildNeedsYouItems, type NeedsYouInputs } from './dashboardNeedsYou'
import { NEEDS_YOU_ITEM_ACTOR } from './needsYouActor'
import { needsYouDoor, needsYouSecondaryDoor } from './needsYouDoors'
import { needsYouSourceEnabled } from './needsYouSources'
import { plainWordsFailures } from './plainWords'

/**
 * The week's call (v2.6864, punch list #303 PR 4): the Needs you line for the Bridge's moves that carry the viewer's
 * own account, as `useBridgeMoves` hands it in. Its own file, as the While you were off line has. Made-up moves.
 */
function inputs(overrides: Partial<NeedsYouInputs> = {}): NeedsYouInputs {
  return {
    role: 'assistant',
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

const rows = [
  { call_id: 'c1', called_by_name: 'Sam', link: 'bill', idx: 0, move_key: 'bill', title: 'Bill the 11 finished jobs.' },
  { call_id: 'c1', called_by_name: 'Sam', link: 'bill', idx: 2, move_key: 'other', title: 'Take bank sorting off whoever bills.' },
]
const two = myMovesNeed(parseMyMoves(rows))
const noPage = myMovesNeed(parseMyMoves(rows.slice(1)))
const line = (over: Partial<NeedsYouInputs>) => buildNeedsYouItems(inputs({ bridgeMovesEnabled: true, ...over })).find((i) => i.key === 'bridge-moves')

describe('bridge-moves (v2.6864, punch list #303 PR 4)', () => {
  it('is one line on the viewer’s first move: its page on the button, Done beside it', () => {
    expect(line({ bridgeMoves: two })).toMatchObject({
      severity: 'amber',
      kicker: 'The week’s call',
      title: 'Bill the 11 finished jobs.',
      detail: 'Sam put it on the week’s call. One more move is yours after it.',
      figure: '2',
      actionLabel: 'Open Stages',
      secondary: [{ key: 'done', label: 'Done' }],
    })
  })

  it('makes Done the button when the app has no page for the move', () => {
    const item = line({ bridgeMoves: noPage })!
    expect(item).toMatchObject({ title: 'Take bank sorting off whoever bills.', figure: '1', actionLabel: 'Mark it done' })
    expect(item.secondary).toBeUndefined()
  })

  it('is silent while off, with no move, and before the migration is pushed', () => {
    expect(line({ bridgeMovesEnabled: false, bridgeMoves: two })).toBeUndefined()
    expect(line({ bridgeMoves: null })).toBeUndefined()
    expect(line({ bridgeMoves: myMovesNeed([]) })).toBeUndefined()
  })

  it('sits with the week’s hard deadline, is the viewer’s own line, and is on for anyone signed in on both hosts', () => {
    expect(NEEDS_YOU_RANK['bridge-moves']).toBe(NEEDS_YOU_RANK['gc-review-weekly'])
    expect(NEEDS_YOU_ITEM_ACTOR['bridge-moves']).toBe('anyone')
    for (const role of ['dev', 'master_technician', 'assistant', 'controller', 'estimator', 'primary', 'helpers'] as const) {
      expect(needsYouSourceEnabled('bridgeMoves', role, 'dashboard')).toBe(true)
      expect(needsYouSourceEnabled('bridgeMoves', role, 'quickfill')).toBe(true)
    }
    expect(needsYouSourceEnabled('bridgeMoves', null, 'dashboard')).toBe(false)
  })

  it('opens the page where the move is done, and marks it done from the link or from a button with no page', () => {
    expect(needsYouDoor({ key: 'bridge-moves' }, { role: 'assistant', bridgeMoveDoor: '/jobs?tab=stages' }, 'dashboard')).toEqual({ kind: 'href', href: '/jobs?tab=stages' })
    expect(needsYouDoor({ key: 'bridge-moves' }, { role: 'assistant', bridgeMoveDoor: null }, 'quickfill')).toEqual({ kind: 'bridge-move-done' })
    expect(needsYouSecondaryDoor({ key: 'bridge-moves' }, 'done')).toEqual({ kind: 'bridge-move-done' })
    expect(needsYouSecondaryDoor({ key: 'bridge-moves' }, 'snooze')).toBeNull()
  })

  it('writes plain words', () => {
    for (const n of [two, noPage]) {
      const item = line({ bridgeMoves: n })!
      for (const w of [item.kicker, item.detail, item.actionLabel]) expect(plainWordsFailures(w), w).toEqual([])
    }
  })
})
