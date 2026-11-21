/**
 * A paper built from settings (punch list #389, step 1). A Contract Book entry may carry a **settings list**
 * (`contract_template_documents.settings_def`): each setting with its choices from loosest to strictest, the fields a
 * clause may use as blanks, and the named levels. A clause is then tied to one choice of one setting (`when`), and may
 * be one of several wordings of one place in the paper (`slot`). The paper for a job is put together from the job's
 * picks: one choice a setting.
 *
 * The database puts the paper together too (`contract_paper_clauses`, `20261120050000_paper_settings.sql`). The cases
 * in `supabase/tests/paper_settings/20_scenario.sql` run through both, so the preview and the sign page cannot drift.
 *
 * A settings list holds no clause wording. Its words are the names of settings and choices and the plain words a
 * summary says. Since step 4 it also holds the words the office's settings page shows beside a choice: what puts a
 * person in breach and what the site must have, and the notice and the site note the page opens on. The database
 * stops a shape that is not plain lines (`20261121150000_settings_page_ground.sql`). Pure: no React, no supabase, no
 * clock.
 */

/** A key as the database keeps it: lower case, digits and underscores, a letter first. */
export const PAPER_KEY_RE = /^[a-z][a-z0-9_]{0,39}$/

/** One choice of a setting. Its place in the list is its strictness: the loosest first. */
export interface SettingChoice {
  key: string
  label: string
  labelEs: string
  /** The plain words the summary says for this choice. */
  says: string
  saysEs: string
  /** True when this choice leaves the topic out of the paper, as *Off* does. A place needs no wording for it. */
  out: boolean
  /** The blanks this choice fills, by field key. */
  fills: Record<string, string>
  fillsEs: Record<string, string>
  /** What puts a person in breach under this choice, a line each. Absent when it has none. */
  breach?: string[]
  breachEs?: string[]
  /** What the site must have for this choice to hold, a line each. Absent when it asks nothing of the site. */
  site?: string[]
  siteEs?: string[]
}

/** The four lists of lines a choice may carry. */
export const CHOICE_LINE_KEYS = ['breach', 'breachEs', 'site', 'siteEs'] as const
export type ChoiceLineKey = (typeof CHOICE_LINE_KEYS)[number]

/**
 * A few words the settings page opens on: the notice (*Before you start*, with the words beside its box in `tick`) and
 * the site note (*Match the paper to the site*, with a `lead`). A note with no line is no note.
 */
export interface PaperNote {
  title: string
  titleEs: string
  lead: string
  leadEs: string
  tick: string
  tickEs: string
  lines: string[]
  linesEs: string[]
}

export const EMPTY_PAPER_NOTE: PaperNote = { title: '', titleEs: '', lead: '', leadEs: '', tick: '', tickEs: '', lines: [], linesEs: [] }

export interface PaperSetting {
  key: string
  label: string
  labelEs: string
  choices: SettingChoice[]
}

/** A blank a clause may hold, written `{key}` in its words. */
export interface PaperField {
  key: string
  label: string
  labelEs: string
}

/** A named level: one pick a setting, under a name and the kind of place it sits beside. */
export interface PaperLevel {
  key: string
  label: string
  labelEs: string
  alignedWith: string
  alignedWithEs: string
  picks: Record<string, string>
}

export interface SettingsDef {
  settings: PaperSetting[]
  fields: PaperField[]
  levels: PaperLevel[]
  /** The notice the settings page opens on. Absent when the list has none. */
  notice?: PaperNote
  /** The note on matching the paper to the site. Absent when the list has none. */
  siteNote?: PaperNote
}

/** A job's picks: one choice a setting, by key. */
export type PaperPicks = Record<string, string>

/** What puts a clause in the paper: a choice of a setting, by key. Null is in every paper. */
export type ClauseWhen = Record<string, string> | null

export const PAPER_SETTINGS_LIMITS = { settings: 40, choices: 12, fields: 40, levels: 12, words: 400, lines: 20, noteLines: 12 } as const

/** A settings paper asked for with no settings. The database says the same words. */
export const SETTINGS_PAPER_BARE = 'This paper is built from settings. It goes with its settings.'

function isBag(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}
const str = (v: unknown): string => (typeof v === 'string' ? v : '')

