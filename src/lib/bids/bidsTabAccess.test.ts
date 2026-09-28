import { describe, expect, it } from 'vitest'
import {
  BID_WORKFLOW_TABS,
  BIDS_TABS,
  FOLLOWUP_LENS_KEYS,
  PRIMARY_BIDS_TABS,
  ROBOT_LENS_KEYS,
  SUPERINTENDENT_OFFICE_BIDS_TABS,
  bidsTabBounce,
  bidsTabOpenFor,
  canOpenBids,
  isBidWorkflowTab,
  isBidsTabKey,
  isFollowupLens,
  isRobotLens,
  resolveBidsTabRoute,
} from './bidsTabAccess'

/** Every role the app knows (hooks/useAuth `UserRole`) plus the signed-out shapes. */
const ALL_ROLES = [
  'dev',
  'master_technician',
  'assistant',
  'controller',
  'subcontractor',
  'helpers',
  'estimator',
  'primary',
  'superintendent',
  null,
  undefined,
  '',
] as const

const BIDS_ROLES = ['dev', 'master_technician', 'assistant', 'controller', 'estimator', 'primary', 'superintendent'] as const

/** The tabs a role's links stand on, in strip order. */
function openTabs(role: string): string[] {
  return BIDS_TABS.filter((t) => bidsTabOpenFor(t, role))
}

describe('bidsTabAccess — who opens the page', () => {
  it('admits the seven Bids roles and nobody else', () => {
    expect(ALL_ROLES.filter((r) => canOpenBids(r))).toEqual(['dev', 'master_technician', 'assistant', 'controller', 'estimator', 'primary', 'superintendent'])
  })
})

describe('bidsTabAccess — the tab keys and the two groups', () => {
  it('knows 26 tab keys, none twice', () => {
    expect(BIDS_TABS).toHaveLength(26)
    expect(new Set(BIDS_TABS).size).toBe(26)
  })

  it('tells a tab key from anything else', () => {
    expect(isBidsTabKey('pricing')).toBe(true)
    expect(isBidsTabKey('cost-estimate')).toBe(false)
    expect(isBidsTabKey('')).toBe(false)
    expect(isBidsTabKey(null)).toBe(false)
    expect(isBidsTabKey(undefined)).toBe(false)
  })

  it('the bid-detail strip is the nine tabs that work on one bid', () => {
    expect(BIDS_TABS.filter((t) => isBidWorkflowTab(t))).toEqual(['counts', 'takeoffs', 'labor', 'pricing', 'cover-letter', 'submittals', 'rfi', 'change-order', 'lien-release'])
    expect([...BID_WORKFLOW_TABS].every((t) => isBidsTabKey(t))).toBe(true)
    expect(isBidWorkflowTab('bid-board')).toBe(false)
    expect(isBidWorkflowTab('submission-followup')).toBe(false)
    expect(isBidWorkflowTab(null)).toBe(false)
    expect(isBidWorkflowTab('')).toBe(false)
  })

  it('the Robots group is the six robot lenses', () => {
    expect(BIDS_TABS.filter(isRobotLens)).toEqual(['robot-board', 'audits', 'robot-shadows', 'robot-queue', 'robot-scoreboard', 'robot-console'])
  })

  it('the Followup group is the six followup lenses', () => {
    expect(BIDS_TABS.filter(isFollowupLens)).toEqual(['builder-review', 'call-queue', 'submission-followup', 'why-we-lost', 'waiting-to-hear', 'job-accounts'])
  })

  it('every group key and every role list is a tab key, and the groups do not overlap', () => {
    for (const key of [...ROBOT_LENS_KEYS, ...FOLLOWUP_LENS_KEYS, ...PRIMARY_BIDS_TABS, ...SUPERINTENDENT_OFFICE_BIDS_TABS]) {
      expect(isBidsTabKey(key)).toBe(true)
    }
    expect([...ROBOT_LENS_KEYS].filter((k) => FOLLOWUP_LENS_KEYS.has(k))).toEqual([])
  })
})

