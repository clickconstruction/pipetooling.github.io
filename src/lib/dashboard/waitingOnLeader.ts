import type { NeedsYouItem } from '../dashboardNeedsYou'
import { formatYmdMonthDay } from '../jobs/billedExpectedPay'
import { lienReminderPlan, type LienReminderPlan } from '../jobs/lienLeaderReminder'
import { lienDeskHref } from '../lien/lienDeskRoute'
import { isAssistantLike } from '../subcontractorLikeRole'

/**
 * The office's side of the short Dashboard (punch list #365, PR 2): one card on an assistant's Dashboard that
 * lists what waits on the leader alone, the same lines his own short page lists (`SHORT_DASHBOARD_ALONE_KEYS`).
 * The office could already see the lien papers on the Lien desk. Nothing showed it the waivers, the line budgets
 * or the tagged notes, so nobody chased them.
 *
 * Pure: what the desk and three small reads hold in, the card's rows and every word out. A lien row carries the
 * plan its Remind press sends (`lienLeaderReminder.ts`, the desk's own press). The other three have no message
 * to send yet, and the card says so instead of offering a press that reaches nobody.
 */

/** Who the card is drawn for: the office that is not the leader. The leader and a dev have the lines as their own. */
export function canSeeWaitingOnLeader(role: string | null | undefined): boolean {
  return isAssistantLike(role)
}

export type WaitingOnLeaderRowKey = 'approve' | 'sign' | 'waivers' | 'line-budgets' | 'tagged-notes'

/**
 * The leader's own line each row stands for. `waitingOnLeader.test.ts` holds this to the short page's list both
 * ways, so a line added to his page is a row the office is owed.
 */
export const WAITING_ON_LEADER_MIRRORS: Record<WaitingOnLeaderRowKey, ReadonlyArray<NeedsYouItem['key']>> = {
  approve: ['lien-notice-approve', 'lien-notice-batch'],
  sign: ['lien-notice-sign'],
  waivers: ['lien-waivers-to-sign'],
  'line-budgets': ['line-budgets-review'],
  'tagged-notes': ['tagged-notes'],
}

/** A lien notice that waits on the leader, as the desk holds it. */
export type WaitingOnLeaderPaper = {
  /** The paper's desk item; null when the desk has none to point at. */
  itemId: string | null
  /** The job as a row names it: its number and its name. */
  label: string
  /** The notice's last day. */
  dueYmd: string | null
  /** The day it was sent for approval. */
  askedYmd: string | null
  /** The GC whose run the office prepared it in; null outside a run. */
  runGc: string | null
}

/** A waiver or a tagged note that waits on a leader: its job, and the day he was asked. */
export type WaitingOnLeaderAsk = { jobId: string; askedYmd: string | null }

export type WaitingOnLeaderInput = {
  /** The leaders' accounts. The card names the leader when there is one, and says *the leader* otherwise. */
  leaders: ReadonlyArray<{ id: string; name: string | null }>
  /** The Lien desk's two piles; null while the desk is not read. */
  lien: { approve: ReadonlyArray<WaitingOnLeaderPaper>; sign: ReadonlyArray<WaitingOnLeaderPaper> } | null
  /** Lien waivers that wait for a leader's signature; null while not read. */
  waivers: ReadonlyArray<WaitingOnLeaderAsk> | null
  /** The week's assumed lines nobody has reviewed; null while not read. */
  lineBudgets: { lines: number; projects: number } | null
  /** Job notes that tagged a leader and still wait; null while not read. */
  tags: ReadonlyArray<WaitingOnLeaderAsk> | null
  /** Today in the app's time zone. With it, a window that has passed reads *closed*, never *closes*. */
  todayYmd?: string | null
}

export type WaitingOnLeaderRow = {
  key: WaitingOnLeaderRowKey
  title: string
  detail: string
  /** What the row's Remind press sends; null when no message exists for this kind of line. */
  remind: LienReminderPlan | null
  /** Where the office can look at it or act on it; null when there is no screen of the office's for it. */
  open: { label: string; href: string } | null
}

export type WaitingOnLeaderCard = {
  /** The leader's name as the reminder's words take it; null for *the leader*. */
  leaderName: string | null
  /** *Waiting on Marcus*. */
  title: string
  /** How many things wait: papers, lines and notes, the number on the card's head. */
  count: number
  rows: WaitingOnLeaderRow[]
  /** He is beside you: the Lien desk's Ready pile, where a notice takes his signing code. Null with nothing to sign. */
  code: { label: string; href: string } | null
}

const first = (name: string | null | undefined): string => {
  const f = (name ?? '').trim().split(/\s+/)[0] ?? ''
  return f ? `${f[0]!.toUpperCase()}${f.slice(1)}` : ''
}

const n = (count: number, one: string, many: string): string => `${count} ${count === 1 ? one : many}`

const earliest = (days: ReadonlyArray<string | null>): string | null => days.filter((d): d is string => Boolean(d)).sort()[0] ?? null

const asked = (days: ReadonlyArray<string | null>): string => {
  const day = earliest(days)
  return day ? `Asked ${formatYmdMonthDay(day)}.` : ''
}

/** The earliest window's sentence: *closed* once its day has passed, *closes today* on the day, *closes* before it. */
const windowWords = (due: string | null, todayYmd: string | null | undefined): string => {
  if (!due) return ''
  if (todayYmd && due < todayYmd) return `First window closed ${formatYmdMonthDay(due)}.`
  if (todayYmd && due === todayYmd) return 'First window closes today.'
  return `First window closes ${formatYmdMonthDay(due)}.`
}

