/**
 * Materials on site: a box's own history and each line's (v2.7199, the owner's ask of 2026-11-13 for a box
 * window with a Cage tab and a Contents tab). Everything here is a reading of rows the app already keeps:
 * the box's row, its moves (`job_container_moves`), its old names (`job_container_names`) and the ledger
 * (`job_material_movements`). Nothing is written. Pure.
 */
import { partKey, type Container, type ContainerMove, type Movement, type Place } from './onSite'

/** A box's old name giving way to a new one, as the database's trigger keeps it. */
export type BoxNameChange = { id: string; containerId: string; oldLabel: string; newLabel: string; byName: string; at: string }

/** One line of a history: when, what in words, and who. */
export type HistoryEvent = { key: string; at: string; words: string; by: string }

const place = (places: ReadonlyArray<Place>, id: string | null): string | null => (id ? (places.find((p) => p.id === id)?.name ?? null) : null)

const newestFirst = (a: HistoryEvent, b: HistoryEvent) => (a.at === b.at ? 0 : a.at < b.at ? 1 : -1)

/**
 * The box's own history, newest first: added, each move, each rename, and its retire. The name it was added
 * under is the old side of its first rename, or the name it carries now.
 */
export function boxHistory(box: Container, places: ReadonlyArray<Place>, moves: ReadonlyArray<ContainerMove>, names: ReadonlyArray<BoxNameChange>): HistoryEvent[] {
  const mine = moves.filter((m) => m.containerId === box.id)
  const renames = names.filter((n) => n.containerId === box.id).sort((a, b) => (a.at < b.at ? -1 : 1))
  const firstName = renames[0]?.oldLabel ?? box.label
  const out: HistoryEvent[] = [{ key: `added:${box.id}`, at: box.createdAt, words: `Added as ${firstName}`, by: '' }]
  for (const m of mine) {
    const from = place(places, m.fromLocationId)
    const to = place(places, m.toLocationId)
    const words = to ? (from ? `Moved from ${from} to ${to}` : `Placed at ${to}`) : from ? `Taken out of ${from}` : 'Moved'
    out.push({ key: `move:${m.id}`, at: m.at, words, by: m.byName })
  }
  for (const n of renames) out.push({ key: `name:${n.id}`, at: n.at, words: `Renamed from ${n.oldLabel} to ${n.newLabel}`, by: n.byName })
  if (box.retiredAt) out.push({ key: `retired:${box.id}`, at: box.retiredAt, words: 'Retired', by: '' })
  return out.sort(newestFirst)
}

/**
 * Where the box stood at a moment, by its moves: the place its last move before then took it to. Before its
 * first move it stood where that move took it from, and a box that never moved stood where it stands now.
 * Null when nobody had said.
 */
export function placeAt(box: Container, places: ReadonlyArray<Place>, moves: ReadonlyArray<ContainerMove>, at: string): string | null {
  const mine = moves.filter((m) => m.containerId === box.id).sort((a, b) => (a.at < b.at ? -1 : 1))
  const first = mine[0]
  if (!first) return place(places, box.locationId)
  let here: string | null = first.fromLocationId
  for (const m of mine) {
    if (m.at > at) break
    here = m.toLocationId
  }
  return place(places, here)
}

const plural = (n: number, one: string, many: string) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`

/** A box's name by its id, for a line that moved in or out. */
type NameOf = (containerId: string | null) => string

/**
 * One line's history in one box, newest first: every ledger row that put some of the part in, took some out
 * or counted it. A count says what it found against what the ledger expected at that moment.
 */
export function lineHistory(movements: ReadonlyArray<Movement>, containerId: string, key: string, nameOf: NameOf): HistoryEvent[] {
  const rows = movements
    .filter((m) => partKey(m.partId, m.partName) === key && (m.fromContainerId === containerId || m.toContainerId === containerId))
    .sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0))
  let onHand = 0
  const out: HistoryEvent[] = []
  for (const m of rows) {
    const n = m.quantity
    let words: string
    if (m.reason === 'counted') {
      const diff = n - onHand
      words = `Counted ${n.toLocaleString('en-US')}${diff === 0 ? ', as expected' : diff < 0 ? `, ${Math.abs(diff).toLocaleString('en-US')} short` : `, ${diff.toLocaleString('en-US')} more than expected`}`
      onHand = n
    } else if (m.toContainerId === containerId && m.fromContainerId !== containerId) {
      words = m.reason === 'moved' ? `${n.toLocaleString('en-US')} moved in from ${nameOf(m.fromContainerId)}` : `Added ${n.toLocaleString('en-US')}${m.source ? ` from ${m.source}` : ''}`
      onHand += n
    } else {
      const left: Record<Exclude<Movement['reason'], 'counted' | 'delivered'>, string> = {
        moved: `${n.toLocaleString('en-US')} moved to ${nameOf(m.toContainerId)}`,
        used: `Used ${n.toLocaleString('en-US')}`,
        returned: `${n.toLocaleString('en-US')} sent back to the supply house`,
        taken: `${n.toLocaleString('en-US')} taken${m.note ? ` to ${m.note}` : ''}`,
        cannot_find: `Can’t find ${n.toLocaleString('en-US')}`,
        damaged: `${n.toLocaleString('en-US')} damaged`,
      }
      words = m.reason === 'delivered' ? `Added ${n.toLocaleString('en-US')}` : left[m.reason]
      onHand = Math.max(0, onHand - n)
    }
    out.push({ key: m.id, at: m.at, words, by: m.byName })
  }
  return out.reverse()
}

/** When a part first came into this box, and by whom: its first ledger row here. Null for a line with no rows read. */
export function lineAdded(movements: ReadonlyArray<Movement>, containerId: string, key: string): { at: string; by: string } | null {
  let first: Movement | null = null
  for (const m of movements) {
    if (partKey(m.partId, m.partName) !== key) continue
    if (m.fromContainerId !== containerId && m.toContainerId !== containerId) continue
    if (!first || m.at < first.at) first = m
  }
  return first ? { at: first.at, by: first.byName } : null
}

/** Under a line's name: *Added Nov 1 by Marcus, at Arena*. The day is drawn by the caller, so this takes it as words. */
export function lineAddedWords(day: string, by: string, placeName: string | null): string {
  return `Added ${day}${by ? ` by ${by}` : ''}${placeName ? `, at ${placeName}` : ''}`
}

/** The tab's own count: *Contents · 3*. */
export function contentsTabWords(lines: number): string {
  return lines > 0 ? `Contents · ${lines.toLocaleString('en-US')}` : 'Contents'
}

/** The fold on a line: *4 events*. */
export function historyFoldWords(n: number): string {
  return plural(n, 'event', 'events')
}
