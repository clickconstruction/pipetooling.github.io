/**
 * A question is taught before it is asked (punch list #111, the OSHA pass of the fourteen-year-old's read, after
 * #119's trade-word rule): a lesson's Check yourself question shares at least one word with that lesson's Why it
 * matters or Must know sentences, and a final-bank question shares at least two with some lesson's, so a sentence
 * moved out of the teaching places cannot strand the question it taught. The words compared are the ask, the right
 * option and the line under a right pick. Glue words and the course's own everyday words (work, employer, safety,
 * hazard) do not count, and a word matches a longer one it begins (ladder and ladders, inspect and inspecting).
 */
import type { Course, CourseLesson, CourseQuestion } from './courseContent'
import { parseFigureItem } from './figures'

/** Glue words that say nothing about the subject. */
export const QUESTION_GLUE_WORDS: ReadonlySet<string> = new Set(
  `a an the of to in on and or for with is are it its by at from as be your you their them they this that these those not no
   any all every one two more than when where which what who whose how do does did done get go gets if up out into over under
   before after only just also very so can could should would must may will has have had use used uses using was were been being
   there here then than most least some such each other another same own per about against between through during without within
   while both either neither nor but yet still too off down back again once never always ever sometimes whatever whichever`.split(/\s+/),
)

/** Words every lesson of a safety course uses, so sharing one proves nothing. */
export const QUESTION_EVERYDAY_WORDS: ReadonlySet<string> = new Set(
  'work worker workers working employer employers employee employees safe safety hazard hazards osha site job jobsite course'.split(' '),
)

export const LESSON_QUESTION_MIN_SHARED = 1
export const BANK_QUESTION_MIN_SHARED = 2

/** The words of a sentence that carry its subject: lower case, no bold marks, no possessive, glue and everyday words dropped. */
export function questionWords(text: string): string[] {
  const plain = text.replace(/\*\*/g, '').replace(/’/g, "'").toLowerCase().replace(/'s\b/g, '')
  const found = plain.match(/[a-z0-9][a-z0-9.,/%-]*[a-z0-9]|[a-z0-9]/g) ?? []
  return found.filter((w) => !QUESTION_GLUE_WORDS.has(w) && !QUESTION_EVERYDAY_WORDS.has(w) && (w.length >= 3 || /^\d+$/.test(w)))
}

function sameWord(a: string, b: string): boolean {
  if (a === b) return true
  const [short, long] = a.length <= b.length ? [a, b] : [b, a]
  return short.length >= 4 && long.startsWith(short)
}

/** The words of the question texts that some teaching sentence also carries. */
export function sharedWords(questionTexts: readonly string[], teachingTexts: readonly string[]): string[] {
  const teaching = new Set(teachingTexts.flatMap(questionWords))
  const asked = new Set(questionTexts.flatMap(questionWords))
  const out: string[] = []
  for (const q of asked) if ([...teaching].some((t) => sameWord(q, t))) out.push(q)
  return out.sort()
}

/** A lesson's teaching sentences: its Why it matters paragraphs and its Must know facts, figure captions left out. */
export function teachingTexts(lesson: CourseLesson): string[] {
  return [...lesson.why, ...lesson.mustKnow.filter((item) => !parseFigureItem(item, lesson.key))]
}

function askedTexts(q: CourseQuestion): string[] {
  return [q.ask, ...q.options.filter((o) => o.right).map((o) => o.text), q.rightWhy]
}

/** One line per question that no teaching sentence covers; an empty list is a pass. */
export function questionTaughtFailures(course: Course): string[] {
  const out: string[] = []
  const teaching = course.lessons.map((l) => ({ lesson: l, texts: teachingTexts(l) }))
  for (const { lesson, texts } of teaching) {
    for (const q of lesson.questions) {
      const shared = sharedWords(askedTexts(q), texts)
      if (shared.length < LESSON_QUESTION_MIN_SHARED) {
        out.push(`${q.id} shares no word with lesson ${lesson.order}'s Why it matters or Must know sentences: ${q.ask}`)
      }
    }
  }
  for (const q of course.finalBank) {
    const best = Math.max(0, ...teaching.map(({ texts }) => sharedWords(askedTexts(q), texts).length))
    if (best < BANK_QUESTION_MIN_SHARED) {
      out.push(`${q.id} shares fewer than ${BANK_QUESTION_MIN_SHARED} words with any lesson's Why it matters or Must know sentences: ${q.ask}`)
    }
  }
  return out
}
