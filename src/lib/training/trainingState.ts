/**
 * Where a person stands on a training course (punch list #111): the ONE kernel behind the
 * colour on the Dashboard card, the People rail, the Users row and the Settings counts. State is
 * read, never stored: a policy row (`training_courses`) and a person's passes (`training_passes`)
 * make the colour, so a dev changing the window recolours everyone at once.
 *
 *   red    the course is on and required for the role, and the person has no pass that counts
 *   amber  the newest pass is older than the window, or within `dueSoonDays` of it
 *   green  the newest pass is inside the window
 *   null   the course is off, or not required for the role: nothing to show
 *
 * A pass counts only when it is on or after `retakeFrom` (the *Everyone takes it again…* stamp).
 * Days are YYYY-MM-DD in the app's calendar; the caller passes `todayYmdInAppTz()`.
 */
import type { UserRole } from '../../hooks/useAuth'

export type TrainingColour = 'red' | 'amber' | 'green'

export type TrainingPolicy = {
  slug: string
  title: string
  on: boolean
  requiredRoles: readonly UserRole[]
  goodForMonths: number
  dueSoonDays: number
  /** A pass before this day does not count; null until a dev presses Everyone takes it again. */
  retakeFrom: string | null
}

export type TrainingPass = {
  slug: string
  /** YYYY-MM-DD, the app's calendar day the final check was passed. */
  passedOn: string
  contentVersion: string
}

export type CourseStanding = {
  slug: string
  title: string
  colour: TrainingColour
  /** The newest pass that counts, or null. */
  passedOn: string | null
  /** The day the pass runs out, or null when there is no pass. */
  dueOn: string | null
  /** Days from today to `dueOn`: negative once lapsed; null with no pass. */
  daysToDue: number | null
}

export const TRAINING_DUE_SOON_DAYS_DEFAULT = 30
export const TRAINING_GOOD_FOR_MONTHS_DEFAULT = 12

const YMD = /^(\d{4})-(\d{2})-(\d{2})$/

function ymdParts(ymd: string): [number, number, number] {
  const m = YMD.exec(ymd)
  if (!m) throw new Error(`not a YYYY-MM-DD day: ${ymd}`)
  return [Number(m[1]), Number(m[2]), Number(m[3])]
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** Calendar days between two YYYY-MM-DD days, `b - a`, with no time zone in the sum. */
export function ymdDiffDays(a: string, b: string): number {
  const [ay, am, ad] = ymdParts(a)
  const [by, bm, bd] = ymdParts(b)
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000)
}

