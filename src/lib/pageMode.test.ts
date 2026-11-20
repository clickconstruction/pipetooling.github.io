import { describe, expect, it } from 'vitest'
import {
  PAGE_MODE_ORDER,
  applyPageModeWrites,
  dispatchModeDefaultForRole,
  dispatchModeEligibleForRole,
  pageModeEligibleForRole,
  pageModeTicks,
  pageModeWrites,
  resolvePageMode,
  type PageModeKey,
  type PageModeWants,
} from './pageMode'

const none: PageModeWants = { task: false, job: false, dispatch: false }
const wants = (p: Partial<PageModeWants>): PageModeWants => ({ ...none, ...p })

/** Every combination the three stored values can be in, the old stacked ones included. */
const EVERY_STATE: PageModeWants[] = [false, true].flatMap((task) =>
  [false, true].flatMap((job) => [false, true].map((dispatch) => ({ task, job, dispatch }))),
)

/** One press, as the menu makes it: the row flips what its tick shows. */
function press(role: string, w: PageModeWants, key: PageModeKey): PageModeWants {
  return applyPageModeWrites(w, pageModeWrites(role, w, key, !pageModeTicks(w)[key]))
}

describe('resolvePageMode: one mode is drawn', () => {
  it('is the full app with nothing on', () => {
    expect(resolvePageMode(none)).toBe('full')
  })

  it('draws a mode that is on alone', () => {
    for (const key of PAGE_MODE_ORDER) expect(resolvePageMode(wants({ [key]: true })), key).toBe(key)
  })

  it('reads the old stacked values by one order: Task Mode, then Job Mode, then Dispatch Mode', () => {
    // The owner's screenshot: Job Mode and Task Mode both stored, the page in Task Mode.
    expect(resolvePageMode(wants({ task: true, job: true }))).toBe('task')
    expect(resolvePageMode(wants({ task: true, dispatch: true }))).toBe('task')
    expect(resolvePageMode(wants({ task: true, job: true, dispatch: true }))).toBe('task')
    // A master technician who took Job Mode from the Dashboard card under a Dispatch Mode nobody chose.
    expect(resolvePageMode(wants({ job: true, dispatch: true }))).toBe('job')
  })
})

describe('pageModeTicks: the tick is the page', () => {
  it('never ticks two rows, whatever is stored', () => {
    for (const w of EVERY_STATE) {
      const ticks = pageModeTicks(w)
      const on = PAGE_MODE_ORDER.filter((k) => ticks[k])
      expect(on.length, JSON.stringify(w)).toBeLessThanOrEqual(1)
      expect(on[0] ?? 'full', JSON.stringify(w)).toBe(resolvePageMode(w))
    }
  })

  it('shows Task Mode alone for the device that held Job Mode and Task Mode together', () => {
    expect(pageModeTicks(wants({ task: true, job: true }))).toEqual({ task: true, job: false, dispatch: false })
  })
})

