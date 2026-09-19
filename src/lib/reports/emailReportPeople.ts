/**
 * Email reports, one list by person (v2.3595 — "Email reports, one modal", Option B).
 *
 * Two streams, one question: *who gets report email, and what?* A **digest** is a slice of a
 * `recurring_job_report_schedules` row per recipient (`recurring_job_report_schedule_recipients`:
 * scope · crew filter · costs); **every report** is a `report_email_subscriptions` row (an app
 * user or an outside address; all authors, or named authors and team leads). This kernel folds
 * both into one row per person, sorted by name, so the modal can show the answer as a table
 * and open one editor per person. An outside address is its own row with no digest cell —
 * the digest recipient is a user FK.
 *
 * `planDigestRowWrites` is the per-row write plan the person editor uses — insert, update or
 * delete by id — never the delete-and-reinsert the old schedule editor did, which rewrote
 * every recipient of the schedule when one person changed.
 */
import { describeDigestScope, describeReportEmailSubscription } from '../emailSchedule/emailScheduleWeek'
import { normalizeEmail, type SubscriptionWithAuthors } from '../reportEmailSubscriptions'
import { parseActivityScope, parseCrewFilter, type ActivityScope, type CrewFilter } from './digestScheduleFields'

export type RosterUser = { id: string; name: string | null; email: string | null }
export type ScheduleLite = { id: string; name: string }
export type DigestRecipientRow = {
  id: string
  schedule_id: string
  recipient_user_id: string
  activity_scope: string
  crew_filter: string
  include_costs: boolean
}

export type PersonDigest = {
  rowId: string
  scheduleId: string
  scheduleName: string
  /** "jobs yesterday · all users · with costs" */
  text: string
  activityScope: ActivityScope
  crewFilter: CrewFilter
  includeCosts: boolean
}

export type PersonEveryReport = {
  subscriptionId: string
  /** "every report anyone files", "reports from Darren, and everyone Abraham leads · paused" */
  text: string
  enabled: boolean
}

export type EmailReportPerson = {
  /** `user:<id>` or `email:<normalized address>` */
  key: string
  userId: string | null
  email: string
  /** The person's name, or the outside address's label, or the address itself. */
  name: string
  outside: boolean
  digests: PersonDigest[]
  everyReport: PersonEveryReport | null
}

function nameOf(u: RosterUser | undefined, fallback: string): string {
  const n = (u?.name ?? '').trim()
  return n || (u?.email ?? '').trim() || fallback
}

export function personKeyForUser(userId: string): string {
  return `user:${userId}`
}
export function personKeyForEmail(email: string): string {
  return `email:${normalizeEmail(email)}`
}