function stringBag(v: unknown): Record<string, string> {
  const out: Record<string, string> = {}
  if (!isBag(v)) return out
  for (const [k, x] of Object.entries(v)) if (typeof x === 'string') out[k] = x
  return out
}

/** Lines as they are kept: trimmed, and an empty one left out. While a person types, a list may hold empty lines. */
export function tidyLines(lines: ReadonlyArray<string> | null | undefined): string[] {
  return (lines ?? []).map((l) => l.trim()).filter((l) => l !== '')
}

function stringList(v: unknown): string[] {
  return Array.isArray(v) ? tidyLines(v.filter((x): x is string => typeof x === 'string')) : []
}

function noteFrom(raw: unknown): PaperNote | null {
  if (!isBag(raw)) return null
  const note: PaperNote = { title: str(raw.title), titleEs: str(raw.titleEs), lead: str(raw.lead), leadEs: str(raw.leadEs), tick: str(raw.tick), tickEs: str(raw.tickEs), lines: stringList(raw.lines), linesEs: stringList(raw.linesEs) }
  return note.lines.length > 0 ? note : null
}

/** A note as the list keeps it: its lines tidied, and nothing at all when no line is left. */
function tidyNote(note: PaperNote | null | undefined): PaperNote | null {
  if (!note) return null
  const lines = tidyLines(note.lines)
  return lines.length > 0 ? { ...note, lines, linesEs: tidyLines(note.linesEs) } : null
}

/** A choice's lines in one language. An empty Spanish list shows the English. */
export function choiceLines(choice: SettingChoice, kind: 'breach' | 'site', lang: 'en' | 'es'): string[] {
  const es = tidyLines(kind === 'breach' ? choice.breachEs : choice.siteEs)
  return lang === 'es' && es.length > 0 ? es : tidyLines(kind === 'breach' ? choice.breach : choice.site)
}

/** The settings list from what the database holds, or null when it is not one at all. Gaps are `settingsDefProblems`'. */
export function parseSettingsDef(raw: unknown): SettingsDef | null {
  if (!isBag(raw) || !Array.isArray(raw.settings)) return null
  const settings: PaperSetting[] = []
  for (const s of raw.settings) {
    if (!isBag(s)) return null
    const choices: SettingChoice[] = []
    for (const c of Array.isArray(s.choices) ? s.choices : []) {
      if (!isBag(c)) return null
      const choice: SettingChoice = { key: str(c.key), label: str(c.label), labelEs: str(c.labelEs), says: str(c.says), saysEs: str(c.saysEs), out: c.out === true, fills: stringBag(c.fills), fillsEs: stringBag(c.fillsEs) }
      // A list written before step 4 has none of these, and reads exactly as it did.
      for (const k of CHOICE_LINE_KEYS) {
        const lines = stringList(c[k])
        if (lines.length > 0) choice[k] = lines
      }
      choices.push(choice)
    }
    settings.push({ key: str(s.key), label: str(s.label), labelEs: str(s.labelEs), choices })
  }
  const fields: PaperField[] = []
  for (const f of Array.isArray(raw.fields) ? raw.fields : []) {
    if (!isBag(f)) return null
    fields.push({ key: str(f.key), label: str(f.label), labelEs: str(f.labelEs) })
  }
  const levels: PaperLevel[] = []
  for (const l of Array.isArray(raw.levels) ? raw.levels : []) {
    if (!isBag(l)) return null
    levels.push({ key: str(l.key), label: str(l.label), labelEs: str(l.labelEs), alignedWith: str(l.alignedWith), alignedWithEs: str(l.alignedWithEs), picks: stringBag(l.picks) })
  }
  const def: SettingsDef = { settings, fields, levels }
  const notice = noteFrom(raw.notice)
  if (notice) def.notice = notice
  const siteNote = noteFrom(raw.siteNote)
  if (siteNote) def.siteNote = siteNote
  return def
}

/**
 * The list as the database keeps it: empty Spanish, empty bags and empty lists left out, so a list reads short. A
 * choice's lines and the two notes are tidied on the way. A list with none of them writes exactly as it did before
 * step 4, so saving one unchanged is still *Nothing changed.*
 */
