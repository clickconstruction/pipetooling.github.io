import { describe, expect, it } from 'vitest'
import {
  NEW_PHONE_LAYOUT_STORAGE_KEY,
  NEW_PHONE_LAYOUT_SWITCH_LABEL,
  NEW_PHONE_LAYOUT_TICK_ROLES,
  newPhoneLayoutOn,
  newPhoneLayoutSwitchTip,
  newPhoneLayoutTickShown,
  readNewPhoneLayoutStored,
  writeNewPhoneLayoutStored,
} from './newPhoneLayout'

function memoryStorage(seed: Record<string, string> = {}) {
  const map = new Map(Object.entries(seed))
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    keys: () => [...map.keys()],
  }
}

describe('the new phone layout switch', () => {
  it('is off until someone ticks it', () => {
    expect(readNewPhoneLayoutStored(memoryStorage())).toBe(false)
    expect(readNewPhoneLayoutStored(null)).toBe(false)
    expect(readNewPhoneLayoutStored(undefined)).toBe(false)
  })

  it('is kept per device: the key carries no user id', () => {
    const storage = memoryStorage()
    writeNewPhoneLayoutStored(storage, true)
    expect(storage.keys()).toEqual([NEW_PHONE_LAYOUT_STORAGE_KEY])
    expect(NEW_PHONE_LAYOUT_STORAGE_KEY).toBe('pt_new_phone_layout')
    expect(readNewPhoneLayoutStored(storage)).toBe(true)
  })

  it('unticked stores nothing, so the device is as it was before the switch', () => {
    const storage = memoryStorage()
    writeNewPhoneLayoutStored(storage, true)
    writeNewPhoneLayoutStored(storage, false)
    expect(storage.keys()).toEqual([])
    expect(readNewPhoneLayoutStored(storage)).toBe(false)
  })

  it('reads off, and writes nothing, when storage throws', () => {
    const broken = {
      getItem: () => {
        throw new Error('no storage')
      },
      setItem: () => {
        throw new Error('no storage')
      },
      removeItem: () => {
        throw new Error('no storage')
      },
    }
    expect(readNewPhoneLayoutStored(broken)).toBe(false)
    expect(() => writeNewPhoneLayoutStored(broken, true)).not.toThrow()
    expect(() => writeNewPhoneLayoutStored(broken, false)).not.toThrow()
  })

  it('only "1" is on: any other stored word is off', () => {
    for (const v of ['0', 'on', 'true', '']) {
      expect(readNewPhoneLayoutStored(memoryStorage({ [NEW_PHONE_LAYOUT_STORAGE_KEY]: v }))).toBe(false)
    }
  })
})

describe('newPhoneLayoutOn: the one rule', () => {
  it('needs the tick AND a phone-wide screen', () => {
    expect(newPhoneLayoutOn({ stored: true, phoneWidth: true })).toBe(true)
  })

  it('is off with the switch off, at any width', () => {
    expect(newPhoneLayoutOn({ stored: false, phoneWidth: true })).toBe(false)
    expect(newPhoneLayoutOn({ stored: false, phoneWidth: false })).toBe(false)
  })

  it('is off at a desk, even with the switch ticked', () => {
    expect(newPhoneLayoutOn({ stored: true, phoneWidth: false })).toBe(false)
  })
})

describe('who is offered the tick', () => {
  const OTHERS = ['helpers', 'subcontractor', 'superintendent', 'assistant', 'controller', 'estimator', 'primary', null, undefined]

  it('devs and master technicians, from one list, on a phone-wide screen', () => {
    expect([...NEW_PHONE_LAYOUT_TICK_ROLES]).toEqual(['dev', 'master_technician'])
    expect(newPhoneLayoutTickShown({ role: 'dev', stored: false, phoneWidth: true })).toBe(true)
    expect(newPhoneLayoutTickShown({ role: 'master_technician', stored: false, phoneWidth: true })).toBe(true)
  })

  it('nobody else while the device has it off', () => {
    for (const role of OTHERS) {
      expect(newPhoneLayoutTickShown({ role, stored: false, phoneWidth: true })).toBe(false)
    }
  })

  it('anyone on a device that has it on, so the way off is always there', () => {
    for (const role of OTHERS) {
      expect(newPhoneLayoutTickShown({ role, stored: true, phoneWidth: true })).toBe(true)
    }
  })

  it('nobody at a desk, ticked or not: the gear menu there is the menu it was', () => {
    for (const role of ['dev', 'master_technician', ...OTHERS]) {
      for (const stored of [true, false]) {
        expect(newPhoneLayoutTickShown({ role, stored, phoneWidth: false })).toBe(false)
      }
    }
  })

  it('names the row and says what a press does', () => {
    expect(NEW_PHONE_LAYOUT_SWITCH_LABEL).toBe('New phone layout')
    expect(newPhoneLayoutSwitchTip(false)).toMatch(/trial/)
    expect(newPhoneLayoutSwitchTip(true)).toMatch(/before/)
  })
})
