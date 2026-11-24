import { describe, expect, it } from 'vitest'
import { CHUNK_RECOVERY_MIN_INTERVAL_MS } from './chunkLoadRecovery'
import {
  decideWindowCure,
  msSinceWindowCure,
  stampWindowCure,
  WINDOW_CURE_KEY,
  WINDOW_CURE_LOOK_AGAIN_MS,
  WINDOW_CURE_MIN_GAP_MS,
  type WindowCureSnapshot,
} from './windowCure'

/** A window is lost, the browser says online, and the page is quiet. */
const quiet: WindowCureSnapshot = {
  lostWindows: 1,
  browserOffline: false,
  framed: false,
  msSinceLastCure: null,
  msSinceLastRecovery: null,
  typedText: false,
  editableFocused: false,
  dialogOpen: false,
  unsavedHolds: 0,
  inFlightWrites: 0,
}

describe('decideWindowCure', () => {
  it('asks the network when a window is lost and the page is quiet', () => {
    expect(decideWindowCure(quiet).act).toBe('ask')
  })

  it('does nothing while no window is lost', () => {
    expect(decideWindowCure({ ...quiet, lostWindows: 0 })).toEqual({ act: 'none', reason: 'no window is lost' })
  })

  it('does nothing while the browser says offline: its online event wakes the cure', () => {
    expect(decideWindowCure({ ...quiet, browserOffline: true }).act).toBe('none')
  })

  it('does nothing inside a frame', () => {
    expect(decideWindowCure({ ...quiet, framed: true }).act).toBe('none')
  })

  it('never goes over words someone typed, and looks again', () => {
    expect(decideWindowCure({ ...quiet, typedText: true })).toEqual({
      act: 'wait',
      reason: 'words typed on the page',
      lookAgainInMs: WINDOW_CURE_LOOK_AGAIN_MS,
    })
  })

  it('typed words hold it however long they stay: no count of looks lets it through', () => {
    for (let look = 0; look < 500; look++) expect(decideWindowCure({ ...quiet, typedText: true }).act).toBe('wait')
  })

  it.each([
    ['a focused field', { editableFocused: true }],
    ['an open window', { dialogOpen: true }],
    ['a component holding unsaved work', { unsavedHolds: 1 }],
    ['a write in flight', { inFlightWrites: 2 }],
  ])('holds for %s', (_name, held) => {
    const cure = decideWindowCure({ ...quiet, ...held })
    expect(cure.act).toBe('wait')
  })

  it('says typed words first when several things hold it', () => {
    const cure = decideWindowCure({ ...quiet, typedText: true, dialogOpen: true, inFlightWrites: 1 })
    expect(cure).toMatchObject({ act: 'wait', reason: 'words typed on the page' })
  })

  it('waits out the minute after a recovery reload, then asks', () => {
    const inside = decideWindowCure({ ...quiet, msSinceLastRecovery: 20_000 })
    expect(inside).toMatchObject({ act: 'wait', lookAgainInMs: CHUNK_RECOVERY_MIN_INTERVAL_MS - 20_000 + 500 })
    expect(decideWindowCure({ ...quiet, msSinceLastRecovery: CHUNK_RECOVERY_MIN_INTERVAL_MS }).act).toBe('ask')
  })

  it('tries once in ten minutes, so a file gone from the server cannot reload the page every minute', () => {
    expect(decideWindowCure({ ...quiet, msSinceLastCure: 60_000 }).act).toBe('none')
    expect(decideWindowCure({ ...quiet, msSinceLastCure: WINDOW_CURE_MIN_GAP_MS - 1 }).act).toBe('none')
    expect(decideWindowCure({ ...quiet, msSinceLastCure: WINDOW_CURE_MIN_GAP_MS }).act).toBe('ask')
  })
})

describe('the cure’s own stamp', () => {
  const store = () => {
    const kept = new Map<string, string>()
    return { getItem: (k: string) => kept.get(k) ?? null, setItem: (k: string, v: string) => void kept.set(k, v), kept }
  }

  it('reads nothing before a cure, and the time since after one', () => {
    const s = store()
    expect(msSinceWindowCure(5_000, s)).toBeNull()
    stampWindowCure(5_000, s)
    expect(s.kept.get(WINDOW_CURE_KEY)).toBe('5000')
    expect(msSinceWindowCure(65_000, s)).toBe(60_000)
  })

  it('a storage that throws or is missing is let be', () => {
    const throws = { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('full') } }
    expect(msSinceWindowCure(1, throws)).toBeNull()
    expect(() => stampWindowCure(1, throws)).not.toThrow()
    expect(msSinceWindowCure(1, null)).toBeNull()
    expect(() => stampWindowCure(1, undefined)).not.toThrow()
  })
})
