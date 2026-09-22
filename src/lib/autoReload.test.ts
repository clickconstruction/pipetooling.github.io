// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import {
  AUTO_RELOAD_KEY,
  decideAutoReload,
  isDialogOpen,
  isEditableFocused,
  msSinceLastAutoReload,
  recordAutoReload,
  type AutoReloadSnapshot,
} from './autoReload'

const quiet: AutoReloadSnapshot = {
  moment: 'first-paint',
  updateWaiting: true,
  framed: false,
  interacted: false,
  msSinceLoad: 1_200,
  editableFocused: false,
  dialogOpen: false,
  unsavedHolds: 0,
  msSinceLastAutoReload: null,
  msSinceDismissed: null,
}

describe('decideAutoReload', () => {
  it('reloads on first paint when nothing has been touched', () => {
    expect(decideAutoReload(quiet)).toEqual({ reload: true, reason: 'first paint, untouched' })
  })
  it('never without a waiting update, never framed', () => {
    expect(decideAutoReload({ ...quiet, updateWaiting: false }).reload).toBe(false)
    expect(decideAutoReload({ ...quiet, framed: true }).reload).toBe(false)
  })
  it('first paint refuses once they touched the page or too long after load', () => {
    expect(decideAutoReload({ ...quiet, interacted: true }).reload).toBe(false)
    expect(decideAutoReload({ ...quiet, msSinceLoad: 16_000 }).reload).toBe(false)
  })
  it('route change reloads even after interaction, but not over a dialog or a focused field', () => {
    const rc: AutoReloadSnapshot = { ...quiet, moment: 'route-change', interacted: true, msSinceLoad: 600_000 }
    expect(decideAutoReload(rc).reload).toBe(true)
    expect(decideAutoReload({ ...rc, dialogOpen: true }).reload).toBe(false)
    expect(decideAutoReload({ ...rc, editableFocused: true }).reload).toBe(false)
    expect(decideAutoReload({ ...rc, unsavedHolds: 1 }).reload).toBe(false)
  })
  it('honours "Not now" for ten minutes, then a quiet moment may reload', () => {
    const rc: AutoReloadSnapshot = { ...quiet, moment: 'route-change' }
    expect(decideAutoReload({ ...rc, msSinceDismissed: 60_000 }).reload).toBe(false)
    expect(decideAutoReload({ ...rc, msSinceDismissed: 11 * 60_000 }).reload).toBe(true)
  })
  it('loop guard: no second automatic reload within a minute', () => {
    expect(decideAutoReload({ ...quiet, msSinceLastAutoReload: 20_000 }).reload).toBe(false)
    expect(decideAutoReload({ ...quiet, msSinceLastAutoReload: 90_000 }).reload).toBe(true)
  })
  it('idle needs the tab hidden five minutes', () => {
    const idle: AutoReloadSnapshot = { ...quiet, moment: 'idle', interacted: true, msSinceLoad: 3_600_000 }
    expect(decideAutoReload({ ...idle, hiddenForMs: 60_000 }).reload).toBe(false)
    expect(decideAutoReload({ ...idle, hiddenForMs: 6 * 60_000 }).reload).toBe(true)
  })
})

describe('the storage stamp', () => {
  it('reads null with nothing recorded, the gap after a record, and survives a broken store', () => {
    const store = new Map<string, string>()
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) }
    expect(msSinceLastAutoReload(1_000, storage)).toBeNull()
    recordAutoReload(1_000, storage)
    expect(store.get(AUTO_RELOAD_KEY)).toBe('1000')
    expect(msSinceLastAutoReload(31_000, storage)).toBe(30_000)
    const broken = { getItem: () => { throw new Error('quota') }, setItem: () => { throw new Error('quota') } }
    expect(() => recordAutoReload(1, broken)).not.toThrow()
    expect(msSinceLastAutoReload(1, broken)).toBeNull()
  })
})

describe('the DOM readers', () => {
  it('sees a focused text field, textarea or contenteditable; not a button or a checkbox', () => {
    document.body.innerHTML = '<input id="t" type="text"><input id="c" type="checkbox"><button id="b"></button><textarea id="a"></textarea><div id="e" contenteditable="true"></div>'
    ;(document.getElementById('t') as HTMLInputElement).focus()
    expect(isEditableFocused(document)).toBe(true)
    ;(document.getElementById('c') as HTMLInputElement).focus()
    expect(isEditableFocused(document)).toBe(false)
    ;(document.getElementById('b') as HTMLButtonElement).focus()
    expect(isEditableFocused(document)).toBe(false)
    ;(document.getElementById('a') as HTMLTextAreaElement).focus()
    expect(isEditableFocused(document)).toBe(true)
    const e = document.getElementById('e') as HTMLElement
    Object.defineProperty(e, 'isContentEditable', { value: true })
    e.focus()
    expect(isEditableFocused({ activeElement: e })).toBe(true)
  })
  it('sees a dialog by role, aria-modal or <dialog open>', () => {
    document.body.innerHTML = '<div>plain</div>'
    expect(isDialogOpen(document)).toBe(false)
    document.body.innerHTML = '<div role="dialog"></div>'
    expect(isDialogOpen(document)).toBe(true)
    document.body.innerHTML = '<div aria-modal="true"></div>'
    expect(isDialogOpen(document)).toBe(true)
    document.body.innerHTML = '<dialog open></dialog>'
    expect(isDialogOpen(document)).toBe(true)
    document.body.innerHTML = '<dialog></dialog>'
    expect(isDialogOpen(document)).toBe(false)
  })
})