describe('pageModeWrites: what a press stores', () => {
  it('switching Task Mode on writes Task Mode alone and leaves the mode under it', () => {
    expect(pageModeWrites('helpers', wants({ job: true }), 'task', true)).toEqual([{ key: 'task', on: true }])
    expect(pageModeWrites('assistant', wants({ dispatch: true }), 'task', true)).toEqual([{ key: 'task', on: true }])
  })

  it('switching Task Mode off writes Task Mode alone, so the page goes back to the mode the person had', () => {
    const inTask = wants({ task: true, job: true })
    const writes = pageModeWrites('helpers', inTask, 'task', false)
    expect(writes).toEqual([{ key: 'task', on: false }])
    expect(resolvePageMode(applyPageModeWrites(inTask, writes))).toBe('job')
  })

  it('a role whose Job Mode is on with nothing stored comes back to it from Task Mode', () => {
    // `job: true` here is the role default, not a stored value: nothing is written to it either way.
    let w = wants({ job: true })
    w = press('subcontractor', w, 'task')
    expect(resolvePageMode(w)).toBe('task')
    w = press('subcontractor', w, 'task')
    expect(w).toEqual(wants({ job: true }))
    expect(resolvePageMode(w)).toBe('job')
  })

  it('switching Job Mode on from Task Mode takes Task Mode off', () => {
    expect(pageModeWrites('helpers', wants({ task: true }), 'job', true)).toEqual([
      { key: 'job', on: true },
      { key: 'task', on: false },
    ])
  })

  it('does not write a value that is already on underneath', () => {
    expect(pageModeWrites('helpers', wants({ task: true, job: true }), 'job', true)).toEqual([{ key: 'task', on: false }])
  })

  it('switching Job Mode on leaves Dispatch Mode stored under it', () => {
    const w = wants({ dispatch: true })
    const writes = pageModeWrites('master_technician', w, 'job', true)
    expect(writes).toEqual([{ key: 'job', on: true }])
    const after = applyPageModeWrites(w, writes)
    expect(pageModeTicks(after)).toEqual({ task: false, job: true, dispatch: false })
    // Job Mode off again: back to Dispatch Mode.
    expect(resolvePageMode(press('master_technician', after, 'job'))).toBe('dispatch')
  })

  it('switching Dispatch Mode on takes Job Mode and Task Mode off', () => {
    expect(pageModeWrites('master_technician', wants({ job: true, dispatch: true }), 'dispatch', true)).toEqual([{ key: 'job', on: false }])
    expect(pageModeWrites('dev', wants({ task: true, job: true }), 'dispatch', true)).toEqual([
      { key: 'dispatch', on: true },
      { key: 'task', on: false },
      { key: 'job', on: false },
    ])
  })

  it('switching a mode off that is not on writes nothing', () => {
    for (const key of PAGE_MODE_ORDER) expect(pageModeWrites('dev', none, key, false), key).toEqual([])
  })

  it('a role that cannot hold a mode writes nothing for it', () => {
    expect(pageModeWrites('helpers', none, 'dispatch', true)).toEqual([])
    expect(pageModeWrites('estimator', none, 'dispatch', true)).toEqual([])
    expect(pageModeWrites(null, none, 'job', true)).toEqual([])
    expect(pageModeWrites(null, none, 'task', true)).toEqual([{ key: 'task', on: true }])
  })
})

describe('every press from every state', () => {
  it('lands in the mode pressed when it was off, and out of it when it was on', () => {
    for (const start of EVERY_STATE) {
      for (const key of PAGE_MODE_ORDER) {
        const was = resolvePageMode(start)
        const after = press('dev', start, key)
        const label = `${JSON.stringify(start)} press ${key}`
        if (was === key) expect(resolvePageMode(after), label).not.toBe(key)
        else expect(resolvePageMode(after), label).toBe(key)
        const ticked = PAGE_MODE_ORDER.filter((k) => pageModeTicks(after)[k])
        expect(ticked.length, label).toBeLessThanOrEqual(1)
      }
    }
  })

  it('a press never switches on a mode the person did not press', () => {
    for (const start of EVERY_STATE) {
      for (const key of PAGE_MODE_ORDER) {
        const after = press('dev', start, key)
        for (const other of PAGE_MODE_ORDER) {
          if (other !== key) expect(after[other] && !start[other], `${JSON.stringify(start)} press ${key}`).toBe(false)
        }
      }
    }
  })
})

describe('who can hold Dispatch Mode', () => {
  it('is offered to a dev, a master technician, an assistant and a controller', () => {
    for (const role of ['dev', 'master_technician', 'assistant', 'controller']) expect(dispatchModeEligibleForRole(role), role).toBe(true)
    for (const role of ['helpers', 'subcontractor', 'estimator', 'primary', 'superintendent', null]) {
      expect(dispatchModeEligibleForRole(role), String(role)).toBe(false)
    }
  })

  it('is on before they choose for the three who run the day, and off for a dev', () => {
    for (const role of ['master_technician', 'assistant', 'controller']) expect(dispatchModeDefaultForRole(role), role).toBe(true)
    expect(dispatchModeDefaultForRole('dev')).toBe(false)
  })

  it('leaves Task Mode open to every role and Job Mode to the roles that leave a job report', () => {
    expect(pageModeEligibleForRole('estimator', 'task')).toBe(true)
    expect(pageModeEligibleForRole('helpers', 'job')).toBe(true)
    expect(pageModeEligibleForRole('helpers', 'dispatch')).toBe(false)
  })
})
