/**
 * Editing a walked builder on the view a GC walks (punch list #404, step 7). Every piece of words on the flow is a
 * field, named by a **path** into the paper's contents. A change is to the draft, and the **map** and the list under
 * it say which **pages** differ from the published revision, each with the way back.
 *
 * A path is dotted: `notice.title`, `notice.lines.2`, `site.lead`, `words.basisAsk`, `topic.photos.label`,
 * `topic.photos.offSays`, `topic.photos.standard.says`, `topic.photos.standard.breach.0`. A page is the flow's own:
 * `notice`, `basis`, `site`, `review`, a topic's name (`topic:photos`), and a topic at a level or at Off
 * (`topic:photos:standard`, `topic:photos:off`).
 *
 * No clause wording is a field. A clause stays grey bars, and its wording stays in the Contract Book.
 *
 * Pure: no React, no supabase, no clock.
 */
import { PAPER_NEW_LINE, PAPER_OFF, type PaperDef, type PaperTopic, type PaperTopicLevel } from './documentBuilder'
import { paperDefProblems } from './definition'
import { sameContents, type BuilderRecord } from './standing'

export { PAPER_NEW_LINE }

const BASIS_WORDS = ['basisAsk', 'basisHow', 'levelsTitle', 'siteFact'] as const
type WordKey = keyof PaperDef['words']
const isBasisWord = (k: string): boolean => (BASIS_WORDS as readonly string[]).includes(k)

const TOPIC_NAME_FIELDS = ['label', 'section', 'fact'] as const
const LEVEL_TEXT_FIELDS = ['says', 'blank'] as const
const LEVEL_LIST_FIELDS = ['breach', 'site'] as const
const NOTICE_TEXT = ['title', 'placeholder', 'tick'] as const
const SITE_TEXT = ['lead', 'title', 'asksNothing', 'placeholder'] as const
const has = <T extends string>(list: readonly T[], k: string | undefined): k is T => k != null && (list as readonly string[]).includes(k)

const topicAt = (def: PaperDef, key: string | undefined): PaperTopic | undefined => def.topics.find((t) => t.key === key)

/** The words at a path, or null when the path names nothing. */
export function paperWordsAt(def: PaperDef, path: string): string | null {
  const p = path.split('.')
  const [head, a, b, c, d] = p
  if (head === 'words' && a != null && a in def.words) return def.words[a as WordKey]
  if (head === 'notice') {
    if (a === 'lines') return def.notice.lines[Number(b)] ?? null
    return has(NOTICE_TEXT, a) ? def.notice[a] : null
  }
  if (head === 'site') {
    if (a === 'lines') return def.site.lines[Number(b)] ?? null
    return has(SITE_TEXT, a) ? def.site[a] : null
  }
  if (head === 'topic') {
    const topic = topicAt(def, a)
    if (!topic) return null
    if (has(TOPIC_NAME_FIELDS, b)) return topic[b] ?? null
    if (b === 'offSays') return topic.offSays ?? null
    const level = b != null ? topic.levels[b] : undefined
    if (!level) return null
    if (has(LEVEL_TEXT_FIELDS, c)) return level[c] ?? null
    if (has(LEVEL_LIST_FIELDS, c)) return level[c][Number(d)] ?? null
  }
  return null
}

const withTopic = (def: PaperDef, key: string, change: (t: PaperTopic) => PaperTopic): PaperDef => ({ ...def, topics: def.topics.map((t) => (t.key === key ? change(t) : t)) })
const withLevel = (topic: PaperTopic, level: string, change: (l: PaperTopicLevel) => PaperTopicLevel): PaperTopic => {
  const at = topic.levels[level]
  return at ? { ...topic, levels: { ...topic.levels, [level]: change(at) } } : topic
}
const setAt = (list: readonly string[], i: number, words: string): string[] => list.map((x, k) => (k === i ? words : x))

/** The level ids stricter than one, in the paper's own order. */
function stricterThan(def: PaperDef, level: string): string[] {
  const at = def.levels.findIndex((l) => l.id === level)
  return at < 0 ? [] : def.levels.slice(at + 1).map((l) => l.id)
}

/**
 * The paper with the words at a path changed. A path that names nothing changes nothing.
 *
 * A breach line a stricter level keeps is the same words written again on that level. So a change to it here is made
 * there too, or the stricter level would show the old words as a rule of its own. A new line is on no other level:
 * adding one writes it here alone, so a stricter level's own new line is left as it is.
 */
