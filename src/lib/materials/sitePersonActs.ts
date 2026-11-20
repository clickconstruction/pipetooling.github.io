/**
 * A site's presses read by person: the **By person** look of a site's materials screen
 * (`SitePeopleView.tsx`). Every ledger row and every box move across the site's jobs becomes one
 * act with its words, newest first, so the office reads what one person did with the material on a
 * site without opening each job's History in turn.
 *
 * Pure: the rows come from the store the desk has already loaded, and nothing here reads or
 * writes. A person is the name on the row (`by_name`), as a job's History filters by it: a box
 * move carries a name and no id, so the name is the one key every act has.
 *
 * Three kinds of act are **worth a look** and wear a chip: a count that changed a number the app
 * already had, a part added by hand to a line that already had a number, and a take or a use with no note. A
 * count that found what the app expected wears none, and neither does the first count of a line or
 * the first part added to one: counting a box in is how a site's record starts, by Count or by Add
 * a part, and a chip on every row of it would say nothing.
 * The chips are the same for everyone. Whose process a press breaks is not known here.
 */
import { partKey, REASON_WORDS, reasonSides, type Container, type ContainerMove, type Movement, type MovementReason, type Place } from './onSite'

export type ActKind = MovementReason | 'box_moved' | 'box_retired' | 'box_brought_back' | 'box_changed' | 'box_renamed' | 'answer_removed'

/** A box retired, brought back, or its kind, where line or words changed (`job_container_changes`). */
export type BoxChange = { id: string; containerId: string; what: 'retired' | 'brought_back' | 'kind' | 'where' | 'said'; oldValue: string; newValue: string; byName: string; at: string }
/** A box renamed (`job_container_names`). */
export type BoxRename = { id: string; containerId: string; oldLabel: string; newLabel: string; byName: string; at: string }
/**
 * The way back from a box change: what to write, and the words of its press. Offered only while the box
 * still reads as the change left it, so a put-back never walks over a later change.
 */
export type PutBack = { containerId: string; act: 'unretire' | 'retire' | 'patch'; patch?: { label?: string; kind?: 'cage' | 'box' | 'loose'; where?: string; said?: string | null }; words: string }

/** A dev's live answer to a press (`job_movement_answers`): taken back, or marked as not allowed. */
export type PressAnswer = { id: string; movementId: string; answer: 'taken_back' | 'marked'; why: string; byName: string; at: string }
/** A part tie or a site price someone took off (`on_site_removed_answers`), with the words of the row as it stood. */
export type RemovedAnswer = { id: string; answer: 'tie' | 'price'; jobId: string | null; words: string; byName: string; at: string }
export type ActLook = 'count_changed' | 'no_source' | 'no_note'

export type PersonAct = {
  /** The row behind it: a ledger row's id, or a box move's. */
  id: string
  at: string
  /** The day it happened on, as `dayOf` reads the time: the key the list groups by. */
  day: string
  kind: ActKind
  /** The act in the office's words: Taken, Count, Moved a box. */
  what: string
  /** The part, or null for a box move. */
  part: string | null
  /** The quantity as the row reads: −12, +40, 40 → 12 for a count, empty for a box move. */
  qty: string
  /** Pieces that left through a take or a use; 0 for every other act. */
  pieces: number
  /** The boxes the act touched, for the count of boxes and the door to each. */
  boxIds: string[]
  /** The box to open from the row, or null when it names none. */
  boxId: string | null
  /** Where: the box and its place, both ends for a move. */
  where: string
  jobId: string
  jobLabel: string
  note: string
  who: string
  personKey: string
  /** The login behind the row, where the row carries one: a ledger row does, a box change does not. */
  byUserId: string | null
  looks: ActLook[]
  /** Why the act is outside the process, for a person the office is watching (`withWatch`); null otherwise. */
  outside: string | null
  /** The live answer on the press, or null. A press taken back is in no sum and is drawn struck through. */
  answer: PressAnswer | null
  /** The way back from a box change, or null: not a box change, or the box has changed again since. */
  putBack: PutBack | null
}

export type ActPerson = { key: string; name: string; acts: number; lastAt: string; userIds: string[] }