describe('bidsTabAccess — the matrix: which tabs stand for which role', () => {
  const DEV_ONLY = ['robot-queue', 'robot-console']

  it('a dev opens every tab', () => {
    expect(openTabs('dev')).toEqual([...BIDS_TABS])
  })

  it('a controller opens everything but the two dev-only robot lenses', () => {
    expect(openTabs('controller')).toEqual(BIDS_TABS.filter((t) => !DEV_ONLY.includes(t)))
  })

  it('master, assistant and estimator also lose the Day book', () => {
    const expected = BIDS_TABS.filter((t) => !DEV_ONLY.includes(t) && t !== 'day-book')
    expect(openTabs('master_technician')).toEqual(expected)
    expect(openTabs('assistant')).toEqual(expected)
    expect(openTabs('estimator')).toEqual(expected)
  })

  it('a primary holds the board and the three customer-facing lenses', () => {
    expect(openTabs('primary')).toEqual(['bid-board', 'rfi', 'change-order', 'lien-release'])
  })

  it('a superintendent keeps the board, the robots, By builder, the workbench and the documents', () => {
    expect(openTabs('superintendent')).toEqual([
      'bid-board',
      'robot-board',
      'audits',
      'robot-shadows',
      'robot-scoreboard',
      'builder-review',
      'working',
      'estimators',
      'counts',
      'takeoffs',
      'labor',
      'rfi',
      'change-order',
      'lien-release',
    ])
  })

  it('a role that has not loaded yet is never bounced', () => {
    for (const tab of BIDS_TABS) {
      expect(bidsTabBounce(tab, null)).toBeNull()
      expect(bidsTabBounce(tab, undefined)).toBeNull()
    }
  })

  it('no tab, no bounce', () => {
    for (const role of BIDS_ROLES) {
      expect(bidsTabBounce(null, role)).toBeNull()
      expect(bidsTabBounce('', role)).toBeNull()
    }
  })
})

describe('bidsTabAccess — silent or announced', () => {
  it('the dev-only lenses, Day book and Bid Costs rewrite without a word', () => {
    expect(bidsTabBounce('robot-queue', 'estimator')).toBe('silent')
    expect(bidsTabBounce('robot-console', 'controller')).toBe('silent')
    expect(bidsTabBounce('day-book', 'master_technician')).toBe('silent')
    expect(bidsTabBounce('bid-costs', 'superintendent')).toBe('silent')
  })

  it('the silent gates come first: a primary on a dev-only lens, Day book or Bid Costs is not announced', () => {
    expect(bidsTabBounce('robot-queue', 'primary')).toBe('silent')
    expect(bidsTabBounce('day-book', 'primary')).toBe('silent')
    expect(bidsTabBounce('bid-costs', 'primary')).toBe('silent')
  })

  it('a primary off their four tabs is told so', () => {
    for (const tab of ['pricing', 'cover-letter', 'counts', 'builder-review', 'working', 'estimators', 'robot-board', 'audits']) {
      expect(bidsTabBounce(tab, 'primary')).toBe('announced')
    }
  })

  it('a primary is told so for a tab the page does not know, as before', () => {
    expect(bidsTabBounce('nonsense', 'primary')).toBe('announced')
    expect(bidsTabBounce('nonsense', 'superintendent')).toBeNull()
    expect(bidsTabBounce('nonsense', 'dev')).toBeNull()
  })

  it('a superintendent on an office tab is told so', () => {
    for (const tab of SUPERINTENDENT_OFFICE_BIDS_TABS) {
      expect(bidsTabBounce(tab, 'superintendent')).toBe('announced')
    }
  })
})

describe('resolveBidsTabRoute', () => {
  it('passes a plain tab through', () => {
    expect(resolveBidsTabRoute('pricing', 'dev')).toEqual({ tab: 'pricing', aliased: false, bounce: null })
  })

  it('no tab param is no tab', () => {
    expect(resolveBidsTabRoute(null, 'dev')).toEqual({ tab: null, aliased: false, bounce: null })
    expect(resolveBidsTabRoute(undefined, 'primary')).toEqual({ tab: null, aliased: false, bounce: null })
  })

  it('an unknown tab is left for the router to ignore', () => {
    expect(resolveBidsTabRoute('nonsense', 'estimator')).toEqual({ tab: 'nonsense', aliased: false, bounce: null })
  })

  it('cost-estimate lands on labor', () => {
    expect(resolveBidsTabRoute('cost-estimate', 'estimator')).toEqual({ tab: 'labor', aliased: true, bounce: null })
  })

  it('robot-shadows lands on the Robot Board', () => {
    expect(resolveBidsTabRoute('robot-shadows', 'estimator')).toEqual({ tab: 'robot-board', aliased: true, bounce: null })
  })

  it('the gates read what the alias became', () => {
    expect(resolveBidsTabRoute('cost-estimate', 'primary')).toEqual({ tab: 'labor', aliased: true, bounce: 'announced' })
    expect(resolveBidsTabRoute('robot-shadows', 'primary')).toEqual({ tab: 'robot-board', aliased: true, bounce: 'announced' })
    expect(resolveBidsTabRoute('cost-estimate', 'superintendent')).toEqual({ tab: 'labor', aliased: true, bounce: null })
  })

  it('an alias still rewrites before the role has loaded', () => {
    expect(resolveBidsTabRoute('cost-estimate', null)).toEqual({ tab: 'labor', aliased: true, bounce: null })
  })
})