export function withPaperWords(def: PaperDef, path: string, words: string): PaperDef {
  const was = paperWordsAt(def, path)
  if (was == null || was === words) return def
  const [head, a, b, c, d] = path.split('.')
  if (head === 'words' && a != null) return { ...def, words: { ...def.words, [a]: words } }
  if (head === 'notice') return a === 'lines' ? { ...def, notice: { ...def.notice, lines: setAt(def.notice.lines, Number(b), words) } } : { ...def, notice: { ...def.notice, [a as string]: words } }
  if (head === 'site') return a === 'lines' ? { ...def, site: { ...def.site, lines: setAt(def.site.lines, Number(b), words) } } : { ...def, site: { ...def.site, [a as string]: words } }
  if (head !== 'topic' || a == null || b == null) return def
  if (has(TOPIC_NAME_FIELDS, b) || b === 'offSays') return withTopic(def, a, (t) => ({ ...t, [b]: words }))
  if (has(LEVEL_TEXT_FIELDS, c)) return withTopic(def, a, (t) => withLevel(t, b, (l) => ({ ...l, [c]: words })))
  if (c === 'site') return withTopic(def, a, (t) => withLevel(t, b, (l) => ({ ...l, site: setAt(l.site, Number(d), words) })))
  if (c === 'breach') {
    const above = was === PAPER_NEW_LINE ? [] : stricterThan(def, b)
    return withTopic(def, a, (t) => {
      let next = withLevel(t, b, (l) => ({ ...l, breach: setAt(l.breach, Number(d), words) }))
      for (const id of above) next = withLevel(next, id, (l) => ({ ...l, breach: l.breach.map((x) => (x === was ? words : x)) }))
      return next
    })
  }
  return def
}

/** A list's path: the disclaimer's lines, the site page's, or a topic's breach or site lines at a level. */
type ListAt = { get: (def: PaperDef) => readonly string[] | null; set: (def: PaperDef, lines: string[]) => PaperDef; topic?: string; level?: string; field?: 'breach' | 'site' }
function listAt(listPath: string): ListAt | null {
  const [head, a, b, c] = listPath.split('.')
  if (head === 'notice' && a === 'lines') return { get: (def) => def.notice.lines, set: (def, lines) => ({ ...def, notice: { ...def.notice, lines } }) }
  if (head === 'site' && a === 'lines') return { get: (def) => def.site.lines, set: (def, lines) => ({ ...def, site: { ...def.site, lines } }) }
  if (head === 'topic' && a != null && b != null && has(LEVEL_LIST_FIELDS, c)) {
    return {
      get: (def) => topicAt(def, a)?.levels[b]?.[c] ?? null,
      set: (def, lines) => withTopic(def, a, (t) => withLevel(t, b, (l) => ({ ...l, [c]: lines }))),
      topic: a,
      level: b,
      field: c,
    }
  }
  return null
}

/** The paper with a new line at the end of a list. */
export function withPaperLine(def: PaperDef, listPath: string): PaperDef {
  const list = listAt(listPath)
  const lines = list?.get(def)
  return list && lines ? list.set(def, [...lines, PAPER_NEW_LINE]) : def
}

/** The paper with one line of a list gone. A breach line a stricter level keeps goes from that level too. A new line is on no other level. */
export function withoutPaperLine(def: PaperDef, listPath: string, index: number): PaperDef {
  const list = listAt(listPath)
  const lines = list?.get(def)
  if (!list || !lines || index < 0 || index >= lines.length) return def
  const gone = lines[index]
  let next = list.set(def, lines.filter((_, i) => i !== index))
  if (list.field === 'breach' && gone !== PAPER_NEW_LINE && list.topic != null && list.level != null) {
    const topic = list.topic
    for (const id of stricterThan(def, list.level)) next = withTopic(next, topic, (t) => withLevel(t, id, (l) => ({ ...l, breach: l.breach.filter((x) => x !== gone) })))
  }
  return next
}

/** The page a path is on. */
export function pathPage(path: string): string {
  const [head, a, b] = path.split('.')
  if (head === 'notice') return 'notice'
  if (head === 'site') return 'site'
  if (head === 'words') return a != null && isBasisWord(a) ? 'basis' : 'review'
  if (head === 'topic' && a != null) {
    if (b == null || has(TOPIC_NAME_FIELDS, b)) return `topic:${a}`
    return b === 'offSays' ? `topic:${a}:${PAPER_OFF}` : `topic:${a}:${b}`
  }
  return 'review'
}

/** Every page of a paper, in the flow's order: a topic's name, then the topic at Off where it can be, then at each level. */
export function paperPages(def: PaperDef): string[] {
  return [
    'notice',
    'basis',
    'site',
    ...def.topics.flatMap((t) => [`topic:${t.key}`, ...(t.inEveryPaper ? [] : [`topic:${t.key}:${PAPER_OFF}`]), ...def.levels.map((l) => `topic:${t.key}:${l.id}`)]),
    'review',
  ]
}

/** What a page holds, to hold against the same page of another revision. */
function pageContents(def: PaperDef, page: string): unknown {
  if (page === 'notice') return def.notice
  if (page === 'site') return def.site
  if (page === 'basis') return Object.fromEntries(Object.entries(def.words).filter(([k]) => isBasisWord(k)))
  if (page === 'review') return Object.fromEntries(Object.entries(def.words).filter(([k]) => !isBasisWord(k)))
  const [, key, level] = page.split(':')
  const topic = topicAt(def, key)
  if (!topic) return null
  if (level == null) return { label: topic.label, section: topic.section, fact: topic.fact ?? null }
  return level === PAPER_OFF ? (topic.offSays ?? null) : (topic.levels[level] ?? null)
}