export type SiteActsInput = {
  jobs: ReadonlyArray<{ id: string; label: string }>
  movements: ReadonlyArray<Movement>
  containerMoves: ReadonlyArray<ContainerMove>
  containers: ReadonlyArray<Container>
  places: ReadonlyArray<Place>
  /** The trail of changes that are not ledger rows. Each is left out until its read answers. */
  boxChanges?: ReadonlyArray<BoxChange>
  boxRenames?: ReadonlyArray<BoxRename>
  removedAnswers?: ReadonlyArray<RemovedAnswer>
  /** The live answers to presses, and the ledger rows taken back, which the ledger's own read leaves out. */
  answers?: ReadonlyArray<PressAnswer>
  takenBack?: ReadonlyArray<Movement>
}

/** The chip on an act worth a look, and the title that says why. */
export const LOOK_WORDS: Record<ActLook, { chip: string; why: string }> = {
  count_changed: { chip: 'count changed the number', why: 'This count changed a number the app already had for the line.' },
  no_source: { chip: 'added by hand', why: 'Added by hand to a line the app already had a number for, with no invoice or PO behind it.' },
  no_note: { chip: 'no note', why: 'Material left the box and the row does not say where it went.' },
}

export const BOX_MOVED_WORDS = 'Moved a box'
/** The words of an act that is not a ledger row. */
export const BOX_ACT_WORDS = {
  box_retired: 'Retired a box',
  box_brought_back: 'Brought a box back',
  box_changed: 'Changed a box',
  box_renamed: 'Renamed a box',
  answer_removed_tie: 'Undid a join',
  answer_removed_price: 'Removed a price',
} as const
const CHANGE_FIELD: Record<'kind' | 'where' | 'said', string> = { kind: 'kind', where: 'where', said: 'words' }
const NO_NAME = 'No name on the row'
const MINUS = '−'

/** The key a person's acts are kept under: the name on the row, in lower case. */
export function personKeyOf(name: string): string {
  return name.trim().toLowerCase()
}

/** The device's own day of a time, YYYY-MM-DD: the day a job's History stamps a row with. */
export function localDayOf(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const two = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`
}

/**
 * A press's day and time on the device's own clock, like *Thu, Nov 19, 1:26 PM*: how the look names a
 * person's last press, and how the answer window tells two presses that read alike apart.
 */
export function actStampWords(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}, ${d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`
}

function n(value: number): string {
  return value.toLocaleString('en-US')
}

/** The kinds a list can be narrowed to, in the order the picker offers them. */
export const ACT_KINDS: ReadonlyArray<{ kind: ActKind; words: string }> = [
  { kind: 'taken', words: REASON_WORDS.taken.past },
  { kind: 'used', words: REASON_WORDS.used.past },
  { kind: 'counted', words: REASON_WORDS.counted.past },
  { kind: 'delivered', words: REASON_WORDS.delivered.past },
  { kind: 'moved', words: REASON_WORDS.moved.past },
  { kind: 'returned', words: REASON_WORDS.returned.past },
  { kind: 'cannot_find', words: REASON_WORDS.cannot_find.past },
  { kind: 'damaged', words: REASON_WORDS.damaged.past },
  { kind: 'box_moved', words: BOX_MOVED_WORDS },
  { kind: 'box_retired', words: BOX_ACT_WORDS.box_retired },
  { kind: 'box_brought_back', words: BOX_ACT_WORDS.box_brought_back },
  { kind: 'box_changed', words: BOX_ACT_WORDS.box_changed },
  { kind: 'box_renamed', words: BOX_ACT_WORDS.box_renamed },
  { kind: 'answer_removed', words: 'Answer taken off' },
]

