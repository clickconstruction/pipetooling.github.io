/**
 * Tagging a teammate in a job note (punch list #363). Pure: no React, no Supabase.
 *
 * A tag is a name picked from a list under the note box, kept as its own row. It is never read
 * back out of the note's words, because the team types `@` to mean "at" and two people can share
 * a first name. This file holds what the box, the posted note and the Tagged job notes section
 * all need: the `@` being typed at the caret, the ranked list, the words a pick leaves in the
 * box, which picks are still in the words, a posted note cut into words and chips, the waiting
 * line, and the age rule.
 */
import { andList } from '../gc/wordToTrades'
import { ymdAddDays } from '../../utils/dateUtils'

/** One person the list may offer on a job: someone who can open that job's notes. */
export type TaggablePerson = {
  userId: string
  name: string
  role: string | null
  /** On the job's crew, as against the office. */
  onJob: boolean
}

/** The list's three groups, in the order they are drawn. */
export type TagGroup = 'asked' | 'job' | 'office'

export type TagListRow = { person: TaggablePerson; group: TagGroup }

export const TAG_GROUP_ORDER: readonly TagGroup[] = ['asked', 'job', 'office']

export const TAG_GROUP_WORDS: Record<TagGroup, string> = {
  asked: 'Asked you',
  job: 'On this job',
  office: 'Office',
}

/** A tag turns amber once it has waited this many working days. */
export const TAG_LATE_AFTER_WORKING_DAYS = 2

/** The section shows this many tags before its Show the rest press. */
export const TAG_SECTION_SHOWN = 3

