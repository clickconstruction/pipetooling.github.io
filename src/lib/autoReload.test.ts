// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import {
  AUTO_RELOAD_KEY,
  AUTO_RELOAD_TYPED_REASON,
  LANDING_SETTLE_MS,
  LANDING_WAIT_MAX_MS,
  RELOAD_FALLBACK_MS,
  decideAutoReload,
  decideReloadLanding,
  isDialogOpen,
  isEditableFocused,
  msSinceLastAutoReload,
  recordAutoReload,
  routeMoveKey,
  type AutoReloadSnapshot,
  type ReloadLandingSnapshot,
} from './autoReload'

const quiet: AutoReloadSnapshot = {
  moment: 'first-paint',
  updateWaiting: true,
  framed: false,
  interacted: false,
  msSinceLoad: 1_200,
  typedText: false,
  editableFocused: false,
  dialogOpen: false,
  unsavedHolds: 0,
  inFlightWrites: 0,
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
    expect(decideAutoReload({ ...rc, inFlightWrites: 1 }).reload).toBe(false)
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
  it('v2.8499: words typed on the page hold every moment, however long the tab has sat', () => {
    const held = { reload: false, reason: AUTO_RELOAD_TYPED_REASON }
    expect(decideAutoReload({ ...quiet, typedText: true })).toEqual(held)
    expect(decideAutoReload({ ...quiet, moment: 'route-change', interacted: true, typedText: true })).toEqual(held)
    // The moment this was built for: a message typed, the field left, the tab forgotten.
    expect(decideAutoReload({ ...quiet, moment: 'idle', interacted: true, typedText: true, hiddenForMs: 5 * 60_000 })).toEqual(held)
    expect(decideAutoReload({ ...quiet, moment: 'idle', interacted: true, typedText: true, idleForMs: 30 * 60_000 })).toEqual(held)
    // No length of time wears the hold out.
    for (const hours of [1, 8, 24, 24 * 14]) {
      expect(decideAutoReload({ ...quiet, moment: 'idle', interacted: true, typedText: true, hiddenForMs: hours * 3_600_000 }).reload).toBe(false)
      expect(decideAutoReload({ ...quiet, moment: 'idle', interacted: true, typedText: true, idleForMs: hours * 3_600_000 }).reload).toBe(false)
    }
    // The words sent or cleared, the same idle tab reloads.
    expect(decideAutoReload({ ...quiet, moment: 'idle', interacted: true, hiddenForMs: 5 * 60_000 }).reload).toBe(true)
  })
  it('v2.8499: typed words are the reason named when several things hold it', () => {
    expect(decideAutoReload({ ...quiet, moment: 'route-change', typedText: true, unsavedHolds: 2, inFlightWrites: 1, editableFocused: true, dialogOpen: true }).reason).toBe(
      AUTO_RELOAD_TYPED_REASON,
    )
  })
  it('idle needs the tab hidden five minutes, or untouched half an hour', () => {
    const idle: AutoReloadSnapshot = { ...quiet, moment: 'idle', interacted: true, msSinceLoad: 3_600_000 }
    expect(decideAutoReload({ ...idle, hiddenForMs: 60_000 }).reload).toBe(false)
    expect(decideAutoReload({ ...idle, hiddenForMs: 6 * 60_000 }).reload).toBe(true)
    expect(decideAutoReload({ ...idle, idleForMs: 10 * 60_000 }).reload).toBe(false)
    expect(decideAutoReload({ ...idle, idleForMs: 31 * 60_000 }).reload).toBe(true)
    expect(decideAutoReload({ ...idle, idleForMs: 31 * 60_000, unsavedHolds: 1 }).reload).toBe(false)
  })
})

