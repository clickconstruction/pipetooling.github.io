/**
 * Your people's week, the Monday email (punch list #273, PR 5, v2.6603): the app's side of the people_week stream.
 * The payload's shape, the subject and the renders come from `supabase/functions/_shared/peopleWeekEmail.ts`, one
 * source with the dispatcher; here are the subscribe sheet's chains (one weekly chain per weekday, the statement
 * round's own kernel with the people riding along) and the sample Settings → What the team sees draws.
 */
import { groupStatementRoundChains, planStatementRoundChainEdit, type StatementRoundChainGroup } from './statementRoundEmail'
import { cardLine, jobLine, peopleWeekSubject, personLine, roadmapLine, type PeopleWeekPayload, type PeopleWeekPerson } from '../../supabase/functions/_shared/peopleWeekEmail'

export {
  cardLine,
  jobLine,
  peopleWeekHeadline,
  peopleWeekSubject,
  personLine,
  renderPeopleWeekHtml,
  renderPeopleWeekText,
  roadmapLine,
  stuckLine,
  weekWords,
  type PeopleWeekCard,
  type PeopleWeekJob,
  type PeopleWeekPayload,
  type PeopleWeekPerson,
  type PeopleWeekRoadmap,
  type PeopleWeekStuck,
} from '../../supabase/functions/_shared/peopleWeekEmail'

export const PEOPLE_WEEK_STREAM = 'people_week' as const
export const PEOPLE_WEEK_DEFAULT_WEEKDAY = 1
export const PEOPLE_WEEK_DEFAULT_TIME = '06:00'
export const PEOPLE_WEEK_PEOPLE_MAX = 50

export type PeopleWeekRequestRow = {
  id: string
  requested_by: string
  recipient_user_id: string
  people_user_ids: string[]
  send_at: string
  repeat_weekly: boolean
  sent_at: string | null
}

export type PeopleWeekChain = StatementRoundChainGroup & { peopleUserIds: string[] }

/** The person's pending weekly chains, with the people the newest row carries. */
export function peopleWeekChains(rows: readonly PeopleWeekRequestRow[]): PeopleWeekChain[] {
  const pending = rows.filter((r) => !r.sent_at && r.repeat_weekly)
  return groupStatementRoundChains(pending).map((g) => {
    const mine = pending.filter((r) => g.allRowIds.includes(r.id)).sort((a, b) => b.send_at.localeCompare(a.send_at))
    return { ...g, peopleUserIds: mine[0]?.people_user_ids ?? [] }
  })
}

export type PeopleWeekInsert = {
  requested_by: string
  recipient_user_id: string
  people_user_ids: string[]
  send_at: string
  repeat_weekly: true
}

export type PeopleWeekEditPlan = { ok: true; inserts: PeopleWeekInsert[]; cancelIds: string[] } | { ok: false; error: string }

/**
 * A subscription edit as rows to add and rows to stop. A change of people re-creates every chain (the people ride on
 * the row); a change of time does too (the chain's instant is its time); a pure weekday change touches only the
 * added and removed days. No weekdays stops them all.
 */
export function planPeopleWeekEdit(
  input: { userId: string; peopleUserIds: string[]; desiredWeekdays: number[]; desiredTimeHm: string; current: PeopleWeekChain | null },
  now: Date = new Date(),
): PeopleWeekEditPlan {
  const people = Array.from(new Set(input.peopleUserIds.filter(Boolean))).slice(0, PEOPLE_WEEK_PEOPLE_MAX)
  if (people.length === 0 && input.desiredWeekdays.length > 0) return { ok: false, error: 'Pick at least one person.' }
  const peopleChanged = input.current != null && !sameSet(input.current.peopleUserIds, people)
  const current = peopleChanged ? { ...input.current!, timeHm: '__changed__' } : input.current
  const plan = planStatementRoundChainEdit({ requestedBy: input.userId, recipientUserId: input.userId, desiredWeekdays: input.desiredWeekdays, desiredTimeHm: input.desiredTimeHm, current }, now)
  if (!plan.ok) return plan
  return { ok: true, inserts: plan.inserts.map((i) => ({ ...i, people_user_ids: people })), cancelIds: plan.cancelIds }
}

