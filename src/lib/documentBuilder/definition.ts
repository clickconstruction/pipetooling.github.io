/**
 * A walked builder's contents, read out of the database and checked (punch list #404, step 2). The table keeps a
 * builder's draft and its published copy as JSON, so nothing about their shape is promised. `parsePaperDef` turns
 * what the database handed back into a `PaperDef`, or says in words what is missing. `paperDefProblems` then holds
 * the definition to the rules a paper must keep before it is saved or shown:
 *
 *   - it has at least one level, and no two levels share an id
 *   - no two topics share a key
 *   - every topic has every level and no other
 *   - every level of a topic says what it means and has at least one breach line
 *   - a topic that can be left out says what Off means
 *   - every line passes the plain-words rules (`lib/plainWords.ts`)
 *
 * A problem is one line a person can act on. An empty list is a pass. Pure: no React, no supabase.
 */
import { plainWordsFailures } from '../plainWords'
import type { PaperDef, PaperLevel, PaperTopic, PaperTopicLevel } from './documentBuilder'

export type ParsedPaperDef = { ok: true; def: PaperDef } | { ok: false; problems: string[] }

type Bag = Record<string, unknown>

function isBag(v: unknown): v is Bag {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** Reads values out of a bag and notes what was missing, so one pass names every gap. */
function reader(problems: string[]) {
  return {
    text(bag: Bag, key: string, where: string): string {
      const v = bag[key]
      if (typeof v === 'string') return v
      problems.push(`${where} has no ${key}.`)
      return ''
    },
    maybeText(bag: Bag, key: string, where: string): string | undefined {
      const v = bag[key]
      if (v == null) return undefined
      if (typeof v === 'string') return v
      problems.push(`${where} has a ${key} that is not words.`)
      return undefined
    },
    lines(bag: Bag, key: string, where: string): string[] {
      const v = bag[key]
      if (Array.isArray(v) && v.every((x) => typeof x === 'string')) return v as string[]
      problems.push(`${where} has no list of ${key}.`)
      return []
    },
    bag(bag: Bag, key: string, where: string): Bag {
      const v = bag[key]
      if (isBag(v)) return v
      problems.push(`${where} has no ${key}.`)
      return {}
    },
    list(bag: Bag, key: string, where: string): unknown[] {
      const v = bag[key]
      if (Array.isArray(v)) return v
      problems.push(`${where} has no list of ${key}.`)
      return []
    },
  }
}

const WORD_KEYS = ['offSays', 'offReview', 'offNote', 'basisAsk', 'basisHow', 'siteFact', 'levelsTitle', 'reviewTitle', 'confirmPress', 'nothingPress', 'beforeConfirm'] as const

/**
 * What the database holds, as a `PaperDef`. A value that is not shaped like one answers with every gap it has, and no
 * definition, so a screen never draws half a paper.
 */
export function parsePaperDef(value: unknown): ParsedPaperDef {
  if (!isBag(value)) return { ok: false, problems: ['The contents are not a paper.'] }
  const problems: string[] = []
  const r = reader(problems)
  const paper = 'The paper'

  const wordsBag = r.bag(value, 'words', paper)
  const words = Object.fromEntries(WORD_KEYS.map((k) => [k, r.text(wordsBag, k, "The paper's words")])) as PaperDef['words']

  const levels = r.list(value, 'levels', paper).map((raw, i): PaperLevel => {
    const where = `Level ${i + 1}`
    if (!isBag(raw)) {
      problems.push(`${where} is not a level.`)
      return { id: '', name: '', alignedWith: '' }
    }
    const shortName = r.maybeText(raw, 'shortName', where)
    return { id: r.text(raw, 'id', where), name: r.text(raw, 'name', where), alignedWith: r.text(raw, 'alignedWith', where), ...(shortName != null ? { shortName } : null) }
  })

  const noticeBag = r.bag(value, 'notice', paper)
  const notice = { title: r.text(noticeBag, 'title', 'The disclaimer'), lines: r.lines(noticeBag, 'lines', 'The disclaimer'), placeholder: r.text(noticeBag, 'placeholder', 'The disclaimer'), tick: r.text(noticeBag, 'tick', 'The disclaimer') }

  const siteBag = r.bag(value, 'site', paper)
  const site = {
    lead: r.text(siteBag, 'lead', 'The site page'),
    title: r.text(siteBag, 'title', 'The site page'),
    lines: r.lines(siteBag, 'lines', 'The site page'),
    asksNothing: r.text(siteBag, 'asksNothing', 'The site page'),
    placeholder: r.text(siteBag, 'placeholder', 'The site page'),
  }

  const topics = r.list(value, 'topics', paper).map((raw, i): PaperTopic => {
    const where = `Topic ${i + 1}`
    if (!isBag(raw)) {
      problems.push(`${where} is not a topic.`)
      return { key: '', label: '', section: '', inEveryPaper: false, levels: {} }
    }
    const label = r.text(raw, 'label', where)
    const named = label ? `Topic ${i + 1}, ${label},` : where
    const levelsBag = r.bag(raw, 'levels', named)
    const topicLevels: Record<string, PaperTopicLevel> = {}
    for (const [id, one] of Object.entries(levelsBag)) {
      const at = `${named} at ${id}`
      if (!isBag(one)) {
        problems.push(`${at} is not a level.`)
        continue
      }
      const blank = r.maybeText(one, 'blank', at)
      topicLevels[id] = { says: r.text(one, 'says', at), breach: r.lines(one, 'breach', at), site: r.lines(one, 'site', at), ...(blank != null ? { blank } : null) }
    }
    const fact = r.maybeText(raw, 'fact', named)
    const offSays = r.maybeText(raw, 'offSays', named)
    if (typeof raw.inEveryPaper !== 'boolean') problems.push(`${named} does not say whether it is in every paper.`)
    return {
      key: r.text(raw, 'key', named),
      label,
      section: r.text(raw, 'section', named),
      inEveryPaper: raw.inEveryPaper === true,
      levels: topicLevels,
      ...(fact != null ? { fact } : null),
      ...(offSays != null ? { offSays } : null),
    }
  })

  const signers = r.list(value, 'signers', paper).map((raw, i) => {
    if (isBag(raw) && typeof raw.group === 'string' && typeof raw.people === 'number' && Number.isFinite(raw.people)) return { group: raw.group, people: raw.people }
    problems.push(`Signer group ${i + 1} is not a group with a head count.`)
    return { group: '', people: 0 }
  })

  const def: PaperDef = {
    id: r.text(value, 'id', paper),
    title: r.text(value, 'title', paper),
    job: r.text(value, 'job', paper),
    company: r.text(value, 'company', paper),
    protectedParty: r.text(value, 'protectedParty', paper),
    words,
    levels,
    notice,
    site,
    topics,
    signers,
  }
  return problems.length > 0 ? { ok: false, problems } : { ok: true, def }
}

/**
 * Every line a definition holds, each with where it sits, for the plain-words check. The paper's own names (its title,
 * the job, the company, the protected party) are names and not lines, so they are not held to the rules.
 */
export function paperDefTexts(def: PaperDef): Array<{ where: string; text: string }> {
  const out: Array<{ where: string; text: string }> = []
  const add = (where: string, text: string | undefined) => {
    if (text) out.push({ where, text })
  }
  for (const k of WORD_KEYS) add("The paper's words", def.words[k])
  for (const level of def.levels) {
    add(`Level ${level.name}`, level.name)
    add(`Level ${level.name}`, level.alignedWith)
    add(`Level ${level.name}`, level.shortName)
  }
  add('The disclaimer', def.notice.title)
  for (const line of def.notice.lines) add('The disclaimer', line)
  add('The disclaimer', def.notice.placeholder)
  add('The disclaimer', def.notice.tick)
  add('The site page', def.site.lead)
  add('The site page', def.site.title)
  for (const line of def.site.lines) add('The site page', line)
  add('The site page', def.site.asksNothing)
  add('The site page', def.site.placeholder)
  for (const topic of def.topics) {
    add(topic.label, topic.label)
    add(topic.label, topic.section)
    add(topic.label, topic.fact)
    add(topic.label, topic.offSays)
    for (const level of def.levels) {
      const at = topic.levels[level.id]
      if (!at) continue
      const where = `${topic.label} at ${level.name}`
      add(where, at.says)
      for (const line of at.breach) add(where, line)
      for (const line of at.site) add(where, line)
    }
  }
  return out
}

/** What stops a definition being saved or shown, one line each. An empty list is a pass. */
export function paperDefProblems(def: PaperDef): string[] {
  const problems: string[] = []

  // The paper's own names can be typed over (punch list #416), so each must still say something.
  if (!def.title.trim()) problems.push('The paper has no title.')
  if (!def.job.trim()) problems.push('The paper names no job.')
  if (!def.company.trim()) problems.push('The paper names no company.')
  if (!def.protectedParty.trim()) problems.push('The paper does not say who it protects.')

  if (def.levels.length === 0) problems.push('The paper has no level.')
  const ids = def.levels.map((l) => l.id)
  for (const level of def.levels) {
    if (!level.id.trim()) problems.push('A level has no id.')
    if (!level.name.trim()) problems.push(`Level ${level.id} has no name.`)
    if (ids.filter((id) => id === level.id).length > 1) problems.push(`Two levels share the id ${level.id}.`)
  }

  const keys = def.topics.map((t) => t.key)
  for (const topic of def.topics) {
    const name = topic.label || topic.key
    if (!topic.key.trim()) problems.push(`The topic ${name} has no key.`)
    if (keys.filter((k) => k === topic.key).length > 1) problems.push(`Two topics share the key ${topic.key}.`)
    if (!topic.label.trim()) problems.push(`The topic ${topic.key} has no name.`)
    for (const level of def.levels) {
      const at = topic.levels[level.id]
      if (!at) {
        problems.push(`${name} has no ${level.name} level.`)
        continue
      }
      if (!at.says.trim()) problems.push(`${name} at ${level.name} does not say what it means.`)
      if (at.breach.filter((line) => line.trim()).length === 0) problems.push(`${name} at ${level.name} has no breach line.`)
      if ([...at.breach, ...at.site].some((line) => !line.trim())) problems.push(`${name} at ${level.name} has an empty line.`)
    }
    for (const id of Object.keys(topic.levels)) {
      if (!ids.includes(id)) problems.push(`${name} has a level the paper does not have: ${id}.`)
    }
    if (!topic.inEveryPaper && !(topic.offSays ?? '').trim()) problems.push(`${name} can be left out, and does not say what Off means.`)
  }

  for (const { where, text } of paperDefTexts(def)) {
    for (const failure of plainWordsFailures(text)) problems.push(`${where}: ${failure}`)
  }
  return [...new Set(problems)]
}

/** The two checks in one: what the database holds, as a definition that keeps every rule, or why not. */
export function readPaperDef(value: unknown): ParsedPaperDef {
  const parsed = parsePaperDef(value)
  if (!parsed.ok) return parsed
  const problems = paperDefProblems(parsed.def)
  return problems.length > 0 ? { ok: false, problems } : parsed
}
