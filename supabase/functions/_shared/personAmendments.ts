/**
 * Corrections as links on a person's HR file (punch list #315, upgrade 1): the pure half of `person_file_amendments`
 * (migration 20261112050000). A row says a thing on the file — an HR entry or a piece of evidence — corrects or
 * completes an older one. The record itself is append-only and untouched; this kernel reads the links and answers what
 * the People → HR tab and the dev seat both need: which things were corrected or completed and by what, what a thing
 * itself amends, the latest word on a thing that was corrected more than once, and the words either line wears.
 *
 * No app import, so the tab (`src/lib/people/personAmendments.ts` is its door) and `dev-mcp` draw from one
 * implementation, as they do the Timeline (`personTimeline.ts`).
 */

export type AmendmentKind = 'hr_entry' | 'hr_evidence'
export type AmendmentHow = 'corrects' | 'completes'

export const AMENDMENT_KINDS: readonly AmendmentKind[] = ['hr_entry', 'hr_evidence']
export const AMENDMENT_HOWS: readonly AmendmentHow[] = ['corrects', 'completes']

/** A `person_file_amendments` row, as the table hands it over. */
export type PersonAmendmentRow = {
  id: string
  from_kind: string
  from_id: string
  to_kind: string
  to_id: string
  how: string
  created_at: string
  withdrawn_at: string | null
}

/** A link that stands: `from` is the newer thing, `to` the older, each as `kind:id`. */
export type AmendmentLink = { id: string; how: AmendmentHow; from: string; to: string; createdAt: string }

/** The key a thing goes by in every map here: `hr_entry:<id>` · `hr_evidence:<id>`. */
export function amendmentKey(kind: AmendmentKind, id: string): string {
  return `${kind}:${id}`
}

/** The table a kind lives in, for a `ref` or a `row` (`table:id`). */
export function amendmentTable(kind: AmendmentKind): 'person_file_entries' | 'person_file_evidence' {
  return kind === 'hr_entry' ? 'person_file_entries' : 'person_file_evidence'
}

/** The kind a Timeline line's `ref.table` names; null for a line that cannot be amended (a paper, a license). */
export function amendmentKindOfTable(table: string): AmendmentKind | null {
  if (table === 'person_file_entries') return 'hr_entry'
  if (table === 'person_file_evidence') return 'hr_evidence'
  return null
}

export function parseAmendmentKey(key: string): { kind: AmendmentKind; id: string } | null {
  const at = key.indexOf(':')
  if (at <= 0) return null
  const kind = key.slice(0, at)
  const id = key.slice(at + 1)
  if (!isKind(kind) || id === '') return null
  return { kind, id }
}

function isKind(v: string): v is AmendmentKind {
  return v === 'hr_entry' || v === 'hr_evidence'
}
function isHow(v: string): v is AmendmentHow {
  return v === 'corrects' || v === 'completes'
}

/**
 * The links that stand, oldest first: a withdrawn one is left out, and so is a row of a kind or a how this code does
 * not know (a later migration's), so an old client never draws a link it cannot name.
 */
export function liveAmendments(rows: ReadonlyArray<PersonAmendmentRow>): AmendmentLink[] {
  const out: AmendmentLink[] = []
  for (const r of rows) {
    if (r.withdrawn_at) continue
    if (!isKind(r.from_kind) || !isKind(r.to_kind) || !isHow(r.how)) continue
    out.push({ id: r.id, how: r.how, from: amendmentKey(r.from_kind, r.from_id), to: amendmentKey(r.to_kind, r.to_id), createdAt: r.created_at })
  }
  return out.sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}

export type AmendmentIndex = {
  /** By the OLDER thing: the links that amend it, oldest first. */
  amendedBy: Map<string, AmendmentLink[]>
  /** By the NEWER thing: the links it makes, oldest first. */
  amends: Map<string, AmendmentLink[]>
}

export function amendmentIndex(rows: ReadonlyArray<PersonAmendmentRow>): AmendmentIndex {
  const amendedBy = new Map<string, AmendmentLink[]>()
  const amends = new Map<string, AmendmentLink[]>()
  for (const l of liveAmendments(rows)) {
    const a = amendedBy.get(l.to) ?? []
    a.push(l)
    amendedBy.set(l.to, a)
    const b = amends.get(l.from) ?? []
    b.push(l)
    amends.set(l.from, b)
  }
  return { amendedBy, amends }
}

export const EMPTY_AMENDMENT_INDEX: AmendmentIndex = { amendedBy: new Map(), amends: new Map() }

/** Where a thing stands: corrected wins over completed, since a reader must not rest on a corrected thing. */
export type AmendmentStanding = 'corrected' | 'completed' | null

export function amendmentStanding(key: string, index: AmendmentIndex): AmendmentStanding {
  const links = index.amendedBy.get(key)
  if (!links || links.length === 0) return null
  return links.some((l) => l.how === 'corrects') ? 'corrected' : 'completed'
}

/** Every thing a live `corrects` link points at: what a document must not cite without a flag. */
export function correctedKeys(index: AmendmentIndex): Set<string> {
  const out = new Set<string>()
  for (const [key, links] of index.amendedBy) if (links.some((l) => l.how === 'corrects')) out.add(key)
  return out
}

/**
 * The latest word on a thing: follow `corrects` links to the newest correction, and that correction's own, until one
 * stands uncorrected. A thing nobody corrected is its own latest word. Safe on a loop (the table's guard refuses one,
 * a hand-made row might not): a thing met twice ends the walk.
 */
