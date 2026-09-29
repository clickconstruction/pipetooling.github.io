/**
 * What the team sees (Settings, dev-only, punch list #60, v2.4142): every email the app sends
 * someone on the team — the 25 `team` and `internal` rows of the outbound catalog — as a
 * person's week: when it lands, who gets it, the subject with sample values filled in, and how
 * the tab can show it. Pure data and pure functions; the tab, the tests and the guard agree.
 *
 * A row renders one of three ways:
 *   sample — a builder the browser can run on the sample company (What customers see's way)
 *   real   — the edge function's own preview mode over live rows, as it would go out now
 *   soon   — the HTML is built inside the function; nothing renders until it is lifted into a
 *            kernel (one digest per PR in the train)
 *
 * `teamEmails.test.ts` is the guard: every `team`/`internal` catalog row is here, and every row
 * here is in the catalog, so the next team email cannot ship invisible.
 */
import type { UserRole } from '../hooks/useAuth'
import { emailStreamCardId, type EmailStreamKey } from './emailLogStreamLink'

export type TeamEmailWhenKind = 'morning' | 'event' | 'weekly' | 'once'

export const TEAM_EMAIL_WHEN_LABELS: Record<TeamEmailWhenKind, { title: string; subtitle: string }> = {
  morning: { title: 'Every morning', subtitle: 'the digests, before the day starts' },
  event: { title: 'When something happens', subtitle: 'sent the moment it does' },
  weekly: { title: 'Every week', subtitle: 'on a schedule' },
  once: { title: 'Once, or on request', subtitle: 'the first day, and what you ask for' },
}

export const TEAM_EMAIL_WHEN_ORDER: readonly TeamEmailWhenKind[] = ['morning', 'event', 'weekly', 'once']

/** The digests whose edge function has a `preview` mode the browser can call (and a `test_send`). */
export type TeamRealPreviewStream = 'crew_day' | 'money_waiting' | 'payment_forecast' | 'billed_awaiting'

export type TeamSampleEmailId =
  | 'money_waiting'
  | 'crew_day'
  | 'payment_forecast'
  | 'billed_awaiting'
  | 'weekly_money'
  | 'signed_agreement_staff'
  | 'estimate_accepted_staff'
  | 'gc_word_ask'
  | 'bid_room_activity_staff'
  | 'portal_request_staff'
  | 'contract_for_signature'
  | 'invitation'
  | 'sign_in'
  | 'task_reminder_fallback'
  | 'workflow_notifications'
  | 'test_email'

export type TeamEmailRender =
  | { kind: 'sample'; sample: TeamSampleEmailId }
  | { kind: 'real'; stream: TeamRealPreviewStream }
  | { kind: 'soon'; note: string }

/** How the app decides who gets a row: a role gate in the sender, a list on Settings, or the event's own people. */
export type TeamRecipientsDecidedBy = 'role' | 'setting' | 'event'

export type TeamEmailRecipients = {
  /** The roles that can receive it. A `setting` row lists the roles the setting may pick from. */
  roles: readonly UserRole[]
  decidedBy: TeamRecipientsDecidedBy
  /** The rule in the office's words. */
  rule: string
  /** For `setting` rows: which list on Emails & reports decides. */
  list?: TeamRecipientList
}

/** The recipient lists the tab reads for "A person" (the same rows Emails & reports edits). */
export type TeamRecipientList = 'paid_job' | 'ready_to_bill' | 'signed_agreements' | 'portal_requests' | 'recurring_job_report'

/** What fills the sample subject: the viewer's name where the email says one, and today. */
export type TeamSampleContext = {
  /** "Sep 29, 2026" — today as the emails print it. */
  dateLabel: string
  /** "Sep 21" — the Monday of the current week, as the weekly emails print it. */
  weekStartLabel: string
  /** "Sep 27" (or "Oct 4" across a month) — that week's Sunday. */
  weekEndLabel: string
  /** The first name the subject addresses (the account man, the invitee). */
  firstName: string
}

