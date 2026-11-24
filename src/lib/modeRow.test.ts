import { describe, expect, it } from 'vitest'
import {
  MODE_ROW_PULL_PX,
  MODE_ROW_THIRDS,
  MODE_ROW_WORDS,
  modeRowDraw,
  modeRowDrawnHere,
  modeRowHeldOpen,
  modeRowLandingPath,
  modeRowOfferedToRole,
  modeRowOnPage,
  modeRowPressWrites,
  modeRowPull,
  modeRowThirdOn,
  type ModeRowThird,
} from './modeRow'
import { applyPageModeWrites, pageModeWrites, resolvePageMode, type PageMode, type PageModeWants } from './pageMode'

const ALL_ROLES = ['dev', 'master_technician', 'assistant', 'controller', 'subcontractor', 'helpers', 'estimator', 'primary', 'superintendent']
/** The estimator's first page is Bids, so the row has no page of the estimator's to sit on. */
const ROW_ROLES = ALL_ROLES.filter((role) => role !== 'estimator')

/** What the page mode's door does with a press of a third: each write goes through `pageModeWrites`, as `usePageMode.set` does. */
function press(role: string, wants: PageModeWants, third: ModeRowThird): PageModeWants {
  let next = wants
  for (const w of modeRowPressWrites(third)) next = applyPageModeWrites(next, pageModeWrites(role, wants, w.key, w.on))
  return next
}

describe('who gets the row, and where', () => {
  it('is offered to every role whose first page is the Dashboard: all nine but the estimator', () => {
    expect(ROW_ROLES).toHaveLength(8)
    for (const role of ALL_ROLES) expect(modeRowOfferedToRole(role), role).toBe(ROW_ROLES.includes(role))
    expect(modeRowOfferedToRole('estimator')).toBe(false)
    expect(modeRowOfferedToRole(null)).toBe(false)
    expect(modeRowOfferedToRole(undefined)).toBe(false)
    expect(modeRowOfferedToRole('nobody')).toBe(false)
  })

  it('is on the Dashboard in every mode, and on the checklist only in Task Mode', () => {
    for (const mode of ['task', 'job', 'dispatch', 'full'] as PageMode[]) {
      expect(modeRowOnPage('/dashboard', mode), mode).toBe(true)
      expect(modeRowOnPage('/dashboard/', mode), mode).toBe(true)
      expect(modeRowOnPage('/jobs', mode), mode).toBe(false)
      expect(modeRowOnPage('/job-mode/schedule', mode), mode).toBe(false)
      expect(modeRowOnPage('/checklist', mode), mode).toBe(mode === 'task')
    }
  })
})

describe('the thirds', () => {
  it('reads Task Mode, Dashboard, Job Mode from left to right', () => {
    expect(MODE_ROW_THIRDS.map((t) => MODE_ROW_WORDS.thirds[t])).toEqual(['Task Mode', 'Dashboard', 'Job Mode'])
  })

  it('fills the third of the mode drawn, and Dispatch Mode reads as the Dashboard', () => {
    expect(modeRowThirdOn('task')).toBe('task')
    expect(modeRowThirdOn('job')).toBe('job')
    expect(modeRowThirdOn('full')).toBe('full')
    expect(modeRowThirdOn('dispatch')).toBe('full')
  })

  it('lands a press on the mode it names, from every state the three toggles can be in', () => {
    for (const role of ROW_ROLES) {
      for (const task of [false, true]) for (const job of [false, true]) for (const dispatch of [false, true]) {
        const wants: PageModeWants = { task, job, dispatch }
        const label = `${role} ${JSON.stringify(wants)}`
        expect(resolvePageMode(press(role, wants, 'task')), label).toBe('task')
        expect(resolvePageMode(press(role, wants, 'job')), label).toBe('job')
        // The middle third: no mode on top. Dispatch Mode, where it was on, is what is left.
        expect(resolvePageMode(press(role, wants, 'full')), label).toBe(dispatch ? 'dispatch' : 'full')
      }
    }
  })

  it('never writes Dispatch Mode', () => {
    for (const third of MODE_ROW_THIRDS) expect(modeRowPressWrites(third).some((w) => w.key === 'dispatch'), third).toBe(false)
  })

  it('goes to the Dashboard from the checklist, and stays put on the Dashboard', () => {
    expect(modeRowLandingPath('full', '/checklist')).toBe('/dashboard')
    expect(modeRowLandingPath('job', '/checklist')).toBe('/dashboard')
    expect(modeRowLandingPath('full', '/dashboard')).toBeNull()
    expect(modeRowLandingPath('job', '/dashboard/')).toBeNull()
    // Task Mode's own bounce sends every page to the checklist.
    expect(modeRowLandingPath('task', '/dashboard')).toBeNull()
  })
})