/** The pages that differ from the published revision. None before the first publish: there is nothing to differ from. */
export function changedPages(draft: PaperDef, published: PaperDef | null): string[] {
  if (!published) return []
  return paperPages(draft).filter((page) => !sameContents(pageContents(draft, page), pageContents(published, page)))
}

/** True when the words at a path differ from the published revision's. False before the first publish. */
export function isPathChanged(draft: PaperDef, published: PaperDef | null, path: string): boolean {
  return published != null && paperWordsAt(draft, path) !== paperWordsAt(published, path)
}

/**
 * A topic with one of its pieces that need not be there, as the published revision has it. Where the published topic
 * has none, the key goes: a key left holding nothing is not what the stored copy holds.
 */
function withPieceAsWas(topic: PaperTopic, piece: 'fact' | 'offSays', was: string | undefined): PaperTopic {
  const next = { ...topic }
  if (was === undefined) delete next[piece]
  else next[piece] = was
  return next
}

/** The draft with one page put back as the published revision has it. */
export function revertPage(draft: PaperDef, published: PaperDef, page: string): PaperDef {
  if (page === 'notice') return { ...draft, notice: published.notice }
  if (page === 'site') return { ...draft, site: published.site }
  if (page === 'basis' || page === 'review') {
    const mine = Object.fromEntries(Object.entries(published.words).filter(([k]) => isBasisWord(k) === (page === 'basis')))
    return { ...draft, words: { ...draft.words, ...mine } }
  }
  const [, key, level] = page.split(':')
  const was = topicAt(published, key)
  if (!was || key == null) return draft
  if (level == null) return withTopic(draft, key, (t) => withPieceAsWas({ ...t, label: was.label, section: was.section }, 'fact', was.fact))
  if (level === PAPER_OFF) return withTopic(draft, key, (t) => withPieceAsWas(t, 'offSays', was.offSays))
  const wasLevel = was.levels[level]
  return wasLevel ? withTopic(draft, key, (t) => ({ ...t, levels: { ...t.levels, [level]: wasLevel } })) : draft
}

/** A page's name, for the list of what changed: *Photos and video, Standard*. */
export function pageName(def: PaperDef, page: string): string {
  if (page === 'notice') return 'Before you start'
  if (page === 'basis') return 'The basis'
  if (page === 'site') return 'Match the paper to the site'
  if (page === 'review') return 'Review'
  const [, key, level] = page.split(':')
  const label = topicAt(def, key)?.label ?? key ?? ''
  if (level == null) return `${label}, its name`
  return `${label}, ${level === PAPER_OFF ? 'Off' : (def.levels.find((l) => l.id === level)?.name ?? level)}`
}

/** Where the flow goes to show a page: its step, and for a topic the stop to stand on. */
export function pageOpens(page: string): { step: string; stop?: string } {
  const [head, key, level] = page.split(':')
  if (head !== 'topic' || key == null) return { step: page }
  return level == null ? { step: key } : { step: key, stop: level }
}

export type MapCell = { level: string; levelName: string; page: string; says: string; changed: boolean }
export type MapRow = { key: string; label: string; cells: MapCell[] }

/** The map: a row a topic, a column a level. A cell says what the level means on the topic, and whether it changed. */
export function mapRows(draft: PaperDef, published: PaperDef | null): MapRow[] {
  const changed = new Set(changedPages(draft, published))
  return draft.topics.map((t) => ({
    key: t.key,
    label: t.label,
    cells: draft.levels.map((l) => {
      const page = `topic:${t.key}:${l.id}`
      return { level: l.id, levelName: l.shortName ?? l.name, page, says: t.levels[l.id]?.says ?? '', changed: changed.has(page) }
    }),
  }))
}

export type WalkedPublishPress = { label: string; dead: boolean; why: string[] }

/** The press that publishes the draft as the next revision, and what stops it. */
export function walkedPublishPress(draft: PaperDef, rec: Pick<BuilderRecord, 'revision' | 'published'>): WalkedPublishPress {
  if (rec.revision > 0 && sameContents(draft, rec.published)) return { label: 'Nothing to publish', dead: true, why: [] }
  const why = paperDefProblems(draft)
  const lists = [draft.notice.lines, draft.site.lines, ...draft.topics.flatMap((t) => Object.values(t.levels).flatMap((l) => [l.breach, l.site]))]
  if (lists.some((lines) => lines.includes(PAPER_NEW_LINE))) why.push('A new line has no words yet.')
  return { label: `Publish revision ${rec.revision + 1}`, dead: why.length > 0, why }
}

/** The line under the bar: what a person outside sees now. */
export function walkedNote(rec: Pick<BuilderRecord, 'revision'>, changed: number): string {
  if (rec.revision === 0) return 'Nobody outside sees this until you publish.'
  if (changed === 0) return `Everyone outside sees revision ${rec.revision}, as you do.`
  return `Changed. Everyone outside sees revision ${rec.revision} until you publish.`
}