export type TeamEmail = {
  /** The `EMAIL_CATALOG` id — one row per catalog row. */
  id: string
  label: string
  when: { kind: TeamEmailWhenKind; label: string; order: number }
  recipients: TeamEmailRecipients
  sampleSubject: (ctx: TeamSampleContext) => string
  render: TeamEmailRender
  /** A digest whose function also has a `preview` / `test_send` mode keeps its real-one doors beside the sample (v2.4161). */
  real?: TeamRealPreviewStream
  /** Where the words or the recipients are changed. */
  manage: { tabId: string; anchorId?: string; label: string }
  /** The Settings or data the email reflects — the reason to look after a change. */
  reflects: string[]
  /** The help guide that covers it (a slug in src/content/help), when one exists. */
  guide?: string
}

const OFFICE: readonly UserRole[] = ['dev', 'master_technician', 'assistant', 'controller']
const OFFICE_AND_PRIMARY: readonly UserRole[] = ['dev', 'master_technician', 'assistant', 'controller', 'primary']
const EVERYONE: readonly UserRole[] = ['dev', 'master_technician', 'assistant', 'controller', 'estimator', 'primary', 'superintendent', 'helpers', 'subcontractor']

const stream = (key: EmailStreamKey, label: string) => ({ tabId: 'settings-emails', anchorId: emailStreamCardId(key), label })
const emails = (label: string) => ({ tabId: 'settings-emails', label })
const templates = (label: string) => ({ tabId: 'settings-templates', label })