export function settingsDefJson(def: SettingsDef): Record<string, unknown> {
  const lean = (o: Record<string, unknown>): Record<string, unknown> =>
    Object.fromEntries(Object.entries(o).filter(([, v]) => !(v === undefined || v === '' || v === false || (isBag(v) && Object.keys(v).length === 0) || (Array.isArray(v) && v.length === 0))))
  const choiceJson = (c: SettingChoice) => lean({ ...c, breach: tidyLines(c.breach), breachEs: tidyLines(c.breachEs), site: tidyLines(c.site), siteEs: tidyLines(c.siteEs) })
  const out: Record<string, unknown> = {
    settings: def.settings.map((s) => ({ ...lean({ key: s.key, label: s.label, labelEs: s.labelEs }), choices: s.choices.map(choiceJson) })),
    fields: def.fields.map((f) => lean({ ...f })),
    levels: def.levels.map((l) => ({ ...lean({ key: l.key, label: l.label, labelEs: l.labelEs, alignedWith: l.alignedWith, alignedWithEs: l.alignedWithEs }), picks: l.picks })),
  }
  const notice = tidyNote(def.notice)
  if (notice) out.notice = lean({ ...notice })
  const siteNote = tidyNote(def.siteNote)
  if (siteNote) out.siteNote = lean({ ...siteNote })
  return out
}

const twice = (keys: readonly string[]): string | null => keys.find((k, i) => keys.indexOf(k) !== i) ?? null

/** Every gap in a settings list, in words for the person setting it up. Empty when it can be saved. */
export function settingsDefProblems(def: SettingsDef): string[] {
  const out: string[] = []
  const L = PAPER_SETTINGS_LIMITS
  if (def.settings.length === 0) out.push('Add a setting.')
  if (def.settings.length > L.settings) out.push(`A settings list holds at most ${L.settings} settings.`)
  if (def.fields.length > L.fields) out.push(`A settings list holds at most ${L.fields} blanks.`)
  if (def.levels.length > L.levels) out.push(`A settings list holds at most ${L.levels} levels.`)
  const settingTwice = twice(def.settings.map((s) => s.key))
  if (settingTwice) out.push(`Two settings share the key ${settingTwice}.`)
  def.settings.forEach((s, i) => {
    const name = s.label.trim() || `Setting ${i + 1}`
    if (!PAPER_KEY_RE.test(s.key)) out.push(`${name} needs a key: a letter, then letters, digits or underscores.`)
    if (!s.label.trim()) out.push(`Setting ${i + 1} has no name.`)
    if (s.choices.length < 2) out.push(`${name} needs two choices or more.`)
    if (s.choices.length > L.choices) out.push(`${name} holds at most ${L.choices} choices.`)
    const choiceTwice = twice(s.choices.map((c) => c.key))
    if (choiceTwice) out.push(`${name} has two choices with the key ${choiceTwice}.`)
    s.choices.forEach((c, j) => {
      const cname = c.label.trim() || `choice ${j + 1}`
      if (!PAPER_KEY_RE.test(c.key)) out.push(`${name}, ${cname}, needs a key.`)
      if (!c.label.trim()) out.push(`${name}, choice ${j + 1}, has no name.`)
      if (!c.says.trim()) out.push(`${name}, ${cname}, does not say what it means.`)
      for (const k of [...Object.keys(c.fills), ...Object.keys(c.fillsEs)]) if (!def.fields.some((f) => f.key === k)) out.push(`${name}, ${cname}, fills a blank that is not on the list: ${k}.`)
    })
    if (s.choices.length > 0 && s.choices.every((c) => c.out)) out.push(`${name} leaves the topic out on every choice.`)
    s.choices.forEach((c, j) => {
      const cname = c.label.trim() || `choice ${j + 1}`
      if (Math.max(tidyLines(c.breach).length, tidyLines(c.breachEs).length) > L.lines) out.push(`${name}, ${cname}, holds at most ${L.lines} breach lines.`)
      if (Math.max(tidyLines(c.site).length, tidyLines(c.siteEs).length) > L.lines) out.push(`${name}, ${cname}, holds at most ${L.lines} site lines.`)
    })
  })
  for (const [label, note] of [['The notice', def.notice], ['The site note', def.siteNote]] as const) {
    if (!note) continue
    const lines = tidyLines(note.lines)
    if (Math.max(lines.length, tidyLines(note.linesEs).length) > L.noteLines) out.push(`${label} holds at most ${L.noteLines} lines.`)
    if (lines.length === 0 && [note.title, note.lead, note.tick, note.titleEs, note.leadEs, note.tickEs, ...note.linesEs].some((w) => w.trim() !== '')) out.push(`${label} has words and no line. Add a line or clear its words.`)
  }
  const fieldTwice = twice(def.fields.map((f) => f.key))
  if (fieldTwice) out.push(`Two blanks share the key ${fieldTwice}.`)
  def.fields.forEach((f, i) => {
    if (!PAPER_KEY_RE.test(f.key)) out.push(`Blank ${i + 1} needs a key: a letter, then letters, digits or underscores.`)
    else if (f.key === 'company' || f.key === 'job') out.push(`A blank cannot be named ${f.key}. The paper fills that one itself.`)
    if (!f.label.trim()) out.push(`Blank ${i + 1} has no name.`)
  })
  const levelTwice = twice(def.levels.map((l) => l.key))
  if (levelTwice) out.push(`Two levels share the key ${levelTwice}.`)
  def.levels.forEach((l, i) => {
    const name = l.label.trim() || `Level ${i + 1}`
    if (!PAPER_KEY_RE.test(l.key)) out.push(`${name} needs a key.`)
    if (!l.label.trim()) out.push(`Level ${i + 1} has no name.`)
    const missing = picksProblem(def, l.picks)
    if (missing) out.push(`${name}: ${missing}`)
  })
  const noteWords = (n: PaperNote | undefined): string[] => (n ? [n.title, n.titleEs, n.lead, n.leadEs, n.tick, n.tickEs, ...n.lines, ...n.linesEs] : [])
  const tooLong = [
    ...def.settings.flatMap((s) => [s.label, s.labelEs, ...s.choices.flatMap((c) => [c.label, c.labelEs, c.says, c.saysEs, ...Object.values(c.fills), ...Object.values(c.fillsEs), ...CHOICE_LINE_KEYS.flatMap((k) => c[k] ?? [])])]),
    ...def.fields.flatMap((f) => [f.label, f.labelEs]),
    ...def.levels.flatMap((l) => [l.label, l.labelEs, l.alignedWith, l.alignedWithEs]),
    ...noteWords(def.notice),
    ...noteWords(def.siteNote),
  ]
  if (tooLong.some((w) => w.length > L.words)) out.push(`A name or a line holds at most ${L.words} characters.`)
  return out
}

