/**
 * Rows the system numbers on a person's HR file (punch list #315, upgrade 2): the pure half of exhibit numbers, a
 * case's open items and its log (migration 20261112070000). The database hands out the numbers; this kernel reads the
 * rows and answers what the People → HR tab and the dev seat both need: the label a record goes by, the number a
 * hand-typed title already wears, the items in reading order, the standing in words, the payloads `dev_case_write`
 * takes, and the backfill's report in sentences.
 *
 * No app import, so the tab (`src/lib/people/personCase.ts` is its door) and `dev-mcp` read one implementation.
 */

// ── exhibit numbers ────────────────────────────────────────────────────────────────────────────────

/** The label a numbered record goes by: `Ev #41`, the form the files already use. */
export function exhibitLabel(n: number): string {
  return `Ev #${n}`
}

const TITLE_NUMBER = /^\s*[Ee][Vv]\.?\s*#?\s*(\d+)(?![A-Za-z0-9])/
const TITLE_LETTERED = /^\s*[Ee][Vv]\.?\s*#?\s*\d+[A-Za-z]/

/**
 * The number a hand-typed title opens with — `Ev #41 …`, `Ev 41`, `ev. #41: …` — or null. The mirror of the
 * database's `exhibit_no_from_title`: a number with a letter (`Ev #41a`), a number in the middle of a title and any
 * other form answer null, so nothing here guesses.
 */
export function exhibitNoFromTitle(title: string | null | undefined): number | null {
  const m = TITLE_NUMBER.exec(title ?? '')
  if (!m || !m[1] || m[1].length > 6) return null
  return Number(m[1])
}

/** `Ev #41a …`: a number with a letter, which the backfill reports and leaves alone. */
export function exhibitTitleHasLetter(title: string | null | undefined): boolean {
  return TITLE_LETTERED.test(title ?? '')
}

/**
 * What to draw beside a record's title: its label, unless the title already opens with that same number (an old
 * record, backfilled), where the label would only say it twice. Null for a record with no number yet.
 */
export function exhibitBesideTitle(record: { exhibit_no: number | null; title: string }): string | null {
  if (record.exhibit_no === null) return null
  return exhibitNoFromTitle(record.title) === record.exhibit_no ? null : exhibitLabel(record.exhibit_no)
}

