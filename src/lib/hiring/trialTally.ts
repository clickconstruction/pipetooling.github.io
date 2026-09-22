/**
 * Try-out loop, PR 3 (to-dos/helper-tryout-loop): the tally on the Try-out card and the nudge.
 *
 * The office reads what the leaders said — by name, the latest word from each — over the days
 * the helper worked, and one line says what the numbers suggest: *3 leaders said yes — hire?*
 * The office presses the button; nothing here decides. `team_prospect_trial_tally()` is the feed.
 *
 * Pure: no React, no supabase.
 */
import { supervisedJobLabel } from '../people/supervisedDays'
import type { LedgerPrefixMap } from '../ledgerDisplayPrefixes'
import { formatWorkDateYmdMonthDayShort, formatWorkDateYmdWeekdayShortFriendly, ymdAddDays } from '../../utils/dateUtils'
import type { TrialVerdict } from './trialVerdicts'

export type TrialTallyLeader = { user_id: string; name: string | null; role: string | null }

export type TrialTallyDay = {
  work_date: string
  /** A clock session backs the day; false = listed on a block (or a verdict exists) but never clocked. */
  clocked: boolean
  /** A session is still running. */
  open: boolean
  job_id: string | null
  hcp_number: string | null
  click_number: string | null
  job_name: string | null
  customer_name: string | null
  /** Everyone the rule would have asked that day. */
  leaders: TrialTallyLeader[]
}

export type TrialTallyVerdictRow = {
  leader_user_id: string
  leader_name: string | null
  leader_role: string | null
  work_date: string
  verdict: TrialVerdict
  note: string | null
  updated_at: string | null
}

/** One object of `team_prospect_trial_tally()`. */
export type TrialTallyRow = {
  prospect_id: string
  helper_user_id: string | null
  deferred_at: string | null
  deferred_by: string | null
  deferred_by_name: string | null
  days: TrialTallyDay[]
  verdicts: TrialTallyVerdictRow[]
}

/** The office presses the button; these only say when the line asks. */
export const TRIAL_NUDGE_THRESHOLDS = { hireYes: 3, passNo: 2 } as const

export type TrialAnswer = Exclude<TrialVerdict, 'skipped'>

export type TrialLeaderLine = {
  userId: string
  name: string
  /** "sub" for a subcontractor, "helper" for a cleared helper, null for a master. */
  roleTag: string | null
  /** The leader's latest answer; null = asked, never answered. */
  verdict: TrialAnswer | null
  note: string
  /** The day of the latest answer. */
  workDate: string | null
  /** Days the rule put them with the helper. */
  daysLed: number
  /** Asked, no answer yet, and the window (today / yesterday) is still open. */
  waiting: boolean
}

export type TrialNudge = {
  tone: 'hire' | 'pass' | 'split' | 'wait'
  text: string
  /** The line asks a question the office can defer with Keep trying. */
  asks: boolean
}

export type TrialTally = {
  prospectId: string
  /** Days with a clock session. */
  daysWorked: number
  /** Days listed on a block that were never clocked. */
  scheduledNotClocked: number
  /** The helper is clocked in right now. */
  onTheJobNow: boolean
  /** "4 days worked · 3 leaders" */
  daysLine: string
  leaders: TrialLeaderLine[]
  counts: { yes: number; no: number; unsure: number }
  /** Closed days worked with nobody who could run the job — the "no lead listed" line, per day. */
  unledDays: { workDate: string; label: string }[]
  nudge: TrialNudge
  /** Keep trying was pressed after the newest answer: the nudge is quiet until a newer one lands. */
  deferred: { at: string; byName: string; label: string } | null
}

function isAnswer(v: TrialVerdict | null | undefined): v is TrialAnswer {
  return v === 'yes' || v === 'no' || v === 'unsure'
}