/** Letters, an apostrophe or a hyphen: what a name being typed after `@` may hold. */
const QUERY_AT_END = /(^|\s)@([\p{L}'’-]*)$/u

/** A letter or a digit: a mention may not run straight into one. */
const NAME_CHAR = /[\p{L}\p{N}]/u

function clampCaret(text: string, caret: number): number {
  if (!Number.isFinite(caret)) return text.length
  return Math.min(Math.max(0, Math.trunc(caret)), text.length)
}

/** Lower case with the accents off, so `jose` finds José. */
function fold(s: string): string {
  return s.normalize('NFD').replace(/\p{M}+/gu, '').toLowerCase()
}

/**
 * The `@` being typed at the caret, or null when the caret is not in one.
 *
 * The `@` must open the note or follow a space, and only letters may follow it. So `arrive @ 8:45`
 * and `materials @$300` open no list once the next key is typed, and an email address never does.
 * `start` is where the `@` sits.
 */
export function tagQueryAtCaret(text: string, caret: number): { query: string; start: number } | null {
  const before = text.slice(0, clampCaret(text, caret))
  const m = QUERY_AT_END.exec(before)
  if (!m) return null
  const query = m[2] ?? ''
  return { query, start: before.length - query.length - 1 }
}

/** True when any word of the name starts with what was typed. Nothing typed matches everyone. */
export function nameMatchesQuery(name: string, query: string): boolean {
  const q = fold(query.trim())
  if (!q) return true
  return fold(name)
    .split(/[\s-]+/)
    .some((word) => word.startsWith(q))
}

/**
 * The list under the box: the person who asked first (an answer box only), then the job's crew,
 * then the office, each by name. People already picked, the writer, and nameless rows are left out.
 */
export function rankTaggable(
  people: readonly TaggablePerson[],
  query: string,
  opts: { pickedIds?: readonly string[]; askerId?: string | null; selfId?: string | null } = {},
): TagListRow[] {
  const picked = new Set(opts.pickedIds ?? [])
  const seen = new Set<string>()
  const rows: TagListRow[] = []
  for (const person of people) {
    if (!person.name.trim() || seen.has(person.userId)) continue
    seen.add(person.userId)
    if (picked.has(person.userId) || person.userId === opts.selfId) continue
    if (!nameMatchesQuery(person.name, query)) continue
    const group: TagGroup = person.userId === opts.askerId ? 'asked' : person.onJob ? 'job' : 'office'
    rows.push({ person, group })
  }
  return rows.sort(
    (a, b) =>
      TAG_GROUP_ORDER.indexOf(a.group) - TAG_GROUP_ORDER.indexOf(b.group) ||
      a.person.name.localeCompare(b.person.name, undefined, { sensitivity: 'base' }) ||
      a.person.userId.localeCompare(b.person.userId),
  )
}

/**
 * The box after a pick: the `@` being typed becomes `@Full Name ` and the caret sits after it.
 * With no `@` at the caret (the @ button, pressed cold) the name goes in at the caret.
 */
export function insertPick(text: string, caret: number, name: string): { text: string; caret: number } {
  const at = clampCaret(text, caret)
  const mention = `@${name.trim()} `
  const q = tagQueryAtCaret(text, at)
  const before = q ? text.slice(0, q.start) : text.slice(0, at)
  const pad = !q && before && !/\s$/.test(before) ? ' ' : ''
  const head = before + pad + mention
  return { text: head + text.slice(at).replace(/^ /, ''), caret: head.length }
}

/**
 * Where `@name` sits in the words at or after `from`, or -1. The `@` must open the words or
 * follow a space, and the name must not run on into another letter, so `@Chris Bell` is not found
 * inside `@Chris Bellamy`.
 */
export function mentionIndex(text: string, name: string, from = 0): number {
  const mention = `@${name.trim()}`
  if (mention === '@') return -1
  let i = text.indexOf(mention, Math.max(0, from))
  while (i >= 0) {
    const prev = i === 0 ? '' : text[i - 1]!
    const next = text[i + mention.length] ?? ''
    if ((prev === '' || /\s/.test(prev)) && !(next && NAME_CHAR.test(next))) return i
    i = text.indexOf(mention, i + 1)
  }
  return -1
}

/** The picks whose `@Full Name` is still in the words. A name the writer deleted is no tag. */
export function liveTags<T extends { name: string }>(text: string, picked: readonly T[]): T[] {
  return picked.filter((p) => mentionIndex(text, p.name) >= 0)
}

/** The words with one pick taken off, by the × on its chip above the box. */
export function removePick(text: string, name: string): string {
  const len = name.trim().length + 1
  let out = text
  let i = mentionIndex(out, name)
  while (i >= 0) {
    const end = i + len
    if (out[end] === ' ') out = out.slice(0, i) + out.slice(end + 1)
    else if (i > 0 && out[i - 1] === ' ') out = out.slice(0, i - 1) + out.slice(end)
    else out = out.slice(0, i) + out.slice(end)
    i = mentionIndex(out, name, Math.max(0, i - 1))
  }
  return out
}

export type NoteBodyPart = { kind: 'text'; text: string } | { kind: 'tag'; name: string }

/**
 * A posted note cut into plain words and name chips. `names` are the people its tag rows name.
 * A name that is not in the words (a person renamed since) draws no chip, and the note still
 * reads whole.
 */
export function noteBodyParts(body: string, names: readonly string[]): NoteBodyPart[] {
  const wanted = [...new Set(names.map((n) => n.trim()).filter(Boolean))].sort((a, b) => b.length - a.length)
  const parts: NoteBodyPart[] = []
  let i = 0
  while (i < body.length) {
    let at = -1
    let hit = ''
    for (const name of wanted) {
      const idx = mentionIndex(body, name, i)
      if (idx >= 0 && (at < 0 || idx < at)) {
        at = idx
        hit = name
      }
    }
    if (at < 0) break
    if (at > i) parts.push({ kind: 'text', text: body.slice(i, at) })
    parts.push({ kind: 'tag', name: hit })
    i = at + hit.length + 1
  }
  if (i < body.length) parts.push({ kind: 'text', text: body.slice(i) })
  return parts
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? ''
}

/**
 * Each name as the row says it: the first name alone, unless someone else on the list shares
 * it, and then the name whole, so the line says which Chris. A name is said once.
 */
export function shortNames(names: readonly string[], everyone: readonly string[]): string[] {
  const wanted = [...new Set(names.map((n) => n.trim()).filter(Boolean))]
  const all = new Set<string>()
  for (const n of [...everyone, ...wanted]) {
    const t = n.trim()
    if (t) all.add(fold(t))
  }
  return wanted.map((n) => {
    const first = fold(firstName(n))
    const sharing = [...all].filter((k) => firstName(k) === first).length
    return sharing > 1 ? n : firstName(n)
  })
}

/** The grey line under a note that tags someone: `waiting on Dana`. Empty when nobody is tagged. */
export function waitingOnWords(tagged: readonly string[], everyone: readonly string[]): string {
  const short = shortNames(tagged, everyone)
  return short.length === 0 ? '' : `waiting on ${andList(short)}`
}

/** One tag row as the screens read it (`jobs_ledger_note_tags`). */
export type NoteTagRow = {
  noteId: string
  taggedUserId: string
  taggedName: string
  taggerUserId: string
  createdAt: string
  clearedAt: string | null
  clearedHow: 'answered' | 'done' | null
}

/** A job's tag rows by the note they sit on. */
export function tagsByNote(rows: readonly NoteTagRow[]): Map<string, NoteTagRow[]> {
  const out = new Map<string, NoteTagRow[]>()
  for (const r of rows) {
    const list = out.get(r.noteId)
    if (list) list.push(r)
    else out.set(r.noteId, [r])
  }
  return out
}

/** What a note's tags add to its line: the names for its chips, the words after it, and its colour. */
export type NoteTagMark = {
  /** The tagged names, for the chips. */
  names: string[]
  /** The names that are the reader, whose chip is amber. */
  mine: string[]
  /** `waiting on Dana · 4d`, `answered by Dana`, `Dana: no reply needed`. */
  words: string
  /** Something still waits. */
  waiting: boolean
  /** It has waited two working days or more. */
  late: boolean
}

/**
 * The mark for one note's tags, or null when it has none. While anyone is still owed an answer
 * the words say who and for how long, with the reader as `you`. Once all have cleared they say
 * how: who answered, and who pressed No reply needed.
 */
export function noteTagMark(
  tags: readonly NoteTagRow[],
  opts: { viewerId: string | null; postedYmd: string; todayYmd: string; everyone?: readonly string[] },
): NoteTagMark | null {
  if (tags.length === 0) return null
  const names = tags.map((t) => t.taggedName)
  const everyone = [...(opts.everyone ?? []), ...names]
  const mine = tags.filter((t) => t.taggedUserId === opts.viewerId).map((t) => t.taggedName)
  const open = tags.filter((t) => t.clearedAt == null)
  if (open.length > 0) {
    const others = shortNames(open.filter((t) => t.taggedUserId !== opts.viewerId).map((t) => t.taggedName), everyone)
    const who = open.some((t) => t.taggedUserId === opts.viewerId) ? ['you', ...others] : others
    const age = tagAgeWords(opts.postedYmd, opts.todayYmd)
    return {
      names,
      mine,
      words: `waiting on ${andList(who)}${age ? ` · ${age}` : ''}`,
      waiting: true,
      late: tagIsLate(opts.postedYmd, opts.todayYmd),
    }
  }
  const answered = shortNames(tags.filter((t) => t.clearedHow === 'answered').map((t) => t.taggedName), everyone)
  const done = shortNames(tags.filter((t) => t.clearedHow === 'done').map((t) => t.taggedName), everyone)
  const said = [
    answered.length > 0 ? `answered by ${andList(answered)}` : '',
    done.length > 0 ? `${andList(done)}: no reply needed` : '',
  ].filter(Boolean)
  return { names, mine, words: said.join(' · '), waiting: false, late: false }
}

/**
 * Who is offered the @ button and the list. A dev alone until the Tagged job notes section
 * lands (punch list #363, PR 4): before it, a tag would reach its person on the job's row only.
 */
export function canTagInJobNotes(role: string | null | undefined): boolean {
  return role === 'dev'
}

const YMD = /^(\d{4})-(\d{2})-(\d{2})$/

function weekdayOfYmd(ymd: string): number | null {
  const m = YMD.exec(ymd)
  if (!m) return null
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).getUTCDay()
}

/** Whole calendar days from the day a tag was posted to today. Never below zero. */
export function tagAgeDays(postedYmd: string, todayYmd: string): number {
  if (!YMD.test(postedYmd) || !YMD.test(todayYmd)) return 0
  const days = Math.round((Date.parse(`${todayYmd}T12:00:00Z`) - Date.parse(`${postedYmd}T12:00:00Z`)) / 86_400_000)
  return Math.max(0, days)
}

/**
 * The working days a tag has waited: each Monday to Friday after the day it was posted, up to
 * and counting today. A tag posted on a Friday has waited none by Sunday and two by Tuesday.
 */
export function workingDaysWaited(postedYmd: string, todayYmd: string): number {
  const span = tagAgeDays(postedYmd, todayYmd)
  // Past this the answer cannot change the amber rule, and the loop stays short for an old tag.
  const steps = Math.min(span, 21)
  let count = 0
  let day = postedYmd
  for (let i = 0; i < steps; i += 1) {
    day = ymdAddDays(day, 1)
    const w = weekdayOfYmd(day)
    if (w !== null && w !== 0 && w !== 6) count += 1
  }
  return count
}

/** Amber: the tag has waited two working days or more. */
export function tagIsLate(postedYmd: string, todayYmd: string): boolean {
  return workingDaysWaited(postedYmd, todayYmd) >= TAG_LATE_AFTER_WORKING_DAYS
}

/** The age beside a tag's time: nothing on the day it was posted, then `1d`, `4d`. */
export function tagAgeWords(postedYmd: string, todayYmd: string): string {
  const days = tagAgeDays(postedYmd, todayYmd)
  return days === 0 ? '' : `${days}d`
}

/** The oldest tag on top: it is the one most owed. */
export function oldestFirst<T extends { createdAt: string }>(tags: readonly T[]): T[] {
  return [...tags].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

/** What the section draws: three tags and how many the Show the rest press holds, or all of them. */
export function sectionSplit<T>(tags: readonly T[], showAll: boolean): { shown: T[]; rest: number } {
  if (showAll || tags.length <= TAG_SECTION_SHOWN) return { shown: [...tags], rest: 0 }
  return { shown: tags.slice(0, TAG_SECTION_SHOWN), rest: tags.length - TAG_SECTION_SHOWN }
}
