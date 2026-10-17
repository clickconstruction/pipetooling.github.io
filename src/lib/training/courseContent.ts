/**
 * Training course content (punch list #111): the lessons a crew member reads at their own pace,
 * parsed from the markdown bundled under `src/content/training/<course>/` the way help guides
 * are bundled from `src/content/help/`. Pure: no React, no Vite. `courseRegistry.ts` is the one
 * module that touches `import.meta.glob`, and `courseContent.test.ts` reads the real folder with
 * `fs` and holds every lesson to the shape below and to the plain-words rules.
 *
 * A course folder holds:
 *   course.md        frontmatter: title, summary, line (the "not a card" sentence), final_draw,
 *                    final_pass; body: a `## Parts` list, `0. Start here` … `8. People and culture`.
 *   NN-<slug>.md     one lesson, NN = its order from 01, consecutive. Frontmatter: title, part,
 *                    minutes, from (the refresher unit it was built from). Body sections, in this
 *                    order: `## Why it matters` (one or two short paragraphs), `## Must know`
 *                    (a list), `## Traps` (a list), `## Numbers` (a list of `**value** label`),
 *                    `## Check yourself` (four numbered questions; each has four `- [ ]` options
 *                    with exactly one `- [x]`, then `> right: …` and `> wrong: …` lines).
 *   final-bank.md    the final check's own questions in the same question shape, at least
 *                    twenty, under `## Questions`.
 *
 * Everything a first-timer reads is held to plain words (`plainWords.ts`): the why, the must-know
 * and trap items, each question, each option and both whys. A number chip's label is a fragment,
 * so it is held to the glue rule only. Nothing is exempt.
 *
 * The final check draws `final_draw` questions, one part at a time so every part is asked, from
 * the lessons' questions and the bank, with a seed so a retake draws again; `final_pass` right
 * passes. A pass records `contentVersion`, a hash of every lesson's words, so a changed word never
 * voids a pass and the office can see which words a person passed on.
 */
import { parseHelpGuideFrontmatter } from '../helpGuides'
import { itemWords, parseFigureItem } from './figures'
import { PLAIN_WORDS_GLUE, plainWordsFailures } from '../plainWords'

export type CourseQuestionOption = { text: string; right: boolean }

export type CourseQuestion = {
  /** `<lesson key>#<n>` or `final-bank#<n>`: stable across draws, the key a pick is recorded under. */
  id: string
  n: number
  ask: string
  options: CourseQuestionOption[]
  /** The line under a right pick. */
  rightWhy: string
  /** The line under a wrong pick, before Try again. */
  wrongWhy: string
  /** The part the question belongs to (the lesson's, or -1 for the bank), for the final check's draw. */
  part: number
}

export type CourseNumber = { value: string; label: string }

export type CourseLesson = {
  /** The filename without `.md`: `19-trenches-soil-and-protection`. */
  key: string
  /** 1-based, consecutive across the course. */
  order: number
  title: string
  part: number
  minutes: number
  from: string
  why: string[]
  mustKnow: string[]
  traps: string[]
  numbers: CourseNumber[]
  questions: CourseQuestion[]
}

export type CoursePart = { n: number; name: string }

export type Course = {
  slug: string
  title: string
  summary: string
  /** "A refresher, not an OSHA card. The card comes from the 30-hour course." */
  line: string
  finalDraw: number
  finalPass: number
  parts: CoursePart[]
  lessons: CourseLesson[]
  finalBank: CourseQuestion[]
  /** A hash of every lesson's and the bank's words; a pass records it. */
  contentVersion: string
  /** The lessons' minutes added up, plus the final check's. */
  minutes: number
  /** `minutes:` in course.md, which the Dashboard reads without the lessons; the content test holds it equal to `minutes`. */
  minutesStated: number | null
}

export const LESSON_QUESTIONS = 4
export const QUESTION_OPTIONS = 4
export const FINAL_BANK_MIN = 20
export const FINAL_CHECK_MINUTES = 15

