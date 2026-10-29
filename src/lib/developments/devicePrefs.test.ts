import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { isFolded, readFolds, readMoneySort, toggleFold, writeFolds, writeMoneySort } from './devicePrefs'

// The node test environment has no window; a Map-backed stand-in is installed per test.
const g = globalThis as unknown as { window?: unknown }
let store: Map<string, string>
let throwing = false
function installWindow() {
  g.window = {
    localStorage: {
      getItem: (k: string) => { if (throwing) throw new Error('blocked'); return store.has(k) ? store.get(k)! : null },
      setItem: (k: string, v: string) => { if (throwing) throw new Error('blocked'); store.set(k, String(v)) },
      removeItem: (k: string) => { if (throwing) throw new Error('blocked'); store.delete(k) },
    },
  }
}
beforeEach(() => { store = new Map(); throwing = false; installWindow() })
afterEach(() => { delete g.window })

const D = 'harlow'

describe('readFolds / writeFolds', () => {
  it('is empty until written, one key per development and scope; an empty set removes the key', () => {
    expect(readFolds(D, 'looks')).toEqual(new Set())
    writeFolds(D, 'looks', new Set(['history', 'open:money']))
    expect(store.get('pt.development.harlow.folds.looks')).toBe('["history","open:money"]')
    expect(readFolds(D, 'looks')).toEqual(new Set(['history', 'open:money']))
    expect(readFolds(D, 'money')).toEqual(new Set())
    expect(readFolds('ridgeway', 'looks')).toEqual(new Set())
    writeFolds(D, 'money', new Set(['band']))
    expect(store.get('pt.development.harlow.folds.money')).toBe('["band"]')
    writeFolds(D, 'looks', new Set())
    expect(store.has('pt.development.harlow.folds.looks')).toBe(false)
  })
  it('keeps only the strings of what it finds, and nothing from junk or a refusing device', () => {
    store.set('pt.development.harlow.folds.looks', '["history", 3, null]')
    expect(readFolds(D, 'looks')).toEqual(new Set(['history']))
    store.set('pt.development.harlow.folds.looks', '"history"')
    expect(readFolds(D, 'looks')).toEqual(new Set())
    store.set('pt.development.harlow.folds.looks', '{')
    expect(readFolds(D, 'looks')).toEqual(new Set())
    throwing = true
    expect(readFolds(D, 'looks')).toEqual(new Set())
    expect(() => writeFolds(D, 'looks', new Set(['history']))).not.toThrow()
  })
})

describe('isFolded', () => {
  it('a mark folds, an open: mark opens, else the default', () => {
    const folds = new Set(['history', 'open:plans'])
    expect(isFolded(folds, 'history', false)).toBe(true)
    expect(isFolded(folds, 'history', true)).toBe(true)
    expect(isFolded(folds, 'plans', true)).toBe(false)
    expect(isFolded(folds, 'plans', false)).toBe(false)
    expect(isFolded(folds, 'money', true)).toBe(true)
    expect(isFolded(folds, 'money', false)).toBe(false)
  })
})

describe('toggleFold', () => {
  it('a default-open thing: a press folds it with a mark, the next press clears the mark', () => {
    const folded = toggleFold(new Set(), 'history', false)
    expect(folded).toEqual(new Set(['history']))
    expect(isFolded(folded, 'history', false)).toBe(true)
    expect(toggleFold(folded, 'history', false)).toEqual(new Set())
  })
  it('a default-folded thing: a press opens it with an open: mark, the next press clears the mark', () => {
    const opened = toggleFold(new Set(), 'plans', true)
    expect(opened).toEqual(new Set(['open:plans']))
    expect(isFolded(opened, 'plans', true)).toBe(false)
    expect(toggleFold(opened, 'plans', true)).toEqual(new Set())
  })
  it('leaves the other marks alone and never leaves both marks on one key', () => {
    const next = toggleFold(new Set(['money', 'history', 'open:history']), 'history', false)
    expect(next).toEqual(new Set(['money']))
    expect(toggleFold(new Set(['money']), 'plans', true)).toEqual(new Set(['money', 'open:plans']))
  })
})

describe('readMoneySort / writeMoneySort', () => {
  it('reads tightest until number is written; anything else reads tightest', () => {
    expect(readMoneySort(D)).toBe('tightest')
    writeMoneySort(D, 'number')
    expect(store.get('pt.development.harlow.money.sort')).toBe('number')
    expect(readMoneySort(D)).toBe('number')
    expect(readMoneySort('ridgeway')).toBe('tightest')
    store.set('pt.development.harlow.money.sort', 'progress')
    expect(readMoneySort(D)).toBe('tightest')
  })
  it('tightest and the looks that are not settings remove the key', () => {
    writeMoneySort(D, 'number')
    writeMoneySort(D, 'tightest')
    expect(store.has('pt.development.harlow.money.sort')).toBe(false)
    writeMoneySort(D, 'number')
    writeMoneySort(D, 'progress')
    expect(store.has('pt.development.harlow.money.sort')).toBe(false)
    writeMoneySort(D, 'number')
    writeMoneySort(D, 'left')
    expect(store.has('pt.development.harlow.money.sort')).toBe(false)
  })
  it('a device that refuses storage reads tightest and swallows the write', () => {
    throwing = true
    expect(readMoneySort(D)).toBe('tightest')
    expect(() => writeMoneySort(D, 'number')).not.toThrow()
  })
})