describe('when the row shows', () => {
  const leader = { role: 'master_technician', pathname: '/dashboard', mode: 'dispatch' as PageMode, phone: true }

  it('is not drawn for the estimator or on another page', () => {
    expect(modeRowDraw({ ...leader, role: 'estimator' })).toBe('none')
    expect(modeRowDraw({ ...leader, pathname: '/jobs' })).toBe('none')
  })

  it('is not drawn past a phone’s width for any role, in any mode', () => {
    for (const role of ALL_ROLES) {
      expect(modeRowDrawnHere(role, false), role).toBe(false)
      for (const mode of ['full', 'dispatch', 'job', 'task'] as PageMode[]) {
        for (const pathname of ['/dashboard', '/checklist']) {
          expect(modeRowDraw({ role, pathname, mode, phone: false }), `${role} ${mode} ${pathname}`).toBe('none')
        }
      }
    }
  })

  it('on a phone it is the door for every role it is offered to', () => {
    for (const role of ALL_ROLES) expect(modeRowDrawnHere(role, true), role).toBe(modeRowOfferedToRole(role))
    expect(modeRowDrawnHere('estimator', true)).toBe(false)
    expect(modeRowDrawnHere(null, true)).toBe(false)
  })

  it('is counted on the Dashboard, for every role with the row, in every mode drawn there', () => {
    for (const role of ROW_ROLES) {
      for (const mode of ['full', 'dispatch', 'job'] as PageMode[]) {
        expect(modeRowDraw({ role, pathname: '/dashboard', mode, phone: true }), `${role} ${mode}`).toBe('counted')
      }
    }
  })

  it('is held in Task Mode, where it is the way out, on the checklist and on the Dashboard', () => {
    expect(modeRowHeldOpen('task')).toBe(true)
    for (const role of ROW_ROLES) {
      expect(modeRowDraw({ role, pathname: '/checklist', mode: 'task', phone: true }), role).toBe('held')
      expect(modeRowDraw({ role, pathname: '/dashboard', mode: 'task', phone: true }), role).toBe('held')
    }
  })

  it('holds for nobody else: a sub or a helper off Job Mode gets the same five seconds as everyone', () => {
    for (const mode of ['full', 'dispatch', 'job'] as PageMode[]) expect(modeRowHeldOpen(mode), mode).toBe(false)
    for (const role of ['subcontractor', 'helpers']) {
      expect(modeRowDraw({ role, pathname: '/dashboard', mode: 'full', phone: true }), role).toBe('counted')
      expect(modeRowDraw({ role, pathname: '/dashboard', mode: 'job', phone: true }), role).toBe('counted')
    }
  })
})

describe('the pull', () => {
  const start = { startX: 100, startY: 200 }

  it('brings the row down once the finger has gone far enough at the top of the page', () => {
    expect(modeRowPull({ ...start, x: 100, y: 200 + MODE_ROW_PULL_PX - 1, scrollTop: 0 })).toBe('wait')
    expect(modeRowPull({ ...start, x: 104, y: 200 + MODE_ROW_PULL_PX, scrollTop: 0 })).toBe('pull')
  })

  it('is not a pull when the page is not at its top', () => {
    expect(modeRowPull({ ...start, x: 100, y: 300, scrollTop: 1 })).toBe('cancel')
  })

  it('is not a pull when the finger goes up or sideways', () => {
    expect(modeRowPull({ ...start, x: 100, y: 180, scrollTop: 0 })).toBe('cancel')
    expect(modeRowPull({ ...start, x: 160, y: 210, scrollTop: 0 })).toBe('cancel')
    // A little sideways drift on the way down is still a pull.
    expect(modeRowPull({ ...start, x: 115, y: 240, scrollTop: 0 })).toBe('pull')
  })
})
