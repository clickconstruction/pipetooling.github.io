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
import { taskTitlePlain } from '../tasks/taskPlace'

/** One person the list may offer on a job or a task: someone who can open its notes. */
export type TaggablePerson = {
  userId: string
  name: string
  role: string | null
  /** On the job's crew, as against the office. */
  onJob: boolean
  /** One of a task's own people (punch list #375): whoever gave it, or whoever has it. */
  onTask?: boolean
  /** The person who gave the task. */
  gave?: boolean
}

/** The list's groups, in the order they are drawn. */
export type TagGroup = 'asked' | 'task' | 'job' | 'office'

export type TagListRow = { person: TaggablePerson; group: TagGroup }

export const TAG_GROUP_ORDER: readonly TagGroup[] = ['asked', 'task', 'job', 'office']

export const TAG_GROUP_WORDS: Record<TagGroup, string> = {
  asked: 'Asked you',
  task: 'On this task',
  job: 'On this job',
  office: 'Office',
}

/** A task's note box offers this many of its own people before a letter is typed. */
export const TASK_OFFER_MAX = 3

/** A tag turns amber once it has waited this many working days. */
export const TAG_LATE_AFTER_WORKING_DAYS = 2

/** The section shows this many tags before its Show the rest press. */
export const TAG_SECTION_SHOWN = 3