export const TEAM_EMAILS: readonly TeamEmail[] = [
  // ---- Every morning ----
  {
    id: 'crew_day',
    label: 'Crew day',
    when: { kind: 'morning', label: 'Every weekday morning', order: 1 },
    recipients: { roles: OFFICE, decidedBy: 'role', rule: 'Every dev, leader, assistant and controller — the function picks them by role.' },
    sampleSubject: (c) => `Crew Day — ${c.dateLabel} · 6 people · 40.4 h · 3 reports · 3 flags`,
    render: { kind: 'sample', sample: 'crew_day' },
    real: 'crew_day',
    manage: emails('Emails & reports → Crew day'),
    reflects: ['Crew day wording (Email templates)', 'today’s dispatch'],
  },
  {
    id: 'money_waiting',
    label: 'Money waiting',
    when: { kind: 'morning', label: 'Every weekday morning', order: 2 },
    recipients: { roles: OFFICE_AND_PRIMARY, decidedBy: 'role', rule: 'Devs, leaders, assistants, controllers and the primary — the function picks them by role.' },
    sampleSubject: (c) => `Money waiting — ${c.dateLabel}`,
    render: { kind: 'sample', sample: 'money_waiting' },
    real: 'money_waiting',
    manage: emails('Emails & reports → Money waiting'),
    reflects: ['Money waiting wording (Email templates)', 'the Moneyfill weekly-close queues'],
  },
  {
    id: 'payment_forecast',
    label: 'Payment forecast',
    when: { kind: 'morning', label: 'Every weekday morning', order: 3 },
    recipients: { roles: OFFICE_AND_PRIMARY, decidedBy: 'role', rule: 'Devs, leaders, assistants, controllers and the primary — the function picks them by role.' },
    sampleSubject: (c) => `Payment forecast — ${c.dateLabel} — $43,020 past expected · $8,200 this week`,
    render: { kind: 'sample', sample: 'payment_forecast' },
    real: 'payment_forecast',
    manage: emails('Emails & reports → Payment forecast'),
    reflects: ['payment promises and pay speeds on the Pipeline'],
  },
  {
    id: 'schedule_day',
    label: 'Dispatch schedule — one day',
    when: { kind: 'morning', label: 'The morning of the day you asked for', order: 4 },
    recipients: { roles: EVERYONE, decidedBy: 'event', rule: 'Whoever asked for a day’s schedule from Dispatch (Email me this day).' },
    sampleSubject: (c) => `Schedule — ${c.dateLabel}`,
    render: { kind: 'soon', note: 'Built inside schedule-day-email-dispatch over the day’s dispatch rows.' },
    manage: stream('schedule_day', 'Emails & reports → Schedule day'),
    reflects: ['the day’s dispatch board'],
  },

  // ---- When something happens ----
  {
    id: 'paid_job',
    label: 'Payment recorded',
    when: { kind: 'event', label: 'When a payment is recorded', order: 10 },
    recipients: { roles: OFFICE_AND_PRIMARY, decidedBy: 'setting', list: 'paid_job', rule: 'The people ticked on Emails & reports → Paid job.' },
    sampleSubject: () => 'Payment recorded — J1054 · Sam Sample · Water heater replacement',
    render: { kind: 'soon', note: 'Built inside paid-job-email over the job’s bills and payments; a test send per job exists on the Billing tab.' },
    manage: stream('paid', 'Emails & reports → Paid job'),
    reflects: ['Paid job wording (Email templates)'],
  },
  {
    id: 'ready_to_bill',
    label: 'Ready to bill',
    when: { kind: 'event', label: 'When a job moves to Ready to Bill', order: 11 },
    recipients: { roles: OFFICE_AND_PRIMARY, decidedBy: 'setting', list: 'ready_to_bill', rule: 'The people ticked on Emails & reports → Ready to bill (email or push, per person).' },
    sampleSubject: () => 'Ready to bill — J1054 · Sam Sample · Water heater replacement',
    render: { kind: 'soon', note: 'Built inside paid-job-email over the job; a test send per job exists on the Billing tab.' },
    manage: stream('ready_to_bill', 'Emails & reports → Ready to bill'),
    reflects: ['Ready to bill wording (Email templates)'],
  },
  {
    id: 'bank_return',
    label: 'Check returned',
    when: { kind: 'event', label: 'When the bank returns a deposit', order: 12 },
    recipients: { roles: OFFICE, decidedBy: 'role', rule: 'Every dev, leader, assistant and controller — the webhook picks them by role.' },
    sampleSubject: () => 'Check returned · $13,680 · J878 Take 5 – Seguin · Insufficient funds',
    render: { kind: 'soon', note: 'Built inside mercury-webhook when a returned deposit lands.' },
    manage: emails('Emails & reports'),
    reflects: ['the bank feed (Mercury)'],
  },
  {
    id: 'signed_agreement_staff',
    label: 'Signed agreement',
    when: { kind: 'event', label: 'When a customer or GC signs', order: 13 },
    recipients: { roles: OFFICE_AND_PRIMARY, decidedBy: 'setting', list: 'signed_agreements', rule: 'The people ticked on Emails & reports → Signed agreements (leaders and estimators by default).' },
    sampleSubject: () => 'Sample Contracting signed $56,343 · Cedar Bend Apartments',
    render: { kind: 'sample', sample: 'signed_agreement_staff' },
    manage: stream('signed_agreements', 'Emails & reports → Signed agreements'),
    reflects: ['the auto-create-a-job switches'],
    guide: 'estimate-accepted-notifications',
  },
  {
    id: 'estimate_accepted_staff',
    label: 'Estimate accepted',
    when: { kind: 'event', label: 'When a customer accepts an estimate', order: 14 },
    recipients: { roles: OFFICE_AND_PRIMARY, decidedBy: 'setting', list: 'signed_agreements', rule: 'The same list as Signed agreements — an accepted estimate is one.' },
    sampleSubject: () => 'Sam Sample signed $4,380 · Water heater replacement',
    render: { kind: 'sample', sample: 'estimate_accepted_staff' },
    manage: stream('signed_agreements', 'Emails & reports → Signed agreements'),
    reflects: ['the auto-create-a-job switches'],
    guide: 'estimate-accepted-notifications',
  },
  {
    id: 'bid_room_activity_staff',
    label: 'Bid room activity',
    when: { kind: 'event', label: 'When a GC opens, signs or declines in a bid room', order: 15 },
    recipients: { roles: ['dev', 'master_technician', 'estimator'], decidedBy: 'event', rule: 'The bid’s leader and whoever sent the room.' },
    sampleSubject: () => 'Bid room — Cedar Bend Apartments',
    render: { kind: 'sample', sample: 'bid_room_activity_staff' },
    manage: emails('sign-bid-room (hardcoded)'),
    reflects: [],
  },
  {
    id: 'portal_request_staff',
    label: 'Customer-portal request',
    when: { kind: 'event', label: 'When a customer asks for something from their portal', order: 16 },
    recipients: { roles: OFFICE_AND_PRIMARY, decidedBy: 'setting', list: 'portal_requests', rule: 'The people ticked on Emails & reports → Portal requests.' },
    sampleSubject: () => 'Portal request — Sam Sample',
    render: { kind: 'sample', sample: 'portal_request_staff' },
    manage: emails('Emails & reports → Portal requests'),
    reflects: [],
  },
  {
    id: 'workflow_notifications',
    label: 'Workflow stage notice',
    when: { kind: 'event', label: 'When a stage is assigned, done or reopened', order: 17 },
    recipients: { roles: EVERYONE, decidedBy: 'event', rule: 'The person a stage is assigned to, or the next one up — eleven templates, one per moment.' },
    sampleSubject: () => 'Rough-in assigned to you — Water heater replacement',
    render: { kind: 'sample', sample: 'workflow_notifications' },
    manage: templates('Email templates → Workflow'),
    reflects: ['the eleven workflow templates (Email templates)'],
  },
  {
    id: 'task_reminder_fallback',
    label: 'Task reminder',
    when: { kind: 'event', label: 'When a reminder is due and you have no push device', order: 18 },
    recipients: { roles: EVERYONE, decidedBy: 'event', rule: 'Whoever the checklist task is for, only when a push cannot reach them.' },
    sampleSubject: () => 'Task reminder',
    render: { kind: 'sample', sample: 'task_reminder_fallback' },
    manage: emails('send-scheduled-reminders (hardcoded)'),
    reflects: ['the checklist'],
  },
  {
    id: 'report_email',
    label: 'Field report',
    when: { kind: 'event', label: 'When a report you subscribe to is filed', order: 19 },
    recipients: { roles: EVERYONE, decidedBy: 'setting', rule: 'Anyone subscribed to that report template (Emails & reports → Report subscriptions).' },
    sampleSubject: () => 'Report — Daily log · J1054 Sam Sample',
    render: { kind: 'soon', note: 'Built inside send-report-email over the filed report.' },
    manage: emails('Emails & reports → Report subscriptions'),
    reflects: ['report templates'],
  },
  {
    id: 'schedule_share',
    label: 'Dispatch schedule share',
    when: { kind: 'event', label: 'When someone shares a schedule range', order: 20 },
    recipients: { roles: EVERYONE, decidedBy: 'event', rule: 'Whoever the sharer picked.' },
    sampleSubject: (c) => `Schedule — ${c.weekStartLabel} to ${c.dateLabel}`,
    render: { kind: 'soon', note: 'Built inside schedule-share-dispatch over the shared days.' },
    manage: emails('Dispatch → Share'),
    reflects: ['the dispatch board'],
  },

  // ---- Every week ----
  {
    id: 'weekly_money',
    label: 'Weekly money movement',
    when: { kind: 'weekly', label: 'Mondays', order: 30 },
    recipients: { roles: ['dev', 'controller'], decidedBy: 'role', rule: 'Devs and controllers — the function picks them by role; one-off sends can be asked for.' },
    sampleSubject: (c) => `Weekly money movement — ${c.weekStartLabel} – ${c.weekEndLabel}`,
    render: { kind: 'sample', sample: 'weekly_money' },
    manage: stream('weekly_money', 'Emails & reports → Weekly money'),
    reflects: ['the Weekly Money Movement report'],
  },
  {
    id: 'weekly_movement',
    label: 'Weekly movement',
    when: { kind: 'weekly', label: 'Mondays', order: 31 },
    recipients: { roles: OFFICE_AND_PRIMARY, decidedBy: 'role', rule: 'Devs, leaders, assistants, controllers and the primary — by role.' },
    sampleSubject: () => 'Click Plumbing and Electrical — weekly movement',
    render: { kind: 'soon', note: 'Built inside weekly-movement-email-dispatch.' },
    manage: stream('weekly_movement', 'Emails & reports → Weekly movement'),
    reflects: ['the movement report'],
  },
  {
    id: 'billed_awaiting',
    label: 'Billed awaiting payment',
    when: { kind: 'weekly', label: 'On its schedule, or when asked', order: 32 },
    recipients: { roles: OFFICE_AND_PRIMARY, decidedBy: 'role', rule: 'Devs, leaders, assistants, controllers and the primary — by role.' },
    sampleSubject: (c) => `Billed awaiting payment — ${c.dateLabel} — $56,944.00 due`,
    render: { kind: 'sample', sample: 'billed_awaiting' },
    real: 'billed_awaiting',
    manage: stream('billed', 'Emails & reports → Billed awaiting'),
    reflects: ['Billed awaiting wording (Email templates)', 'Billed Awaiting Payment on the Pipeline'],
  },
  {
    id: 'gc_word_ask',
    label: 'Where do your GCs stand?',
    when: { kind: 'weekly', label: 'Wednesdays, when the office asks', order: 33 },
    recipients: { roles: OFFICE, decidedBy: 'event', rule: 'The account man the office asks — the link to answer for his GCs.' },
    sampleSubject: (c) => `${c.firstName}, where do your 7 GCs stand? — $312,500 owed`,
    render: { kind: 'sample', sample: 'gc_word_ask' },
    manage: emails('GC Review → Ask'),
    reflects: ['GC Review’s worklist'],
    guide: 'run-your-gc-statement-round',
  },
  {
    id: 'recurring_job_report',
    label: 'Job activity report',
    when: { kind: 'weekly', label: 'On each schedule’s days and time', order: 34 },
    recipients: { roles: EVERYONE, decidedBy: 'setting', list: 'recurring_job_report', rule: 'The people on each schedule (Emails & reports → Job reports).' },
    sampleSubject: () => 'Job activity report — J1054 Sam Sample',
    render: { kind: 'soon', note: 'Built inside recurring-job-report-dispatch over the job’s week.' },
    manage: stream('digest', 'Emails & reports → Job reports'),
    reflects: ['each schedule’s scope'],
  },
  {
    id: 'ct_roster_audit',
    label: 'CT↔PT roster audit',
    when: { kind: 'weekly', label: 'Weekly', order: 35 },
    recipients: { roles: ['dev'], decidedBy: 'role', rule: 'Devs only — the function picks them by role.' },
    sampleSubject: (c) => `CT/PT roster audit — ${c.dateLabel}`,
    render: { kind: 'soon', note: 'Built inside ct-roster-audit over the two rosters.' },
    manage: emails('ct-roster-audit (cron)'),
    reflects: ['the CountTooling roster'],
  },

  // ---- Once, or on request ----
  {
    id: 'invitation',
    label: 'Invitation',
    when: { kind: 'once', label: 'When you are added to the roster', order: 40 },
    recipients: { roles: EVERYONE, decidedBy: 'event', rule: 'The person being invited.' },
    sampleSubject: () => 'Invitation to join ClickTooling',
    render: { kind: 'sample', sample: 'invitation' },
    manage: templates('Email templates → Invitation'),
    reflects: ['the Invitation template'],
    guide: 'add-someone-to-the-roster',
  },
  {
    id: 'sign_in',
    label: 'Sign-in link',
    when: { kind: 'once', label: 'Whenever you ask to sign in by email', order: 41 },
    recipients: { roles: EVERYONE, decidedBy: 'event', rule: 'The person signing in.' },
    sampleSubject: () => 'Sign in to ClickTooling',
    render: { kind: 'sample', sample: 'sign_in' },
    manage: templates('Email templates → Sign-in'),
    reflects: ['the Sign-in template'],
  },
  {
    id: 'contract_for_signature',
    label: 'Contract for signature',
    when: { kind: 'once', label: 'When the office sends a sub a contract to sign', order: 42 },
    recipients: { roles: ['subcontractor'], decidedBy: 'event', rule: 'The subcontractor asked to sign.' },
    sampleSubject: () => 'Please sign: Subcontractor agreement · Click Plumbing and Electrical',
    render: { kind: 'sample', sample: 'contract_for_signature' },
    manage: { tabId: 'settings-contracts', label: 'Contracts & terms' },
    reflects: ['the subcontractor agreement wording'],
  },
  {
    id: 'test_email',
    label: 'Dev test email',
    when: { kind: 'once', label: 'When a dev presses Send test', order: 43 },
    recipients: { roles: ['dev'], decidedBy: 'event', rule: 'Whoever pressed Send test.' },
    sampleSubject: () => 'Test — whatever the tester typed',
    render: { kind: 'sample', sample: 'test_email' },
    manage: templates('Email templates → Test'),
    reflects: [],
  },
]