/** Every act on the site, newest first. */
export function sitePersonActs(input: SiteActsInput, dayOf: (iso: string) => string = localDayOf): PersonAct[] {
  const jobLabel = new Map(input.jobs.map((j) => [j.id, j.label]))
  const box = new Map(input.containers.map((c) => [c.id, c]))
  const place = new Map(input.places.map((p) => [p.id, p.name]))
  const boxWords = (id: string | null): string => {
    if (!id) return ''
    const c = box.get(id)
    if (!c) return 'a box no longer listed'
    const at = c.locationId ? place.get(c.locationId) : null
    return at ? `${c.label} · ${at}` : c.label
  }
  // What each count found against what the ledger expected, and whether the line had a row before
  // it: one pass in time order, as `containerLines` sums. A box is one job's, so a line is too.
  const counts = new Map<string, { expected: number; first: boolean }>()
  /** The deliveries that landed on a line with a row already: an add on top of a number, not a box counted in. */
  const addedOnTop = new Set<string>()
  const running = new Map<string, number>()
  const line = (containerId: string, m: Movement) => `${containerId}\u0000${partKey(m.partId, m.partName)}`
  const add = (k: string, by: number) => running.set(k, (running.get(k) ?? 0) + by)
  for (const m of [...input.movements].sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0))) {
    if (m.reason === 'counted') {
      if (!m.fromContainerId) continue
      const k = line(m.fromContainerId, m)
      counts.set(m.id, { expected: running.get(k) ?? 0, first: !running.has(k) })
      running.set(k, m.quantity)
      continue
    }
    const sides = reasonSides(m.reason)
    if (sides.from && m.fromContainerId) add(line(m.fromContainerId, m), -m.quantity)
    if (sides.to && m.toContainerId) {
      const k = line(m.toContainerId, m)
      if (m.reason === 'delivered' && running.has(k)) addedOnTop.add(m.id)
      add(k, m.quantity)
    }
  }

  const answerOf = new Map((input.answers ?? []).map((a) => [a.movementId, a]))
  const standing = new Set(input.movements.map((m) => m.id))
  const acts: PersonAct[] = []
  // The rows that stand, then the rows taken back: the same words, in no sum and with no chip.
  const ledger: Array<[Movement, boolean]> = [...input.movements.map((m): [Movement, boolean] => [m, false]), ...(input.takenBack ?? []).filter((m) => !standing.has(m.id)).map((m): [Movement, boolean] => [m, true])]
  for (const [m, struck] of ledger) {
    const who = m.byName.trim() || NO_NAME
    const looks: ActLook[] = []
    const count = struck ? undefined : counts.get(m.id)
    if (count && !count.first && count.expected !== m.quantity) looks.push('count_changed')
    if (!struck && m.reason === 'delivered' && !(m.source ?? '').trim() && addedOnTop.has(m.id)) looks.push('no_source')
    if (!struck && (m.reason === 'taken' || m.reason === 'used') && !m.note.trim()) looks.push('no_note')
    const qty =
      m.reason === 'counted'
        ? struck || !count
          ? n(m.quantity)
          : `${n(count.expected)} → ${n(m.quantity)}`
        : m.reason === 'delivered'
          ? `+${n(m.quantity)}`
          : m.reason === 'moved'
            ? n(m.quantity)
            : `${MINUS}${n(m.quantity)}`
    const where =
      m.reason === 'moved'
        ? `${boxWords(m.fromContainerId)} → ${boxWords(m.toContainerId)}`
        : boxWords(m.fromContainerId ?? m.toContainerId)
    acts.push({
      id: m.id,
      at: m.at,
      day: dayOf(m.at),
      kind: m.reason,
      what: REASON_WORDS[m.reason].past,
      part: m.partName,
      qty,
      pieces: !struck && (m.reason === 'taken' || m.reason === 'used') ? m.quantity : 0,
      boxIds: [m.fromContainerId, m.toContainerId].filter((id): id is string => Boolean(id)),
      boxId: m.fromContainerId ?? m.toContainerId,
      where,
      jobId: m.jobId,
      jobLabel: jobLabel.get(m.jobId) ?? '',
      note: m.note.trim() || (m.source ?? '').trim(),
      who,
      personKey: personKeyOf(who),
      byUserId: m.byUserId,
      looks,
      outside: null,
      answer: answerOf.get(m.id) ?? null,
      putBack: null,
    })
  }
  for (const mv of input.containerMoves) {
    const who = mv.byName.trim() || NO_NAME
    const c = box.get(mv.containerId)
    const from = mv.fromLocationId ? place.get(mv.fromLocationId) ?? 'a place no longer listed' : 'no place'
    const to = mv.toLocationId ? place.get(mv.toLocationId) ?? 'a place no longer listed' : 'no place'
    acts.push({
      id: mv.id,
      at: mv.at,
      day: dayOf(mv.at),
      kind: 'box_moved',
      what: BOX_MOVED_WORDS,
      part: null,
      qty: '',
      pieces: 0,
      boxIds: [mv.containerId],
      boxId: mv.containerId,
      where: `${c ? c.label : 'a box no longer listed'} · ${from} → ${to}`,
      jobId: mv.jobId,
      jobLabel: jobLabel.get(mv.jobId) ?? '',
      note: '',
      who,
      personKey: personKeyOf(who),
      byUserId: null,
      looks: [],
      outside: null,
      answer: null,
      putBack: null,
    })
  }
  // The trail: changes to a box that are not ledger rows, and answers taken off.
  const blank = { part: null, qty: '', pieces: 0, note: '', looks: [] as ActLook[], answer: null, byUserId: null, outside: null, putBack: null as PutBack | null }
  const boxAct = (id: string, at: string, byName: string, containerId: string, kind: ActKind, what: string, note: string): PersonAct => {
    const who = byName.trim() || NO_NAME
    const c = box.get(containerId)
    return { ...blank, id, at, day: dayOf(at), kind, what, note, boxIds: [containerId], boxId: c ? containerId : null, where: boxWords(containerId), jobId: c?.jobId ?? '', jobLabel: c ? jobLabel.get(c.jobId) ?? '' : '', who, personKey: personKeyOf(who) }
  }
  const said = (v: string) => (v.trim() ? v.trim() : 'nothing')
  for (const ch of input.boxChanges ?? []) {
    const c = box.get(ch.containerId)
    if (ch.what === 'retired') acts.push({ ...boxAct(ch.id, ch.at, ch.byName, ch.containerId, 'box_retired', BOX_ACT_WORDS.box_retired, ''), putBack: c && c.retiredAt ? { containerId: c.id, act: 'unretire', words: `Bring ${c.label} back` } : null })
    else if (ch.what === 'brought_back') acts.push({ ...boxAct(ch.id, ch.at, ch.byName, ch.containerId, 'box_brought_back', BOX_ACT_WORDS.box_brought_back, ''), putBack: c && !c.retiredAt ? { containerId: c.id, act: 'retire', words: `Retire ${c.label} again` } : null })
    else {
      // The box must still read as this change left it, and must be live: a retired box takes no edit.
      const stands = Boolean(c) && !c?.retiredAt && (ch.what === 'kind' ? c?.kind === ch.newValue : ch.what === 'where' ? (c?.where ?? '') === ch.newValue : (c?.said ?? '') === ch.newValue)
      const back: PutBack | null = !c || !stands
        ? null
        : ch.what === 'kind'
          ? ch.oldValue === 'cage' || ch.oldValue === 'box' || ch.oldValue === 'loose'
            ? { containerId: c.id, act: 'patch', patch: { kind: ch.oldValue }, words: `Make ${c.label} a ${ch.oldValue} again` }
            : null
          : ch.what === 'where'
            ? { containerId: c.id, act: 'patch', patch: { where: ch.oldValue }, words: `Put the where line of ${c.label} back` }
            : { containerId: c.id, act: 'patch', patch: { said: ch.oldValue || null }, words: `Put the words on ${c.label} back` }
      acts.push({ ...boxAct(ch.id, ch.at, ch.byName, ch.containerId, 'box_changed', BOX_ACT_WORDS.box_changed, `${CHANGE_FIELD[ch.what]}: ${said(ch.oldValue)} \u2192 ${said(ch.newValue)}`), putBack: back })
    }
  }
  for (const r of input.boxRenames ?? []) {
    const c = box.get(r.containerId)
    const stands = Boolean(c) && !c?.retiredAt && c?.label === r.newLabel
    acts.push({ ...boxAct(r.id, r.at, r.byName, r.containerId, 'box_renamed', BOX_ACT_WORDS.box_renamed, `${r.oldLabel} \u2192 ${r.newLabel}`), putBack: c && stands ? { containerId: c.id, act: 'patch', patch: { label: r.oldLabel }, words: `Rename ${r.newLabel} back to ${r.oldLabel}` } : null })
  }
  for (const r of input.removedAnswers ?? []) {
    const who = r.byName.trim() || NO_NAME
    acts.push({ ...blank, id: r.id, at: r.at, day: dayOf(r.at), kind: 'answer_removed', what: r.answer === 'tie' ? BOX_ACT_WORDS.answer_removed_tie : BOX_ACT_WORDS.answer_removed_price, part: r.words, boxIds: [], boxId: null, where: '', jobId: r.jobId ?? '', jobLabel: r.jobId ? jobLabel.get(r.jobId) ?? '' : '', who, personKey: personKeyOf(who) })
  }
  return acts.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : a.id < b.id ? 1 : a.id > b.id ? -1 : 0))
}

