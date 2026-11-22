import { describe, expect, it } from 'vitest'
import {
  PHONE_BAR_MAX_HEIGHT_PX,
  PHONE_BAR_ORDER,
  PHONE_BAR_PAD_Y_PX,
  PHONE_BAR_PRESS_NAMES,
  PHONE_BAR_PRESS_PX,
  PHONE_DAY_PRESS_COMPACT_MIN_PX,
  PHONE_DAY_PRESS_ROW_PX,
  PHONE_TABS_MIN_HEIGHT_PX,
  phoneBarPageName,
  phoneBarPlan,
  phoneBarWhere,
  type PhoneBarPress,
} from './phoneBar'
import { PATH_TO_LABEL } from '../pinnedTabs'

/** Every subset of the old row's presses, so the rule is held for rows no role has yet. */
function everyRow(): PhoneBarPress[][] {
  const rows: PhoneBarPress[][] = []
  for (let mask = 0; mask < 1 << PHONE_BAR_ORDER.length; mask++) {
    rows.push(PHONE_BAR_ORDER.filter((_, i) => mask & (1 << i)))
  }
  return rows
}

/** The rows the app draws today, by who is signed in and which mode is on. */
const HELPER_JOB_MODE: PhoneBarPress[] = ['home', 'search', 'tell-the-dev', 'call-office', 'task-dispatch', 'ask-estimating', 'task', 'gear']
const LEADER: PhoneBarPress[] = ['menu', 'home', 'search', 'tell-the-dev', 'task-dispatch', 'ask-estimating', 'task', 'people', 'gear']
const SUPERINTENDENT: PhoneBarPress[] = ['menu', 'home', 'search', 'tell-the-dev', 'gear']
const ASSISTANT: PhoneBarPress[] = ['menu', 'home', 'search', 'tell-the-dev', 'task-dispatch', 'ask-estimating', 'task', 'customers', 'people', 'gear']

describe('phoneBarPlan: nothing is dropped', () => {
  it('sorts every press of every possible row into exactly one place', () => {
    for (const row of everyRow()) {
      for (const dashboardTab of [true, false]) {
        const plan = phoneBarPlan(row, { dashboardTab })
        const placed = [...plan.bar, ...plan.gearRows, ...plan.onTabs]
        expect(placed.slice().sort()).toEqual(row.slice().sort())
        expect(new Set(placed).size).toBe(placed.length)
        for (const press of row) expect(phoneBarWhere(plan, press)).not.toBeNull()
      }
    }
  })

  it('keeps the old row’s order in the bar and in the gear menu', () => {
    const plan = phoneBarPlan(ASSISTANT, { dashboardTab: false })
    const at = (p: PhoneBarPress) => PHONE_BAR_ORDER.indexOf(p)
    expect(plan.bar.map(at)).toEqual(plan.bar.map(at).slice().sort((a, b) => a - b))
    expect(plan.gearRows.map(at)).toEqual(plan.gearRows.map(at).slice().sort((a, b) => a - b))
  })

  it('reads a row handed over out of order in the old row’s order', () => {
    const shuffled: PhoneBarPress[] = ['gear', 'task', 'menu', 'tell-the-dev', 'search']
    expect(phoneBarPlan(shuffled, { dashboardTab: false })).toEqual({ bar: ['menu', 'search', 'gear'], gearRows: ['tell-the-dev', 'task'], onTabs: [] })
  })
})

describe('phoneBarPlan: the one-row bar', () => {
  it('a helper in Job Mode: Search, the green phone and the gear stay, home is the Dashboard tab', () => {
    const plan = phoneBarPlan(HELPER_JOB_MODE, { dashboardTab: true })
    expect(plan.bar).toEqual(['search', 'call-office', 'gear'])
    expect(plan.gearRows).toEqual(['tell-the-dev', 'task-dispatch', 'ask-estimating', 'task'])
    expect(plan.onTabs).toEqual(['home'])
    expect(phoneBarWhere(plan, 'home')).toBe('Dashboard tab')
  })

  it('a helper with Job Mode off has no tabs, so home stays in the bar', () => {
    const row = HELPER_JOB_MODE.filter((p) => p !== 'call-office')
    const plan = phoneBarPlan(row, { dashboardTab: false })
    expect(plan.bar).toEqual(['home', 'search', 'gear'])
    expect(plan.onTabs).toEqual([])
  })

  it('a leader: the menu and home at the left, and People joins the gear’s rows', () => {
    const plan = phoneBarPlan(LEADER, { dashboardTab: false })
    expect(plan.bar).toEqual(['menu', 'home', 'search', 'gear'])
    expect(plan.gearRows).toEqual(['tell-the-dev', 'task-dispatch', 'ask-estimating', 'task', 'people'])
  })

  it('a leader in Job Mode: the menu stays, home is the tab, the phone stays', () => {
    const plan = phoneBarPlan([...LEADER, 'call-office'], { dashboardTab: true })
    expect(plan.bar).toEqual(['menu', 'search', 'call-office', 'gear'])
    expect(plan.onTabs).toEqual(['home'])
  })

  it('a superintendent: only the wrench moves', () => {
    const plan = phoneBarPlan(SUPERINTENDENT, { dashboardTab: false })
    expect(plan.bar).toEqual(['menu', 'home', 'search', 'gear'])
    expect(plan.gearRows).toEqual(['tell-the-dev'])
  })

  it('an assistant: Customers and People move, in the row’s order', () => {
    const plan = phoneBarPlan(ASSISTANT, { dashboardTab: false })
    expect(plan.gearRows).toEqual(['tell-the-dev', 'task-dispatch', 'ask-estimating', 'task', 'customers', 'people'])
  })

  it('a partner’s Statement is a gear row, first', () => {
    const plan = phoneBarPlan(['home', 'statement', 'search', 'tell-the-dev', 'gear'], { dashboardTab: false })
    expect(plan.gearRows).toEqual(['statement', 'tell-the-dev'])
  })

  it('the Bids page keeps its Bid press in the bar', () => {
    const plan = phoneBarPlan([...LEADER, 'new-bid'], { dashboardTab: false })
    expect(plan.bar).toEqual(['menu', 'home', 'search', 'new-bid', 'gear'])
  })

  it('a row with no gear (the role dock) keeps every press: there is no menu to move one to', () => {
    const dock: PhoneBarPress[] = ['home', 'search', 'tell-the-dev', 'task-dispatch', 'ask-estimating', 'task']
    for (const dashboardTab of [true, false]) {
      expect(phoneBarPlan(dock, { dashboardTab })).toEqual({ bar: dock, gearRows: [], onTabs: [] })
    }
  })

  it('names every press', () => {
    for (const press of PHONE_BAR_ORDER) expect(PHONE_BAR_PRESS_NAMES[press]).toBeTruthy()
    expect(PHONE_BAR_PRESS_NAMES['ask-estimating']).toBe('Ask estimating')
    expect(PHONE_BAR_PRESS_NAMES['task-dispatch']).toBe('Task Dispatch')
  })
})