export function buildEmailReportPeople(input: {
  roster: readonly RosterUser[]
  schedules: readonly ScheduleLite[]
  digestRecipients: readonly DigestRecipientRow[]
  subscriptions: readonly SubscriptionWithAuthors[]
  /** Team-lead names by user id (the roster covers most; the RPC's list is the fallback). */
  teamLeadNames?: ReadonlyMap<string, string>
}): EmailReportPerson[] {
  const userById = new Map(input.roster.map((u) => [u.id, u]))
  const scheduleById = new Map(input.schedules.map((s) => [s.id, s]))
  const people = new Map<string, EmailReportPerson>()

  const forUser = (userId: string): EmailReportPerson => {
    const key = personKeyForUser(userId)
    let p = people.get(key)
    if (!p) {
      const u = userById.get(userId)
      p = { key, userId, email: (u?.email ?? '').trim(), name: nameOf(u, 'Unknown user'), outside: false, digests: [], everyReport: null }
      people.set(key, p)
    }
    return p
  }

  for (const r of input.digestRecipients) {
    const s = scheduleById.get(r.schedule_id)
    if (!s) continue
    const p = forUser(r.recipient_user_id)
    p.digests.push({
      rowId: r.id,
      scheduleId: r.schedule_id,
      scheduleName: s.name,
      text: describeDigestScope({ activity_scope: r.activity_scope, crew_filter: r.crew_filter, include_costs: r.include_costs }),
      activityScope: parseActivityScope(r.activity_scope),
      crewFilter: parseCrewFilter(r.crew_filter),
      includeCosts: r.include_costs === true,
    })
  }

  for (const s of input.subscriptions) {
    const sub = s.subscription
    let p: EmailReportPerson
    if (sub.recipient_user_id) p = forUser(sub.recipient_user_id)
    else {
      const email = (sub.recipient_email ?? '').trim()
      if (!email) continue
      const key = personKeyForEmail(email)
      let q = people.get(key)
      if (!q) {
        q = { key, userId: null, email, name: (sub.label ?? '').trim() || email, outside: true, digests: [], everyReport: null }
        people.set(key, q)
      }
      p = q
    }
    const authors = s.authorUserIds.map((id) => nameOf(userById.get(id), 'someone'))
    const teamLeads = s.teamLeadUserIds.map((id) => (input.teamLeadNames?.get(id) ?? '').trim() || nameOf(userById.get(id), 'a team lead'))
    p.everyReport = {
      subscriptionId: sub.id,
      text: describeReportEmailSubscription({ enabled: sub.enabled, autoSend: sub.auto_send, allAuthors: sub.all_authors, authors, teamLeads }),
      enabled: sub.enabled,
    }
  }

  const order = new Map(input.schedules.map((s, i) => [s.id, i]))
  for (const p of people.values()) p.digests.sort((a, b) => (order.get(a.scheduleId) ?? 0) - (order.get(b.scheduleId) ?? 0))
  return [...people.values()].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }) || a.email.localeCompare(b.email))
}

/** One schedule's slice in the person editor: on or off, and the slice's three settings. */
export type PersonDigestDraft = {
  scheduleId: string
  on: boolean
  activityScope: ActivityScope
  crewFilter: CrewFilter
  includeCosts: boolean
}

export function digestDraftsFor(schedules: readonly ScheduleLite[], person: EmailReportPerson | null): PersonDigestDraft[] {
  return schedules.map((s) => {
    const d = person?.digests.find((x) => x.scheduleId === s.id)
    return d
      ? { scheduleId: s.id, on: true, activityScope: d.activityScope, crewFilter: d.crewFilter, includeCosts: d.includeCosts }
      : { scheduleId: s.id, on: false, activityScope: 'calendar_yesterday', crewFilter: 'all_users', includeCosts: false }
  })
}

export type DigestRowWritePlan = {
  inserts: Array<{ schedule_id: string; recipient_user_id: string; activity_scope: ActivityScope; crew_filter: CrewFilter; include_costs: boolean }>
  updates: Array<{ id: string; activity_scope: ActivityScope; crew_filter: CrewFilter; include_costs: boolean }>
  deletes: string[]
}

/** Per-row writes for one person: only the rows that changed, each by its own id. */
export function planDigestRowWrites(userId: string, existing: readonly PersonDigest[], drafts: readonly PersonDigestDraft[]): DigestRowWritePlan {
  const plan: DigestRowWritePlan = { inserts: [], updates: [], deletes: [] }
  for (const d of drafts) {
    const cur = existing.find((x) => x.scheduleId === d.scheduleId)
    if (d.on && !cur) plan.inserts.push({ schedule_id: d.scheduleId, recipient_user_id: userId, activity_scope: d.activityScope, crew_filter: d.crewFilter, include_costs: d.includeCosts })
    else if (d.on && cur) {
      if (cur.activityScope !== d.activityScope || cur.crewFilter !== d.crewFilter || cur.includeCosts !== d.includeCosts)
        plan.updates.push({ id: cur.rowId, activity_scope: d.activityScope, crew_filter: d.crewFilter, include_costs: d.includeCosts })
    } else if (!d.on && cur) plan.deletes.push(cur.rowId)
  }
  return plan
}
