/**
 * Training course content (punch list #111): the parser on fixtures, then the REAL content under
 * src/content/training/ held to the lesson shape, the plain-words rules and Appendix B. A lesson
 * that fails here is rewritten, never exempted. A course whose lessons do not run 01, 02, 03… or
 * that has no final bank fails the registry case, so a half-written course never ships.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { TRAINING_COURSE_FACTS } from './courseFacts'
import { COURSE_TRADE_TERMS, TRADE_TERMS, TRADE_TERM_TEACHING_PLACES, tradeTermFailures, tradeTermFirstUse, tradeTermsFor } from './tradeTerms'
import { questionTaughtFailures, questionWords, sharedWords } from './questionTaught'
import { FIGURE_NAMES, parseFigureItem } from './figures'
import {
  APPENDIX_B_BANNED_ASKS,
  appendixBFailures,
  buildCourseRegistry,
  contentVersionOf,
  courseProgress,
  askKey,
  drawFinalCheck,
  gradeFinalCheck,
  instructionFailures,
  lessonPlainWordsFailures,
  NO_INSTRUCTION_COURSES,
  parseLesson,
  parseQuestions,
  seededRandom,
  shuffleOptions,
  type Course,
  type CourseLesson,
} from './courseContent'

const CONTENT_DIR = join(__dirname, '../../content/training')

function courseFolders(): string[] {
  return readdirSync(CONTENT_DIR).filter((f) => statSync(join(CONTENT_DIR, f)).isDirectory())
}

function lessonFiles(): Array<{ slug: string; key: string; source: string }> {
  const out: Array<{ slug: string; key: string; source: string }> = []
  for (const slug of courseFolders()) {
    for (const file of readdirSync(join(CONTENT_DIR, slug))) {
      if (!file.endsWith('.md') || file === 'course.md' || file === 'final-bank.md') continue
      out.push({ slug, key: file.slice(0, -3), source: readFileSync(join(CONTENT_DIR, slug, file), 'utf8') })
    }
  }
  return out.sort((a, b) => a.key.localeCompare(b.key))
}

function loadContent(): Record<string, string> {
  const record: Record<string, string> = {}
  for (const slug of courseFolders()) {
    for (const file of readdirSync(join(CONTENT_DIR, slug))) {
      if (!file.endsWith('.md')) continue
      record[`../content/training/${slug}/${file}`] = readFileSync(join(CONTENT_DIR, slug, file), 'utf8')
    }
  }
  return record
}

const FIXTURE = `---
title: A fixture lesson
part: 1
minutes: 5
from: Unit 9
---
## Why it matters
One short line.

## Must know
- First fact.
- Second fact with a **number** in it.
- Third fact.
- Fourth fact.

## Traps
- A trap.

## Numbers
- **5 ft** a system
- **20 ft** an engineer
- **2 ft** spoil back

## Check yourself
1. First question?
- [x] Right
- [ ] Wrong one
- [ ] Wrong two
- [ ] Wrong three
> right: Yes.
> wrong: No.

2. Second question?
- [ ] Wrong one
- [x] Right
- [ ] Wrong two
- [ ] Wrong three
> right: Yes.
> wrong: No.

3. Third question?
- [ ] Wrong one
- [ ] Wrong two
- [x] Right
- [ ] Wrong three
> right: Yes.
> wrong: No.

4. Fourth question?
- [ ] Wrong one
- [ ] Wrong two
- [ ] Wrong three
- [x] Right
> right: Yes.
> wrong: No.
`

describe('parseLesson', () => {
  it('reads the frontmatter, the five sections and four questions', () => {
    const l = parseLesson(FIXTURE, '03-a-fixture')
    expect(l.order).toBe(3)
    expect(l.title).toBe('A fixture lesson')
    expect(l.part).toBe(1)
    expect(l.minutes).toBe(5)
    expect(l.why).toEqual(['One short line.'])
    expect(l.mustKnow).toHaveLength(4)
    expect(l.numbers[0]).toEqual({ value: '5 ft', label: 'a system' })
    expect(l.questions).toHaveLength(4)
    expect(l.questions[1]?.id).toBe('03-a-fixture#2')
    expect(l.questions[1]?.options.findIndex((o) => o.right)).toBe(1)
    expect(l.questions[0]?.rightWhy).toBe('Yes.')
  })

  it('refuses a question with two right options, five options, a missing why, or an unknown line', () => {
    const twoRight = FIXTURE.replace('- [ ] Wrong one\n- [ ] Wrong two\n- [ ] Wrong three\n> right: Yes.\n> wrong: No.\n\n2.', '- [x] Wrong one\n- [ ] Wrong two\n- [ ] Wrong three\n> right: Yes.\n> wrong: No.\n\n2.')
    expect(() => parseLesson(twoRight, '03-a-fixture')).toThrow(/marks 2 right options/)
    const five = FIXTURE.replace('- [ ] Wrong three\n> right: Yes.\n> wrong: No.\n\n2.', '- [ ] Wrong three\n- [ ] Wrong four\n> right: Yes.\n> wrong: No.\n\n2.')
    expect(() => parseLesson(five, '03-a-fixture')).toThrow(/has 5 options/)
    const noWhy = FIXTURE.replace('> wrong: No.\n\n2.', '\n2.')
    expect(() => parseLesson(noWhy, '03-a-fixture')).toThrow(/no "> wrong:" line/)
    const stray = FIXTURE.replace('> wrong: No.\n\n2.', '> wrong: No.\nA stray line.\n\n2.')
    expect(() => parseLesson(stray, '03-a-fixture')).toThrow(/question 1 holds a line/)
  })

  it('refuses a missing section, a wrong section order, three questions and a bad filename', () => {
    expect(() => parseLesson(FIXTURE.replace('## Traps\n- A trap.\n\n', ''), '03-a-fixture')).toThrow(/sections must be exactly/)
    expect(() => parseLesson(FIXTURE.replace('## Must know', '## Numbers').replace('## Numbers\n- **5', '## Must know\n- **5'), '03-a-fixture')).toThrow(/sections must be exactly/)
    expect(() => parseLesson(FIXTURE.replace(/\n4\. Fourth question\?[\s\S]*$/, '\n'), '03-a-fixture')).toThrow(/exactly 4 questions/)
    expect(() => parseLesson(FIXTURE, 'a-fixture')).toThrow(/named NN-<slug>\.md/)
  })

  it('a figure line (punch list #116) parses when the app draws it, fails the lesson when it does not, and the plain-words rules read its caption', () => {
    const withFigure = FIXTURE.replace('- First fact.\n', '- First fact.\n- {{figure:controls-ladder|Start at the top. Each step down leans more on people doing the right thing.}}\n')
    const lesson = parseLesson(withFigure, '01-a')
    expect(lesson.mustKnow).toHaveLength(5)
    expect(lessonPlainWordsFailures(lesson)).toEqual([])
    const tooLong = FIXTURE.replace('- First fact.\n', '- First fact.\n- {{figure:controls-ladder|' + 'word '.repeat(22).trim() + '.}}\n')
    expect(lessonPlainWordsFailures(parseLesson(tooLong, '01-a')).join(' ')).toMatch(/must know 2/)
    expect(() => parseLesson(FIXTURE.replace('- First fact.\n', '- First fact.\n- {{figure:no-such-drawing|Words.}}\n'), '01-a')).toThrow(/figure "no-such-drawing" is not drawn/)
  })

  it('a Numbers item is **value** label', () => {
    expect(() => parseLesson(FIXTURE.replace('- **5 ft** a system', '- 5 ft a system'), '03-a-fixture')).toThrow(/not "\*\*value\*\* label"/)
  })
})

describe('plain words over a lesson', () => {
  it('names the item that runs long or is glued', () => {
    const l = parseLesson(FIXTURE, '03-a-fixture')
    const long = { ...l, mustKnow: ['one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty twentyone.'] }
    expect(lessonPlainWordsFailures(long)[0]).toMatch(/^03-a-fixture must know 1: 21 words/)
    const glued = { ...l, questions: l.questions.map((q, i) => (i === 0 ? { ...q, ask: 'Which (of these) is right?' } : q)) }
    expect(lessonPlainWordsFailures(glued)[0]).toMatch(/^03-a-fixture question 1: glued/)
    const numberGlue = { ...l, numbers: [{ value: '5 ft', label: 'a system · a box' }] }
    expect(lessonPlainWordsFailures(numberGlue)[0]).toMatch(/number 1: glued label/)
    expect(lessonPlainWordsFailures(l)).toEqual([])
  })
})

describe('no lesson instructs (punch list #120, the owner\'s call 6)', () => {
  it('an item that begins with a doing verb fails unless it names who does it; a word that only starts the same passes', () => {
    const l = parseLesson(FIXTURE, '01-a')
    const bare = instructionFailures({ ...l, mustKnow: ['Replace the element with the breaker off.'], traps: ['Remove the cover and press the button once.'] })
    expect(bare).toHaveLength(2)
    expect(bare[0]).toMatch(/^01-a must know 1 begins with "replace"/)
    expect(bare[1]).toMatch(/^01-a trap 1 begins with "remove the cover"/)
    expect(instructionFailures({ ...l, mustKnow: ['Replace the element only when the electrician says it is dead.'], traps: ['Remove the cover only with the breaker off, which a plumber on the truck may do.'] })).toEqual([])
    expect(instructionFailures({ ...l, mustKnow: ['Replacement parts come from the truck.', 'Landing a wire is the electrician\'s.', '{{figure:controls-ladder|A wire and a pipe never read as one thing.}}'] })).toEqual([])
    expect(instructionFailures({ ...l, mustKnow: ['{{figure:controls-ladder|Wire the box with the breaker off.}}'] })).toHaveLength(1)
  })

  it('holds every lesson of the courses listed, and the list names a course on disk', () => {
    expect(NO_INSTRUCTION_COURSES).toEqual(['intro-electrical'])
    expect(courseFolders()).toContain('intro-electrical')
    for (const f of lessonFiles().filter((x) => NO_INSTRUCTION_COURSES.includes(x.slug))) {
      const failures = instructionFailures(parseLesson(f.source, f.key))
      expect(failures, `lesson "${f.key}" reads as an instruction to do electrical work:\n  - ${failures.join('\n  - ')}`).toEqual([])
    }
  })
})

describe('the final check', () => {
  const makeCourse = (): Course => {
    const l = parseLesson(FIXTURE, '01-a')
    const lessons = [1, 2, 3].map((n) => ({ ...parseLesson(FIXTURE, `0${n}-a`), part: n - 1, questions: parseLesson(FIXTURE, `0${n}-a`).questions.map((q) => ({ ...q, part: n - 1 })) }))
    const bankSource = Array.from({ length: 20 }, (_, i) => `${i + 1}. Bank question ${i + 1}?\n- [x] Right\n- [ ] A\n- [ ] B\n- [ ] C\n> right: Yes.\n> wrong: No.`).join('\n\n')
    const finalBank = parseQuestions(bankSource.split('\n'), 'bank', 'final-bank', -1)
    return { slug: 's', title: 't', summary: 's', line: 'l', finalDraw: 8, finalPass: 6, parts: [{ n: 0, name: 'a' }, { n: 1, name: 'b' }, { n: 2, name: 'c' }], lessons, finalBank, contentVersion: contentVersionOf([l.title]), minutes: 30, minutesStated: null }
  }

  it('draws one part at a time so every part is asked, shuffles options, and replays the same seed', () => {
    const course = makeCourse()
    const drawn = drawFinalCheck(course, 7)
    expect(drawn).toHaveLength(8)
    const parts = new Set(drawn.map((q) => q.part))
    expect([...parts].sort()).toEqual([-1, 0, 1, 2])
    expect(drawn.map((q) => q.id)).toEqual(drawFinalCheck(course, 7).map((q) => q.id))
    expect(drawn.map((q) => q.id)).not.toEqual(drawFinalCheck(course, 8).map((q) => q.id))
    for (const q of drawn) expect(q.options.filter((o) => o.right)).toHaveLength(1)
  })

  it('skips an ask the draw already holds, so a bank question that repeats a lesson\'s never comes up twice (v2.5576)', () => {
    // The fixture's three lessons share one source, so first give each lesson its own asks; then every bank question repeats lesson 1's first.
    const base = makeCourse()
    const lessons = base.lessons.map((l, li) => ({ ...l, questions: l.questions.map((q) => ({ ...q, ask: `${q.ask} (${li})` })) }))
    const twin = lessons[0]!.questions[0]!
    const finalBank = base.finalBank.map((q) => ({ ...q, ask: twin.ask.toUpperCase() + ' ' }))
    const course: Course = { ...base, lessons, finalBank }
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const drawn = drawFinalCheck(course, seed)
      expect(drawn).toHaveLength(8)
      expect(new Set(drawn.map((q) => askKey(q.ask))).size).toBe(8)
    }
    expect(askKey("What is it's name?  ")).toBe('what is its name')
  })

  it('grades picks by the drawn order and passes at final_pass', () => {
    const course = makeCourse()
    const drawn = drawFinalCheck(course, 1)
    const allRight: Record<string, number> = {}
    for (const q of drawn) allRight[q.id] = q.options.findIndex((o) => o.right)
    expect(gradeFinalCheck(drawn, allRight, 6)).toEqual({ right: 8, total: 8, passed: true, missed: [] })
    const picks = { ...allRight }
    for (const q of drawn.slice(0, 3)) picks[q.id] = ((allRight[q.id] ?? 0) + 1) % 4
    const r = gradeFinalCheck(drawn, picks, 6)
    expect(r.right).toBe(5)
    expect(r.passed).toBe(false)
    expect(r.missed).toEqual(drawn.slice(0, 3).map((q) => q.id))
    expect(gradeFinalCheck(drawn, {}, 6).right).toBe(0)
  })

  it('shuffleOptions keeps the one right option and seededRandom is stable', () => {
    const q = parseLesson(FIXTURE, '01-a').questions[0]!
    const s = shuffleOptions(q, 3)
    expect(s.options.filter((o) => o.right)).toHaveLength(1)
    expect(s.options.map((o) => o.text).sort()).toEqual(q.options.map((o) => o.text).sort())
    const a = seededRandom(5)
    const b = seededRandom(5)
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
  })

  it('courseProgress counts the lessons passed and the final check as the last step', () => {
    const course = makeCourse()
    expect(courseProgress(course, new Set(['01-a']), false)).toMatchObject({ done: 1, of: 4, lessonsDone: 1, lessons: 3, finalPassed: false, allLessonsDone: false })
    expect(courseProgress(course, new Set(['01-a']), false).nextLesson?.key).toBe('02-a')
    expect(courseProgress(course, new Set(['01-a', '02-a', '03-a']), true)).toMatchObject({ done: 4, of: 4, allLessonsDone: true, nextLesson: null })
  })

  it('contentVersionOf changes with one word and is eight hex characters', () => {
    const a = contentVersionOf(['one', 'two'])
    expect(a).toMatch(/^[0-9a-f]{8}$/)
    expect(contentVersionOf(['one', 'twp'])).not.toBe(a)
    expect(contentVersionOf(['one', 'two'])).toBe(a)
  })
})

describe('the real content under src/content/training', () => {
  const files = lessonFiles()

  it('has the OSHA 30 refresher', () => {
    expect(courseFolders()).toContain('osha-30-refresher')
    expect(files.map((f) => f.key)).toContain('19-trenches-soil-and-protection')
  })

  it.each(files.map((f) => [f.key, f] as const))('%s — the lesson shape', (_key, f) => {
    expect(() => parseLesson(f.source, f.key)).not.toThrow()
  })

  it.each(files.map((f) => [f.key, f] as const))('%s — plain words, nothing exempt', (_key, f) => {
    const failures = lessonPlainWordsFailures(parseLesson(f.source, f.key))
    expect(failures, `lesson "${f.key}" fails the plain-words rules (src/lib/plainWords.ts):\n  - ${failures.join('\n  - ')}`).toEqual([])
  })

  it.each(files.map((f) => [f.key, f] as const))('%s — no question stands on an Appendix B quirk', (_key, f) => {
    expect(appendixBFailures(parseLesson(f.source, f.key).questions)).toEqual([])
  })

  it('every course builds whole: course.md, lessons 01…N with no gap, a final bank of twenty or more, every part named', () => {
    const courses = buildCourseRegistry(loadContent())
    expect(courses.map((c) => c.slug)).toContain('osha-30-refresher')
    for (const c of courses) {
      expect(c.lessons.length).toBeGreaterThanOrEqual(10)
      expect(c.finalBank.length).toBeGreaterThanOrEqual(20)
      expect(appendixBFailures(c.finalBank)).toEqual([])
      const partsUsed = new Set(c.lessons.map((l) => l.part))
      for (const p of c.parts) expect(partsUsed.has(p.n), `course "${c.slug}" part ${p.n} "${p.name}" has no lesson`).toBe(true)
      expect(c.contentVersion).toMatch(/^[0-9a-f]{8}$/)
      expect(c.minutes).toBeGreaterThan(60)
      expect(c.minutesStated, `course "${c.slug}": course.md says minutes: ${c.minutesStated} but the lessons and the final check add up to ${c.minutes}`).toBe(c.minutes)
      // v2.5589: the Dashboard's facts come from course.md alone (no lesson file is globbed there), so hold them to the lessons on disk.
      const facts = TRAINING_COURSE_FACTS[c.slug]
      expect(facts?.lessons, `course "${c.slug}": course.md says lessons: ${facts?.lessons} but ${c.lessons.length} lesson files are on disk`).toBe(c.lessons.length)
      expect(facts?.minutes).toBe(c.minutes)
    }
  })

  it('no ask appears twice across a course: the lessons and the bank ask each question once (v2.5576)', () => {
    for (const c of buildCourseRegistry(loadContent())) {
      const where = new Map<string, string[]>()
      for (const q of [...c.lessons.flatMap((l) => l.questions), ...c.finalBank]) where.set(askKey(q.ask), [...(where.get(askKey(q.ask)) ?? []), q.id])
      const twice = [...where.entries()].filter(([, ids]) => ids.length > 1).map(([key, ids]) => `${ids.join(' and ')} both ask "${key}"`)
      expect(twice, `course "${c.slug}" asks a question twice:\n  - ${twice.join('\n  - ')}`).toEqual([])
    }
  })

  it('every drawn figure is named by a lesson, and every named figure is drawn (punch list #116)', () => {
    const named = new Set<string>()
    for (const c of buildCourseRegistry(loadContent())) for (const l of c.lessons) for (const item of [...l.mustKnow, ...l.traps]) {
      const f = parseFigureItem(item, l.key)
      if (f) named.add(f.figure)
    }
    expect([...named].sort(), 'a drawing no lesson names is dead weight in the chunk; a lesson naming an undrawn figure fails parseLesson').toEqual([...FIGURE_NAMES])
  })

  it('the Appendix B list is lower case substrings', () => {
    for (const b of APPENDIX_B_BANNED_ASKS) expect(b).toBe(b.toLowerCase())
  })
})

describe('a trade word is taught before it is tested (punch list #119, the fourteen-year-old\'s read)', () => {
  const courses = buildCourseRegistry(loadContent())

  it('finds the first place a term is met, reading the lessons in order and the bank last', () => {
    const plumbing = courses.find((c) => c.slug === 'intro-to-plumbing')!
    const stack = tradeTermFirstUse(plumbing, 'stack')!
    expect(stack.lesson?.order).toBe(14)
    expect(stack.place).toBe('must know')
    expect(tradeTermFirstUse(plumbing, 'no such word')).toBeNull()
    // A term met first as a quiz option, a Numbers label, a Traps item or a figure caption fails; the same words in Must know pass.
    const first = plumbing.lessons[0]!
    const questions = first.questions.map((q) => ({ ...q, ask: 'Which?', options: q.options.map((o) => ({ ...o, text: 'A thing' })), rightWhy: 'Yes.', wrongWhy: 'No.' }))
    const lesson: CourseLesson = { ...first, mustKnow: ['One fact.', 'Two.', 'Three.', 'Four.'], traps: ['A trap.'], why: ['A why.'], numbers: [{ value: '2', label: 'systems' }], questions }
    const asOption = { ...lesson, questions: lesson.questions.map((q, i) => (i === 0 ? { ...q, options: [{ text: 'A cleanout', right: false }, ...q.options.slice(1)] } : q)) }
    const asCaption = { ...lesson, mustKnow: ['{{figure:two-systems|A cleanout where the drain leaves.}}', ...lesson.mustKnow] }
    const asTrap = { ...lesson, traps: ['The cleanout is the first door.'] }
    const asFact = { ...lesson, mustKnow: ['A cleanout is a capped opening a plumber opens to run a cable in.', ...lesson.mustKnow] }
    const only = (l: CourseLesson): Course => ({ ...plumbing, lessons: [l], finalBank: [] })
    expect(tradeTermFailures(only(asOption))).toEqual([expect.stringMatching(/^"cleanout" is first met in lesson 1 "01-[a-z-]+" check yourself option/)])
    expect(tradeTermFailures(only(asCaption))[0]).toMatch(/figure caption/)
    expect(tradeTermFailures(only(asTrap))[0]).toMatch(/ traps,/)
    expect(tradeTermFailures(only(asFact))).toEqual([])
  })

  it('the list is lower case apart from an acronym, and the teaching places are the two sentence sections', () => {
    for (const t of [...TRADE_TERMS, ...Object.values(COURSE_TRADE_TERMS).flat()]) expect(t === t.toUpperCase() || t === t.toLowerCase(), `"${t}" is neither an acronym nor lower case`).toBe(true)
    expect(TRADE_TERM_TEACHING_PLACES).toEqual(['why it matters', 'must know'])
  })

  it('a course\'s own words hold that course and no other, and every course list names a course on disk', () => {
    for (const slug of Object.keys(COURSE_TRADE_TERMS)) expect(courses.map((c) => c.slug)).toContain(slug)
    expect(tradeTermsFor({ slug: 'osha-30-refresher' })).toEqual(expect.arrayContaining(['competent person', 'GFCI', ...TRADE_TERMS]))
    expect(tradeTermsFor({ slug: 'intro-electrical' })).toEqual(TRADE_TERMS)
    for (const list of Object.values(COURSE_TRADE_TERMS)) expect(new Set(list).size, 'a course list names a word twice').toBe(list.length)
  })

  it.each(courses.map((c) => [c.slug, c] as const))('%s — every trade word is first met in a Must know or Why it matters sentence', (_slug, c) => {
    const failures = tradeTermFailures(c)
    expect(failures, `course "${c.slug}" tests a word before it teaches it (src/lib/training/tradeTerms.ts):\n  - ${failures.join('\n  - ')}`).toEqual([])
  })
})

describe('a question is taught before it is asked (punch list #111, so a moved sentence cannot strand a question)', () => {
  const courses = buildCourseRegistry(loadContent())

  it('compares subject words, not glue or the course\'s everyday words, and a short word matches the longer one it begins', () => {
    expect(questionWords('The worker\'s employer inspects **the** trench daily.')).toEqual(['inspects', 'trench', 'daily'])
    expect(sharedWords(['Inspect the ladders'], ['A ladder is inspected each shift.'])).toEqual(['inspect', 'ladders'])
    expect(sharedWords(['Who is on the site?'], ['Safety on the site is the employer\'s.'])).toEqual([])
  })

  it('fails a lesson question whose teaching sentences are gone, and a bank question no lesson teaches', () => {
    const osha = courses.find((c) => c.slug === 'osha-30-refresher')!
    const trench = osha.lessons.find((l) => l.key.startsWith('19-'))!
    const stranded: CourseLesson = { ...trench, why: ['A why.'], mustKnow: ['One fact.', 'Two.', 'Three.', 'Four.'] }
    const one = (l: CourseLesson, bank = osha.finalBank.slice(0, 0)): Course => ({ ...osha, lessons: [l], finalBank: bank })
    expect(questionTaughtFailures(one(trench))).toEqual([])
    expect(questionTaughtFailures(one(stranded))).toHaveLength(4)
    const bankQ = { ...osha.finalBank[0]!, ask: 'Which pictogram is the flame over a circle?', options: [{ text: 'The oxidizer', right: true }, ...osha.finalBank[0]!.options.filter((o) => !o.right)], rightWhy: 'It feeds a fire.' }
    expect(questionTaughtFailures(one(trench, [bankQ]))[0]).toMatch(/^final-bank#\d+ shares fewer than 2 words/)
  })

  it.each(courses.map((c) => [c.slug, c] as const))('%s — every Check yourself and final-bank question is taught by Why it matters or Must know words', (_slug, c) => {
    const failures = questionTaughtFailures(c)
    expect(failures, `course "${c.slug}" asks what no teaching sentence says (src/lib/training/questionTaught.ts):\n  - ${failures.join('\n  - ')}`).toEqual([])
  })
})
