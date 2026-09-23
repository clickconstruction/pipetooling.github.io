import { describe, expect, it } from 'vitest'
import {
  activeDockKey,
  parseStoredDockSlots,
  phoneDockPagesFor,
  resolveDockSlots,
  roleDockDefault,
  suggestedDockPages,
  swapDockSlot,
  PHONE_DOCK_PAGES,
} from './phoneDock'

describe('roleDockDefault', () => {
  it('gives assistants and controllers Jobs · Schedule · Quickfill · Inbox', () => {
    expect(roleDockDefault('assistant')).toEqual(['jobs', 'schedule', 'quickfill', 'inbox'])
    expect(roleDockDefault('controller')).toEqual(['jobs', 'schedule', 'quickfill', 'inbox'])
  })
  it('leaves every other role on the fixed bar', () => {
    for (const role of ['dev', 'master_technician', 'estimator', 'subcontractor', 'helpers', 'primary', 'superintendent', null] as const) {
      expect(roleDockDefault(role)).toBeNull()
    }
  })
  it('every default slot is a page the role can see', () => {
    const visible = new Set(phoneDockPagesFor('assistant').map((p) => p.key))
    for (const k of roleDockDefault('assistant')!) expect(visible.has(k)).toBe(true)
  })
})

describe('parseStoredDockSlots / resolveDockSlots', () => {
  it('accepts four distinct visible keys', () => {
    expect(parseStoredDockSlots('["jobs","supplyHouses","quickfill","inbox"]', 'assistant')).toEqual(['jobs', 'supplyHouses', 'quickfill', 'inbox'])
  })
  it('rejects bad JSON, wrong length, duplicates, unknown keys and pages the role cannot see', () => {
    expect(parseStoredDockSlots('nope', 'assistant')).toBeNull()
    expect(parseStoredDockSlots('["jobs","schedule","quickfill"]', 'assistant')).toBeNull()
    expect(parseStoredDockSlots('["jobs","jobs","quickfill","inbox"]', 'assistant')).toBeNull()
    expect(parseStoredDockSlots('["jobs","gone","quickfill","inbox"]', 'assistant')).toBeNull()
    // Banking is controller-only; an assistant's stored Banking slot falls back whole.
    expect(parseStoredDockSlots('["jobs","banking","quickfill","inbox"]', 'assistant')).toBeNull()
    expect(parseStoredDockSlots('["jobs","banking","quickfill","inbox"]', 'controller')).toEqual(['jobs', 'banking', 'quickfill', 'inbox'])
  })
  it('falls back to the role default, and to null for roles without a dock', () => {
    expect(resolveDockSlots('assistant', null)).toEqual(['jobs', 'schedule', 'quickfill', 'inbox'])
    expect(resolveDockSlots('assistant', '["x"]')).toEqual(['jobs', 'schedule', 'quickfill', 'inbox'])
    expect(resolveDockSlots('dev', '["jobs","schedule","quickfill","inbox"]')).toBeNull()
  })
})

describe('swapDockSlot', () => {
  const base = ['jobs', 'schedule', 'quickfill', 'inbox'] as const
  it('replaces the slot with a page not yet on the dock', () => {
    expect(swapDockSlot([...base], 1, 'supplyHouses')).toEqual(['jobs', 'supplyHouses', 'quickfill', 'inbox'])
  })
  it('trades places when the page already holds a slot', () => {
    expect(swapDockSlot([...base], 0, 'inbox')).toEqual(['inbox', 'schedule', 'quickfill', 'jobs'])
  })
  it('is a no-op for the same page or a bad index', () => {
    const slots = [...base]
    expect(swapDockSlot(slots, 2, 'quickfill')).toBe(slots)
    expect(swapDockSlot(slots, 9, 'jobs')).toBe(slots)
  })
})

describe('activeDockKey', () => {
  const slots = ['jobs', 'schedule', 'quickfill', 'inbox'] as const
  it('lights Jobs on the Pipeline and on the bare Jobs page, not on Billing', () => {
    expect(activeDockKey('/jobs', '?tab=stages', [...slots])).toBe('jobs')
    expect(activeDockKey('/jobs', '', [...slots])).toBe('jobs')
    expect(activeDockKey('/jobs', '?tab=billing', [...slots])).toBeNull()
  })
  it('lights the Dispatch Mode pages by prefix and nothing elsewhere', () => {
    expect(activeDockKey('/dispatch-mode/schedule', '', [...slots])).toBe('schedule')
    expect(activeDockKey('/dispatch-mode/inbox', '?x=1', [...slots])).toBe('inbox')
    expect(activeDockKey('/quickfill', '', [...slots])).toBe('quickfill')
    expect(activeDockKey('/customers', '', [...slots])).toBeNull()
    expect(activeDockKey('/dispatch-mode', '', [...slots])).toBeNull()
  })
  it('prefers the more specific page when two slots share a path', () => {
    const both = ['jobs', 'subsPay', 'quickfill', 'inbox'] as const
    expect(activeDockKey('/jobs', '?tab=subs&view=pay', [...both])).toBe('subsPay')
    expect(activeDockKey('/jobs', '?tab=subs', [...both])).toBeNull()
    expect(activeDockKey('/jobs', '?tab=stages', [...both])).toBe('jobs')
  })
})

describe('suggestedDockPages', () => {
  const slots = ['jobs', 'schedule', 'quickfill', 'inbox'] as const
  it('ranks pages outside the dock by the person’s own minutes', () => {
    const rows = [
      { page: 'jobs:stages', active_seconds: 60 * 60 * 64 },
      { page: 'materials:supply-houses', active_seconds: 60 * 60 * 10 },
      { page: 'jobs:subs', active_seconds: 60 * 60 * 3 },
      { page: 'people:hours', active_seconds: 60 * 80 },
      { page: 'customers', active_seconds: 60 * 63 },
      { page: 'materials', active_seconds: 60 * 5 },
    ]
    const out = suggestedDockPages(rows, [...slots], 'assistant')
    expect(out.map((s) => s.page.key)).toEqual(['supplyHouses', 'subsPay', 'peopleHours'])
    expect(out[0]!.minutes).toBe(600)
  })
  it('never suggests a page already on the dock, and a plain page keeps its unclaimed tabs', () => {
    const rows = [
      { page: 'quickfill', active_seconds: 9999 },
      { page: 'jobs:billing', active_seconds: 300 },
      { page: 'estimates', active_seconds: 120 },
    ]
    const out = suggestedDockPages(rows, [...slots], 'assistant')
    // jobs:billing belongs to Jobs, which is on the dock — so only Estimates remains.
    expect(out.map((s) => s.page.key)).toEqual(['estimates'])
  })
  it('ignores rows it cannot read, pages the role cannot see, and pages under a minute', () => {
    const rows = [
      { page: 'banking', active_seconds: 500 },
      { page: 'nonsense', active_seconds: 500 },
      { page: 'tally', active_seconds: -5 },
      { page: 'calendar', active_seconds: 59 },
    ]
    expect(suggestedDockPages(rows, [...slots], 'assistant')).toEqual([])
    expect(suggestedDockPages([{ page: 'calendar', active_seconds: 60 }], [...slots], 'assistant').map((s) => s.page.key)).toEqual(['calendar'])
  })
})

describe('registry', () => {
  it('has distinct keys and every page opens somewhere', () => {
    const keys = PHONE_DOCK_PAGES.map((p) => p.key)
    expect(new Set(keys).size).toBe(keys.length)
    for (const p of PHONE_DOCK_PAGES) expect(p.to.startsWith('/')).toBe(true)
  })
})
