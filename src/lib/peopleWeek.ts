/**
 * Your people's week, the Monday email (punch list #273, PR 5, v2.6603): the app's side of the people_week stream.
 * The payload's shape, the subject and the renders come from `supabase/functions/_shared/peopleWeekEmail.ts`, one
 * source with the dispatcher; here are the subscribe sheet's chains (one weekly chain per weekday, the statement
 * round's own kernel with the people riding along) and the sample Settings → What the team sees draws.
 */
import { groupStatementRoundChains, planStatementRoundChainEdit, type StatementRoundChainGroup } from './statementRoundEmail'
import type { PeopleWeekPayload } from '../../supabase/functions/_shared/peopleWeekEmail'

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
        jobs: [{ hcp_number: '1105', customer_name: 'Madison Park kitchen', pct_complete: 65, sessions: 3, reports: 2 }],
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