/** Letters, an apostrophe or a hyphen: what a name being typed after `@` may hold. */
const QUERY_AT_END = /(^|\s)@([\p{L}'’-]*)$/u

/** What may follow `@` while it could still be a name: a word, then more words one space apart. */
const NAME_SO_FAR = /^[\p{L}'’-]+(?: [\p{L}'’-]*)*$/u

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

/**
 * The `@` being typed at the caret, read by its shape alone (punch list #375): where it sits and
 * the words after it. Unlike `tagQueryAtCaret` the words may run through a space, so `@chris b`
 * is still one. Null once anything but a name's letters follows, as in `@ 8:45` and `@$300`.
 */
export function tagTypingAtCaret(text: string, caret: number): { query: string; start: number } | null {
  const before = text.slice(0, clampCaret(text, caret))
  const start = before.lastIndexOf('@')
  if (start < 0 || (start > 0 && !/\s/.test(before[start - 1]!))) return null
  const query = before.slice(start + 1)
  return query === '' || NAME_SO_FAR.test(query) ? { query, start } : null
}

/**
 * The `@` being typed at the caret, read with the names the row can offer (punch list #375).
 *
 * One word after the `@` is always a query, as before. Past a space it stays one only while the
 * words still start somebody's full name, so `@chris b` keeps Chris Bell and Chris Bellamy
 * offered and `@will call` offers nobody. An `@` that already holds a made tag (`liveNames`) is
 * done and opens nothing. This only says what the row shows: a name is tagged by a tap or
 * Enter, never by being typed.
 */
export function tagNameQueryAtCaret(
  text: string,
  caret: number,
  names: readonly string[],
  liveNames: readonly string[] = [],
): { query: string; start: number } | null {
  const typing = tagTypingAtCaret(text, caret)
  if (!typing) return null
  if (liveNames.some((n) => mentionIndex(text, n, typing.start) === typing.start)) return null
  if (!typing.query.includes(' ')) return typing
  const q = fold(typing.query)
  return names.some((n) => foldName(n).startsWith(q)) ? typing : null
}

/** A name folded, with one space between its words. */
function foldName(name: string): string {
  return fold(name.trim().replace(/\s+/g, ' '))
}

/**
 * True when the name fits what was typed. One word fits the start of any word of the name. Words
 * with a space between them fit only the start of the whole name. Nothing typed matches everyone.
 */
export function nameMatchesQuery(name: string, query: string): boolean {
  const q = fold(query.replace(/^\s+/, ''))
  if (!q.trim()) return true
  if (q.includes(' ')) return foldName(name).startsWith(q)
  return foldName(name)
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
    const group: TagGroup = person.userId === opts.askerId ? 'asked' : person.onTask ? 'task' : person.onJob ? 'job' : 'office'
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
 * With no `@` at the caret (a name pressed cold) the name goes in at the caret.
 *
 * `queryStart` is where the open row's `@` sits, or null for a cold press. Left out, the `@` is
 * found as `tagQueryAtCaret` finds it, which stops at a space.
 */
export function insertPick(text: string, caret: number, name: string, queryStart?: number | null): { text: string; caret: number } {
  const at = clampCaret(text, caret)
  const mention = `@${name.trim()} `
  const q = queryStart === undefined ? tagQueryAtCaret(text, at) : queryStart == null || queryStart < 0 || queryStart > at ? null : { start: queryStart }
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

/**
 * One Backspace right after a tag takes the whole `@Full Name` off (punch list #375). `caret` is
 * where the caret sits before the key. Null when the caret is not right after a live tag, with
 * or without the space a pick leaves, and the key is then an ordinary Backspace.
 */
export function backspaceTag(text: string, caret: number, liveNames: readonly string[]): { text: string; caret: number } | null {
  const at = clampCaret(text, caret)
  for (const name of liveNames) {
    const mention = `@${name.trim()}`
    if (mention === '@') continue
    for (const tail of [' ', '']) {
      const start = at - mention.length - tail.length
      if (start >= 0 && text.slice(start, at) === mention + tail && mentionIndex(text, name, start) === start) {
        return { text: text.slice(0, start) + text.slice(at), caret: start }
      }
    }
  }
  return null
}

/**
 * The same rule read after the fact, for a phone keyboard that names no key: `before` and `after`
 * are the words around one change and `caret` is where the caret now sits. When the change took
 * one character off right after a live tag, the answer is the words with the whole tag off.
 */
export function backspacedTag(before: string, after: string, caret: number, liveNames: readonly string[]): { text: string; caret: number } | null {
  if (after.length !== before.length - 1) return null
  const at = clampCaret(after, caret)
  if (before.slice(0, at) + before.slice(at + 1) !== after) return null
  return backspaceTag(before, at + 1, liveNames)
}

/** A run of the words being written: plain, a made tag, or the `@` the row is offering names for. */
export type DraftPart = { text: string; mark: 'tag' | 'typing' | null }

/**
 * The words in the box cut into runs, so a layer under the box can tint each live `@Full Name`
 * and underline the `@` being typed (punch list #375). The runs joined are the words unchanged.
 */
export function draftMarkParts(text: string, liveNames: readonly string[], typing?: { start: number; end: number } | null): DraftPart[] {
  const ranges: { start: number; end: number; mark: 'tag' | 'typing' }[] = []
  for (const name of new Set(liveNames.map((n) => n.trim()).filter(Boolean))) {
    let i = mentionIndex(text, name)
    while (i >= 0) {
      ranges.push({ start: i, end: i + name.length + 1, mark: 'tag' })
      i = mentionIndex(text, name, i + 1)
    }
  }
  if (typing && typing.end > typing.start) {
    ranges.push({ start: Math.max(0, typing.start), end: Math.min(text.length, typing.end), mark: 'typing' })
  }
  ranges.sort((a, b) => a.start - b.start || (a.mark === 'tag' ? -1 : 1))
  const parts: DraftPart[] = []
  let at = 0
  for (const r of ranges) {
    if (r.start < at || r.end <= r.start) continue
    if (r.start > at) parts.push({ text: text.slice(at, r.start), mark: null })
    parts.push({ text: text.slice(r.start, r.end), mark: r.mark })
    at = r.end
  }
  if (at < text.length) parts.push({ text: text.slice(at), mark: null })
  return parts
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
  /** The note or comment that answered this tag, when one did. A reader that does not ask for it leaves it out. */
  answerNoteId?: string | null
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

/** What a name press says under the name: what the person is to this job or this task. */
export function tagPersonSays(row: TagListRow): string {
  if (row.group === 'asked') return 'asked you'
  const person = row.person
  if (person.gave) return 'gave this task'
  if (person.onTask) return 'has this task'
  const role = person.role === 'helpers' || person.role === 'primary' ? 'crew' : person.role === 'superintendent' ? 'superintendent' : 'office'
  return person.onJob && role !== 'office' ? `${role} · on this job` : role
}

/**
 * The names a task's note box offers before a letter is typed (punch list #375): the task's own
 * people, whoever gave it first, three at most, without anyone already tagged.
 */
export function taskOffer(people: readonly TaggablePerson[], pickedIds: readonly string[] = []): TagListRow[] {
  return rankTaggable(
    people.filter((p) => p.onTask),
    '',
    { pickedIds },
  )
    .sort((a, b) => Number(b.person.gave === true) - Number(a.person.gave === true))
    .slice(0, TASK_OFFER_MAX)
}

/**
 * Who is offered the @ in a task's note box (punch list #375): the same seven roles as on a job.
 * The server still decides task by task: only a task's own people and the office are on its list,
 * and anyone else gets a plain box.
 */
export function canTagInTaskNotes(role: string | null | undefined): boolean {
  return canTagInJobNotes(role)
}

/** The roles job_note_people() lists (punch list #363): the office, and the roles a job's crew is made of. */
const TAGGING_ROLES: readonly string[] = ['dev', 'master_technician', 'assistant', 'controller', 'superintendent', 'helpers', 'primary']

/**
 * Who is offered the @ button and the list: every role the list itself can hold. A subcontractor
 * and an estimator are not offered it, since nobody can tag them back. The server still decides
 * job by job: a helper off a job's crew is refused its list.
 */
export function canTagInJobNotes(role: string | null | undefined): boolean {
  return role != null && TAGGING_ROLES.includes(role)
}

/** Which notes a list of tags holds: a job's, a task's, or both side by side. */
export type TagKinds = 'job' | 'task' | 'both'

/**
 * One row of `note_tags_mine()`: a tag that waits on the reader, or one the reader made, in a job
 * note or a task note. A job tag carries its job and a task tag its day row, task and title.
 */
export type MyTag = {
  tagId: string
  kind: 'waiting' | 'asked'
  /** Where the note is (punch list #375). Left out, the tag is a job's. */
  source?: 'job' | 'task'
  /** A task tag's day row, its task, the task's title as written and the day row's date. */
  instanceId?: string | null
  itemId?: string | null
  taskTitle?: string | null
  taskDate?: string | null
  /** The tagged person is archived: an open tag on them will never be answered. */
  taggedLeft?: boolean
  noteId: string
  jobId: string
  jobName: string
  jobNumber: string | null
  jobKind: string | null
  customerName: string | null
  noteBody: string
  noteCreatedAt: string
  taggerUserId: string
  taggerName: string
  taggedUserId: string
  taggedName: string
  createdAt: string
  clearedAt: string | null
  clearedHow: 'answered' | 'done' | null
  answerBody: string | null
  askerSeenAt: string | null
}

/** The section's two lists and its number. */
export type MyTagsView = {
  /** What waits on the reader, the oldest on top. */
  waiting: MyTag[]
  /** What the reader asked: an answer not yet seen first, then what still waits, then the rest. */
  asked: MyTag[]
  /** Answers and No reply needed presses the reader has not seen. */
  unseen: number
  /** The number above Jobs. */
  count: number
}

/** True for a tag in a task note. */
export function tagIsTask(t: Pick<MyTag, 'source'>): boolean {
  return t.source === 'task'
}

/** The tags of one kind, or all of them. */
export function tagsOfKind<T extends Pick<MyTag, 'source'>>(tags: readonly T[], kinds: TagKinds): T[] {
  if (kinds === 'both') return [...tags]
  return tags.filter((t) => tagIsTask(t) === (kinds === 'task'))
}

/** What a tag is about, as the lists name it: the job's name, or the task's title as plain words. */
export function tagWhere(t: Pick<MyTag, 'source' | 'jobName' | 'taskTitle'>): string {
  return tagIsTask(t) ? taskTitlePlain(t.taskTitle) : t.jobName.trim() || 'A job'
}

function askedRank(t: MyTag): number {
  if (t.clearedAt != null && t.askerSeenAt == null) return 0
  return t.clearedAt == null ? 1 : 2
}

export function myTagsView(tags: readonly MyTag[]): MyTagsView {
  const waiting = oldestFirst(tags.filter((t) => t.kind === 'waiting'))
  const asked = tags
    .filter((t) => t.kind === 'asked')
    .sort((a, b) => askedRank(a) - askedRank(b) || (askedRank(a) === 1 ? a.createdAt.localeCompare(b.createdAt) : (b.clearedAt ?? '').localeCompare(a.clearedAt ?? '')))
  const unseen = asked.filter((t) => askedRank(t) === 0).length
  return { waiting, asked, unseen, count: waiting.length + unseen }
}

/** What a You asked line says after the name: how the tag stands, and whether it is late. */
export function askedLineWords(tag: MyTag, todayYmd: string, postedYmd: string): { words: string; tone: 'late' | 'waiting' | 'cleared' } {
  // A tag on someone who has left waits forever, so the line says so in place of an age.
  if (tag.clearedAt == null && tag.taggedLeft) return { words: 'has left', tone: 'late' }
  if (tag.clearedAt == null) {
    const age = tagAgeWords(postedYmd, todayYmd)
    return { words: `no answer yet${age ? ` · ${age}` : ''}`, tone: tagIsLate(postedYmd, todayYmd) ? 'late' : 'waiting' }
  }
  if (tag.clearedHow === 'done') return { words: 'no reply needed', tone: 'cleared' }
  const said = (tag.answerBody ?? '').trim()
  return { words: said ? `answered: ${said}` : 'answered', tone: 'cleared' }
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}

/**
 * The Needs you line for tags (punch list #363, and task notes since #375): its title and the jobs
 * and tasks under it, in the order they wait. Null when nothing waits.
 */
export function tagsNeed(view: Pick<MyTagsView, 'waiting' | 'unseen' | 'count'>): { count: number; title: string; detail: string } | null {
  if (view.count === 0) return null
  const taskNotes = view.waiting.filter(tagIsTask).length
  const jobNotes = view.waiting.length - taskNotes
  const parts = [
    jobNotes > 0 ? `${plural(jobNotes, 'job note', 'job notes')} tagged you` : '',
    taskNotes > 0 ? `${plural(taskNotes, 'task note', 'task notes')} tagged you` : '',
    view.unseen > 0 ? `${plural(view.unseen, 'answer', 'answers')} to a note you tagged` : '',
  ].filter(Boolean)
  const names = [...new Set(view.waiting.map((t) => (tagIsTask(t) || t.jobName.trim() ? tagWhere(t) : '')).filter(Boolean))]
  const detail = names.length > 3 ? `${names.slice(0, 3).join(' · ')} and ${names.length - 3} more` : names.join(' · ')
  return { count: view.count, title: parts.join(' · '), detail }
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
