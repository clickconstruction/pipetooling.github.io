/**
 * Materials on site (punch list #209): the ledger of movements behind every number a crew or the
 * office reads about a part in a container on a job. Nobody types a quantity over another: a press
 * names what happened to some of a part, and the number on the screen is the sum of the rows. A
 * count is a row like any other, a point in time that resets the sum and leaves the difference on
 * record, so "report when they are missing" is the same rows read a second way.
 *
 * Pure rules only. The spike's store is `onSiteStore.ts` (the phone's own storage until the two
 * tables land); the field tab is `components/tally/TallyOnSiteTab.tsx`, the office tab
 * `components/jobs/JobsMaterialsTab.tsx`.
 */

export const MOVEMENT_REASONS = ['delivered', 'moved', 'used', 'returned', 'taken', 'cannot_find', 'damaged', 'counted'] as const
export type MovementReason = (typeof MOVEMENT_REASONS)[number]

export const CONTAINER_KINDS = ['cage', 'box', 'loose', 'unsorted'] as const
export type ContainerKind = (typeof CONTAINER_KINDS)[number]

/** A container of a job: the stencil is the human id, the row is the app's. Per job, never shared. */
export type Container = {
  id: string
  jobId: string
  /** The stencil: A1, A2, B1 … or Unsorted for the system row a delivery lands in. */
  label: string
  kind: ContainerKind
  /** A note on where exactly inside its place ("by the north stair"); empty when nobody said. */
  where: string
  /** The place on site it stands in (`Place`), null until someone says. A big site has several. */
  locationId: string | null
  /** Its pin on the site map, set from the phone where the crew stands or by dragging; null until marked. */
  lat: number | null
  lng: number | null
  retiredAt: string | null
  createdAt: string
}

/** A place on a site: a building level, the laydown yard, the mech room. Per job; a box moves between them. */
export type Place = {
  id: string
  jobId: string
  name: string
  createdAt: string
}

/** A box moved from one place to another: the container's own history, apart from its parts. */
export type ContainerMove = {
  id: string
  jobId: string
  containerId: string
  fromLocationId: string | null
  toLocationId: string | null
  byName: string
  at: string
}

/** One thing that happened to some of a part. Append only: a wrong press gets a correcting row. */
export type Movement = {
  id: string
  jobId: string
  /** `material_parts.id`, or null for a name typed on site the office ties later. */
  partId: string | null
  partName: string
  manufacturer: string | null
  /** Always positive. For `counted` it is the number counted, not a change. */
  quantity: number
  reason: MovementReason
  /** Null on a delivery (it came from outside). */
  fromContainerId: string | null
  /** Null when the part left the job: used, returned, taken, cannot find, damaged. */
  toContainerId: string | null
  /** Where a taken part went ("Mateo's truck", "the shop"), a note, or nothing. */
  note: string
  byUserId: string | null
  byName: string
  at: string
  /** The PO or procurement line behind a delivery, when known. */
  source: string | null
  /** V3: the engraved item this row is about. Null until then. */
  itemId: string | null
}

/** A line of a container: one part, with its number as the ledger reads it. */
export type ContainerLine = {
  containerId: string
  partKey: string
  partId: string | null
  partName: string
  manufacturer: string | null
  onHand: number
  lastTouchedAt: string | null
  lastTouchedBy: string | null
  lastCountAt: string | null
  lastCountBy: string | null
  /** The last count's difference: negative = missing, positive = found, 0 = counted right. Null when never counted. */
  lastCountDiff: number | null
  /** A press of Can't find since the last count: the office reads the line amber. */
  cannotFindSinceCount: number
}

/** A count's result: what the ledger expected against what was counted. */
export type CountDiff = {
  movementId: string
  at: string
  byName: string
  containerId: string
  partKey: string
  partId: string | null
  partName: string
  manufacturer: string | null
  expected: number
  counted: number
  /** counted − expected: negative = missing, positive = found. */
  diff: number
}

/** A container is due a count after this many days without one (the Needs you line, the amber card). */
export const STALE_COUNT_DAYS = 14