/** The people with an act on the site, the one who pressed last first. */
export function actPeople(acts: ReadonlyArray<PersonAct>): ActPerson[] {
  const by = new Map<string, ActPerson>()
  for (const a of acts) {
    const p = by.get(a.personKey)
    const mine = p ?? { key: a.personKey, name: a.who, acts: 0, lastAt: a.at, userIds: [] }
    if (!p) by.set(a.personKey, mine)
    mine.acts += 1
    if (a.at > mine.lastAt) mine.lastAt = a.at
    if (a.byUserId && !mine.userIds.includes(a.byUserId)) mine.userIds.push(a.byUserId)
  }
  return [...by.values()].sort((a, b) => (a.lastAt < b.lastAt ? 1 : a.lastAt > b.lastAt ? -1 : a.name.localeCompare(b.name)))
}

export type ActFilter = { person: string | null; kind: ActKind | null; lookOnly: boolean }

export function filterActs(acts: ReadonlyArray<PersonAct>, f: ActFilter): PersonAct[] {
  return acts.filter((a) => (!f.person || a.personKey === f.person) && (!f.kind || a.kind === f.kind) && (!f.lookOnly || a.looks.length > 0 || a.outside != null))
}

/** The four figures over the list, for the acts shown. */
export function actTiles(acts: ReadonlyArray<PersonAct>): { presses: number; days: number; pieces: number; boxes: number; look: number; markedPieces: number; outside: number } {
  const boxes = new Set<string>()
  const days = new Set<string>()
  let pieces = 0
  let look = 0
  let markedPieces = 0
  let outside = 0
  for (const a of acts) {
    for (const id of a.boxIds) boxes.add(id)
    days.add(a.day)
    pieces += a.pieces
    if (a.answer?.answer === 'marked') markedPieces += a.pieces
    if (a.looks.length > 0 || a.outside != null) look += 1
    if (a.outside != null) outside += 1
  }
  return { presses: acts.length, days: days.size, pieces, boxes: boxes.size, look, markedPieces, outside }
}