export function teamEmailById(id: string): TeamEmail | undefined {
  return TEAM_EMAILS.find((e) => e.id === id)
}

/** The rows a role can receive, in the tab's order. */
export function teamEmailsForRole(role: UserRole): TeamEmail[] {
  return TEAM_EMAILS.filter((e) => e.recipients.roles.includes(role)).sort((a, b) => a.when.order - b.when.order)
}

/** The recipient lists Emails & reports keeps, as user ids — what "A person" reads. A list the tab could not load is `null` (fall back to the role). */
export type TeamRecipientLists = Partial<Record<TeamRecipientList, readonly string[] | null>>

/** Whether one person gets a row: a `setting` row asks its list; the rest ask the role. */
export function personGetsTeamEmail(email: TeamEmail, person: { id: string; role: UserRole }, lists: TeamRecipientLists): boolean {
  if (!email.recipients.roles.includes(person.role)) return false
  if (email.recipients.decidedBy !== 'setting' || !email.recipients.list) return true
  const list = lists[email.recipients.list]
  if (list == null) return true
  return list.includes(person.id)
}

export function teamEmailsForPerson(person: { id: string; role: UserRole }, lists: TeamRecipientLists): TeamEmail[] {
  return TEAM_EMAILS.filter((e) => personGetsTeamEmail(e, person, lists)).sort((a, b) => a.when.order - b.when.order)
}