/** The sections a lesson body carries, in this order. */
export const LESSON_SECTIONS = ['Why it matters', 'Must know', 'Traps', 'Numbers', 'Check yourself'] as const

/**
 * Appendix B of the refresher: the places where the course's own quiz key contradicts its lessons.
 * No check question is built on one, so a question whose ask carries one of these phrases fails
 * the content test. Lower-case substrings.
 */
export const APPENDIX_B_BANNED_ASKS: readonly string[] = [
  'changing how work is done',
  'changes how work is done',
  'minimum distance scaffolds can be from',
  'distance scaffolds can be from electrical',
  '2,220',
  'disciplinary action',
  '55-gallon',
  'daily inspection form',
  'within 15 days',
  'spray water',
  'controlled access zone',
  'initial hazard assessment',
]

function fail(where: string, what: string): never {
  throw new Error(`Training content "${where}": ${what}`)
}

function listItems(lines: string[], where: string, section: string): string[] {
  const items: string[] = []
  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue
    if (!line.startsWith('- ')) fail(where, `"${section}" holds a line that is not a list item: ${line}`)
    items.push(line.slice(2).trim())
  }
  return items
}

function paragraphs(lines: string[]): string[] {
  return lines.map((l) => l.trim()).filter(Boolean)
}

const NUMBER_ITEM = /^\*\*([^*]+)\*\*\s+(.+)$/

function parseNumbers(items: string[], where: string): CourseNumber[] {
  return items.map((item) => {
    const m = NUMBER_ITEM.exec(item)
    if (!m) fail(where, `a Numbers item is not "**value** label": ${item}`)
    return { value: (m[1] ?? '').trim(), label: (m[2] ?? '').trim() }
  })
}

const QUESTION_START = /^(\d+)\.\s+(.+)$/
const OPTION_LINE = /^-\s+\[( |x|X)\]\s+(.+)$/
const WHY_LINE = /^>\s*(right|wrong):\s*(.+)$/

/** The numbered questions of a `## Check yourself` or `## Questions` section. */
export function parseQuestions(lines: string[], where: string, idPrefix: string, part: number): CourseQuestion[] {
  const out: CourseQuestion[] = []
  let cur: { n: number; ask: string; options: CourseQuestionOption[]; rightWhy: string; wrongWhy: string } | null = null
  const close = () => {
    if (!cur) return
    const rights = cur.options.filter((o) => o.right).length
    if (cur.options.length !== QUESTION_OPTIONS) fail(where, `question ${cur.n} has ${cur.options.length} options, not ${QUESTION_OPTIONS}`)
    if (rights !== 1) fail(where, `question ${cur.n} marks ${rights} right options, not one`)
    if (!cur.rightWhy) fail(where, `question ${cur.n} has no "> right:" line`)
    if (!cur.wrongWhy) fail(where, `question ${cur.n} has no "> wrong:" line`)
    out.push({ id: `${idPrefix}#${cur.n}`, n: cur.n, ask: cur.ask, options: cur.options, rightWhy: cur.rightWhy, wrongWhy: cur.wrongWhy, part })
    cur = null
  }
  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue
    const q = QUESTION_START.exec(line)
    if (q) {
      close()
      const n = Number.parseInt(q[1] ?? '', 10)
      if (n !== out.length + 1) fail(where, `question numbers must run 1, 2, 3… (found ${n} after ${out.length})`)
      cur = { n, ask: (q[2] ?? '').trim(), options: [], rightWhy: '', wrongWhy: '' }
      continue
    }
    if (!cur) fail(where, `a line before the first question: ${line}`)
    const o = OPTION_LINE.exec(line)
    if (o) {
      cur.options.push({ text: (o[2] ?? '').trim(), right: (o[1] ?? ' ') !== ' ' })
      continue
    }
    const w = WHY_LINE.exec(line)
    if (w) {
      if (w[1] === 'right') cur.rightWhy = (w[2] ?? '').trim()
      else cur.wrongWhy = (w[2] ?? '').trim()
      continue
    }
    fail(where, `question ${cur.n} holds a line that is not an option or a why: ${line}`)
  }
  close()
  return out
}