/** The acts grouped by day, in the order they came: newest day first when the acts are newest first. */
export function actDays(acts: ReadonlyArray<PersonAct>): Array<{ day: string; acts: PersonAct[] }> {
  const out: Array<{ day: string; acts: PersonAct[] }> = []
  for (const a of acts) {
    const last = out[out.length - 1]
    if (last && last.day === a.day) last.acts.push(a)
    else out.push({ day: a.day, acts: [a] })
  }
  return out
}

/** A count with its noun: 1 press, 12 presses. */
export function countWords(count: number, one: string, many: string): string {
  return `${n(count)} ${count === 1 ? one : many}`
}

/**
 * Why an act is outside the process for a person the office is watching, or null when it is inside. A
 * watched person may take, use and return with a note, move parts between boxes and move a box. A count,
 * a part added, a box retired, brought back, changed or renamed, and an answer taken off are the office's.
 * The view applies this to a watched person alone; for everyone else the three chips of `looks` stand.
 */
export function outsideProcess(act: Pick<PersonAct, 'kind' | 'note'>): string | null {
  switch (act.kind) {
    case 'counted':
      return 'a count is the office\u2019s'
    case 'delivered':
      return 'adding a part is the office\u2019s'
    case 'box_retired':
      return 'retired a box'
    case 'box_brought_back':
      return 'brought a box back'
    case 'box_changed':
      return 'changed a box'
    case 'box_renamed':
      return 'renamed a box'
    case 'answer_removed':
      return 'took an answer off'
    case 'taken':
    case 'used':
      return act.note.trim() ? null : 'no note'
    default:
      return null
  }
}

/**
 * The acts with a watch applied. A person is watched when one of their rows carries a watched login;
 * every act under that person's name then says why it is outside the process, or nothing. A box change
 * carries a name and no login, so it follows the name.
 */
export function withWatch(acts: ReadonlyArray<PersonAct>, watchedUserIds: ReadonlySet<string>): PersonAct[] {
  if (watchedUserIds.size === 0) return [...acts]
  const watched = new Set<string>()
  for (const a of acts) if (a.byUserId && watchedUserIds.has(a.byUserId)) watched.add(a.personKey)
  if (watched.size === 0) return [...acts]
  return acts.map((a) => (watched.has(a.personKey) && a.answer?.answer !== 'taken_back' ? { ...a, outside: outsideProcess(a) } : a))
}

/** The boxes a watched person opened on a screen since the watch began and never pressed on, oldest open first. */
export function openedNotPressed(opens: ReadonlyArray<{ containerId: string; at: string }>, acts: ReadonlyArray<PersonAct>, since: string): string[] {
  const pressed = new Set<string>()
  for (const a of acts) if (a.at >= since) for (const id of a.boxIds) pressed.add(id)
  const out: string[] = []
  for (const o of [...opens].sort((x, y) => (x.at < y.at ? -1 : x.at > y.at ? 1 : 0))) {
    if (o.at >= since && !pressed.has(o.containerId) && !out.includes(o.containerId)) out.push(o.containerId)
  }
  return out
}