export function groupTeamEmailsByWhen(rows: readonly TeamEmail[]): Array<{ kind: TeamEmailWhenKind; rows: TeamEmail[] }> {
  return TEAM_EMAIL_WHEN_ORDER.map((kind) => ({ kind, rows: rows.filter((r) => r.when.kind === kind).sort((a, b) => a.when.order - b.when.order) })).filter((g) => g.rows.length > 0)
}

export type TeamEmailCoverage = { total: number; sample: number; real: number; soon: number }

export function teamEmailCoverage(rows: readonly TeamEmail[] = TEAM_EMAILS): TeamEmailCoverage {
  const c: TeamEmailCoverage = { total: rows.length, sample: 0, real: 0, soon: 0 }
  for (const r of rows) c[r.render.kind] += 1
  return c
}

/** "25 emails · 11 render live · 4 show the real one · 10 built on the server (next release)" */
export function teamCoverageLine(c: TeamEmailCoverage): string {
  const parts = [`${c.total} email${c.total === 1 ? '' : 's'}`]
  if (c.sample) parts.push(`${c.sample} render live`)
  if (c.real) parts.push(`${c.real} show the real one`)
  if (c.soon) parts.push(`${c.soon} built on the server (next release)`)
  return parts.join(' · ')
}

/** The From line every team email carries — the software's name, so one inbox tells an app notice from a customer thread. */
export const TEAM_EMAIL_FROM_LABEL = 'ClickTooling <team@noreply.clicktooling.com>'