function roleTagOf(role: string | null | undefined): string | null {
  if (role === 'subcontractor') return 'sub'
  if (role === 'helpers') return 'helper'
  return null
}

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`
}

function firstName(name: string): string {
  return name.split(/\s+/)[0] || name
}

function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? ''
  if (names.length === 2) return `${names[0]} and ${names[1]}`
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

export function buildTrialTally(row: TrialTallyRow, opts: { todayYmd: string; prefixMap?: LedgerPrefixMap }): TrialTally {
  const today = opts.todayYmd
  const yesterday = ymdAddDays(today, -1)
  const days = Array.isArray(row.days) ? row.days.filter((d) => d && d.work_date && d.work_date <= today) : []
  const verdicts = Array.isArray(row.verdicts) ? row.verdicts : []

  const daysWorked = days.filter((d) => d.clocked).length
  const scheduledNotClocked = days.filter((d) => !d.clocked && d.work_date !== today).length
  const onTheJobNow = days.some((d) => d.open)

  // Every leader the rule ever put with the helper, plus anyone who answered anyway.
  const leaderIds = new Map<string, { name: string; role: string | null; daysLed: number; askedWithinWindow: boolean }>()
  for (const d of days) {
    // Today's open day has not been asked yet.
    if (d.open) continue
    for (const l of d.leaders ?? []) {
      const cur = leaderIds.get(l.user_id) ?? { name: (l.name ?? '').trim() || 'A leader', role: l.role ?? null, daysLed: 0, askedWithinWindow: false }
      cur.daysLed += 1
      if (d.work_date === today || d.work_date === yesterday) cur.askedWithinWindow = true
      leaderIds.set(l.user_id, cur)
    }
  }
  for (const v of verdicts) {
    if (!leaderIds.has(v.leader_user_id)) {
      leaderIds.set(v.leader_user_id, { name: (v.leader_name ?? '').trim() || 'A leader', role: v.leader_role ?? null, daysLed: 0, askedWithinWindow: false })
    }
  }

  // Each leader's latest answer (a skip is not an answer, but it keeps them on the list).
  const latest = new Map<string, TrialTallyVerdictRow>()
  for (const v of verdicts) {
    if (!isAnswer(v.verdict)) continue
    const cur = latest.get(v.leader_user_id)
    if (!cur || v.work_date > cur.work_date || (v.work_date === cur.work_date && (v.updated_at ?? '') > (cur.updated_at ?? ''))) latest.set(v.leader_user_id, v)
  }

  const leaders: TrialLeaderLine[] = [...leaderIds.entries()].map(([userId, l]) => {
    const v = latest.get(userId)
    return {
      userId,
      name: l.name,
      roleTag: roleTagOf(l.role),
      verdict: v ? (v.verdict as TrialAnswer) : null,
      note: (v?.note ?? '').trim(),
      workDate: v?.work_date ?? null,
      daysLed: l.daysLed,
      waiting: !v && l.askedWithinWindow,
    }
  })
  // Answers first (newest first), then the ones still waiting, then the ones who never answered.
  const rank = (l: TrialLeaderLine) => (l.verdict ? 0 : l.waiting ? 1 : 2)
  leaders.sort((a, b) => rank(a) - rank(b) || (b.workDate ?? '').localeCompare(a.workDate ?? '') || a.name.localeCompare(b.name))

  const counts = { yes: 0, no: 0, unsure: 0 }
  for (const l of leaders) if (l.verdict) counts[l.verdict] += 1

  const unledDays = days
    .filter((d) => d.clocked && !d.open && (d.leaders ?? []).length === 0)
    .map((d) => {
      const job = d.job_id ? supervisedJobLabel({ hcp_number: d.hcp_number, click_number: d.click_number, job_name: d.job_name, customer_name: d.customer_name }, opts.prefixMap) : null
      return { workDate: d.work_date, label: `${formatWorkDateYmdWeekdayShortFriendly(d.work_date)}${job ? ` at ${job}` : ''} — no lead listed; ask Dispatch to put a master on the block` }
    })

  const answered = leaders.filter((l) => l.verdict).length
  const daysLine = `${plural(daysWorked, 'day')} worked${scheduledNotClocked ? ` · ${plural(scheduledNotClocked, 'listed day')} not clocked` : ''}${answered ? ` · ${plural(answered, 'leader')}` : ''}${onTheJobNow ? ' · on a job now' : ''}`

  const nudge = trialNudge({ counts, daysWorked, scheduledNotClocked, leaders, unledDays: unledDays.length })

  // Keep trying quiets the nudge until an answer newer than the press lands.
  let deferred: TrialTally['deferred'] = null
  if (row.deferred_at && nudge.asks) {
    const newestAnswer = verdicts.filter((v) => isAnswer(v.verdict)).map((v) => v.updated_at ?? '').sort().pop() ?? ''
    if (newestAnswer <= row.deferred_at) {
      const byName = (row.deferred_by_name ?? '').trim() || 'the office'
      const at = new Date(row.deferred_at)
      const when = Number.isNaN(at.getTime()) ? '' : ` ${formatWorkDateYmdMonthDayShort(at.toISOString().slice(0, 10))}`
      deferred = { at: row.deferred_at, byName, label: `Keep trying — ${firstName(byName)}${when}` }
    }
  }

  return { prospectId: row.prospect_id, daysWorked, scheduledNotClocked, onTheJobNow, daysLine, leaders, counts, unledDays, nudge, deferred }
}

/** The one line under the tally. Thresholds: TRIAL_NUDGE_THRESHOLDS; the office still presses the button. */
export function trialNudge(input: {
  counts: { yes: number; no: number; unsure: number }
  daysWorked: number
  scheduledNotClocked: number
  leaders: readonly Pick<TrialLeaderLine, 'name' | 'verdict' | 'waiting'>[]
  unledDays: number
}): TrialNudge {
  const { yes, no, unsure } = input.counts
  const { hireYes, passNo } = TRIAL_NUDGE_THRESHOLDS
  if (yes >= hireYes && no >= passNo) return { tone: 'split', text: `${yes} said yes, ${no} said no — talk to them before you decide`, asks: true }
  if (yes >= hireYes && no === 0) return { tone: 'hire', text: `${plural(yes, 'leader')} said yes — hire?`, asks: true }
  if (no >= passNo) return { tone: 'pass', text: `${no} said no${yes ? `, ${yes} yes` : ''} — pass?`, asks: true }

  const waitingOn = input.leaders.filter((l) => l.waiting).map((l) => firstName(l.name))
  if (input.daysWorked === 0 && input.scheduledNotClocked === 0) return { tone: 'wait', text: 'no days yet — ask Dispatch to put them on a crew', asks: false }
  if (waitingOn.length > 0) return { tone: 'wait', text: `waiting on ${joinNames(waitingOn)}`, asks: false }
  const answered = yes + no + unsure
  if (answered === 0 && input.unledDays > 0) return { tone: 'wait', text: 'nobody who could run the job was on the block — ask Dispatch to put a master on it', asks: false }
  const said = [yes ? `${yes} yes` : null, no ? `${no} no` : null, unsure ? `${unsure} not sure` : null].filter(Boolean).join(', ')
  return { tone: 'wait', text: `${said ? `${said} — ` : ''}needs another leader`, asks: false }
}

/** "✓" / "✗" / "?" for the leader line. */
export function trialVerdictMark(v: TrialAnswer | null): string {
  return v === 'yes' ? '✓' : v === 'no' ? '✗' : v === 'unsure' ? '?' : '–'
}