/** The backfill's reply (`dev_evidence_number_backfill`), the parts the window reads. */
export type ExhibitBackfillReport = {
  dry_run: boolean
  numbered: number
  clashes: ReadonlyArray<{ number: number; records: ReadonlyArray<{ id: string; day: string; title: string; holds_it: boolean }> }>
  lettered: ReadonlyArray<{ id: string; day: string; title: string }>
  no_number: ReadonlyArray<{ id: string; day: string; title: string }>
  no_number_numbered: number
  highest: number
  next: number
  still_unnumbered: number
}

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`

/**
 * The report in sentences, one a fact, the count first: what would be (or was) numbered, and each kind it will not
 * decide. An empty list means every record already has its number.
 */
export function exhibitBackfillWords(r: ExhibitBackfillReport): string[] {
  const out: string[] = []
  const will = r.dry_run ? 'would take' : 'took'
  if (r.numbered > 0) out.push(`${plural(r.numbered, 'record', 'records')} ${will} the number the title already wears.`)
  if (r.clashes.length > 0) out.push(`${plural(r.clashes.length, 'number is', 'numbers are')} worn by more than one record. Those records are left alone.`)
  if (r.lettered.length > 0) out.push(`${plural(r.lettered.length, 'title wears', 'titles wear')} a number with a letter. ${r.lettered.length === 1 ? 'It is' : 'They are'} left alone.`)
  if (r.no_number_numbered > 0) out.push(`${plural(r.no_number_numbered, 'record', 'records')} with no number in the title ${will} the next ${r.no_number_numbered === 1 ? 'number' : 'numbers'}.`)
  else if (r.no_number.length > 0) out.push(`${plural(r.no_number.length, 'title has', 'titles have')} no number. ${r.no_number.length === 1 ? 'It is' : 'They are'} left alone unless you ask.`)
  if (out.length > 0) out.push(`The next new record takes ${exhibitLabel(r.next)}.`)
  return out
}

// ── a case's open items and log ────────────────────────────────────────────────────────────────────

export type CaseItemState = 'open' | 'done' | 'dropped'
export const CASE_ITEM_STATES: readonly CaseItemState[] = ['open', 'done', 'dropped']

/** A `person_case_items` row, as the table hands it over. */
export type PersonCaseItem = {
  id: string
  item_no: number
  title: string
  detail: string
  owner_label: string
  state: string
  opened_at: string
  closed_at: string | null
  closed_why: string | null
  author_label: string | null
  session_label: string | null
}

/** A `person_case_log` row. */
export type PersonCaseLogLine = {
  id: string
  logged_at: string
  line: string
  item_no: number | null
  author_label: string | null
  session_label: string | null
}

export const CASE_TITLE_MAX = 200
export const CASE_WHY_MAX = 500
export const CASE_LINE_MAX = 1000

function stateOf(v: string): CaseItemState {
  return v === 'done' || v === 'dropped' ? v : 'open'
}

/** The open items by number, then the closed ones, the one closed last first. */
export function sortCaseItems<T extends Pick<PersonCaseItem, 'item_no' | 'state' | 'closed_at'>>(items: ReadonlyArray<T>): { open: T[]; closed: T[] } {
  const open = items.filter((i) => stateOf(i.state) === 'open').sort((a, b) => a.item_no - b.item_no)
  const closed = items
    .filter((i) => stateOf(i.state) !== 'open')
    .sort((a, b) => ((a.closed_at ?? '') > (b.closed_at ?? '') ? -1 : (a.closed_at ?? '') < (b.closed_at ?? '') ? 1 : b.item_no - a.item_no))
  return { open, closed }
}

export type CaseItemCounts = { open: number; done: number; dropped: number }

export function caseItemCounts(items: ReadonlyArray<Pick<PersonCaseItem, 'state'>>): CaseItemCounts {
  const out: CaseItemCounts = { open: 0, done: 0, dropped: 0 }
  for (const i of items) out[stateOf(i.state)] += 1
  return out
}

/** "3 open, 5 done, 1 dropped"; a zero is left out; "No items yet" for none. */
export function caseStandingWords(c: CaseItemCounts): string {
  const parts = [c.open > 0 ? `${c.open} open` : '', c.done > 0 ? `${c.done} done` : '', c.dropped > 0 ? `${c.dropped} dropped` : ''].filter(Boolean)
  return parts.length > 0 ? parts.join(', ') : 'No items yet'
}

/** "Item 12": the handle an item goes by in a note or a request. */
export function caseItemLabel(itemNo: number): string {
  return `Item ${itemNo}`
}

/** Under an item's title: who has it, or that nobody does; for a closed one, how it ended and why. */
export function caseItemNote(item: Pick<PersonCaseItem, 'state' | 'owner_label' | 'closed_why'>): string {
  const state = stateOf(item.state)
  if (state === 'open') return item.owner_label.trim() ? `with ${item.owner_label.trim()}` : 'nobody has it yet'
  return `${state}: ${(item.closed_why ?? '').trim()}`
}

/** The log, newest first; lines written at one instant keep the order they were written in. */
export function caseLogNewestFirst<T extends Pick<PersonCaseLogLine, 'logged_at'>>(lines: ReadonlyArray<T>): T[] {
  return lines
    .map((line, at) => ({ line, at }))
    .sort((a, b) => (a.line.logged_at > b.line.logged_at ? -1 : a.line.logged_at < b.line.logged_at ? 1 : a.at - b.at))
    .map((x) => x.line)
}

/** Why a new item cannot be opened as typed, or null. */
export function caseItemDraftProblem(draft: { title: string; itemNo?: string }): string | null {
  const title = draft.title.trim()
  if (title === '') return 'Say what the item is.'
  if (title.length > CASE_TITLE_MAX) return `Keep the item to ${CASE_TITLE_MAX} characters. The detail takes the rest.`
  const no = (draft.itemNo ?? '').trim()
  if (no !== '' && !/^[1-9][0-9]{0,5}$/.test(no)) return 'The number is a whole number from 1. Leave it empty and the file gives the next one.'
  return null
}

/** Why an item cannot be closed as typed, or null. */
export function caseCloseProblem(why: string): string | null {
  const w = why.trim()
  if (w === '') return 'Say why it closes.'
  if (w.length > CASE_WHY_MAX) return `Keep the reason to ${CASE_WHY_MAX} characters.`
  return null
}

/** One change to an item, as `dev_case_write` takes it. */
export type CaseItemChange =
  | { add: { title: string; detail?: string; owner?: string; item_no?: number } }
  | { item_no: number; set: { title?: string; detail?: string; owner?: string } }
  | { item_no: number; close: { why: string; state?: 'done' | 'dropped' } }
  | { item_no: number; reopen: true }

/** `dev_case_write`'s payload: the person, the session's name when it has one, the changes and the log lines. */
export function caseWritePayload(input: { personId: string; session?: string | null; items?: ReadonlyArray<CaseItemChange>; log?: ReadonlyArray<string | { line: string; item_no?: number }> }): Record<string, unknown> {
  const p: Record<string, unknown> = { person_id: input.personId }
  const session = (input.session ?? '').trim()
  if (session) p.session = session
  if (input.items && input.items.length > 0) p.items = input.items
  if (input.log && input.log.length > 0) p.log = input.log
  return p
}

/** A new item's change from the form: the title trimmed, the number only when one was typed. */
export function caseAddChange(draft: { title: string; detail?: string; owner?: string; itemNo?: string }): CaseItemChange {
  const add: { title: string; detail?: string; owner?: string; item_no?: number } = { title: draft.title.trim() }
  if ((draft.detail ?? '').trim()) add.detail = (draft.detail ?? '').trim()
  if ((draft.owner ?? '').trim()) add.owner = (draft.owner ?? '').trim()
  const no = (draft.itemNo ?? '').trim()
  if (no) add.item_no = Number(no)
  return { add }
}