describe('decideReloadLanding, the second look when the reload would fire', () => {
  /** An automatic reload whose new worker has just taken over, with the page as quiet as it was. */
  const landing: ReloadLandingSnapshot = {
    asked: false,
    workerTookOver: true,
    msSinceDecision: 600,
    touchedSinceDecision: false,
    typedText: false,
    editableFocused: false,
    dialogOpen: false,
    unsavedHolds: 0,
    inFlightWrites: 0,
    msSinceWriteSettled: null,
  }

  it('still quiet: it reloads the moment the new worker takes over', () => {
    expect(decideReloadLanding(landing)).toEqual({ act: 'reload', reason: 'still quiet' })
  })
  it('waits for the worker, and no longer than the fallback', () => {
    expect(decideReloadLanding({ ...landing, workerTookOver: false, msSinceDecision: 1_000 })).toEqual({
      act: 'wait',
      reason: 'the new worker has not taken over yet',
      lookAgainInMs: RELOAD_FALLBACK_MS - 1_000,
    })
    expect(decideReloadLanding({ ...landing, workerTookOver: false, msSinceDecision: RELOAD_FALLBACK_MS }).act).toBe('reload')
  })
  it('a write that began after the decision is waited out, never cut', () => {
    const midWrite = decideReloadLanding({ ...landing, inFlightWrites: 1, msSinceDecision: 2_000 })
    expect(midWrite).toEqual({ act: 'wait', reason: '1 write(s) in flight', lookAgainInMs: LANDING_WAIT_MAX_MS - 2_000 })
    // The fallback running out does not fire over it either.
    expect(decideReloadLanding({ ...landing, workerTookOver: false, inFlightWrites: 1, msSinceDecision: RELOAD_FALLBACK_MS }).act).toBe('wait')
  })
  it('a write that just came back holds the reload a beat: the next one of a chain may follow', () => {
    expect(decideReloadLanding({ ...landing, msSinceWriteSettled: 400 })).toEqual({
      act: 'wait',
      reason: 'a write just came back, another may follow',
      lookAgainInMs: LANDING_SETTLE_MS - 400,
    })
    expect(decideReloadLanding({ ...landing, msSinceWriteSettled: LANDING_SETTLE_MS }).act).toBe('reload')
  })
  it('a write still in flight half a minute on is not waited out: the pill takes over', () => {
    expect(decideReloadLanding({ ...landing, inFlightWrites: 2, msSinceDecision: LANDING_WAIT_MAX_MS })).toEqual({
      act: 'stand-down',
      reason: '2 write(s) still in flight',
    })
  })
  it('a touch, a dialog, a focused field or an unsaved hold stands it down to the pill', () => {
    expect(decideReloadLanding({ ...landing, touchedSinceDecision: true }).act).toBe('stand-down')
    expect(decideReloadLanding({ ...landing, dialogOpen: true }).act).toBe('stand-down')
    expect(decideReloadLanding({ ...landing, editableFocused: true }).act).toBe('stand-down')
    expect(decideReloadLanding({ ...landing, unsavedHolds: 1 }).act).toBe('stand-down')
  })
  it('v2.8499: words that are on the page when the reload would fire stand it down, with no touch', () => {
    // A draft the app brought back after the decision: nothing was pressed.
    expect(decideReloadLanding({ ...landing, typedText: true })).toEqual({ act: 'stand-down', reason: AUTO_RELOAD_TYPED_REASON })
    // Before the worker takes over, and with a write in flight: it does not wait and then reload.
    expect(decideReloadLanding({ ...landing, typedText: true, workerTookOver: false, msSinceDecision: 200 }).act).toBe('stand-down')
    expect(decideReloadLanding({ ...landing, typedText: true, inFlightWrites: 1 }).act).toBe('stand-down')
    // However long the decision has waited.
    expect(decideReloadLanding({ ...landing, typedText: true, msSinceDecision: 10 * 60_000 }).act).toBe('stand-down')
  })
  it('stands down at once, before the worker takes over, and a touch outranks a write in flight', () => {
    expect(decideReloadLanding({ ...landing, workerTookOver: false, msSinceDecision: 50, touchedSinceDecision: true }).act).toBe('stand-down')
    expect(decideReloadLanding({ ...landing, touchedSinceDecision: true, inFlightWrites: 1 }).act).toBe('stand-down')
  })
  it('the pill’s own Reload press is held by nothing but the worker', () => {
    const busy: ReloadLandingSnapshot = {
      ...landing,
      asked: true,
      touchedSinceDecision: true,
      typedText: true,
      dialogOpen: true,
      editableFocused: true,
      unsavedHolds: 1,
      inFlightWrites: 1,
      msSinceWriteSettled: 0,
    }
    expect(decideReloadLanding(busy)).toEqual({ act: 'reload', reason: 'they pressed Reload' })
    expect(decideReloadLanding({ ...busy, workerTookOver: false, msSinceDecision: 100 })).toEqual({
      act: 'wait',
      reason: 'the new worker has not taken over yet',
      lookAgainInMs: RELOAD_FALLBACK_MS - 100,
    })
    expect(decideReloadLanding({ ...busy, workerTookOver: false, msSinceDecision: RELOAD_FALLBACK_MS }).act).toBe('reload')
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

describe('routeMoveKey (v2.4214)', () => {
  it('a tab switch is a move; the same tab is not', () => {
    expect(routeMoveKey('/people', '?tab=hours')).not.toBe(routeMoveKey('/people', '?tab=review'))
    expect(routeMoveKey('/people', '?tab=hours&lens=pay')).toBe(routeMoveKey('/people', '?tab=hours'))
  })
  it('a page change is a move with or without a tab', () => {
    expect(routeMoveKey('/jobs', '')).not.toBe(routeMoveKey('/people', ''))
    expect(routeMoveKey('/people', '')).toBe('/people')
  })
  it('a picked bid, a lens or a filter alone is not a move', () => {
    expect(routeMoveKey('/bids', '?bidId=1')).toBe(routeMoveKey('/bids', '?bidId=2'))
    expect(routeMoveKey('/bids', '?tab=pricing&bidId=1')).toBe(routeMoveKey('/bids', '?tab=pricing&bidId=2'))
  })
})