export function settingOf(def: SettingsDef, key: string): PaperSetting | null {
  return def.settings.find((s) => s.key === key) ?? null
}

export function choiceOf(def: SettingsDef, settingKey: string, choiceKey: string | undefined): SettingChoice | null {
  return settingOf(def, settingKey)?.choices.find((c) => c.key === choiceKey) ?? null
}

/** A choice's place in its list, the loosest 0. -1 when it is not a choice of that setting. */
export function choiceRank(def: SettingsDef, settingKey: string, choiceKey: string): number {
  return settingOf(def, settingKey)?.choices.findIndex((c) => c.key === choiceKey) ?? -1
}

/** Why these picks cannot put a paper together, or null: every setting needs one of its own choices. */
export function picksProblem(def: SettingsDef, picks: PaperPicks | null): string | null {
  if (picks == null) return SETTINGS_PAPER_BARE
  const unpicked = def.settings.find((s) => !choiceOf(def, s.key, picks[s.key]))
  return unpicked ? `Pick ${unpicked.label}.` : null
}

/** The picks a new job starts on: the first level's, or the loosest choice of every setting. */
export function startPicks(def: SettingsDef): PaperPicks {
  const first = def.levels[0]?.picks ?? {}
  return Object.fromEntries(def.settings.map((s) => [s.key, choiceOf(def, s.key, first[s.key])?.key ?? s.choices[0]?.key ?? '']))
}

/** True when a clause tied to `when` is in the paper for these picks. In SQL: `when_opts IS NULL OR when_opts <@ settings`. */
export function whenKept(when: ClauseWhen, picks: PaperPicks | null): boolean {
  if (when == null) return true
  return Object.entries(when).every(([k, v]) => picks != null && picks[k] === v)
}

/** A clause's `when` as the database's column gives it, or null for a clause in every paper. */
export function whenFromRow(raw: unknown): ClauseWhen {
  const bag = stringBag(raw)
  return Object.keys(bag).length > 0 ? bag : null
}

