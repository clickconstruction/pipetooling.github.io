import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  MODE_ROW_FIRST_VISITS,
  MODE_ROW_NO_MEMORY,
  MODE_ROW_PULL_PX,
  MODE_ROW_THIRDS,
  MODE_ROW_WORDS,
  modeRowCountOpen,
  modeRowDraw,
  modeRowFirstVisits,
  modeRowHeldOpen,
  modeRowLandingPath,
  modeRowNewMark,
  modeRowOfferedToRole,
  modeRowOnPage,
  modeRowOpensKey,
  modeRowPressWrites,
  modeRowPressedKey,
  modeRowPull,
  modeRowThirdOn,
  parseModeRowMemory,
  readModeRowMemory,
  writeModeRowMemory,
  type ModeRowMemory,
  type ModeRowThird,
} from './modeRow'
import { applyPageModeWrites, pageModeWrites, resolvePageMode, type PageMode, type PageModeWants } from './pageMode'

const ALL_ROLES = ['dev', 'master_technician', 'assistant', 'controller', 'subcontractor', 'helpers', 'estimator', 'primary', 'superintendent']
const FIELD_ROLES = ['master_technician', 'superintendent', 'subcontractor', 'helpers']
const USED: ModeRowMemory = { pressed: true, opens: 2 }

/** What the page mode's door does with a press of a third: each write goes through `pageModeWrites`, as `usePageMode.set` does. */
function press(role: string, wants: PageModeWants, third: ModeRowThird): PageModeWants {
  let next = wants
  for (const w of modeRowPressWrites(third)) next = applyPageModeWrites(next, pageModeWrites(role, wants, w.key, w.on))
  return next
}

describe('who gets the row, and where', () => {
  it('is offered to the four field roles and to nobody else', () => {
    for (const role of ALL_ROLES) expect(modeRowOfferedToRole(role), role).toBe(FIELD_ROLES.includes(role))
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
    for (const role of FIELD_ROLES) {
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
  const leader = { role: 'master_technician', pathname: '/dashboard', mode: 'dispatch' as PageMode, phone: true, shownNow: false }

  it('is not drawn for another role or on another page', () => {
    expect(modeRowDraw({ ...leader, role: 'assistant', memory: MODE_ROW_NO_MEMORY })).toBe('none')
    expect(modeRowDraw({ ...leader, pathname: '/jobs', memory: MODE_ROW_NO_MEMORY })).toBe('none')
  })

  it('always shows on a desk', () => {
    expect(modeRowDraw({ ...leader, phone: false, memory: USED })).toBe('row')
  })

  it('shows on the first visits, then tucks', () => {
    for (let opens = 1; opens <= MODE_ROW_FIRST_VISITS; opens++) {
      expect(modeRowDraw({ ...leader, memory: { pressed: false, opens } }), String(opens)).toBe('row')
    }
    expect(modeRowDraw({ ...leader, memory: { pressed: false, opens: MODE_ROW_FIRST_VISITS + 1 } })).toBe('tucked')
  })

  it('tucks from the first open after a third was pressed', () => {
    expect(modeRowFirstVisits({ pressed: true, opens: 1 })).toBe(false)
    expect(modeRowDraw({ ...leader, memory: { pressed: true, opens: 1 } })).toBe('tucked')
  })

  it('shows once it is brought down, whatever the memory', () => {
    expect(modeRowDraw({ ...leader, shownNow: true, memory: USED })).toBe('row')
  })

  it('holds open in Task Mode, where it is the way out', () => {
    for (const role of FIELD_ROLES) {
      expect(modeRowHeldOpen(role, 'task'), role).toBe(true)
      expect(modeRowDraw({ role, pathname: '/checklist', mode: 'task', phone: true, shownNow: false, memory: USED }), role).toBe('row')
    }
  })

  it('holds open for a sub or a helper who is off Job Mode, and tucks once they are back on it', () => {
    for (const role of ['subcontractor', 'helpers']) {
      expect(modeRowDraw({ role, pathname: '/dashboard', mode: 'full', phone: true, shownNow: false, memory: USED }), role).toBe('row')
      expect(modeRowDraw({ role, pathname: '/dashboard', mode: 'job', phone: true, shownNow: false, memory: USED }), role).toBe('tucked')
    }
    // A leader's Dashboard is their own first screen: nothing to hold.
    expect(modeRowHeldOpen('master_technician', 'full')).toBe(false)
    expect(modeRowHeldOpen('superintendent', 'dispatch')).toBe(false)
  })

  it('marks Job Mode as new until a third is pressed, and never once Job Mode is on', () => {
    expect(modeRowNewMark('job', 'full', MODE_ROW_NO_MEMORY)).toBe(true)
    expect(modeRowNewMark('job', 'dispatch', MODE_ROW_NO_MEMORY)).toBe(true)
    expect(modeRowNewMark('job', 'job', MODE_ROW_NO_MEMORY)).toBe(false)
    expect(modeRowNewMark('job', 'full', USED)).toBe(false)
    expect(modeRowNewMark('task', 'full', MODE_ROW_NO_MEMORY)).toBe(false)
    expect(modeRowNewMark('full', 'job', MODE_ROW_NO_MEMORY)).toBe(false)
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

describe("the phone's memory of the row", () => {
  let store: Map<string, string>
  let prev: unknown
  beforeEach(() => {
    store = new Map()
    const fake = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    }
    prev = (globalThis as Record<string, unknown>).localStorage
    ;(globalThis as Record<string, unknown>).localStorage = fake
  })
  afterEach(() => {
    ;(globalThis as Record<string, unknown>).localStorage = prev
  })

  it('reads nothing stored, and anything unreadable, as no memory', () => {
    expect(parseModeRowMemory(null, null)).toEqual(MODE_ROW_NO_MEMORY)
    expect(parseModeRowMemory('yes', 'many')).toEqual(MODE_ROW_NO_MEMORY)
    expect(parseModeRowMemory('1', '-3')).toEqual({ pressed: true, opens: 0 })
    expect(readModeRowMemory(null)).toEqual(MODE_ROW_NO_MEMORY)
  })

  it('counts an open, and stops one past the first visits', () => {
    let memory = MODE_ROW_NO_MEMORY
    for (let i = 0; i < MODE_ROW_FIRST_VISITS + 4; i++) memory = modeRowCountOpen(memory)
    expect(memory).toEqual({ pressed: false, opens: MODE_ROW_FIRST_VISITS + 1 })
  })

  it('keeps one memory per person on a shared phone', () => {
    writeModeRowMemory('u1', { pressed: true, opens: 3 })
    writeModeRowMemory('u2', { pressed: false, opens: 1 })
    expect(readModeRowMemory('u1')).toEqual({ pressed: true, opens: 3 })
    expect(readModeRowMemory('u2')).toEqual({ pressed: false, opens: 1 })
    expect(store.get(modeRowPressedKey('u1'))).toBe('1')
    expect(store.has(modeRowPressedKey('u2'))).toBe(false)
    expect(store.get(modeRowOpensKey('u2'))).toBe('1')
    writeModeRowMemory(null, { pressed: true, opens: 9 })
    expect(store.size).toBe(3)
  })
})