export function latestWord(key: string, index: AmendmentIndex): string {
  const seen = new Set<string>([key])
  let at = key
  for (;;) {
    const corrections = (index.amendedBy.get(at) ?? []).filter((l) => l.how === 'corrects')
    const newest = corrections[corrections.length - 1]
    if (!newest || seen.has(newest.from)) return at
    seen.add(newest.from)
    at = newest.from
  }
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const

/** `2026-11-03` → `Nov 3, 2026`; anything else comes back as it was given. */
export function amendmentDayLabel(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd)
  if (!m) return ymd
  const month = MONTHS[Number(m[2]) - 1]
  if (!month) return ymd
  return `${month} ${Number(m[3])}, ${m[1]}`
}

/** The thing in a word: *entry* · *evidence record*. */
export function amendmentThingWord(kind: AmendmentKind): string {
  return kind === 'hr_entry' ? 'entry' : 'evidence record'
}

/**
 * What the OLDER line wears, by the newer thing's day: *Corrected Nov 3, 2026* · *Completed Nov 3, 2026*. With no day
 * (the newer thing is held from this reader) the day is left off.
 */
export function amendedByWords(how: AmendmentHow, newerYmd: string | null): string {
  const verb = how === 'corrects' ? 'Corrected' : 'Completed'
  return newerYmd ? `${verb} ${amendmentDayLabel(newerYmd)}` : verb
}

/**
 * What the NEWER line wears, by the older thing: *Corrects the entry of Oct 28, 2026* · *Completes the evidence
 * record of Oct 28, 2026*.
 */
export function amendsWords(how: AmendmentHow, olderKind: AmendmentKind, olderYmd: string | null): string {
  const verb = how === 'corrects' ? 'Corrects' : 'Completes'
  const thing = amendmentThingWord(olderKind)
  return olderYmd ? `${verb} the ${thing} of ${amendmentDayLabel(olderYmd)}` : `${verb} an ${thing} held from this view`
}

/** One end of a link as a reader is handed it: the how, the other thing's key, table row and day. */
export type AmendmentEnd = { link_id: string; how: AmendmentHow; key: string; row: string; day: string | null; words: string }

/**
 * Both sides of a thing's links, in words, for a Timeline line or a seat reply. `dayOf` answers the day a thing is
 * about by its key, or null when this reader does not hold it (a counsel-only record from the seat).
 */
export function amendmentEnds(key: string, index: AmendmentIndex, dayOf: (key: string) => string | null): { amendedBy: AmendmentEnd[]; amends: AmendmentEnd[] } {
  const rowOf = (k: string): string => {
    const p = parseAmendmentKey(k)
    return p ? `${amendmentTable(p.kind)}:${p.id}` : k
  }
  const amendedBy = (index.amendedBy.get(key) ?? []).map((l): AmendmentEnd => {
    const day = dayOf(l.from)
    return { link_id: l.id, how: l.how, key: l.from, row: rowOf(l.from), day, words: amendedByWords(l.how, day) }
  })
  const amends = (index.amends.get(key) ?? []).map((l): AmendmentEnd => {
    const day = dayOf(l.to)
    const kind = parseAmendmentKey(l.to)?.kind ?? 'hr_entry'
    return { link_id: l.id, how: l.how, key: l.to, row: rowOf(l.to), day, words: amendsWords(l.how, kind, day) }
  })
  return { amendedBy, amends }
}

/** What a new entry amends, as the composer or an agent picked it. */
export type AmendmentTarget = { kind: AmendmentKind; id: string; how: AmendmentHow }

/**
 * Why a pick cannot be linked, in words, or null when it can. Mirrors the table's guard for the cases a reader can
 * see before the write: the same thing picked twice, and a thing that would amend itself.
 */
export function amendmentTargetsProblem(targets: ReadonlyArray<AmendmentTarget>, selfKey: string | null): string | null {
  const seen = new Set<string>()
  for (const t of targets) {
    const key = amendmentKey(t.kind, t.id)
    if (selfKey && key === selfKey) return 'A thing cannot correct or complete itself.'
    if (seen.has(key)) return `The same ${amendmentThingWord(t.kind)} is picked twice. One link a pair.`
    seen.add(key)
  }
  return null
}

/**
 * `hr_agent_write`'s keys for a NEW entry's links (`entries[].corrects`, `entries[].completes`): an entry by its bare
 * id, a piece of evidence as `{ kind, id }`. A how with nothing picked is left out, so a plain entry's payload — and
 * its plan hash — is what it always was.
 */
export function amendmentEntryKeys(targets: ReadonlyArray<AmendmentTarget>): { corrects?: Array<string | { kind: AmendmentKind; id: string }>; completes?: Array<string | { kind: AmendmentKind; id: string }> } {
  const out: { corrects?: Array<string | { kind: AmendmentKind; id: string }>; completes?: Array<string | { kind: AmendmentKind; id: string }> } = {}
  for (const how of AMENDMENT_HOWS) {
    const list = targets.filter((t) => t.how === how).map((t) => (t.kind === 'hr_entry' ? t.id : { kind: t.kind, id: t.id }))
    if (list.length > 0) out[how] = list
  }
  return out
}

/** The rows the tab inserts beside an entry it just wrote, one a target. */
export function amendmentInsertRows(input: { personId: string; fromKind: AmendmentKind; fromId: string; targets: ReadonlyArray<AmendmentTarget>; createdBy: string | null }): Array<{ person_id: string; from_kind: AmendmentKind; from_id: string; to_kind: AmendmentKind; to_id: string; how: AmendmentHow; created_by: string | null }> {
  return input.targets.map((t) => ({ person_id: input.personId, from_kind: input.fromKind, from_id: input.fromId, to_kind: t.kind, to_id: t.id, how: t.how, created_by: input.createdBy }))
}

/** "1 link" · "3 links". */
export function amendmentCountWords(n: number): string {
  return `${n} ${n === 1 ? 'link' : 'links'}`
}