/** Why a clause cannot be tied this way, or null. A paper with no settings list ties nothing. */
export function whenProblem(def: SettingsDef | null, when: ClauseWhen, slot: string | null): string | null {
  if (when == null) return slot ? 'A wording of a place needs its Only when.' : null
  if (!def) return 'This paper has no settings list. A clause is tied to a choice only on a paper that has one.'
  for (const [k, v] of Object.entries(when)) {
    const setting = settingOf(def, k)
    if (!setting) return `${k} is not on this paper's settings list.`
    if (!setting.choices.some((c) => c.key === v)) return `${setting.label} has no choice ${v}.`
  }
  if (slot != null && !PAPER_KEY_RE.test(slot)) return 'That place does not read. Pick it again.'
  return null
}

/** *Only when Photos and video is Standard*, or *In every paper*. */
export function whenWords(def: SettingsDef | null, when: ClauseWhen): string {
  if (when == null) return 'In every paper'
  const parts = Object.entries(when).map(([k, v]) => `${(def && settingOf(def, k)?.label) || k} is ${(def && choiceOf(def, k, v)?.label) || v}`)
  return `Only when ${parts.join(' and ')}`
}

/**
 * The blanks' values for these picks: what each picked choice fills, then what was typed for the job on top. In
 * Spanish a choice's Spanish value where it has one. Only blanks on the list, and never an empty value.
 */
export function resolvedFields(def: SettingsDef, picks: PaperPicks, typed: Record<string, string> | null, lang: 'en' | 'es'): Record<string, string> {
  const out: Record<string, string> = {}
  const known = new Set(def.fields.map((f) => f.key))
  const put = (k: string, v: string | undefined) => {
    if (known.has(k) && typeof v === 'string' && v.trim() !== '') out[k] = v.trim()
  }
  for (const s of def.settings) {
    const c = choiceOf(def, s.key, picks[s.key])
    if (!c) continue
    for (const k of Object.keys(c.fills)) put(k, lang === 'es' && (c.fillsEs[k] ?? '').trim() !== '' ? c.fillsEs[k] : c.fills[k])
  }
  for (const [k, v] of Object.entries(typed ?? {})) put(k, v)
  return out
}

/**
 * A clause's words with its blanks filled, in the list's own order of blanks. A blank with no value is left as
 * written, and `blankMissing` names it.
 */
export function fillBlanks(def: SettingsDef, text: string, fields: Record<string, string>): string {
  let out = text
  for (const f of def.fields) {
    const v = fields[f.key]
    if (v !== undefined) out = out.split(`{${f.key}}`).join(v)
  }
  return out
}

/** The first blank on the list a clause holds that has no value, or null. */
export function blankMissing(def: SettingsDef, text: string, fields: Record<string, string>): PaperField | null {
  return def.fields.find((f) => text.includes(`{${f.key}}`) && !(f.key in fields)) ?? null
}

/** A clause as the place rules need it. */
export interface PlacedClause {
  id: string
  order: number
  slot: string | null
  when: ClauseWhen
}

/**
 * Where a clause sits on the paper: its own order, or for a wording of a place the order of that place's first
 * wording. So a wording added later reads where the place is, not at the end.
 */
export function clausePlaces(clauses: ReadonlyArray<PlacedClause>): Map<string, number> {
  const first = new Map<string, number>()
  for (const c of clauses) if (c.slot != null) first.set(c.slot, Math.min(first.get(c.slot) ?? Infinity, c.order))
  return new Map(clauses.map((c) => [c.id, c.slot != null ? (first.get(c.slot) ?? c.order) : c.order]))
}

/** The setting a place is tied to: the first setting on the list any of its wordings names. */
function placeSetting(def: SettingsDef, wordings: ReadonlyArray<PlacedClause>): PaperSetting | null {
  const named = new Set(wordings.flatMap((w) => Object.keys(w.when ?? {})))
  return def.settings.find((s) => named.has(s.key)) ?? null
}

/**
 * What stops the paper for these picks at one of its places, or null: a place with two wordings for the pick, or with
 * none where the pick does not leave the topic out. The places are read in the paper's order, and the first that
 * stops it is the one named.
 */