/** The same day `months` months on; a day the month does not have lands on its last day (Jan 31 + 1 → Feb 28). */
export function ymdAddMonths(ymd: string, months: number): string {
  const [y, m, d] = ymdParts(ymd)
  const total = y * 12 + (m - 1) + months
  const ny = Math.floor(total / 12)
  const nm = (total % 12) + 1
  const last = new Date(Date.UTC(ny, nm, 0)).getUTCDate()
  return `${ny}-${pad(nm)}-${pad(Math.min(d, last))}`
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** `2026-03-03` → `Mar 3, 2026`; with `todayYmd` of the same year → `Mar 3`. */
export function ymdWords(ymd: string, todayYmd?: string): string {
  const [y, m, d] = ymdParts(ymd)
  const sameYear = todayYmd ? ymdParts(todayYmd)[0] === y : false
  return sameYear ? `${MONTHS[m - 1]} ${d}` : `${MONTHS[m - 1]} ${d}, ${y}`
}

export function roleMustTake(policy: Pick<TrainingPolicy, 'on' | 'requiredRoles'>, role: UserRole | null): boolean {
  return policy.on && role != null && policy.requiredRoles.includes(role)
}

/** The newest pass that counts under the policy, or null. */
export function countingPass(policy: Pick<TrainingPolicy, 'slug' | 'retakeFrom'>, passes: readonly TrainingPass[]): TrainingPass | null {
  let best: TrainingPass | null = null
  for (const p of passes) {
    if (p.slug !== policy.slug) continue
    if (policy.retakeFrom && p.passedOn < policy.retakeFrom) continue
    if (!best || p.passedOn > best.passedOn) best = p
  }
  return best
}

/**
 * Where one person stands on one course. Null when the course is off or the role need not take
 * it; a pass someone took on a course their role need not take shows nowhere.
 */
export function courseStanding(policy: TrainingPolicy, passes: readonly TrainingPass[], role: UserRole | null, todayYmd: string): CourseStanding | null {
  if (!roleMustTake(policy, role)) return null
  const pass = countingPass(policy, passes)
  if (!pass) return { slug: policy.slug, title: policy.title, colour: 'red', passedOn: null, dueOn: null, daysToDue: null }
  const dueOn = ymdAddMonths(pass.passedOn, policy.goodForMonths)
  const daysToDue = ymdDiffDays(todayYmd, dueOn)
  const colour: TrainingColour = daysToDue <= policy.dueSoonDays ? 'amber' : 'green'
  return { slug: policy.slug, title: policy.title, colour, passedOn: pass.passedOn, dueOn, daysToDue }
}

/** Every course a person must take, worst first (red, then amber by nearest day, then green). */
export function personStandings(policies: readonly TrainingPolicy[], passes: readonly TrainingPass[], role: UserRole | null, todayYmd: string): CourseStanding[] {
  const rank: Record<TrainingColour, number> = { red: 0, amber: 1, green: 2 }
  return policies
    .map((p) => courseStanding(p, passes, role, todayYmd))
    .filter((s): s is CourseStanding => s != null)
    .sort((a, b) => rank[a.colour] - rank[b.colour] || (a.daysToDue ?? 0) - (b.daysToDue ?? 0) || a.title.localeCompare(b.title))
}

/** The worst colour among standings, or null when there is nothing to show. */
export function worstColour(standings: readonly CourseStanding[]): TrainingColour | null {
  if (standings.some((s) => s.colour === 'red')) return 'red'
  if (standings.some((s) => s.colour === 'amber')) return 'amber'
  return standings.length ? 'green' : null
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}

/** The card's verdict line: "1 course to do", "2 courses to take again", "You are caught up". */
export function trainingVerdict(standings: readonly CourseStanding[]): { colour: TrainingColour; line: string } | null {
  const colour = worstColour(standings)
  if (!colour) return null
  if (colour === 'red') return { colour, line: `${plural(standings.filter((s) => s.colour === 'red').length, 'course', 'courses')} to do` }
  if (colour === 'amber') return { colour, line: `${plural(standings.filter((s) => s.colour === 'amber').length, 'course', 'courses')} to take again` }
  return { colour, line: 'You are caught up' }
}

/**
 * The line under a course's name on the card: when it was done and when it is due, in the day's
 * words. Red with no pass reads from the course itself (the caller adds "Not started" or progress).
 */
export function standingWords(s: CourseStanding, todayYmd: string): string {
  if (!s.passedOn || !s.dueOn || s.daysToDue == null) return ''
  const done = `Done ${ymdWords(s.passedOn, todayYmd)}`
  if (s.daysToDue < 0) {
    const ago = -s.daysToDue
    return `${done} · was due ${ymdWords(s.dueOn, todayYmd)}, ${plural(ago, 'day', 'days')} ago`
  }
  if (s.daysToDue === 0) return `${done} · due again today`
  if (s.colour === 'amber') return `${done} · due again ${ymdWords(s.dueOn, todayYmd)}, in ${plural(s.daysToDue, 'day', 'days')}`
  return `${done} · due again ${ymdWords(s.dueOn, todayYmd)}`
}

/** The press on a course's row. */
export function standingPress(s: CourseStanding, started: boolean): 'Start' | 'Continue' | 'Take it again' | 'Read it again' {
  if (s.colour === 'green') return 'Read it again'
  if (s.colour === 'amber') return 'Take it again'
  return started ? 'Continue' : 'Start'
}

/** The People chip beside the paperwork ones: red "training due", amber "training lapsed" (due soon reads lapsed too, the day in the fold-out). */
export function trainingChip(standings: readonly CourseStanding[]): { tone: 'red' | 'amber'; label: string; long: string } | null {
  const red = standings.filter((s) => s.colour === 'red')
  if (red.length) return { tone: 'red', label: 'training due', long: red.map((s) => `${s.title} not done`).join(' · ') }
  const amber = standings.filter((s) => s.colour === 'amber')
  if (amber.length) {
    return {
      tone: 'amber',
      label: 'training lapsed',
      long: amber.map((s) => (s.daysToDue != null && s.daysToDue < 0 ? `${s.title} lapsed ${ymdWords(s.dueOn!)}` : `${s.title} due ${ymdWords(s.dueOn!)}`)).join(' · '),
    }
  }
  return null
}

/** Settings → Training counts: how many are current, lapsed and not done among the people who must take it. */
export function standingCounts(standings: readonly (CourseStanding | null)[]): { current: number; lapsed: number; notDone: number } {
  let current = 0
  let lapsed = 0
  let notDone = 0
  for (const s of standings) {
    if (!s) continue
    if (s.colour === 'green') current++
    else if (s.colour === 'amber') lapsed++
    else notDone++
  }
  return { current, lapsed, notDone }
}