/** Split a markdown body into its `## ` sections, in file order. */
export function bodySections(body: string): Array<{ heading: string; lines: string[] }> {
  const sections: Array<{ heading: string; lines: string[] }> = []
  for (const raw of body.replace(/\r\n/g, '\n').split('\n')) {
    if (raw.startsWith('## ')) {
      sections.push({ heading: raw.slice(3).trim(), lines: [] })
      continue
    }
    if (raw.startsWith('# ')) throw new Error(`a top-level # heading is not allowed in course content: ${raw}`)
    if (sections.length === 0) {
      if (raw.trim()) throw new Error(`text before the first ## heading: ${raw}`)
      continue
    }
    const last = sections[sections.length - 1]
    if (last) last.lines.push(raw)
  }
  return sections
}

const LESSON_FILE = /^(\d{2})-([a-z0-9-]+)$/

export function parseLesson(source: string, key: string): CourseLesson {
  const m = LESSON_FILE.exec(key)
  if (!m) fail(key, 'a lesson file is named NN-<slug>.md')
  const order = Number.parseInt(m[1] ?? '', 10)
  const { fields, body } = parseHelpGuideFrontmatter(source)
  const title = (fields.title ?? '').trim()
  if (!title) fail(key, 'missing frontmatter "title"')
  const part = Number.parseInt((fields.part ?? '').trim(), 10)
  if (!Number.isInteger(part) || part < 0) fail(key, 'frontmatter "part" is a part number, 0 for Start here')
  const minutes = Number.parseInt((fields.minutes ?? '').trim(), 10)
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 30) fail(key, 'frontmatter "minutes" is 1 to 30')
  const from = (fields.from ?? '').trim()
  if (!from) fail(key, 'missing frontmatter "from" (the refresher unit)')
  let sections: ReturnType<typeof bodySections>
  try {
    sections = bodySections(body)
  } catch (e) {
    fail(key, (e as Error).message)
  }
  const headings = sections.map((s) => s.heading)
  if (headings.join('|') !== LESSON_SECTIONS.join('|')) {
    fail(key, `sections must be exactly: ${LESSON_SECTIONS.map((s) => `## ${s}`).join(', ')} (found: ${headings.map((h) => `## ${h}`).join(', ') || 'none'})`)
  }
  const [why, mustKnow, traps, numbers, check] = sections
  if (!why || !mustKnow || !traps || !numbers || !check) fail(key, 'the five sections are missing')
  const lesson: CourseLesson = {
    key,
    order,
    title,
    part,
    minutes,
    from,
    why: paragraphs(why.lines),
    mustKnow: listItems(mustKnow.lines, key, 'Must know'),
    traps: listItems(traps.lines, key, 'Traps'),
    numbers: parseNumbers(listItems(numbers.lines, key, 'Numbers'), key),
    questions: parseQuestions(check.lines, key, key, part),
  }
  // Figures (punch list #116, v2.5598): a `{{figure:<name>|<caption>}}` item must name a drawing the app has,
  // and a figure is not a fact, so the item counts below are of sentences.
  const facts = (items: readonly string[]) => items.filter((item) => !parseFigureItem(item, key)).length
  if (lesson.why.length < 1 || lesson.why.length > 3) fail(key, 'Why it matters is one to three short paragraphs')
  if (facts(lesson.mustKnow) < 4 || facts(lesson.mustKnow) > 12) fail(key, `Must know is 4 to 12 facts (found ${facts(lesson.mustKnow)})`)
  if (facts(lesson.traps) < 1 || facts(lesson.traps) > 4) fail(key, `Traps is 1 to 4 items (found ${facts(lesson.traps)})`)
  if (lesson.numbers.length < 3 || lesson.numbers.length > 10) fail(key, `Numbers is 3 to 10 items (found ${lesson.numbers.length})`)
  if (lesson.questions.length !== LESSON_QUESTIONS) fail(key, `Check yourself is exactly ${LESSON_QUESTIONS} questions (found ${lesson.questions.length})`)
  return lesson
}

