import { describe, expect, it } from 'vitest'
import {
  MODAL_FULL_SCREEN_ENTER_LABEL,
  MODAL_FULL_SCREEN_LEAVE_LABEL,
  modalFullScreenStorageKey,
  modalFullScreenToggleLabel,
  readModalFullScreen,
  writeModalFullScreen,
  type StorageLike,
} from './modalFullScreen'

function memoryStorage(): StorageLike & { map: Map<string, string> } {
  const map = new Map<string, string>()
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v)
    },
    removeItem: (k) => {
      map.delete(k)
    },
  }
}

describe('modalFullScreen', () => {
  it('names the other state: the button says what a press gives you', () => {
    expect(modalFullScreenToggleLabel(false)).toBe(MODAL_FULL_SCREEN_ENTER_LABEL)
    expect(modalFullScreenToggleLabel(true)).toBe(MODAL_FULL_SCREEN_LEAVE_LABEL)
    expect(MODAL_FULL_SCREEN_ENTER_LABEL).toBe('Full screen')
    expect(MODAL_FULL_SCREEN_LEAVE_LABEL).toBe('Back to a window')
  })

  it('keys the memory per modal, and reads false until something was kept', () => {
    const s = memoryStorage()
    expect(modalFullScreenStorageKey('contract-sweep')).toBe('modal_full_screen_contract-sweep')
    expect(readModalFullScreen('contract-sweep', s)).toBe(false)
    writeModalFullScreen('contract-sweep', true, s)
    expect(readModalFullScreen('contract-sweep', s)).toBe(true)
    expect(readModalFullScreen('lien-desk', s)).toBe(false)
  })

  it('the window state removes the key instead of keeping a "0"', () => {
    const s = memoryStorage()
    writeModalFullScreen('contract-sweep', true, s)
    writeModalFullScreen('contract-sweep', false, s)
    expect(s.map.has('modal_full_screen_contract-sweep')).toBe(false)
    expect(readModalFullScreen('contract-sweep', s)).toBe(false)
  })

  it('a store that throws or is missing reads false and swallows the write', () => {
    const broken: StorageLike = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('full')
      },
      removeItem: () => {
        throw new Error('blocked')
      },
    }
    expect(readModalFullScreen('contract-sweep', broken)).toBe(false)
    expect(() => writeModalFullScreen('contract-sweep', true, broken)).not.toThrow()
    expect(readModalFullScreen('contract-sweep', null)).toBe(false)
    expect(() => writeModalFullScreen('contract-sweep', true, null)).not.toThrow()
  })
})
