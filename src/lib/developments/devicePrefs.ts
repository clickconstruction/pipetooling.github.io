/**
 * What the Development page remembers on the device (punch list #208, design spike): which looks
 * are folded, which Money sections and whether its band is, and the Money order when it is a
 * setting (`MONEY_SORT_IS_SETTING`); a look (percent complete, most left) is never written, as the
 * Pipeline does it. One key per development, in `localStorage`, nothing in the database.
 */
import { MONEY_SORT_IS_SETTING, type MoneySortMode } from './siteMoney'
import { isScoreboardCut, isScoreboardWindowKey, type ScoreboardCut, type ScoreboardWindowKey } from './scoreboardCuts'

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

/** The Money look's view (v2.6407): where the money is, the scoreboard or, since v2.6493, the timeline; the device remembers the one you were in. */
export type MoneyView = 'money' | 'scoreboard' | 'timeline'

const viewKey = (developmentId: string) => `pt.development.${developmentId}.money.view`

export function readMoneyView(developmentId: string): MoneyView {
  try {
    const raw = window.localStorage.getItem(viewKey(developmentId))
    return raw === 'scoreboard' || raw === 'timeline' ? raw : 'money'
  } catch {
    return 'money'
  }
}

export function writeMoneyView(developmentId: string, view: MoneyView): void {
  try {
    if (view === 'money') window.localStorage.removeItem(viewKey(developmentId))
    else window.localStorage.setItem(viewKey(developmentId), view)
  } catch {
    /* the page works without the memory */
  }
}

/** The Scoreboard's cut and window (v2.6558, punch list #250 PR 4): the device remembers both; job and all time, the defaults, leave no key. */
const cutKey = (developmentId: string) => `pt.development.${developmentId}.scoreboard.cut`
const windowKey = (developmentId: string) => `pt.development.${developmentId}.scoreboard.window`

export function readScoreboardCut(developmentId: string): ScoreboardCut {
  try {
    const raw = window.localStorage.getItem(cutKey(developmentId))
    return isScoreboardCut(raw) ? raw : 'job'
  } catch {
    return 'job'
  }
}

export function writeScoreboardCut(developmentId: string, cut: ScoreboardCut): void {
  try {
    if (cut === 'job') window.localStorage.removeItem(cutKey(developmentId))
    else window.localStorage.setItem(cutKey(developmentId), cut)
  } catch {
    /* the page works without the memory */
  }
}

export function readScoreboardWindow(developmentId: string): ScoreboardWindowKey {
  try {
    const raw = window.localStorage.getItem(windowKey(developmentId))
    return isScoreboardWindowKey(raw) ? raw : 'all'
  } catch {
    return 'all'
  }
}

export function writeScoreboardWindow(developmentId: string, key: ScoreboardWindowKey): void {
  try {
    if (key === 'all') window.localStorage.removeItem(windowKey(developmentId))
    else window.localStorage.setItem(windowKey(developmentId), key)
  } catch {
    /* the page works without the memory */
  }
}
