/**
 * Trade words a course must teach before it tests (punch list #119, the fourteen-year-old's read):
 * a reader meets each of these first in a Must know or Why it matters sentence, never first in a
 * Check yourself option, a Numbers label, a Traps item or a figure caption. The list is the words
 * the Intro to plumbing and Intro to electrical read-throughs found used before their lesson; a course that never uses a
 * word is not held to it. Held for every course under src/content/training, with a course's own
 * words in COURSE_TRADE_TERMS beside them.
 */
import type { Course, CourseLesson } from './courseContent'
import { parseFigureItem } from './figures'

export const TRADE_TERMS: readonly string[] = [
  'check valve',
  'vacuum breaker',
  'backflow',
  'cleanout',
  'hub',
  'stack',
  'lavatory',
  'lav',
  'closet drain',
  'AAV',
  'cross-connection',
  'air gap',
  'trap arm',
  'hose bib',
  'angle stop',
  'wye',
  'sanitary tee',
  'wet vent',
  // Intro to electrical (punch list #120, v2.5622), by the lesson that teaches each. Off the list because another
  // course uses them in a plain sense first: hot, breaker, load, meter, panel, ground, live, GFCI.
  'neutral',
  'circuit',
  'current',
  'fault',
  'service drop',
  'weatherhead',
  'lug',
  'bus bar',
  'subpanel',
  'volt',
  'amp',
  'watt',
  'two-pole',
  'bonding',
  'electrode',
  'ground rod',
  'jumper',
  'branch circuit',
  'directory',
  'tester',
  'gauge',
  'AWG',
  'overload',
  'milliamp',
  'whip',
  'receptacle',
  'line side',
  'switch leg',
  'three-way',
  'AFCI',
  'arc',
  'element',
  'thermostat',
  'high-limit',
  'disconnect',
  'terminal',
  'power-vent',
  'kick plate',
  'air switch',
  'float switch',
  'pressure switch',
  'control box',
  'transformer',
  'low voltage',
  'thermocouple',
  'backfeed',
  'transfer switch',
  'lineman',
  'solar array',
  'non-contact tester',
  'conduit',
  'lockout',
  'tagout',
  'hasp',
  'nail plate',
]

/**
 * A course's own words, held for that course alone (punch list #111): OSHA's words for the OSHA 30 refresher,
 * each met first where it is explained. Another course that uses one of them is not held to it here.
 */
export const COURSE_TRADE_TERMS: Readonly<Record<string, readonly string[]>> = {
  'osha-30-refresher': [
    'competent person',
    'qualified person',
    'protective system',
    'trench',
    'excavation',
    'trench box',
    'benching',
    'spoil',
    'cave-in',
    'egress',
    'confined space',
    'permit-required',
    'PRCS',
    'attendant',
    'entrant',
    'LEL',
    'IDLH',
    'lockout',
    'tagout',
    'LOTO',
    'energized',
    'arc flash',
    'approach boundary',
    'ppe category',
    'NFPA 70E',
    'ESP',
    'GFCI',
    'PPE',
    'scaffold',
    'guardrail',
    'midrail',
    'toeboard',
    'leading edge',
    'parapet',
    'hole cover',
    'PFAS',
    'anchorage',
    'lanyard',
    'free fall',
    'clearance',
    'suspension trauma',
    'swing radius',
    'struck-by',
    'caught-in',
    'ROPS',
    'signal person',
    'flagger',
    'rigging',
    'sling',
    'tag line',
    'rebar',
    'powered industrial truck',
    'hot work',
    'fire watch',
    'kickback',
    'point of operation',
    'powder-actuated',
    'hazard communication',
    'hazcom',
    'SDS',
    'pictogram',
    'PEL',
    'TWA',
    'respirator',
    'dust mask',
    'N95',
    'APF',
    'SCBA',
    'fit test',
    'silica',
    'asbestos',
    'abatement',
    'acclimatization',
    'JHA',
    'SIF',
    'near miss',
    'OSHA 300',
  ],
}

/** The words a course is held to: the shared list, then its own. */
export function tradeTermsFor(course: Pick<Course, 'slug'>): readonly string[] {
  return [...TRADE_TERMS, ...(COURSE_TRADE_TERMS[course.slug] ?? [])]
}

/** Where a term may be met first. */
export const TRADE_TERM_TEACHING_PLACES: readonly string[] = ['why it matters', 'must know']

export type TradeTermFirstUse = { term: string; lesson: CourseLesson | null; place: string; text: string }

function matcher(term: string): RegExp {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(?<![\\w-])${escaped}s?(?![\\w])`, 'i')
}

/** The places of a lesson a reader meets, in reading order, each named by the section it sits in. */
function placesOf(lesson: CourseLesson): Array<{ place: string; text: string }> {
  const out: Array<{ place: string; text: string }> = []
  for (const p of lesson.why) out.push({ place: 'why it matters', text: p })
  for (const item of lesson.mustKnow) {
    const f = parseFigureItem(item, lesson.key)
    out.push(f ? { place: 'figure caption', text: f.caption } : { place: 'must know', text: item })
  }
  for (const item of lesson.traps) {
    const f = parseFigureItem(item, lesson.key)
    out.push(f ? { place: 'figure caption', text: f.caption } : { place: 'traps', text: item })
  }
  for (const n of lesson.numbers) out.push({ place: 'numbers', text: `${n.value} ${n.label}` })
  for (const q of lesson.questions) {
    out.push({ place: 'check yourself ask', text: q.ask })
    for (const o of q.options) out.push({ place: 'check yourself option', text: o.text })
    out.push({ place: 'check yourself why', text: q.rightWhy })
    out.push({ place: 'check yourself why', text: q.wrongWhy })
  }
  return out
}

/** The first place a term appears in a course, reading the lessons in order and the final bank last; null when it never does. */
export function tradeTermFirstUse(course: Course, term: string): TradeTermFirstUse | null {
  const re = matcher(term)
  for (const lesson of course.lessons) {
    for (const { place, text } of placesOf(lesson)) if (re.test(text)) return { term, lesson, place, text }
  }
  for (const q of course.finalBank) {
    for (const text of [q.ask, ...q.options.map((o) => o.text), q.rightWhy, q.wrongWhy]) if (re.test(text)) return { term, lesson: null, place: 'final bank', text }
  }
  return null
}

/** One line per term a course first meets outside a teaching sentence; an empty list is a pass. */
export function tradeTermFailures(course: Course): string[] {
  const out: string[] = []
  for (const term of tradeTermsFor(course)) {
    const first = tradeTermFirstUse(course, term)
    if (!first || TRADE_TERM_TEACHING_PLACES.includes(first.place)) continue
    const where = first.lesson ? `lesson ${first.lesson.order} "${first.lesson.key}" ${first.place}` : first.place
    out.push(`"${term}" is first met in ${where}, not in a Must know or Why it matters sentence: ${first.text}`)
  }
  return out
}