const jobHref = (jobId: string): string => `/jobs?edit=${encodeURIComponent(jobId)}`

export const WAITING_ON_LEADER_WORDS = {
  title: (who: string): string => `Waiting on ${who || 'the leader'}`,
  remind: 'Remind',
  /** Under a row with no Remind: the truth about why. */
  noReminder: (who: string): string => `No reminder goes for this yet. Tell ${who || 'the leader'} yourself.`,
  /** A read that failed: the row is left out, and the card says which. */
  notRead: (what: string): string => `${what} could not be read, so this list may be short.`,
  code: (who: string): string => `${who || 'The leader'} is here, sign with the signing code`,
} as const

/**
 * The card, or null when nothing waits on the leader. Rows come in the order of his own page: the notices to
 * approve, the notices to sign, the waivers, the tagged notes, the line budgets.
 */
export function buildWaitingOnLeader(input: WaitingOnLeaderInput): WaitingOnLeaderCard | null {
  const leaderName = input.leaders.length === 1 ? (input.leaders[0]!.name ?? '').trim() || null : null
  const who = first(leaderName)
  const they = who || 'the leader'
  const rows: WaitingOnLeaderRow[] = []
  let count = 0

  const approve = input.lien?.approve ?? []
  if (approve.length > 0) {
    const due = earliest(approve.map((p) => p.dueYmd))
    const runs = approve.filter((p) => p.runGc)
    const gcs = [...new Set(runs.map((p) => p.runGc as string))]
    const run = runs.length === 0 ? '' : gcs.length === 1 ? `${n(runs.length, 'is', 'are')} in the run for ${gcs[0]}.` : `${n(runs.length, 'is', 'are')} in runs for ${gcs.length} GCs.`
    rows.push({
      key: 'approve',
      title: n(approve.length, 'lien notice to approve', 'lien notices to approve'),
      detail: [asked(approve.map((p) => p.askedYmd)), windowWords(due, input.todayYmd), run].filter(Boolean).join(' '),
      remind: lienReminderPlan(approve.map((p) => ({ kind: 'notice' as const, label: p.label, itemId: p.itemId, dueYmd: p.dueYmd }))),
      open: { label: 'Open', href: lienDeskHref({ kind: 'notice', pile: 'awaiting' }) },
    })
    count += approve.length
  }

  const sign = input.lien?.sign ?? []
  if (sign.length > 0) {
    const due = earliest(sign.map((p) => p.dueYmd))
    rows.push({
      key: 'sign',
      title: n(sign.length, 'lien notice to sign', 'lien notices to sign'),
      detail: [`Approved. The run holds ${sign.length === 1 ? 'it' : 'them'} until ${they} signs.`, windowWords(due, input.todayYmd)].filter(Boolean).join(' '),
      remind: lienReminderPlan(sign.map((p) => ({ kind: 'signature' as const, label: p.label, itemId: p.itemId, dueYmd: p.dueYmd }))),
      open: { label: 'Open', href: lienDeskHref({ kind: 'notice', pile: 'ready' }) },
    })
    count += sign.length
  }

  const waivers = input.waivers ?? []
  if (waivers.length > 0) {
    rows.push({
      key: 'waivers',
      title: n(waivers.length, 'lien waiver to sign', 'lien waivers to sign'),
      detail: [asked(waivers.map((w) => w.askedYmd)), `${waivers.length === 1 ? 'It goes' : 'Each goes'} out when ${they} signs.`].filter(Boolean).join(' '),
      remind: null,
      open: { label: 'Open the job', href: jobHref(oldest(waivers).jobId) },
    })
    count += waivers.length
  }

  const tags = input.tags ?? []
  if (tags.length > 0) {
    rows.push({
      key: 'tagged-notes',
      title: n(tags.length, 'tagged job note to answer', 'tagged job notes to answer'),
      detail: [asked(tags.map((t) => t.askedYmd)), 'A teammate is waiting on the answer.'].filter(Boolean).join(' '),
      remind: null,
      open: { label: 'Open the job', href: jobHref(oldest(tags).jobId) },
    })
    count += tags.length
  }

  const budgets = input.lineBudgets
  if (budgets && budgets.lines > 0) {
    rows.push({
      key: 'line-budgets',
      title: `${n(budgets.lines, 'assumed line', 'assumed lines')} on ${n(budgets.projects, 'project', 'projects')} to review`,
      detail: `Awarded this week. The review is on ${who ? `${who}’s` : 'the leader’s'} Dashboard.`,
      remind: null,
      open: null,
    })
    count += budgets.lines
  }

  if (rows.length === 0) return null
  return {
    leaderName,
    title: WAITING_ON_LEADER_WORDS.title(who),
    count,
    rows,
    code: sign.length > 0 ? { label: WAITING_ON_LEADER_WORDS.code(who), href: lienDeskHref({ kind: 'notice', pile: 'ready' }) } : null,
  }
}

/** The one asked longest ago; an ask with no day sorts last. */
function oldest(asks: ReadonlyArray<WaitingOnLeaderAsk>): WaitingOnLeaderAsk {
  return [...asks].sort((a, b) => (a.askedYmd ?? '9999').localeCompare(b.askedYmd ?? '9999'))[0]!
}