const PART_LINE = /^(\d+)\.\s+(.+)$/

function parseCourseMeta(source: string, slug: string): Omit<Course, 'lessons' | 'finalBank' | 'contentVersion' | 'minutes'> {
  const { fields, body } = parseHelpGuideFrontmatter(source)
  const title = (fields.title ?? '').trim()
  if (!title) fail(`${slug}/course.md`, 'missing frontmatter "title"')
  const summary = (fields.summary ?? '').trim()
  if (!summary) fail(`${slug}/course.md`, 'missing frontmatter "summary"')
  const line = (fields.line ?? '').trim()
  if (!line) fail(`${slug}/course.md`, 'missing frontmatter "line" (what the course is not)')
  const finalDraw = Number.parseInt((fields.final_draw ?? '').trim(), 10)
  const finalPass = Number.parseInt((fields.final_pass ?? '').trim(), 10)
  if (!Number.isInteger(finalDraw) || finalDraw < 5) fail(`${slug}/course.md`, '"final_draw" is how many questions the final check asks, 5 or more')
  if (!Number.isInteger(finalPass) || finalPass < 1 || finalPass > finalDraw) fail(`${slug}/course.md`, '"final_pass" is how many right pass, up to final_draw')
  const sections = bodySections(body)
  const partsSection = sections.find((s) => s.heading === 'Parts')
  if (!partsSection) fail(`${slug}/course.md`, 'needs a "## Parts" section')
  const parts: CoursePart[] = []
  for (const raw of partsSection.lines) {
    const l = raw.trim()
    if (!l) continue
    const m = PART_LINE.exec(l)
    if (!m) fail(`${slug}/course.md`, `a Parts line is "N. Name": ${l}`)
    const n = Number.parseInt(m[1] ?? '', 10)
    if (n !== parts.length) fail(`${slug}/course.md`, `parts run 0, 1, 2… (found ${n} after ${parts.length - 1})`)
    parts.push({ n, name: (m[2] ?? '').trim() })
  }
  if (parts.length < 2) fail(`${slug}/course.md`, 'a course has at least two parts')
  const minutesStated = Number.parseInt((fields.minutes ?? '').trim(), 10)
  return { slug, title, summary, line, finalDraw, finalPass, parts, minutesStated: Number.isFinite(minutesStated) ? minutesStated : null }
}

function parseFinalBank(source: string, slug: string): CourseQuestion[] {
  const { body } = parseHelpGuideFrontmatter(source)
  const sections = bodySections(body)
  const qs = sections.find((s) => s.heading === 'Questions')
  if (!qs) fail(`${slug}/final-bank.md`, 'needs a "## Questions" section')
  const questions = parseQuestions(qs.lines, `${slug}/final-bank.md`, 'final-bank', -1)
  if (questions.length < FINAL_BANK_MIN) fail(`${slug}/final-bank.md`, `the bank holds at least ${FINAL_BANK_MIN} questions (found ${questions.length})`)
  return questions
}

/** FNV-1a over the words, as eight hex characters: the content version a pass records. */
export function contentVersionOf(sources: string[]): string {
  let h = 0x811c9dc5
  for (const s of sources) {
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i)
      h = Math.imul(h, 0x01000193) >>> 0
    }
    h ^= 0x2f
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, '0')
}

/** `'../content/training/osha-30-refresher/19-trenches.md'` → `{ slug: 'osha-30-refresher', file: '19-trenches' }`. */
export function courseFileFromGlobPath(path: string): { slug: string; file: string } | null {
  const m = /([a-z0-9-]+)\/([A-Za-z0-9-]+)\.md$/.exec(path)
  if (!m) return null
  return { slug: m[1] ?? '', file: m[2] ?? '' }
}

/**
 * Build every course from an `import.meta.glob` record (path → raw markdown). Throws on a bad
 * file so the content test fails loudly; sorted by slug, lessons by order.
 */
