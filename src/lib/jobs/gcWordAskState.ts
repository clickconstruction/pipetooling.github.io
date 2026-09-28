/**
 * Ask by link, as GC Review reads it (punch list #49, step 7): where a link
 * stands — asked, opened, answered, run out — which GCs to ask about, and the
 * call sheet's drafts from the answers waiting on the office. Pure; the IO is
 * `gcWordAskIo.ts`, the rules the page and the server share are `gcWordAsk.ts`.
 */
import { isTemperature, type Temperature } from './gcStatementRounds'
import type { CallSheetDraft } from './gcCallSheet'
import type { GcWorklistGroup } from './gcWorklist'

export type GcWordAskAnswerRow = {
  id: string
  ask_id: string
  gc_customer_id: string
  temperature: string | null
  note: string
  expected_pay_by: string | null
  no_change: boolean
  answered_at: string
  status: 'pending' | 'accepted' | 'dismissed' | string
}

export type GcWordAskRow = {
  id: string
  week_start: string
  owner_user_id: string
  owner_name: string
  gc_ids: string[]
  token: string | null
  created_by_name: string
  created_at: string
  expires_at: string
  emailed_at: string | null
  emailed_to: string | null
  opened_at: string | null
  answered_at: string | null
  revoked_at: string | null
  answers: GcWordAskAnswerRow[]
}

export type GcWordAskStage = 'asked' | 'opened' | 'answered' | 'expired'

/** How far a live link has got. A link that has run out with answers waiting still reads "answered". */
export function wordAskStage(ask: Pick<GcWordAskRow, 'opened_at' | 'answered_at' | 'expires_at' | 'answers'>, nowMs: number): GcWordAskStage {
  if (ask.answers.some((a) => a.status === 'pending')) return 'answered'
  const expires = new Date(ask.expires_at).getTime()
  if (Number.isNaN(expires) || expires <= nowMs) return 'expired'
  if (ask.answered_at) return 'answered'
  return ask.opened_at ? 'opened' : 'asked'
}

const shortDay = (iso: string) => new Date(iso).toLocaleDateString('en-US', { weekday: 'short' })

/** "asked Thu · emailed · not opened yet" / "answered 3 of 5 · 2 waiting on you". */
export function wordAskStatusLine(ask: GcWordAskRow, nowMs: number): string {
  const stage = wordAskStage(ask, nowMs)
  const pending = ask.answers.filter((a) => a.status === 'pending').length
  const asked = `asked ${shortDay(ask.created_at)}${ask.emailed_at ? ' · emailed' : ''}`
  if (stage === 'expired') return `${asked} · the link has run out`
  if (stage === 'asked') return `${asked} · not opened yet`
  if (stage === 'opened') return `${asked} · opened ${shortDay(ask.opened_at!)} · no answers yet`
  const answered = ask.answers.length
  return `answered ${answered} of ${ask.gc_ids.length}${pending > 0 ? ` · ${pending} waiting on you` : ' · all read'}`
}

/** The week's live ask per account man; the newest when a rotate left more than one. */
export function liveAskByOwner(asks: readonly GcWordAskRow[]): Map<string, GcWordAskRow> {
  const out = new Map<string, GcWordAskRow>()
  for (const a of asks) {
    if (a.revoked_at) continue
    const prev = out.get(a.owner_user_id)
    if (!prev || a.created_at > prev.created_at) out.set(a.owner_user_id, a)
  }
  return out
}

/** The answers still waiting on the office, across every ask of the week (a rotated link's answers are kept). */
export function pendingAnswersByOwner(asks: readonly GcWordAskRow[]): Map<string, GcWordAskAnswerRow[]> {
  const out = new Map<string, GcWordAskAnswerRow[]>()
  for (const a of [...asks].sort((x, y) => (x.created_at < y.created_at ? -1 : 1))) {
    const byGc = new Map((out.get(a.owner_user_id) ?? []).map((r) => [r.gc_customer_id, r]))
    // A newer link's answer for the same GC replaces the older one.
    for (const r of a.answers) if (r.status === 'pending') byGc.set(r.gc_customer_id, r)
    if (byGc.size > 0) out.set(a.owner_user_id, [...byGc.values()])
  }
  return out
}

/** Who to ask about: the group's GCs with no word in this week. The link asks only for what is missing. */
export function gcIdsToAskAbout(group: Pick<GcWorklistGroup, 'rows'>): string[] {
  return group.rows.filter((r) => r.overLine && !r.word && !r.skipped).map((r) => r.gcId)
}

/** His answers as the call sheet's drafts, for the office to read, change and save. */
export function callSheetDraftsFromAnswers(answers: readonly GcWordAskAnswerRow[]): Record<string, CallSheetDraft> {
  const out: Record<string, CallSheetDraft> = {}
  for (const a of answers) {
    if (a.status !== 'pending') continue
    const temperature: Temperature | null = isTemperature(a.temperature) ? a.temperature : null
    out[a.gc_customer_id] = { temperature: a.no_change ? null : temperature, note: a.no_change ? '' : a.note, payBy: a.expected_pay_by ?? '', noChange: a.no_change === true }
  }
  return out
}
