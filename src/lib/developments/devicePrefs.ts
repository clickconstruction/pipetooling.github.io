/**
 * What the Development page remembers on the device (punch list #208, design spike): which looks
 * are folded, which Money sections and whether its band is, and the Money order when it is a
 * setting (`MONEY_SORT_IS_SETTING`); a look (percent complete, most left) is never written, as the
 * Pipeline does it. One key per development, in `localStorage`, nothing in the database.
 */
import { MONEY_SORT_IS_SETTING, type MoneySortMode } from './siteMoney'

const foldsKey = (developmentId: string, scope: string) => `pt.development.${developmentId}.folds.${scope}`
const sortKey = (developmentId: string) => `pt.development.${developmentId}.money.sort`

function readSet(key: string): Set<string> {
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return new Set()
    const parsed: unknown = JSON.parse(raw)
    return new Set(Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [])
  } catch {
    return new Set()
  }
}

function writeSet(key: string, set: ReadonlySet<string>): void {
  try {
    if (set.size === 0) window.localStorage.removeItem(key)
    else window.localStorage.setItem(key, JSON.stringify([...set]))
  } catch {
    /* the page works without the memory */
  }
}

/** `scope` is `looks` (the cards) or `money` (the band and the sections). A key present means *folded*; `open:<key>` means opened against its default. */
export function readFolds(developmentId: string, scope: 'looks' | 'money'): Set<string> {
  return readSet(foldsKey(developmentId, scope))
}

export function writeFolds(developmentId: string, scope: 'looks' | 'money', folds: ReadonlySet<string>): void {
  writeSet(foldsKey(developmentId, scope), folds)
}

/** Folded or not, from the device's marks and the thing's default. */
export function isFolded(folds: ReadonlySet<string>, key: string, defaultFolded: boolean): boolean {
  if (folds.has(key)) return true
  if (folds.has(`open:${key}`)) return false
  return defaultFolded
}

/** The next marks after a press on `key`. */
export function toggleFold(folds: ReadonlySet<string>, key: string, defaultFolded: boolean): Set<string> {
  const next = new Set(folds)
  const now = isFolded(folds, key, defaultFolded)
  next.delete(key)
  next.delete(`open:${key}`)
  if (!now && !defaultFolded) next.add(key)
  if (now && defaultFolded) next.add(`open:${key}`)
  if (!now && defaultFolded) {
    /* folding a default-folded thing: back to its default, nothing to mark */
  }
  if (now && !defaultFolded) {
    /* opening a default-open thing: back to its default */
  }
  return next
}

export function readMoneySort(developmentId: string): MoneySortMode {
  try {
    const raw = window.localStorage.getItem(sortKey(developmentId))
    return raw === 'number' ? 'number' : 'tightest'
  } catch {
    return 'tightest'
  }
}

export function writeMoneySort(developmentId: string, mode: MoneySortMode): void {
  try {
    if (!MONEY_SORT_IS_SETTING.has(mode) || mode === 'tightest') window.localStorage.removeItem(sortKey(developmentId))
    else window.localStorage.setItem(sortKey(developmentId), mode)
  } catch {
    /* the page works without the memory */
  }
}
