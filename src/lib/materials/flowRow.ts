/**
 * Materials on site (punch list #209): the flow row's figures. One row at the pills' height reads the
 * material's path left to right — came in → on site → used → missing — each figure in its colour, with
 * a badge where a hand is needed; the phone's row is the three names the crew already sees, Unsorted,
 * Used and Count, each with its count. Pure: the money comes through `priceOf`.
 */
import { containerLines, countDiffs, countIsDue, lastCountedAt, linesOf, missingMoney, partKey, type Container, type ContainerLine, type Movement } from './onSite'

/** The window the Missing figure and its money read over. */
export const FLOW_WINDOW_DAYS = 7

export type OfficeFlow = {
  /** Pieces delivered to the job, all time. */
  cameIn: number
  /** Pieces still in Unsorted: what waits to be put away. The amber badge on came in. */
  unsorted: number
  /** Pieces on hand across the job's live containers, Unsorted included. */
  onSite: number
  /** Live boxes, Unsorted left out. */
  boxes: number
  /** Boxes that need a hand: due a count, or with a Can't find since their last count. The amber badge on on site. */
  due: number
  /** Pieces the crew pressed Used on, all time. */
  used: number
  /** Pieces short in the window: counts under the ledger, plus Can't find presses. */
  missing: number
  /** The window's shortfall priced, where a price is known. The red badge on missing. */
  missingMoney: number
}

export type PhoneFlow = {
  /** Pieces in Unsorted, and the container to open; null when the job has none. */
  unsorted: number
  unsortedId: string | null
  /** Pieces pressed Used since midnight, and the boxes they came from. */
  usedToday: number
  usedBoxIds: string[]
  /** Boxes that need a hand today: due a count, or with a Can't find since their last count. */
  due: number
  dueBoxIds: string[]
}

/** The boxes that need a hand: due a count, or holding a Can't find since the last count. Unsorted is never one. */
export function boxesNeedingAHand(containers: ReadonlyArray<Container>, lines: ReadonlyArray<ContainerLine>, movements: ReadonlyArray<Movement>, now: Date): Container[] {
  return containers.filter((c) => !c.retiredAt && c.kind !== 'unsorted' && (countIsDue(lastCountedAt(movements, c.id), now) || linesOf(lines, c.id).some((l) => l.cannotFindSinceCount > 0)))
}

export function officeFlow(containers: ReadonlyArray<Container>, movements: ReadonlyArray<Movement>, now: Date, priceOf: (key: string) => number | null, windowDays = FLOW_WINDOW_DAYS): OfficeFlow {
  const live = containers.filter((c) => !c.retiredAt)
  const liveIds = new Set(live.map((c) => c.id))
  const unsortedIds = new Set(live.filter((c) => c.kind === 'unsorted').map((c) => c.id))
  const lines = containerLines(movements)
  let cameIn = 0
  let used = 0
  for (const m of movements) {
    if (m.reason === 'delivered') cameIn += m.quantity
    else if (m.reason === 'used') used += m.quantity
  }
  let onSite = 0
  let unsorted = 0
  for (const l of lines) {
    if (l.onHand <= 0 || !liveIds.has(l.containerId)) continue
    onSite += l.onHand
    if (unsortedIds.has(l.containerId)) unsorted += l.onHand
  }
  const since = new Date(now.getTime() - windowDays * 86_400_000).toISOString()
  let missing = 0
  let money = 0
  for (const d of countDiffs(movements)) {
    if (d.at < since || d.diff >= 0) continue
    missing += -d.diff
    money += missingMoney(d.diff, priceOf(d.partKey)) ?? 0
  }
  for (const m of movements) {
    if (m.reason !== 'cannot_find' || m.at < since) continue
    missing += m.quantity
    money += missingMoney(-m.quantity, priceOf(partKey(m.partId, m.partName))) ?? 0
  }
  return {
    cameIn,
    unsorted,
    onSite,
    boxes: live.filter((c) => c.kind !== 'unsorted').length,
    due: boxesNeedingAHand(live, lines, movements, now).length,
    used,
    missing,
    missingMoney: money,
  }
}

/** Midnight of `now`'s day on this device, as the ledger's ISO stamps compare. */
export function startOfDayIso(now: Date): string {
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

export function phoneFlow(containers: ReadonlyArray<Container>, movements: ReadonlyArray<Movement>, now: Date): PhoneFlow {
  const live = containers.filter((c) => !c.retiredAt)
  const lines = containerLines(movements)
  const un = live.find((c) => c.kind === 'unsorted') ?? null
  const unsorted = un ? linesOf(lines, un.id).reduce((s, l) => s + Math.max(0, l.onHand), 0) : 0
  const dayStart = startOfDayIso(now)
  let usedToday = 0
  const usedBoxes = new Set<string>()
  for (const m of movements) {
    if (m.reason !== 'used' || m.at < dayStart) continue
    usedToday += m.quantity
    if (m.fromContainerId) usedBoxes.add(m.fromContainerId)
  }
  const due = boxesNeedingAHand(live, lines, movements, now)
  return { unsorted, unsortedId: un?.id ?? null, usedToday, usedBoxIds: [...usedBoxes], due: due.length, dueBoxIds: due.map((c) => c.id) }
}

/** 1,250 — the row's figures with their thousands mark. */
export function flowFigure(n: number): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: 0 })
}