export const UNSORTED_LABEL = 'Unsorted'

/** The one key a part has on a job: its book id, or its typed name folded. */
export function partKey(partId: string | null, partName: string): string {
  return partId ? `id:${partId}` : `text:${partName.trim().toLowerCase().replace(/\s+/g, ' ')}`
}

/** Which rows a reason writes: the sign on the from side and the to side. */
export function reasonSides(reason: MovementReason): { from: -1 | 0; to: 1 | 0 } {
  switch (reason) {
    case 'delivered':
      return { from: 0, to: 1 }
    case 'moved':
      return { from: -1, to: 1 }
    case 'counted':
      return { from: 0, to: 0 }
    default:
      return { from: -1, to: 0 }
  }
}

function byTime(a: Movement, b: Movement): number {
  return a.at < b.at ? -1 : a.at > b.at ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

type Acc = { onHand: number; lastTouchedAt: string | null; lastTouchedBy: string | null; lastCountAt: string | null; lastCountBy: string | null; lastCountDiff: number | null; cannotFindSinceCount: number; partId: string | null; partName: string; manufacturer: string | null }

function key(containerId: string, pk: string): string {
  return `${containerId}\u0000${pk}`
}

/**
 * The lines of every container on a job, read from its movements in time order. A `counted` row
 * resets the line to the counted number and records the difference; every other row adds to its
 * to side and takes from its from side.
 */
export function containerLines(movements: ReadonlyArray<Movement>): ContainerLine[] {
  const acc = new Map<string, Acc>()
  const get = (containerId: string, m: Movement): Acc => {
    const k = key(containerId, partKey(m.partId, m.partName))
    let a = acc.get(k)
    if (!a) {
      a = { onHand: 0, lastTouchedAt: null, lastTouchedBy: null, lastCountAt: null, lastCountBy: null, lastCountDiff: null, cannotFindSinceCount: 0, partId: m.partId, partName: m.partName, manufacturer: m.manufacturer }
      acc.set(k, a)
    }
    return a
  }
  for (const m of [...movements].sort(byTime)) {
    if (m.reason === 'counted') {
      if (!m.fromContainerId) continue
      const a = get(m.fromContainerId, m)
      a.lastCountDiff = m.quantity - a.onHand
      a.onHand = m.quantity
      a.lastCountAt = m.at
      a.lastCountBy = m.byName
      a.lastTouchedAt = m.at
      a.lastTouchedBy = m.byName
      a.cannotFindSinceCount = 0
      continue
    }
    const sides = reasonSides(m.reason)
    if (sides.from && m.fromContainerId) {
      const a = get(m.fromContainerId, m)
      a.onHand -= m.quantity
      a.lastTouchedAt = m.at
      a.lastTouchedBy = m.byName
      if (m.reason === 'cannot_find') a.cannotFindSinceCount += m.quantity
    }
    if (sides.to && m.toContainerId) {
      const a = get(m.toContainerId, m)
      a.onHand += m.quantity
      a.lastTouchedAt = m.at
      a.lastTouchedBy = m.byName
    }
  }
  const out: ContainerLine[] = []
  for (const [k, a] of acc) {
    const [containerId, pk] = k.split('\u0000') as [string, string]
    out.push({ containerId, partKey: pk, partId: a.partId, partName: a.partName, manufacturer: a.manufacturer, onHand: a.onHand, lastTouchedAt: a.lastTouchedAt, lastTouchedBy: a.lastTouchedBy, lastCountAt: a.lastCountAt, lastCountBy: a.lastCountBy, lastCountDiff: a.lastCountDiff, cannotFindSinceCount: a.cannotFindSinceCount })
  }
  return out.sort((x, y) => x.partName.localeCompare(y.partName) || x.partKey.localeCompare(y.partKey))
}

/**
 * The lines of one container a crew should see: something on hand, a Can't find since the last
 * count, or a shortfall at the last count. A line counted to zero with nothing owed drops out.
 */
export function linesOf(lines: ReadonlyArray<ContainerLine>, containerId: string): ContainerLine[] {
  return lines.filter((l) => l.containerId === containerId && (l.onHand > 0 || l.cannotFindSinceCount > 0 || (l.lastCountDiff ?? 0) < 0))
}

/** Every count's difference, newest first: the Missing section and the money read these. */
export function countDiffs(movements: ReadonlyArray<Movement>): CountDiff[] {
  const running = new Map<string, number>()
  const out: CountDiff[] = []
  for (const m of [...movements].sort(byTime)) {
    const pk = partKey(m.partId, m.partName)
    if (m.reason === 'counted') {
      if (!m.fromContainerId) continue
      const k = key(m.fromContainerId, pk)
      const expected = running.get(k) ?? 0
      out.push({ movementId: m.id, at: m.at, byName: m.byName, containerId: m.fromContainerId, partKey: pk, partId: m.partId, partName: m.partName, manufacturer: m.manufacturer, expected, counted: m.quantity, diff: m.quantity - expected })
      running.set(k, m.quantity)
      continue
    }
    const sides = reasonSides(m.reason)
    if (sides.from && m.fromContainerId) {
      const k = key(m.fromContainerId, pk)
      running.set(k, (running.get(k) ?? 0) - m.quantity)
    }
    if (sides.to && m.toContainerId) {
      const k = key(m.toContainerId, pk)
      running.set(k, (running.get(k) ?? 0) + m.quantity)
    }
  }
  return out.reverse()
}

/** When a container was last counted: the newest count row in it, or null. */
export function lastCountedAt(movements: ReadonlyArray<Movement>, containerId: string): { at: string; byName: string } | null {
  let best: Movement | null = null
  for (const m of movements) {
    if (m.reason !== 'counted' || m.fromContainerId !== containerId) continue
    if (!best || m.at > best.at) best = m
  }
  return best ? { at: best.at, byName: best.byName } : null
}

/** Days since a stamp, whole, at `now`. */
export function daysSince(iso: string, now: Date): number {
  return Math.floor((now.getTime() - new Date(iso).getTime()) / 86_400_000)
}

/** A container with no count, or one older than `STALE_COUNT_DAYS`, is due a count. */
export function countIsDue(last: { at: string } | null, now: Date): boolean {
  return last == null || daysSince(last.at, now) >= STALE_COUNT_DAYS
}

/** "counted Mon by Jordan" · "counted 12 days ago" · "never counted". */
export function lastCountWords(last: { at: string; byName: string } | null, now: Date): string {
  if (!last) return 'never counted'
  const days = daysSince(last.at, now)
  if (days <= 0) return `counted today by ${last.byName}`
  if (days === 1) return `counted yesterday by ${last.byName}`
  if (days < 7) return `counted ${new Date(last.at).toLocaleDateString(undefined, { weekday: 'short' })} by ${last.byName}`
  return `counted ${days} days ago`
}

/** The search box across the whole site: every line whose name or maker holds every word typed. */
export function searchLines(lines: ReadonlyArray<ContainerLine>, query: string): ContainerLine[] {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return []
  return lines.filter((l) => {
    const hay = `${l.partName} ${l.manufacturer ?? ''}`.toLowerCase()
    return words.every((w) => hay.includes(w)) && (l.onHand !== 0 || l.lastCountAt != null)
  })
}

/** The words on a press: the verb a crew reads, and the row's past-tense word the office reads. */
export const REASON_WORDS: Record<MovementReason, { press: string; past: string }> = {
  delivered: { press: 'Delivered', past: 'Delivered' },
  moved: { press: 'Move to…', past: 'Moved' },
  used: { press: 'Used', past: 'Used' },
  returned: { press: 'Back to the supply house', past: 'Returned' },
  taken: { press: 'Taken', past: 'Taken' },
  cannot_find: { press: "Can't find", past: "Can't find" },
  damaged: { press: 'Damaged, scrap', past: 'Damaged' },
  counted: { press: 'Count', past: 'Count' },
}

/** The button under a number sheet says exactly what it will do with its count: "Mark 4 used", "Move 10 to A1", "Mark 2 as can't find". */
export function pressLabel(reason: MovementReason, n: number, destination?: string): string {
  switch (reason) {
    case 'used':
      return `Mark ${n} used`
    case 'moved':
      return `Move ${n} to ${destination ?? '…'}`
    case 'returned':
      return `Send ${n} back`
    case 'taken':
      return `Take ${n} to ${destination ?? '…'}`
    case 'cannot_find':
      return `Mark ${n} as can't find`
    case 'damaged':
      return `Mark ${n} damaged`
    case 'counted':
      return `Save ${n}`
    case 'delivered':
      return `Add ${n}`
  }
}

/** "A2 will have 10 left." after a press that takes `n` from a line with `onHand`. */
export function leftWords(containerLabel: string, onHand: number, n: number): string {
  const left = onHand - n
  if (left <= 0) return `${containerLabel} will have none left.`
  return `${containerLabel} will have ${left} left.`
}

/** The money a count's shortfall costs at a unit price, in cents from dollars; null when no price is known. */
export function missingMoney(diff: number, unitPrice: number | null): number | null {
  if (diff >= 0 || unitPrice == null) return null
  return Math.round(-diff * unitPrice * 100) / 100
}

/** A container's label and kind as a crew reads them: "A2 · cage", "Unsorted · delivered". */
export function containerWords(c: Pick<Container, 'label' | 'kind'>): string {
  return `${c.label} · ${c.kind === 'unsorted' ? 'delivered' : c.kind}`
}

/** The next free stencil of a kind, A1 → A2, B1 → B2, for Add a container's suggestion. */
export function nextLabel(existing: ReadonlyArray<Pick<Container, 'label'>>, prefix: string): string {
  let n = 0
  for (const c of existing) {
    const m = new RegExp(`^${prefix}(\\d+)$`, 'i').exec(c.label.trim())
    if (m) n = Math.max(n, Number(m[1]))
  }
  return `${prefix.toUpperCase()}${n + 1}`
}

/** Stencils sort as people read them: A1, A2, A10, B1, not A1, A10, A2. */
export function compareLabels(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
}

export type PlaceGroup = { place: Place | null; containers: Container[] }

/**
 * The containers of a job grouped by place, the places in name order, the ones with no place last,
 * the system Unsorted row first on its own. Within a group the stencils sort as read.
 */
export function groupByPlace(containers: ReadonlyArray<Container>, places: ReadonlyArray<Place>): PlaceGroup[] {
  const live = containers.filter((c) => !c.retiredAt)
  const out: PlaceGroup[] = []
  const unsorted = live.filter((c) => c.kind === 'unsorted')
  if (unsorted.length) out.push({ place: null, containers: unsorted })
  const byPlace = new Map<string, Container[]>()
  const none: Container[] = []
  for (const c of live) {
    if (c.kind === 'unsorted') continue
    if (c.locationId && places.some((p) => p.id === c.locationId)) byPlace.set(c.locationId, [...(byPlace.get(c.locationId) ?? []), c])
    else none.push(c)
  }
  for (const p of [...places].sort((a, b) => compareLabels(a.name, b.name))) {
    const cs = byPlace.get(p.id)
    if (cs?.length) out.push({ place: p, containers: cs.sort((a, b) => compareLabels(a.label, b.label)) })
  }
  if (none.length) out.push({ place: null, containers: none.sort((a, b) => compareLabels(a.label, b.label)) })
  return out
}

/** The containers whose stencil starts with what was typed, spaces and case ignored: "b 12" finds B12 and B120. */
export function searchContainers(containers: ReadonlyArray<Container>, query: string): Container[] {
  const q = query.replace(/\s+/g, '').toLowerCase()
  if (!q) return []
  return containers.filter((c) => !c.retiredAt && c.label.replace(/\s+/g, '').toLowerCase().startsWith(q)).sort((a, b) => compareLabels(a.label, b.label))
}

/** "Level 2" · "no place yet" */
export function placeName(places: ReadonlyArray<Place>, id: string | null): string {
  return places.find((p) => p.id === id)?.name ?? 'no place yet'
}