export function buildCourseRegistry(rawBySourcePath: Record<string, string>): Course[] {
  const byCourse = new Map<string, { meta?: string; bank?: string; lessons: Array<{ key: string; source: string }> }>()
  for (const [path, source] of Object.entries(rawBySourcePath)) {
    const at = courseFileFromGlobPath(path)
    if (!at) throw new Error(`Training content: a file outside a course folder: ${path}`)
    const entry = byCourse.get(at.slug) ?? { lessons: [] }
    if (at.file === 'course') entry.meta = source
    else if (at.file === 'final-bank') entry.bank = source
    else entry.lessons.push({ key: at.file, source })
    byCourse.set(at.slug, entry)
  }
  const courses: Course[] = []
  for (const [slug, entry] of [...byCourse.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    if (!entry.meta) fail(slug, 'has no course.md')
    if (!entry.bank) fail(slug, 'has no final-bank.md')
    const meta = parseCourseMeta(entry.meta, slug)
    const lessons = entry.lessons.map((l) => parseLesson(l.source, l.key)).sort((a, b) => a.order - b.order)
    if (lessons.length === 0) fail(slug, 'has no lessons')
    lessons.forEach((l, i) => {
      if (l.order !== i + 1) fail(l.key, `lesson orders run 01, 02, 03… (found ${l.order} where ${i + 1} was due)`)
      if (l.part >= meta.parts.length) fail(l.key, `part ${l.part} is not in course.md's Parts`)
    })
    const finalBank = parseFinalBank(entry.bank, slug)
    const sources = [...entry.lessons.sort((a, b) => a.key.localeCompare(b.key)).map((l) => l.source), entry.bank]
    const minutes = lessons.reduce((sum, l) => sum + l.minutes, 0) + FINAL_CHECK_MINUTES
    courses.push({ ...meta, lessons, finalBank, contentVersion: contentVersionOf(sources), minutes })
  }
  return courses
}

/** Bold marks go; what is left is the words a person reads. */
function forCounting(text: string): string {
  return text.replace(/\*\*/g, '')
}

/**
 * Plain words over one lesson: the why, every must-know and trap item, each question's ask,
 * each option and both whys. A number's label is a fragment and is held to the glue rule only.
 * Each failure names where it is.
 */
export function lessonPlainWordsFailures(lesson: CourseLesson): string[] {
  const failures: string[] = []
  const hold = (where: string, text: string) => {
    for (const f of plainWordsFailures(forCounting(text))) failures.push(`${lesson.key} ${where}: ${f}`)
  }
  lesson.why.forEach((p, i) => hold(`why ${i + 1}`, p))
  lesson.mustKnow.forEach((p, i) => hold(`must know ${i + 1}`, itemWords(p)))
  lesson.traps.forEach((p, i) => hold(`trap ${i + 1}`, itemWords(p)))
  lesson.numbers.forEach((n, i) => {
    if (PLAIN_WORDS_GLUE.test(n.label)) failures.push(`${lesson.key} number ${i + 1}: glued label: ${n.label}`)
  })
  for (const f of questionsPlainWordsFailures(lesson.questions)) failures.push(`${lesson.key} ${f}`)
  return failures
}

export function questionsPlainWordsFailures(questions: readonly CourseQuestion[]): string[] {
  const failures: string[] = []
  for (const q of questions) {
    for (const f of plainWordsFailures(forCounting(q.ask))) failures.push(`question ${q.n}: ${f}`)
    q.options.forEach((o, i) => {
      for (const f of plainWordsFailures(forCounting(o.text))) failures.push(`question ${q.n} option ${i + 1}: ${f}`)
    })
    for (const f of plainWordsFailures(forCounting(q.rightWhy))) failures.push(`question ${q.n} right: ${f}`)
    for (const f of plainWordsFailures(forCounting(q.wrongWhy))) failures.push(`question ${q.n} wrong: ${f}`)
  }
  return failures
}

/** A question whose ask stands on an Appendix B quirk. */
export function appendixBFailures(questions: readonly CourseQuestion[]): string[] {
  const out: string[] = []
  for (const q of questions) {
    const ask = q.ask.toLowerCase()
    for (const banned of APPENDIX_B_BANNED_ASKS) {
      if (ask.includes(banned)) out.push(`${q.id} asks on an Appendix B quirk ("${banned}"): ${q.ask}`)
    }
  }
  return out
}

/** mulberry32: a small seeded generator, so a retake draws and shuffles again but a draw can be replayed. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function shuffled<T>(items: readonly T[], rnd: () => number): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    const a = out[i] as T
    out[i] = out[j] as T
    out[j] = a
  }
  return out
}

/** The same question with its options in a new order (the right one still marked). */
export function shuffleOptions(q: CourseQuestion, seed: number): CourseQuestion {
  return { ...q, options: shuffled(q.options, seededRandom(seed)) }
}

/**
 * The final check's questions: `finalDraw` of them, taken one part at a time (the bank counts as a
 * part) so every part is asked, each with its options shuffled. The same seed draws the same check.
 */
/** The ask with its case and punctuation stripped: two questions with the same key are one question asked twice. */
export function askKey(ask: string): string {
  return ask.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim()
}

export function drawFinalCheck(course: Course, seed: number): CourseQuestion[] {
  const rnd = seededRandom(seed)
  const groups = new Map<number, CourseQuestion[]>()
  for (const l of course.lessons) for (const q of l.questions) groups.set(l.part, [...(groups.get(l.part) ?? []), q])
  groups.set(-1, [...course.finalBank])
  const queues = [...groups.entries()].sort(([a], [b]) => a - b).map(([, qs]) => shuffled(qs, rnd))
  const out: CourseQuestion[] = []
  const asked = new Set<string>()
  let guard = 0
  while (out.length < course.finalDraw && guard++ < 10_000) {
    let took = false
    for (const queue of queues) {
      if (out.length >= course.finalDraw) break
      // v2.5576: an ask the draw already holds is skipped, so a bank question that repeats a lesson's never comes up twice.
      let q = queue.shift()
      while (q && asked.has(askKey(q.ask))) q = queue.shift()
      if (!q) continue
      asked.add(askKey(q.ask))
      out.push({ ...q, options: shuffled(q.options, rnd) })
      took = true
    }
    if (!took) break
  }
  return out
}

export type FinalCheckResult = { right: number; total: number; passed: boolean; missed: string[] }

/** Grade a drawn check against the picks (question id → the index of the option picked, in the drawn order). */
export function gradeFinalCheck(drawn: readonly CourseQuestion[], picks: Readonly<Record<string, number>>, finalPass: number): FinalCheckResult {
  let right = 0
  const missed: string[] = []
  for (const q of drawn) {
    const pick = picks[q.id]
    if (pick != null && q.options[pick]?.right) right++
    else missed.push(q.id)
  }
  return { right, total: drawn.length, passed: right >= finalPass, missed }
}

/**
 * Progress: `lessonsDone` of `lessons`, whether the final check is passed, and the next lesson. `done`/`of` count
 * the final check as the last step (the dock and older callers); the screens say lessons and the final check apart
 * (v2.5575).
 */
export function courseProgress(course: Course, passedLessonKeys: ReadonlySet<string>, finalPassed: boolean): { done: number; of: number; lessonsDone: number; lessons: number; finalPassed: boolean; nextLesson: CourseLesson | null; allLessonsDone: boolean } {
  const done = course.lessons.filter((l) => passedLessonKeys.has(l.key)).length
  const nextLesson = course.lessons.find((l) => !passedLessonKeys.has(l.key)) ?? null
  return { done: done + (finalPassed ? 1 : 0), of: course.lessons.length + 1, lessonsDone: done, lessons: course.lessons.length, finalPassed, nextLesson, allLessonsDone: done === course.lessons.length }
}

/** The lesson a course opens on: the first not yet passed, else the first. */
export function lessonToOpen(course: Course, passedLessonKeys: ReadonlySet<string>): CourseLesson {
  const first = course.lessons[0]
  if (!first) throw new Error(`Training content "${course.slug}": has no lessons`)
  return course.lessons.find((l) => !passedLessonKeys.has(l.key)) ?? first
}
