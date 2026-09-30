import { describe, expect, it } from 'vitest'
import { bidsTabOpenFor, isBidsTabKey, isFollowupLens, isRobotLens } from './bidsTabAccess'
import { followupLensCaption, followupLenses, followupNeedsReasonChipShows, robotLensBarShows, robotLensCaption, robotLenses } from './bidsLenses'

const BIDS_ROLES = ['dev', 'master_technician', 'assistant', 'controller', 'estimator', 'primary', 'superintendent'] as const

const robotKeys = (role: string | null, activeTab = 'robot-board') =>
  robotLenses({ role, activeTab, mirrorCount: null, auditsPending: 0 }).map((l) => l.key)
const followupKeys = (role: string | null) => followupLenses({ role, jobAccountsMissing: 0 }).map((l) => l.key)

describe('robotLensBarShows', () => {
  it('draws when more than one lens has something to show', () => {
    expect(robotLensBarShows({ robotBidCount: 3, anyAudits: true, role: 'superintendent' })).toBe(true)
    expect(robotLensBarShows({ robotBidCount: 3, anyAudits: false, role: 'estimator' })).toBe(true)
    expect(robotLensBarShows({ robotBidCount: 0, anyAudits: true, role: 'dev' })).toBe(true)
  })

  it('stays away when only one does', () => {
    expect(robotLensBarShows({ robotBidCount: 3, anyAudits: false, role: 'superintendent' })).toBe(false)
    expect(robotLensBarShows({ robotBidCount: 0, anyAudits: true, role: 'primary' })).toBe(false)
    expect(robotLensBarShows({ robotBidCount: 0, anyAudits: false, role: 'dev' })).toBe(false)
    expect(robotLensBarShows({ robotBidCount: 0, anyAudits: false, role: null })).toBe(false)
  })
})

describe('robotLenses — who sees which pill', () => {
  it('everyone gets the Robot Board and Audits', () => {
    expect(robotKeys('superintendent')).toEqual(['robot-board', 'audits'])
    expect(robotKeys('primary')).toEqual(['robot-board', 'audits'])
    expect(robotKeys(null)).toEqual(['robot-board', 'audits'])
  })

  it('the audit roles add the Scoreboard', () => {
    for (const role of ['master_technician', 'assistant', 'controller', 'estimator']) {
      expect(robotKeys(role)).toEqual(['robot-board', 'audits', 'robot-scoreboard'])
    }
  })

  it('a dev adds the Console', () => {
    expect(robotKeys('dev')).toEqual(['robot-board', 'audits', 'robot-scoreboard', 'robot-console'])
  })

  it('the Queue pill draws only for a dev while the Queue is open, before the Console', () => {
    expect(robotKeys('dev', 'robot-queue')).toEqual(['robot-board', 'audits', 'robot-scoreboard', 'robot-queue', 'robot-console'])
    expect(robotKeys('estimator', 'robot-queue')).toEqual(['robot-board', 'audits', 'robot-scoreboard'])
  })

  it('the dev pills carry the DEV mark, the others none', () => {
    const lenses = robotLenses({ role: 'dev', activeTab: 'robot-queue', mirrorCount: null, auditsPending: 0 })
    expect(lenses.filter((l) => l.badge).map((l) => [l.key, l.badge])).toEqual([
      ['robot-queue', { text: 'DEV', tone: 'dev' }],
      ['robot-console', { text: 'DEV', tone: 'dev' }],
    ])
  })

  it('the Robot Board says how many it mirrors once it knows', () => {
    expect(robotLenses({ role: 'dev', activeTab: 'audits', mirrorCount: null, auditsPending: 0 })[0]!.label).toBe('Robot Board')
    expect(robotLenses({ role: 'dev', activeTab: 'audits', mirrorCount: 0, auditsPending: 0 })[0]!.label).toBe('Robot Board · 0')
    expect(robotLenses({ role: 'dev', activeTab: 'audits', mirrorCount: 12, auditsPending: 0 })[0]!.label).toBe('Robot Board · 12')
  })

  it('Audits says how many are pending, and nothing at zero', () => {
    expect(robotLenses({ role: 'dev', activeTab: 'audits', mirrorCount: null, auditsPending: 0 })[1]!.label).toBe('Audits')
    expect(robotLenses({ role: 'dev', activeTab: 'audits', mirrorCount: null, auditsPending: 4 })[1]!.label).toBe('Audits · 4')
  })

  it('every pill is a Robots-group tab with a tooltip', () => {
    for (const lens of robotLenses({ role: 'dev', activeTab: 'robot-queue', mirrorCount: 1, auditsPending: 1 })) {
      expect(isRobotLens(lens.key)).toBe(true)
      expect(lens.title).toBeTruthy()
    }
  })

  it('no pill opens a tab the router would turn the role away from', () => {
    for (const role of BIDS_ROLES.filter((r) => r !== 'primary')) {
      for (const lens of robotLenses({ role, activeTab: 'robot-queue', mirrorCount: null, auditsPending: 0 })) {
        expect(bidsTabOpenFor(lens.key, role)).toBe(true)
      }
    }
  })
})