function sameSet(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false
  const s = new Set(a)
  return b.every((x) => s.has(x))
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/** *Mateo, Darren and Rosa · Monday 6:00 AM · every week*, the row on Settings and the sheet's standing line. */
export function peopleWeekChainWords(chain: PeopleWeekChain, nameOf: (id: string) => string): string {
  const names = chain.peopleUserIds.map(nameOf).filter(Boolean)
  const who = names.length === 0 ? 'nobody yet' : names.length <= 3 ? joinNames(names) : `${names.slice(0, 2).join(', ')} and ${names.length - 2} more`
  const days = chain.weekdays.map((d) => WEEKDAYS[d] ?? '').filter(Boolean).join(', ')
  return `${who} · ${days} ${timeWords(chain.timeHm)} · every week`
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? ''
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

/** *6:00 AM* from *06:00*. */
export function timeWords(hm: string): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hm)
  if (!m) return hm
  const h = Number(m[1])
  const suffix = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${m[2]} ${suffix}`
}

const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/**
 * *Email me every Monday at 6:00 AM*: the sheet's first press, said whole, so the press itself says it is an email,
 * that it comes every week, and on which day and at what time (v2.8041). Two days read short, three or more as a count.
 */
export function peopleWeekStartWords(weekdays: readonly number[], timeHm: string): string {
  const days = Array.from(new Set(weekdays.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))).sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
  const at = /^\d{1,2}:\d{2}$/.test(timeHm) ? ` at ${timeWords(timeHm)}` : ''
  if (days.length === 0) return 'Pick a day'
  if (days.length === 7) return `Email me every day${at}`
  if (days.length === 1) return `Email me every ${WEEKDAYS[days[0]!]}${at}`
  if (days.length === 2) return `Email me every ${SHORT_DAYS[days[0]!]} and ${SHORT_DAYS[days[1]!]}${at}`
  return `Email me ${days.length} days a week${at}`
}

/** The label over the people: the cap is said only once it is reached. */
export function peopleWeekAboutWords(pickedCount: number, max: number = PEOPLE_WEEK_PEOPLE_MAX): string {
  return pickedCount >= max ? `About these people, ${max} at most` : 'About these people'
}

/** The words of the sheet's small presses and labels, one home so the guide and the tests name the same controls. */
export const PEOPLE_WEEK_SHEET_WORDS = {
  sample: 'Sample',
  seeYours: 'See yours now',
  backToSample: 'Back to the sample',
  test: 'Email me a test',
  every: 'Every',
  at: 'At',
  zone: 'Central',
  ownWeek: 'About your own week.',
} as const

/** A list of more people than this folds the ones not picked behind **＋ N more**. */
export const PEOPLE_WEEK_FOLD_OVER = 10

/**
 * The people chips in the order the sheet draws them: the ones picked when the sheet opened first, so nobody hunts a
 * wall of names for who is in it, then everyone else by name. On a long list everyone else waits behind **＋ N more**
 * until it is pressed. The order holds while the sheet is open, so a chip never moves from under a finger. A find
 * reads the whole list.
 */
export function peopleWeekPickList<T extends { id: string; name: string }>(input: { people: readonly T[]; lead: readonly string[]; filter: string; unfolded: boolean }): { shown: T[]; more: number; findBox: boolean } {
  const lead = new Set(input.lead)
  const first = input.people.filter((p) => lead.has(p.id))
  const rest = input.people.filter((p) => !lead.has(p.id))
  const long = input.people.length > PEOPLE_WEEK_FOLD_OVER
  const q = input.filter.trim().toLowerCase()
  if (q) return { shown: [...first, ...rest].filter((p) => p.name.toLowerCase().includes(q)), more: 0, findBox: long }
  if (long && first.length > 0 && rest.length > 0 && !input.unfolded) return { shown: first, more: rest.length, findBox: false }
  return { shown: [...first, ...rest], more: 0, findBox: long }
}

export type PeopleWeekGlance = { subject: string; name: string; line: string; groups: { label: string; line: string }[] }

/** The one made-up person on the sheet's picture: every kind of line the email writes, once. */
export function glancePerson(): PeopleWeekPerson {
  return {
    user_id: 'sample-mateo',
    name: 'Mateo',
    open: 1,
    done: 2,
    moved: 1,
    photos: 4,
    cards: [{ title: 'Hang the shelves', from_percent: 25, to_percent: 75, done: false, lines_ticked: 2, lines_total: 3, photos: 0, last_words: null }],
    roadmap: [{ task_title: 'Hang the shelves', stage_title: 'Containers', roadmap_title: 'Farm 1', percent: 75, done: false }],
    jobs: [{ hcp_number: '1105', customer_name: 'Morris Park', pct_complete: 65, sessions: 3, reports: 0 }],
    stuck: [],
  }
}

/**
 * The sheet's picture of the email, in place of a paragraph that described it (v2.8041): the subject for the week
 * just finished and one made-up person, every line written by the email's own kernel, so the picture cannot say
 * something the email does not. The labels are the email's own group names.
 */
export function peopleWeekGlance(todayYmd: string): PeopleWeekGlance {
  const { week_start, week_end } = samplePeopleWeekPayload(todayYmd)
  const x = glancePerson()
  return {
    subject: peopleWeekSubject({ week_start, week_end, people: [x] }),
    name: x.name,
    line: personLine(x),
    groups: [
      { label: 'Cards', line: x.cards.map(cardLine).join(' ') },
      { label: 'Roadmap', line: x.roadmap.map(roadmapLine).join(' ') },
      { label: 'Jobs', line: x.jobs.map(jobLine).join(' ') },
    ],
  }
}

/** The sample Settings → What the team sees draws: three people, one week, every group once. */
export function samplePeopleWeekPayload(todayYmd: string): PeopleWeekPayload {
  const t = Date.parse(`${todayYmd}T00:00:00Z`)
  const d = new Date(Number.isFinite(t) ? t : Date.now())
  const dow = d.getUTCDay()
  const monday = new Date(d.getTime() - ((dow + 6) % 7) * 86_400_000 - 7 * 86_400_000)
  const ws = monday.toISOString().slice(0, 10)
  const we = new Date(monday.getTime() + 6 * 86_400_000).toISOString().slice(0, 10)
  return {
    week_start: ws,
    week_end: we,
    people: [
      {
        user_id: 'sample-mateo',
        name: 'Mateo',
        open: 2,
        done: 2,
        moved: 1,
        photos: 4,
        cards: [
          { title: 'Put the plumbing tools in a neat home', from_percent: 0, to_percent: 100, done: true, lines_ticked: 3, lines_total: 3, photos: 3, last_words: null },
          { title: 'Check the AAA policy', from_percent: 0, to_percent: 100, done: true, lines_ticked: 0, lines_total: 0, photos: 0, last_words: null },
          { title: 'Clear the back half of the floor', from_percent: 25, to_percent: 75, done: false, lines_ticked: 0, lines_total: 0, photos: 1, last_words: 'puddy and the glue, Thursday' },
        ],
        roadmap: [{ task_title: 'Clear the back half of the floor', stage_title: 'Workout Facility Floors', roadmap_title: 'Farm 1', percent: 75, done: false }],
        jobs: [{ hcp_number: '1105', customer_name: 'Morris Park kitchen', pct_complete: 65, sessions: 3, reports: 2 }],
        stuck: [],
      },
      {
        user_id: 'sample-darren',
        name: 'Darren',
        open: 1,
        done: 0,
        moved: 1,
        photos: 1,
        cards: [{ title: 'Weld up the second set of shelves', from_percent: 0, to_percent: 50, done: false, lines_ticked: 1, lines_total: 2, photos: 1, last_words: 'uprights done' }],
        roadmap: [{ task_title: 'Weld up the second set of shelves', stage_title: 'Shelve the containers', roadmap_title: 'Farm 1', percent: 50, done: false }],
        jobs: [],
        stuck: [],
      },
      {
        user_id: 'sample-rosa',
        name: 'Rosa',
        open: 3,
        done: 0,
        moved: 0,
        photos: 0,
        cards: [],
        roadmap: [],
        jobs: [],
        stuck: [{ title: 'One marker every mile', age_days: 32 }],
      },
    ],
  }
}