export function placeProblem(def: SettingsDef, clauses: ReadonlyArray<PlacedClause>, picks: PaperPicks): string | null {
  const places = clausePlaces(clauses)
  const slots = [...new Set(clauses.flatMap((c) => (c.slot != null ? [c.slot] : [])))].sort((a, b) => {
    const at = (s: string) => Math.min(...clauses.filter((c) => c.slot === s).map((c) => places.get(c.id) ?? 0))
    return at(a) - at(b) || a.localeCompare(b)
  })
  for (const slot of slots) {
    const wordings = clauses.filter((c) => c.slot === slot)
    const kept = wordings.filter((w) => whenKept(w.when, picks)).length
    if (kept === 1) continue
    const setting = placeSetting(def, wordings)
    if (!setting) continue
    const choice = choiceOf(def, setting.key, picks[setting.key])
    if (!choice) continue
    if (kept > 1) return `${setting.label} has two wordings for ${choice.label}.`
    const leftOut = [...new Set(wordings.flatMap((w) => Object.keys(w.when ?? {})))].some((k) => choiceOf(def, k, picks[k])?.out === true)
    if (!leftOut) return `${setting.label} has no wording for ${choice.label}.`
  }
  return null
}

/**
 * Every gap the Book can see without a job's picks, for the paper's card: for each place tied to one setting, a
 * choice with no wording or with two. A place tied to two settings at once is checked when a paper is put together.
 */
export function bookGaps(def: SettingsDef, clauses: ReadonlyArray<PlacedClause>): string[] {
  const out: string[] = []
  const slots = [...new Set(clauses.flatMap((c) => (c.slot != null ? [c.slot] : [])))].sort()
  for (const slot of slots) {
    const wordings = clauses.filter((c) => c.slot === slot)
    const keys = new Set(wordings.flatMap((w) => Object.keys(w.when ?? {})))
    const setting = placeSetting(def, wordings)
    if (!setting || keys.size !== 1) continue
    for (const choice of setting.choices) {
      const n = wordings.filter((w) => w.when?.[setting.key] === choice.key).length
      if (n > 1) out.push(`${setting.label} has two wordings for ${choice.label}.`)
      else if (n === 0 && !choice.out) out.push(`${setting.label} has no wording for ${choice.label}.`)
    }
  }
  return [...new Set(out)]
}

/** A new place's key for a setting: the setting's own key, then `_2`, `_3` while those are taken. */
export function newSlotKey(settingKey: string, taken: ReadonlyArray<string>): string {
  if (!taken.includes(settingKey)) return settingKey
  for (let n = 2; ; n++) {
    const key = `${settingKey.slice(0, 36)}_${n}`
    if (!taken.includes(key)) return key
  }
}

/**
 * A key made from a name, for a setting, a choice, a blank or a level: *Photos and video* is `photos_and_video`. A
 * name with no letter in it takes `fallback`. `_2`, `_3` while the key is taken.
 */
export function keyFromLabel(label: string, taken: ReadonlyArray<string>, fallback = 'item'): string {
  const base =
    label
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^[^a-z]+/, '')
      .replace(/_+$/, '')
      .slice(0, 36) || fallback
  if (!taken.includes(base)) return base
  for (let n = 2; ; n++) if (!taken.includes(`${base}_${n}`)) return `${base}_${n}`
}

/** An empty list, for a paper that has none yet. */
export const EMPTY_SETTINGS_DEF: SettingsDef = { settings: [], fields: [], levels: [] }

/** A new choice, by name. */
export function newChoice(label: string, taken: ReadonlyArray<string>): SettingChoice {
  return { key: keyFromLabel(label, taken, 'choice'), label: label.trim(), labelEs: '', says: '', saysEs: '', out: false, fills: {}, fillsEs: {} }
}

/** A list with one setting's choice moved one place looser or stricter. The order is the strictness. */
export function moveChoice(def: SettingsDef, settingKey: string, choiceKey: string, by: -1 | 1): SettingsDef {
  return {
    ...def,
    settings: def.settings.map((s) => {
      if (s.key !== settingKey) return s
      const at = s.choices.findIndex((c) => c.key === choiceKey)
      const to = at + by
      if (at < 0 || to < 0 || to >= s.choices.length) return s
      const choices = [...s.choices]
      const [moved] = choices.splice(at, 1)
      if (moved) choices.splice(to, 0, moved)
      return { ...s, choices }
    }),
  }
}