describe('the bars’ sizes', () => {
  it('the top bar is 52 px or less with 44 px presses', () => {
    expect(PHONE_BAR_PRESS_PX).toBeGreaterThanOrEqual(44)
    // The presses, the room above and below, and the 1 px line under the row.
    expect(PHONE_BAR_PAD_Y_PX * 2 + PHONE_BAR_PRESS_PX + 1).toBeLessThanOrEqual(PHONE_BAR_MAX_HEIGHT_PX)
  })

  it('the three bars total 175 px or less on a phone with no inset', () => {
    const top = PHONE_BAR_PAD_Y_PX * 2 + PHONE_BAR_PRESS_PX + 1
    // The press bar: 6 px above and below its one row, and a 1 px line on each edge.
    const presses = 6 + PHONE_DAY_PRESS_ROW_PX + 6 + 2
    const tabs = PHONE_TABS_MIN_HEIGHT_PX + 1
    expect(top + presses + tabs).toBeLessThanOrEqual(175)
    expect(PHONE_TABS_MIN_HEIGHT_PX).toBeGreaterThanOrEqual(52)
    expect(PHONE_DAY_PRESS_COMPACT_MIN_PX).toBeGreaterThanOrEqual(44)
    expect(PHONE_DAY_PRESS_ROW_PX).toBeGreaterThanOrEqual(PHONE_DAY_PRESS_COMPACT_MIN_PX)
  })
})

describe('phoneBarPageName', () => {
  it('names the pages a crew opens', () => {
    expect(phoneBarPageName('/dashboard')).toBe('Dashboard')
    expect(phoneBarPageName('/')).toBe('Dashboard')
    expect(phoneBarPageName('')).toBe('Dashboard')
    expect(phoneBarPageName('/checklist')).toBe('Checklist')
    expect(phoneBarPageName('/tally')).toBe('Tally')
    expect(phoneBarPageName('/calendar')).toBe('Calendar')
  })

  it('names Job Mode’s pages by the tab lit under them', () => {
    expect(phoneBarPageName('/job-mode/schedule')).toBe('Schedule')
    expect(phoneBarPageName('/job-mode/inbox')).toBe('Inbox')
    expect(phoneBarPageName('/job-mode/customers')).toBe('Customers')
  })

  it('names the office pages', () => {
    expect(phoneBarPageName('/jobs')).toBe('Jobs')
    expect(phoneBarPageName('/schedule-dispatch')).toBe('Schedule')
    expect(phoneBarPageName('/accounts-receivable')).toBe('Accounts receivable')
    expect(phoneBarPageName('/bridge')).toBe('The Bridge')
    expect(phoneBarPageName('/gc')).toBe('GC projects')
    expect(phoneBarPageName('/my-statement')).toBe('Statement')
  })

  it('names a page under another by its own page', () => {
    expect(phoneBarPageName('/customers/abc-123')).toBe('Customers')
    expect(phoneBarPageName('/estimates/abc-123')).toBe('Estimates')
    expect(phoneBarPageName('/training/ladder-safety')).toBe('Training')
    expect(phoneBarPageName('/m/AB12')).toBe('Machine')
    expect(phoneBarPageName('/first-look/abc')).toBe('First look')
  })

  it('agrees with a pin’s words for Dispatch Mode’s pages', () => {
    for (const path of ['/dispatch-mode', '/dispatch-mode/schedule', '/dispatch-mode/inbox', '/dispatch-mode/customers', '/dispatch-mode/po']) {
      expect(phoneBarPageName(path)).toBe(PATH_TO_LABEL[path])
    }
  })

  it('writes out a page it has no name for, so a new page still reads as words', () => {
    expect(phoneBarPageName('/some-new-page')).toBe('Some new page')
    expect(phoneBarPageName('/some_new_page/deeper')).toBe('Some new page')
  })
})