describe('followupLenses — who sees which pill', () => {
  it('the office gets all six, the Call queue first', () => {
    for (const role of ['dev', 'master_technician', 'assistant', 'controller', 'estimator']) {
      expect(followupKeys(role)).toEqual(['call-queue', 'builder-review', 'submission-followup', 'why-we-lost', 'waiting-to-hear', 'job-accounts'])
    }
  })

  it('a superintendent keeps By builder alone, with no "Old:" before it', () => {
    expect(followupLenses({ role: 'superintendent', jobAccountsMissing: 5 })).toEqual([{ key: 'builder-review', label: 'By builder' }])
  })

  it('the bar keeps its own rule for a primary and a role not loaded yet: all six', () => {
    expect(followupKeys('primary')).toHaveLength(6)
    expect(followupKeys(null)).toHaveLength(6)
  })

  it('"Old:" sits before By builder', () => {
    const lenses = followupLenses({ role: 'estimator', jobAccountsMissing: 0 })
    expect(lenses.filter((l) => l.leadIn).map((l) => [l.key, l.leadIn])).toEqual([['builder-review', 'Old:']])
  })

  it('the Call queue is marked new', () => {
    expect(followupLenses({ role: 'estimator', jobAccountsMissing: 0 })[0]!.badge).toEqual({ text: 'new', tone: 'new' })
  })

  it('Job accounts counts what is missing, and carries no badge at zero', () => {
    const at = (n: number) => followupLenses({ role: 'estimator', jobAccountsMissing: n }).find((l) => l.key === 'job-accounts')!
    expect(at(0).badge).toBeUndefined()
    expect('badge' in at(0)).toBe(false)
    expect(at(7).badge).toEqual({ text: '7', tone: 'count' })
    expect(at(7).testId).toBe('followup-job-accounts-tab')
  })

  it('every pill is a Followup-group tab', () => {
    for (const lens of followupLenses({ role: 'dev', jobAccountsMissing: 1 })) {
      expect(isBidsTabKey(lens.key)).toBe(true)
      expect(isFollowupLens(lens.key)).toBe(true)
    }
  })

  it('no pill opens a tab the router would turn an office role or a superintendent away from', () => {
    for (const role of BIDS_ROLES.filter((r) => r !== 'primary')) {
      for (const lens of followupLenses({ role, jobAccountsMissing: 0 })) {
        expect(bidsTabOpenFor(lens.key, role)).toBe(true)
      }
    }
  })
})

describe('followupNeedsReasonChipShows', () => {
  it('shows for the office while a lost bid has no reason', () => {
    expect(followupNeedsReasonChipShows({ role: 'estimator', activeTab: 'call-queue', lostNeedingReason: 2 })).toBe(true)
  })

  it('hides at zero, on the Why we lost lens, and for a superintendent', () => {
    expect(followupNeedsReasonChipShows({ role: 'estimator', activeTab: 'call-queue', lostNeedingReason: 0 })).toBe(false)
    expect(followupNeedsReasonChipShows({ role: 'estimator', activeTab: 'why-we-lost', lostNeedingReason: 2 })).toBe(false)
    expect(followupNeedsReasonChipShows({ role: 'superintendent', activeTab: 'builder-review', lostNeedingReason: 2 })).toBe(false)
  })
})

describe('followupLensCaption', () => {
  it('says what each lens is for', () => {
    expect(followupLensCaption('call-queue')).toMatch(/^One queue/)
    expect(followupLensCaption('builder-review')).toMatch(/every builder/)
    expect(followupLensCaption('submission-followup')).toMatch(/^The status tables/)
    expect(followupLensCaption('why-we-lost')).toMatch(/why bids were lost/)
    expect(followupLensCaption('job-accounts')).toMatch(/supply-house account/)
    expect(followupLensCaption('waiting-to-hear')).toMatch(/^Chase recent sent bids/)
  })

  it('six lenses, six different lines', () => {
    const keys = followupLenses({ role: 'dev', jobAccountsMissing: 0 }).map((l) => l.key)
    expect(new Set(keys.map(followupLensCaption)).size).toBe(6)
  })
})

describe('robotLensCaption (v2.4256)', () => {
  it('says what each lens is for, the Audits line leading with the questions', () => {
    expect(robotLensCaption('audits')).toMatch(/^Teach the robots — answer their questions, then judge their drafts/)
    expect(robotLensCaption('robot-scoreboard')).toMatch(/by kind of job/)
    expect(robotLensCaption('robot-board')).toMatch(/^Our bids seen through the robots/)
    expect(robotLensCaption('robot-queue')).toMatch(/^Dev only/)
    expect(robotLensCaption('robot-console')).toMatch(/^Dev only/)
    expect(robotLensCaption('robot-shadows')).toBe(robotLensCaption('robot-board'))
  })
})
