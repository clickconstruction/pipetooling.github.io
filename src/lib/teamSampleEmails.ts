/**
 * The sample team emails What the team sees renders in the browser (punch list #60, v2.4142):
 * the same builders the edge functions run, fed the sample company — and, for the three
 * template-driven emails (the invitation, the sign-in link, the workflow stage notice), the live `email_templates` rows with sample variables, so an edit
 * on Email templates shows here the way a Settings edit shows on What customers see.
 */
import { buildSignedAgreementEmail } from './signedAgreementEmail'
import { bidRoomActivityStaffEmail } from '../../supabase/functions/_shared/bidRoomActivityStaffEmail'
import { portalRequestStaffEmail } from '../../supabase/functions/_shared/portalRequestStaffEmail'
import { wordAskEmail } from '../../supabase/functions/_shared/gcWordAsk'
import { SAMPLE_GC, SAMPLE_HOMEOWNER } from './customerSample'
import { buildSampleContractEmail, type SampleEmailContext } from './customerSampleEmails'
import { escapeEmailHtml, renderEmailWording } from './emailWording'
import type { TeamSampleEmailId } from './teamEmails'
import { moneyWaitingEmailSubject, moneyWaitingEmailText, renderMoneyWaitingEmail, type MoneyWaitingEmailPayload } from '../../supabase/functions/_shared/moneyWaitingEmail'
import { buildCrewDayEmailView, crewDayEmailSubject, crewDayEmailText, renderCrewDayEmail, type CrewDayEmailPayload } from '../../supabase/functions/_shared/crewDayEmail'
import { paymentForecastEmailSubject, paymentForecastEmailText, renderPaymentForecastEmail, type ForecastEmailPayload } from '../../supabase/functions/_shared/paymentForecastEmail'
import { billedReportEmailSubject, billedReportEmailText, renderBilledReportEmail, type BilledReportPayload, type BilledReportRow } from '../../supabase/functions/_shared/billedReportEmail'
import { renderWeeklyMoneyHtml, renderWeeklyMoneyText, weekLabelFromMonday, weeklyMoneySubject, type WeeklyMoneyPayload } from '../../supabase/functions/_shared/weeklyMoneyEmail'
import { renderWeeklyMovementHtml, renderWeeklyMovementText, weeklyMovementSubject, type WeeklyMovementPayload, type WeeklyMovementPayloadEntry } from '../../supabase/functions/_shared/weeklyMovementEmail'
import { paidJobEmailSubject, paidJobEmailText, renderPaidJobEmailDetailed, type PaidJobEmailPayload } from '../../supabase/functions/_shared/paidJobEmail'
import { buildScheduleEmail, type ScheduleDayBlockRow } from '../../supabase/functions/_shared/scheduleDayEmail'
import { buildShareEmail, type ShareBlockRow } from '../../supabase/functions/_shared/scheduleShareCore'
import { buildRecurringJobReportHtml, buildRecurringJobReportTextFallback, recurringJobReportEmailSubject, type RecurringJobReportPayload } from '../../supabase/functions/_shared/recurringJobReportEmail'
import { sunSatWeekOf } from './teamEmails'
import { buildReportEmail, type ReportContent } from '../../supabase/functions/_shared/fieldReportEmail'
import { buildBankReturnNoticeEmail, type BankReturnNoticeInput } from '../../supabase/functions/_shared/bankReturnedDeposits'
import { renderCtRosterAuditEmail } from '../../supabase/functions/_shared/ctRosterAuditEmail'
import type { CtRosterDiff } from '../../supabase/functions/_shared/ctRosterDiff'
import { readyToBillSubject, readyToBillText, renderReadyToBillDetailed, type ReadyToBillPayload } from '../../supabase/functions/_shared/readyToBillEmail'
import { gcMoneyMondaySubject, renderGcMoneyMondayHtml, renderGcMoneyMondayText, type GcMoneyMondayPayload } from '../../supabase/functions/_shared/gcMoneyMondayEmail'
import { billTheCustomerUrl, buildOfficeNoticeEmail } from '../../supabase/functions/_shared/gcOfficeNotices'
import { lienStatusEmailHtml, lienStatusEmailText, lienStatusSubject, type LienStatusPayload } from '../../supabase/functions/_shared/lienDeskStatus'
import { ymdAddDays } from '../../supabase/functions/_shared/appTimeZone'
import { calendarYmdInAppTzFromIso } from '../utils/dateUtils'

export type BuiltTeamEmail = { subject: string; html: string; text: string }

/** One `email_templates` row as the tab loads it — the live wording, when the office has set any. */
export type TeamEmailTemplateRow = { template_type: string; subject: string; body: string }

export type TeamSampleContext = SampleEmailContext & {
  /** The live template rows (`email_templates`), or none when the load has not landed. */
  templates: readonly TeamEmailTemplateRow[]
  /** The person the sample addresses — the viewer, or the person picked. */
  recipient: { name: string; email: string; role: string }
}

/**
 * The defaults the senders fall back to when no template row exists (`invite-user`,
 * `send-sign-in-email` carry the same strings; `teamSampleEmails.test.ts` reads their source to
 * keep these in step). The workflow default is the sample's own — the seeded rows are the
 * source of truth there and are always present in prod.
 */
export const TEAM_TEMPLATE_DEFAULTS: Record<string, { subject: string; body: string }> = {
  invitation: {
    subject: 'Invitation to join ClickTooling',
    body: "Hi {{name}},\n\nYou've been invited to join ClickTooling as a {{role}}. Click the link below to set up your account:\n\n{{link}}\n\nIf you didn't expect this invitation, you can safely ignore this email.",
  },
  sign_in: {
    subject: 'Sign in to ClickTooling',
    body: "Hi {{name}},\n\nClick the link below to sign in to your ClickTooling account:\n\n{{link}}\n\nIf you didn't request this sign-in link, you can safely ignore this email.",
  },
  stage_assigned_started: {
    subject: '{{stage_name}} assigned to you — {{project_name}}',
    body: 'Hi {{name}},\n\n{{assigned_to_name}} assigned you {{stage_name}} on {{project_name}}.\n\nOpen the workflow: {{workflow_link}}',
  },
}

/** A template email the way the senders build it: variables filled, the body escaped, paragraphs on blank lines. */
export function renderTemplateEmail(template: { subject: string; body: string }, vars: Record<string, string>): BuiltTeamEmail {
  const subject = renderEmailWording(template.subject, vars)
  const text = renderEmailWording(template.body, vars)
  const html = text
    .split(/\n{2,}/)
    .map((p) => `<p>${escapeEmailHtml(p).replace(/\n/g, '<br>')}</p>`)
    .join('')
  return { subject, html, text }
}

function templateFor(ctx: TeamSampleContext, type: string): { subject: string; body: string } {
  const live = ctx.templates.find((t) => t.template_type === type)
  if (live && (live.subject.trim() || live.body.trim())) return { subject: live.subject, body: live.body }
  return TEAM_TEMPLATE_DEFAULTS[type] ?? { subject: type, body: '' }
}

/** Sample GCs for the account man's ask — the sample company's builders, with what they owe. */
const SAMPLE_WORD_ASK_GCS = [
  { gcName: SAMPLE_GC.company, amount: 125_000, promise: { payBy: '2026-10-15', late: false, daysLate: 0 } },
  { gcName: 'RMC · Dudley Mason', amount: 98_500, promise: null },
  { gcName: 'Structura', amount: 89_000, promise: { payBy: '2026-09-20', late: true, daysLate: 9 } },
] as const

/**
 * Where the liens stand for the sample company (v2.4311): five notices across three GCs, one
 * waiting for approval, one owner to find, an affidavit short its legal description, and two
 * windows already gone. The months and dates count from today so the email reads right any day.
 */
export function sampleLienStatusPayload(todayYmd: string): LienStatusPayload {
  const month = (back: number) => {
    const m = /^(\d{4})-(\d{2})/.exec(todayYmd)
    const d = new Date(Date.UTC(Number(m?.[1] ?? 2026), Number(m?.[2] ?? 1) - 1 - back, 1))
    return d.toISOString().slice(0, 7)
  }
  const soon = ymdAddDays(todayYmd, 14)
  const later = ymdAddDays(todayYmd, 46)
  const job = (n: number, name: string, gc: string, owed: number, months: string[], where: LienStatusPayload['jobs'][number]['where'], byYmd = soon, sinceYmd = '') => ({
    jobId: `00000000-0000-4000-8000-00000000${n}`,
    number: String(n),
    name,
    gc,
    owed,
    months,
    where,
    byYmd,
    sinceYmd,
  })
  return {
    v: 1,
    asOf: `${todayYmd}T19:14:00.000Z`,
    todayYmd,
    gc: null,
    jobs: [
      job(1048, 'Cedar Bend Apartments, Building A', SAMPLE_GC.company, 24_800, [month(2)], 'approval', soon, ymdAddDays(todayYmd, -5)),
      job(1052, 'Cedar Bend Apartments, Building B', SAMPLE_GC.company, 12_150, [month(2)], 'draft'),
      job(1031, 'Lennox remodel', 'RMC · Dudley Mason', 9_800, [month(2), month(1)], 'draft'),
      job(1039, 'Service visit, 628 Terrell Rd', 'RMC · Dudley Mason', 1_710, [month(1)], 'owner'),
      job(1044, 'Mission Hills drains', 'Structura', 6_400, [month(1)], 'draft', later),
    ],
    liens: [{ number: '1012', name: 'Wildflower', gc: '', owed: 603, byYmd: soon, needs: ['legal'] }],
    kindsUnset: 1,
    trackingOwed: 0,
    pastWindow: { jobs: 2, owed: 3_450 },
    retainage: { jobs: 0, held: 0, firstYmd: '' },
  }
}

/**
 * The Money waiting digest's payload for the sample company (v2.4161): three customers off
 * their pace, one on it — the same rows `get_money_waiting_email_payload` returns, dated from
 * today so the waits read right whenever the tab is opened.
 */
export function sampleMoneyWaitingPayload(todayYmd: string): MoneyWaitingEmailPayload {
  const daysAgo = (n: number) => {
    const d = new Date(`${todayYmd}T12:00:00Z`)
    d.setUTCDate(d.getUTCDate() - n)
    return d.toISOString()
  }
  const row = (invoice: string, job: string, number: string, name: string, address: string, customerId: string, customer: string, billedDaysAgo: number, remaining: number) => ({
    invoice_id: invoice,
    job_id: job,
    display_number: number,
    job_name: name,
    job_address: address,
    customer_id: customerId,
    customer_name: customer,
    billed_at: daysAgo(billedDaysAgo),
    est_bill_ymd: null,
    remaining,
  })
  return {
    generated_at: `${todayYmd}T12:30:00Z`,
    today: todayYmd,
    rows: [
      row('inv-1', 'job-1', '1041', 'Cedar Bend Apartments — rough-in', '2530 Cedar Bend Dr, Kyle, TX 78640', 'gc-sample', SAMPLE_GC.company, 41, 26_000),
      row('inv-2', 'job-2', '1046', 'Cedar Bend Apartments — top out', '2530 Cedar Bend Dr, Kyle, TX 78640', 'gc-sample', SAMPLE_GC.company, 19, 8_200),
      row('inv-3', 'job-3', '1054', 'Water heater replacement', SAMPLE_HOMEOWNER.address, 'home-sample', SAMPLE_HOMEOWNER.name, 58, 4_380),
      row('inv-4', 'job-4', '1039', 'Structura — pretest', '901 Structura Way, Buda, TX 78610', 'structura', 'Structura', 33, 12_640),
      row('inv-5', 'job-5', '1057', 'Hunter Homes — gas line', '77 Hunter Loop, Kyle, TX 78640', 'hunter', 'Hunter Homes', 6, 5_724),
    ],
    pay_speeds: {
      company: { medianDays: 24, samples: 40 },
      customers: {
        'gc-sample': { medianDays: 18, samples: 9 },
        'home-sample': { medianDays: 12, samples: 4 },
        hunter: { medianDays: 30, samples: 5 },
      },
      segments: { residential: { medianDays: 14, samples: 12 }, commercial: { medianDays: 27, samples: 28 } },
      customerTypes: { 'gc-sample': 'commercial', 'home-sample': 'residential', structura: 'commercial', hunter: 'commercial' },
    },
  }
}

/**
 * The Crew day digest's payload for the sample company (v2.4163): a busy day — three jobs, six
 * people, three reports, one flag (a clock still open at send time), a sub on site — timed in
 * the company calendar zone on the day the tab is opened.
 */
export function sampleCrewDayPayload(todayYmd: string): CrewDayEmailPayload {
  const at = (hhmm: string) => `${todayYmd}T${hhmm}:00-05:00`
  return {
    day: todayYmd,
    users: [
      { id: 'u-sam', name: 'Sam Plumber' },
      { id: 'u-jo', name: 'Jo Helper' },
      { id: 'u-lee', name: 'Lee Tech' },
      { id: 'u-ana', name: 'Ana Lead' },
      { id: 'u-max', name: 'Max Helper' },
      { id: 'u-kim', name: 'Kim Tech' },
    ],
    jobs: [
      { id: 'job-1', hcp_number: '1041', click_number: null, job_name: 'Cedar Bend Apartments — rough-in', job_address: '2530 Cedar Bend Dr, Kyle, TX 78640', status: 'working', pct_complete: 55 },
      { id: 'job-3', hcp_number: '1054', click_number: null, job_name: 'Water heater replacement', job_address: SAMPLE_HOMEOWNER.address, status: 'working', pct_complete: 100 },
      { id: 'job-5', hcp_number: '1057', click_number: null, job_name: 'Hunter Homes — gas line', job_address: '77 Hunter Loop, Kyle, TX 78640', status: 'working', pct_complete: 20 },
    ],
    sessions: [
      { user_id: 'u-sam', job_id: 'job-1', clocked_in_at: at('07:02'), clocked_out_at: at('15:41') },
      { user_id: 'u-jo', job_id: 'job-1', clocked_in_at: at('07:05'), clocked_out_at: at('15:40') },
      { user_id: 'u-lee', job_id: 'job-1', clocked_in_at: at('07:10'), clocked_out_at: at('12:02') },
      { user_id: 'u-ana', job_id: 'job-3', clocked_in_at: at('08:00'), clocked_out_at: at('13:30') },
      { user_id: 'u-max', job_id: 'job-3', clocked_in_at: at('08:00'), clocked_out_at: at('13:32') },
      { user_id: 'u-kim', job_id: 'job-5', clocked_in_at: at('09:15'), clocked_out_at: null },
    ],
    blocks: [
      { user_id: 'u-sam', job_id: 'job-1', bid_id: null, time_start: at('07:00'), time_end: at('15:30'), note: null },
      { user_id: 'u-jo', job_id: 'job-1', bid_id: null, time_start: at('07:00'), time_end: at('15:30'), note: null },
      { user_id: 'u-ana', job_id: 'job-3', bid_id: null, time_start: at('08:00'), time_end: at('14:00'), note: 'Bring the 50-gal' },
      { user_id: 'u-max', job_id: 'job-3', bid_id: null, time_start: at('08:00'), time_end: at('14:00'), note: null },
      { user_id: 'u-kim', job_id: 'job-5', bid_id: null, time_start: at('09:00'), time_end: at('17:00'), note: null },
    ],
    reports: [
      { id: 'r-1', user_id: 'u-sam', job_id: 'job-1', created_at: at('15:35'), template_name: 'Daily log', field_values: { notes: 'Second floor rough-in done; inspection Thursday.' } },
      { id: 'r-2', user_id: 'u-ana', job_id: 'job-3', created_at: at('13:20'), template_name: 'Pressure test', field_values: { result: 'PASS', notes: 'Held 15 min at 80 psi.' } },
      { id: 'r-3', user_id: 'u-kim', job_id: 'job-5', created_at: at('11:50'), template_name: 'Daily log', field_values: { notes: 'Trench open; gas line set tomorrow.' } },
    ],
    pct_notes: [{ job_id: 'job-1', body: 'Rough-in 40% → 55%', created_at: at('15:36') }],
    subs: [{ person_name: "Sam's Plumbing LLC", job_id: 'job-1', job_label: '1041 · Cedar Bend Apartments', stage_name: 'Rough-in', picked_start: todayYmd, picked_end: todayYmd }],
    outcomes: { 'u-ana': 'water heater in, tested, customer paid at the door' },
  }
}

/** The Payment forecast digest's payload (v2.4164): the same five bills as Money waiting, with one promise on the books. */
export function sampleForecastPayload(todayYmd: string): ForecastEmailPayload {
  const mw = sampleMoneyWaitingPayload(todayYmd)
  const plus = (n: number) => {
    const d = new Date(`${todayYmd}T12:00:00Z`)
    d.setUTCDate(d.getUTCDate() + n)
    return d.toISOString().slice(0, 10)
  }
  return {
    generated_at: mw.generated_at,
    today: todayYmd,
    rows: mw.rows.map(({ job_address: _address, ...r }) => r),
    pay_speeds: mw.pay_speeds,
    promises: { 'job-2': { promisedYmd: plus(3), markedByName: 'Wendi' } },
  }
}

/** The Billed awaiting payment report's payload (lift 4): the same five bills, aged, with the customers' contact lines and the 30–90 / 90+ chips. */
export function sampleBilledReportPayload(todayYmd: string): BilledReportPayload {
  const mw = sampleMoneyWaitingPayload(todayYmd)
  const contacts: Record<string, { email: string | null; phone: string | null }> = {
    'gc-sample': { email: SAMPLE_GC.email, phone: '(512) 555-0199' },
    'home-sample': { email: SAMPLE_HOMEOWNER.email, phone: SAMPLE_HOMEOWNER.phone },
    structura: { email: 'ap@structura.example.com', phone: null },
    hunter: { email: null, phone: '(512) 555-0142' },
  }
  const rows: BilledReportRow[] = mw.rows.map((r) => {
    const days = Math.round((new Date(`${todayYmd}T12:00:00Z`).getTime() - new Date(r.billed_at ?? '').getTime()) / 86_400_000)
    return {
      job_id: r.job_id,
      display_number: r.display_number,
      job_name: r.job_name,
      job_address: r.job_address,
      customer_id: r.customer_id,
      customer_name: r.customer_name,
      customer_email: contacts[r.customer_id ?? '']?.email ?? null,
      customer_phone: contacts[r.customer_id ?? '']?.phone ?? null,
      detail: r.job_name?.includes('rough-in') ? 'Draw 2 of 3' : 'Final',
      ref_date: calendarYmdInAppTzFromIso(r.billed_at ?? ''),
      ref_is_estimate: false,
      days_past: days,
      remaining: r.remaining,
      aging_bucket: days >= 90 ? '90' : days >= 30 ? '30_90' : null,
    }
  })
  const b3090 = rows.filter((r) => r.aging_bucket === '30_90')
  const b90 = rows.filter((r) => r.aging_bucket === '90')
  return {
    generated_at: mw.generated_at,
    totals: {
      row_count: rows.length,
      grand_total: rows.reduce((s, r) => s + r.remaining, 0),
      count30_90: b3090.length,
      sum30_90: b3090.reduce((s, r) => s + r.remaining, 0),
      count90: b90.length,
      sum90: b90.reduce((s, r) => s + r.remaining, 0),
    },
    rows,
  }
}

/** The Monday of the week that holds `ymd` (YYYY-MM-DD). */
export function mondayOf(ymd: string): string {
  const d = new Date(`${ymd}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7))
  return d.toISOString().slice(0, 10)
}

/** The Weekly money movement payload (lift 5): a week where two jobs made money, one lost, one has no report yet, plus the office's overhead. */
export function sampleWeeklyMoneyPayload(weekMonday: string): WeeklyMoneyPayload {
  const end = new Date(`${weekMonday}T12:00:00Z`)
  end.setUTCDate(end.getUTCDate() + 6)
  const job = (id: string, hcp: string, name: string, address: string, revenue: number | null, costs: Partial<Record<'labor_cost' | 'sub_cost' | 'mercury_cost' | 'supply_cost' | 'tally_cost' | 'other_cost' | 'payments_in', number>>, pctStart: number | null, pctEnd: number | null, source: string | null = 'report') => ({
    job_id: id,
    hcp_number: hcp,
    click_number: null,
    job_name: name,
    job_address: address,
    revenue,
    labor_cost: costs.labor_cost ?? 0,
    sub_cost: costs.sub_cost ?? 0,
    mercury_cost: costs.mercury_cost ?? 0,
    supply_cost: costs.supply_cost ?? 0,
    tally_cost: costs.tally_cost ?? 0,
    other_cost: costs.other_cost ?? 0,
    payments_in: costs.payments_in ?? 0,
    pct_start: pctStart,
    pct_end: pctEnd,
    pct_end_source: source,
  })
  return {
    week_monday: weekMonday,
    week_end: end.toISOString().slice(0, 10),
    jobs: [
      job('job-1', '1041', 'Cedar Bend Apartments — rough-in', '2530 Cedar Bend Dr, Kyle, TX 78640', 86_000, { labor_cost: 6_420, supply_cost: 3_180, payments_in: 26_000 }, 40, 55),
      job('job-3', '1054', 'Water heater replacement', SAMPLE_HOMEOWNER.address, 4_380, { labor_cost: 640, supply_cost: 1_210, payments_in: 4_380 }, 0, 100),
      job('job-5', '1057', 'Hunter Homes — gas line', '77 Hunter Loop, Kyle, TX 78640', 18_900, { labor_cost: 2_980, sub_cost: 1_500, mercury_cost: 420 }, 20, 25),
      job('job-4', '1039', 'Structura — pretest', '901 Structura Way, Buda, TX 78610', 12_640, { labor_cost: 380 }, 60, null, null),
    ],
    overhead: { office_labor_hours: 38, office_labor_cost: 1_520, office_job_charges: 210, bid_labor_hours: 11, bid_labor_cost: 495 },
  }
}

/**
 * The Monday money email (O7b) on sample GC jobs: one bill late past a promise with one missed before it, one expected,
 * one waiting on the architect, and last week's send and certificate.
 */
export function sampleGcMoneyMondayPayload(todayYmd: string): GcMoneyMondayPayload {
  const monday = mondayOf(todayYmd)
  const day = (n: number) => {
    const d = new Date(`${monday}T12:00:00Z`)
    d.setUTCDate(d.getUTCDate() + n)
    return d.toISOString().slice(0, 10)
  }
  const bill = { projectId: 'gc-sample', architect: 'Lake Flato Architects', final: false, missed: 0, promised: false, waitingOnArchitect: false }
  return {
    today: monday,
    weekFrom: day(-7),
    weekTo: day(-1),
    bills: [
      { ...bill, project: 'Stone Oak Medical', customer: 'Stone Oak Partners', number: 2, sentOn: day(-40), certified: 25_000, certifiedOn: day(-38), open: 15_000, dueOn: day(-6), promised: true, daysLate: 6, missed: 1 },
      { ...bill, project: 'Fair Oaks Clinic', customer: 'Fair Oaks Health', number: 1, sentOn: day(-30), certified: 36_000, certifiedOn: day(-4), open: 36_000, dueOn: day(41), daysLate: 0 },
      { ...bill, project: 'Stone Oak Medical', customer: 'Stone Oak Partners', number: 3, sentOn: day(-5), certified: null, certifiedOn: null, open: 11_000, dueOn: day(15), daysLate: 0, waitingOnArchitect: true },
    ],
    sent: [{ project: 'Stone Oak Medical', number: 3, final: false, due: 11_000, sentOn: day(-5) }],
    certified: [{ project: 'Fair Oaks Clinic', number: 1, final: false, certified: 36_000, certifiedOn: day(-4) }],
  }
}

/** The Weekly movement payload (lift 6): the sample company's stage moves in one week, one sent back. */
export function sampleWeeklyMovementPayload(weekMonday: string): WeeklyMovementPayload {
  const e = (event: string, job: string, display: string, address: string, weekday: string, mover: string, revenue: number, extra: Partial<WeeklyMovementPayloadEntry> = {}): WeeklyMovementPayloadEntry => ({ event_id: event, job_id: job, display, address, weekday, mover_name: mover, revenue, ...extra })
  const working = [e('ev-1', 'job-5', '1057 · Hunter Homes — gas line', '77 Hunter Loop, Kyle, TX 78640', 'Mon', 'Wendi Douglas', 18_900), e('ev-2', 'job-6', '1060 · Structura — phase 2', '901 Structura Way, Buda, TX 78610', 'Wed', 'Wendi Douglas', 42_500)]
  const ready = [e('ev-3', 'job-3', '1054 · Water heater replacement', SAMPLE_HOMEOWNER.address, 'Tue', 'Ana Lead', 4_380)]
  const billed = [e('ev-4', 'job-1', '1041 · Cedar Bend Apartments — rough-in', '2530 Cedar Bend Dr, Kyle, TX 78640', 'Thu', 'Malachi Sample', 86_000), e('ev-5', 'job-3', '1054 · Water heater replacement', SAMPLE_HOMEOWNER.address, 'Thu', 'Malachi Sample', 4_380)]
  const sent_backs = [e('ev-6', 'job-4', '1039 · Structura — pretest', '901 Structura Way, Buda, TX 78610', 'Fri', 'Wendi Douglas', 12_640, { from_label: 'Ready to bill', to_label: 'Working' })]
  const sections = [
    { to_status: 'working', label: 'Working', entries: working },
    { to_status: 'ready_to_bill', label: 'Ready to bill', entries: ready },
    { to_status: 'billed', label: 'Billed', entries: billed },
  ].map((s) => ({ ...s, job_count: new Set(s.entries.map((x) => x.job_id)).size, total: s.entries.reduce((t, x) => t + x.revenue, 0) }))
  const all = [...working, ...ready, ...billed, ...sent_backs]
  return { generated_at: `${weekMonday}T12:00:00Z`, week_monday: weekMonday, sections, send_backs: sent_backs, move_count: all.length, job_count: new Set(all.map((x) => x.job_id)).size }
}

/** The Paid job payload (lift 7): the sample water heater job, billed and paid in full, with its line items, the invoice, the crew's labor, the parts and the timeline. */
export function samplePaidJobPayload(todayYmd: string): PaidJobEmailPayload {
  const daysAgo = (n: number) => {
    const d = new Date(`${todayYmd}T12:00:00Z`)
    d.setUTCDate(d.getUTCDate() - n)
    return d.toISOString().slice(0, 10)
  }
  const month = todayYmd.slice(0, 7)
  return {
    job: { id: 'job-3', display_number: '1054', job_name: 'Water heater replacement', job_address: SAMPLE_HOMEOWNER.address, customer_name: SAMPLE_HOMEOWNER.name, status: 'paid', service_type_name: 'Plumbing' },
    line_items: [
      { name: '50-gal gas water heater', count: 1, unit_price: 2_980, amount: 2_980, description: 'Bradford White, 40k BTU', invoice_status: 'paid' },
      { name: 'Expansion tank', count: 1, unit_price: 320, amount: 320, description: null, invoice_status: 'paid' },
      { name: 'Labor', count: 4, unit_price: 270, amount: 1_080, description: 'Two techs, half a day', invoice_status: 'paid' },
    ],
    invoices: [{ status: 'paid', amount: 4_380, paid: 4_380, sent_at: daysAgo(3), sent_day_offset: 0, channel: 'stripe', detail: 'Water heater replacement · 1054', bill_to: null }],
    charge_events: [
      { source: 'supply_house', date_key: daysAgo(5), amount: 1_210, label: 'Ferguson · heater + tank' },
      { source: 'team_labor', date_key: daysAgo(4), amount: 640, label: 'Ana Lead, Max Helper · 8.0 h' },
    ],
    money: { revenue: 4_380, payments: [{ amount: 4_380, payment_date: daysAgo(1), method: 'stripe' }], payments_total: 4_380, last_payment: { amount: 4_380, at: `${daysAgo(1)}T15:12:00Z` } },
    costs: { team_labor: { total: 640, people: [{ name: 'Ana Lead', hours: 4, wage: 42, cost: 168 }, { name: 'Max Helper', hours: 4, wage: 28, cost: 112 }] }, sub_labor_total: 0, parts_total: 1_210, supply_house_total: 1_210, tally_total: 0, other_total: 0 },
    profit: 4_380 - 640 - 1_210,
    timeline: [{ month, labor_cost: 640, parts_cost: 1_210, payments: 4_380 }],
    dates: { job_start: daysAgo(4), last_work: daysAgo(4), paid_at: `${daysAgo(1)}T15:12:00Z` },
  }
}

/** The Ready to bill payload (lift 7): the gas-line job moved from Working by its lead, one draft bill waiting. */
export function sampleReadyToBillPayload(todayYmd: string): ReadyToBillPayload {
  return {
    job: { id: 'job-5', display_number: '1057', job_name: 'Hunter Homes — gas line', job_address: '77 Hunter Loop, Kyle, TX 78640', customer_name: 'Hunter Homes', status: 'ready_to_bill', service_type_name: 'Plumbing', revenue: 18_900 },
    billing: { rtb_draft_total: 18_900, rtb_draft_count: 1, payments_total: 0 },
    moved_by: { name: 'Kim Tech', at: `${todayYmd}T21:05:00Z`, from_status: 'working' },
  }
}

/** The Dispatch schedule rows (lift 8): three blocks on the sample day — a two-person rough-in, a service call, an afternoon inspection. */
export function sampleScheduleDayBlocks(todayYmd: string): ScheduleDayBlockRow[] {
  const row = (id: string, assignee_user_id: string, assignee_name: string, time_start: string, time_end: string, job: { id: string; hcp: string; name: string; address: string }, note: string | null): ScheduleDayBlockRow => ({
    id, job_id: job.id, assignee_user_id, work_date: todayYmd, time_start, time_end, note, assignee_name, job_hcp_number: job.hcp, job_name: job.name, job_address: job.address,
  })
  const roughIn = { id: 'job-5', hcp: '1057', name: 'Hunter Homes — gas line', address: '77 Hunter Loop\nKyle, TX 78640' }
  const service = { id: 'job-3', hcp: '1054', name: 'Water heater replacement', address: SAMPLE_HOMEOWNER.address }
  return [
    row('blk-1', 'u-ana', 'Ana Lead', '07:00:00', '12:00:00', roughIn, 'Meet the GC super at the gate'),
    row('blk-2', 'u-max', 'Max Helper', '07:00:00', '12:00:00', roughIn, null),
    row('blk-3', 'u-kim', 'Kim Tech', '08:30:00', '11:00:00', service, 'Customer home after 8:30'),
    row('blk-4', 'u-ana', 'Ana Lead', '13:00:00', '15:00:00', roughIn, 'City inspection 1–3'),
  ]
}

/** The Schedule share rows (lift 9): today's four blocks plus two more days — the rough-in runs on, Kim takes a repipe estimate. The RPC orders by person, date, start. */
export function sampleScheduleShareBlocks(todayYmd: string): { dates: string[]; blocks: ShareBlockRow[] } {
  const plus = (n: number) => {
    const d = new Date(`${todayYmd}T12:00:00Z`)
    d.setUTCDate(d.getUTCDate() + n)
    return d.toISOString().slice(0, 10)
  }
  const dates = [todayYmd, plus(1), plus(2)]
  const day1 = sampleScheduleDayBlocks(todayYmd)
  const roughIn = day1[0]!
  const more: ShareBlockRow[] = [
    { ...roughIn, id: 'blk-5', work_date: plus(1), time_start: '07:00:00', time_end: '15:00:00', note: null },
    { ...roughIn, id: 'blk-6', work_date: plus(2), time_start: '07:00:00', time_end: '15:00:00', note: 'Pressure test before backfill' },
    { ...day1[1]!, id: 'blk-7', work_date: plus(1), time_start: '07:00:00', time_end: '15:00:00', note: null },
    { ...day1[2]!, id: 'blk-8', work_date: plus(2), time_start: '09:00:00', time_end: '10:30:00', job_id: 'job-6', job_hcp_number: '1058', job_name: 'Repipe estimate', job_address: '410 Elm Grove\nBuda, TX 78610', note: 'Estimate only — bring the camera' },
  ]
  const byPerson = (r: ShareBlockRow) => r.assignee_name
  const blocks = [...day1, ...more].sort((a, b) => byPerson(a).localeCompare(byPerson(b)) || a.work_date.localeCompare(b.work_date) || a.time_start.localeCompare(b.time_start))
  return { dates, blocks }
}

/** The Job activity report payload (lift 10): the Sun–Sat week holding today, two jobs — the water heater with clock time and a filed report, the gas line with clock time only. */
export function sampleRecurringJobReportPayload(todayYmd: string): RecurringJobReportPayload {
  const week = sunSatWeekOf(todayYmd)
  const clock = (displayName: string, hours: number, notes: string[], wage: number) => ({ displayName, hours, notes, costDollars: Math.round(hours * wage * 100) / 100 })
  return {
    reportingDate: week.start,
    weekEndYmd: week.end,
    periodKind: 'weekly',
    windowStartUtc: `${week.start}T05:00:00Z`,
    windowEndUtc: `${week.end}T05:00:00Z`,
    jobs: [
      {
        job: { id: 'job-3', job_name: 'Water heater replacement', hcp_number: '1054', job_address: SAMPLE_HOMEOWNER.address },
        byUserId: new Map([
          ['u-ana', clock('Ana Lead', 4, ['Old unit drained and out by 9'], 42)],
          ['u-max', clock('Max Helper', 4, [], 28)],
        ]),
        reports: [
          {
            id: 'rep-1', created_at: `${todayYmd}T17:40:00Z`, created_by_user_id: 'u-ana', creatorName: 'Ana Lead', template_name: 'Job completion',
            fieldPairs: [
              { label: 'Work done', htmlValue: 'Replaced 50-gal gas heater, new expansion tank, flex lines.' },
              { label: 'Follow-up', htmlValue: 'None — customer walked through.' },
            ],
          },
        ],
      },
      {
        job: { id: 'job-5', job_name: 'Hunter Homes — gas line', hcp_number: '1057', job_address: '77 Hunter Loop\nKyle, TX 78640' },
        byUserId: new Map([
          ['u-ana', clock('Ana Lead', 18.5, ['Trench open Mon', 'Pressure test held 24 h'], 42)],
          ['u-max', clock('Max Helper', 18.5, [], 28)],
        ]),
        reports: [],
      },
    ],
  }
}

/** The Field report content (lift 11): Ana's Job completion report on the water heater job, filed this afternoon, signature captured. */
export function sampleFieldReportContent(todayYmd: string): ReportContent {
  return {
    templateName: 'Job completion',
    authorName: 'Ana Lead',
    jobDisplay: '1054 · Water heater replacement',
    createdAt: `${todayYmd}T17:40:00Z`,
    fieldValues: {
      'Work done': 'Replaced 50-gal gas heater, new expansion tank, flex lines.\nOld unit hauled off.',
      'Parts used': ['Bradford White 50-gal', 'Expansion tank', '2× flex lines'],
      'Follow-up': 'None — customer walked through.',
      'Customer signature': 'data:image/png;base64,iVBORw0KGgo=',
      'Photos': '',
    },
  }
}

/** The Check returned notice (lift 12): Hunter Homes' $13,680 draw on the gas-line job, posted three days ago, sent back for insufficient funds. */
export function sampleBankReturnInput(todayYmd: string, appOrigin: string): BankReturnNoticeInput {
  const d = new Date(`${todayYmd}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() - 3)
  return {
    counterparty: 'Hunter Homes',
    amount: 13_680,
    reason: 'Insufficient funds',
    postedYmd: d.toISOString().slice(0, 10),
    jobs: [{ jobId: 'job-5', jobLabel: 'J1057 Hunter Homes – gas line', amount: 13_680 }],
    appOrigin,
  }
}

/** The roster audit diff (lift 13): one CountTooling seat nobody links to, one PT person whose email is already on CT — two items over 14 people and 12 accounts. */
export function sampleCtRosterDiff(): { diff: CtRosterDiff; ptCount: number; ctCount: number } {
  const diff: CtRosterDiff = {
    onlyInCt: [{ ct_user_id: 'ct-9f2', email: 'oldsub@example.com', is_digital_twin: false, is_admin: false, active: false }],
    linkedButGone: [],
    twinFlagMismatch: [],
    activeMismatch: [],
    emailChanged: [],
    backfillCandidates: [
      {
        pt: { id: 'u-kim', email: 'kim@example.com', name: 'Kim Tech', archived_at: null, is_digital_twin: false, counttooling_user_id: null },
        ct: { ct_user_id: 'ct-a41', email: 'kim@example.com', is_digital_twin: false, is_admin: false, active: true },
      },
    ],
    clean: false,
  }
  return { diff, ptCount: 14, ctCount: 12 }
}

export function buildTeamSampleEmail(id: TeamSampleEmailId, ctx: TeamSampleContext): BuiltTeamEmail {
  const origin = ctx.origin
  switch (id) {
    case 'paid_job': {
      const p = samplePaidJobPayload(ctx.todayYmd)
      return { subject: paidJobEmailSubject(p), html: renderPaidJobEmailDetailed(p), text: paidJobEmailText(p) }
    }
    case 'schedule_day': {
      return buildScheduleEmail({ workDateYmd: ctx.todayYmd, blocks: sampleScheduleDayBlocks(ctx.todayYmd) })
    }
    case 'schedule_share': {
      return buildShareEmail(sampleScheduleShareBlocks(ctx.todayYmd))
    }
    case 'recurring_job_report': {
      const p = sampleRecurringJobReportPayload(ctx.todayYmd)
      return { subject: recurringJobReportEmailSubject(p), html: buildRecurringJobReportHtml(p), text: buildRecurringJobReportTextFallback(p, false) }
    }
    case 'report_email': {
      return buildReportEmail(sampleFieldReportContent(ctx.todayYmd))
    }
    case 'bank_return': {
      return buildBankReturnNoticeEmail(sampleBankReturnInput(ctx.todayYmd, origin))
    }
    case 'ct_roster_audit': {
      const { diff, ptCount, ctCount } = sampleCtRosterDiff()
      // The function sends HTML only; the text pane shows the same words.
      const { subject, html } = renderCtRosterAuditEmail(diff, ptCount, ctCount)
      return { subject, html, text: `${subject}\n\n${ptCount} ClickTooling people · ${ctCount} CountTooling accounts.\n(This email is sent as HTML only.)` }
    }
    case 'ready_to_bill': {
      const p = sampleReadyToBillPayload(ctx.todayYmd)
      return { subject: readyToBillSubject(p), html: renderReadyToBillDetailed(p), text: readyToBillText(p) }
    }
    case 'weekly_movement': {
      const monday = mondayOf(ctx.todayYmd)
      const p = sampleWeeklyMovementPayload(monday)
      const week = weekLabelFromMonday(monday)
      return { subject: weeklyMovementSubject(week), html: renderWeeklyMovementHtml(p, week, ctx.sender?.name || undefined), text: renderWeeklyMovementText(p, week) }
    }
    case 'weekly_money': {
      const monday = mondayOf(ctx.todayYmd)
      const p = sampleWeeklyMoneyPayload(monday)
      const week = weekLabelFromMonday(monday)
      return { subject: weeklyMoneySubject(week), html: renderWeeklyMoneyHtml(p, week, ctx.sender?.name || undefined), text: renderWeeklyMoneyText(p, week) }
    }
    case 'gc_office_notice': {
      // Bill day on the sample job, with one trade still owing its unconditional waiver.
      const billDay = `${ctx.todayYmd.slice(0, 7)}-25`
      return buildOfficeNoticeEmail(
        {
          kind: 'bill_day',
          projectId: 'sample',
          project: 'Sample Retail Shell',
          billingJobId: null,
          billDay,
          number: 4,
          waiversOwed: [{ company: 'Sample Concrete', draws: [2], final: false }],
          to: { userId: 'sample', name: ctx.sender?.name ?? 'The project manager' },
        },
        billTheCustomerUrl(origin, 'sample'),
        null,
      )
    }
    case 'gc_money_monday': {
      const p = sampleGcMoneyMondayPayload(ctx.todayYmd)
      const moneyUrl = `${origin}/gc?view=money`
      return { subject: gcMoneyMondaySubject(p), html: renderGcMoneyMondayHtml(p, moneyUrl, ctx.sender?.name || undefined), text: renderGcMoneyMondayText(p, moneyUrl) }
    }
    case 'billed_awaiting': {
      const p = sampleBilledReportPayload(ctx.todayYmd)
      return { subject: billedReportEmailSubject(p), html: renderBilledReportEmail(p, origin, ctx.sender?.name || undefined), text: billedReportEmailText(p, origin) }
    }
    case 'payment_forecast': {
      const p = sampleForecastPayload(ctx.todayYmd)
      return { subject: paymentForecastEmailSubject(p), html: renderPaymentForecastEmail(p, origin, ctx.sender?.name || undefined), text: paymentForecastEmailText(p, origin) }
    }
    case 'crew_day': {
      const view = buildCrewDayEmailView(sampleCrewDayPayload(ctx.todayYmd), new Date(`${ctx.todayYmd}T16:30:00-05:00`).getTime())
      return { subject: crewDayEmailSubject(view), html: renderCrewDayEmail(view, ctx.sender?.name || undefined), text: crewDayEmailText(view) }
    }
    case 'money_waiting': {
      const p = sampleMoneyWaitingPayload(ctx.todayYmd)
      return { subject: moneyWaitingEmailSubject(p), html: renderMoneyWaitingEmail(p, origin, ctx.sender?.name || undefined), text: moneyWaitingEmailText(p) }
    }
    case 'signed_agreement_staff':
      return buildSignedAgreementEmail({
        kind: 'bid',
        estimateNumber: 412,
        title: 'Cedar Bend Apartments',
        projectAddress: '2530 Cedar Bend Dr, Kyle, TX 78640',
        customerName: SAMPLE_GC.company,
        signerName: SAMPLE_GC.contact,
        optionName: 'To Plans',
        totalCents: 5_634_300,
        signedAtLabel: `${ctx.dateLabel} · 9:12 AM`,
        origin,
        job: null,
        autoCreateOn: false,
      })
    case 'estimate_accepted_staff':
      return buildSignedAgreementEmail({
        kind: 'estimate',
        estimateNumber: 0,
        title: 'Water heater replacement',
        projectAddress: SAMPLE_HOMEOWNER.address,
        customerName: SAMPLE_HOMEOWNER.name,
        signerName: SAMPLE_HOMEOWNER.name,
        optionName: null,
        totalCents: 438_000,
        signedAtLabel: `${ctx.dateLabel} · 4:12 PM`,
        origin,
        job: { id: 'sample', hcpNumber: '1054' },
        autoCreateOn: true,
      })
    case 'gc_word_ask':
      return wordAskEmail({
        ownerName: 'Robert',
        askedByName: ctx.sender?.name ?? 'The office',
        gcs: SAMPLE_WORD_ASK_GCS,
        url: `${origin}/word/sample`,
        expiresLabel: 'in 8 days',
      })
    case 'bid_room_activity_staff':
      return bidRoomActivityStaffEmail({ projectName: 'Cedar Bend Apartments', what: `signed the proposal (${SAMPLE_GC.contact}, ${SAMPLE_GC.company})`, origin })
    case 'portal_request_staff':
      return portalRequestStaffEmail({
        kindLabel: 'request',
        customerName: SAMPLE_HOMEOWNER.name,
        lines: [
          `${SAMPLE_HOMEOWNER.name} sent a request from their portal.`,
          '',
          'What they wrote: The water heater is making a knocking sound again — can someone come by this week?',
          'Best days & times: Thursday or Friday, after 2',
          `Phone: ${SAMPLE_HOMEOWNER.phone}`,
          'Linked to one of their jobs (see the dispatch item).',
          '',
          'The request is in the dispatch inbox in ClickTooling.',
        ],
      })
    case 'contract_for_signature': {
      const m = buildSampleContractEmail(ctx)
      return { subject: m.subject, html: m.html, text: m.text }
    }
    case 'invitation':
      return renderTemplateEmail(templateFor(ctx, 'invitation'), {
        name: ctx.recipient.name,
        email: ctx.recipient.email,
        role: ctx.recipient.role,
        link: `${origin}/accept-invite?token=sample`,
      })
    case 'sign_in':
      return renderTemplateEmail(templateFor(ctx, 'sign_in'), {
        name: ctx.recipient.name,
        email: ctx.recipient.email,
        link: `${origin}/auth/sign-in?token=sample`,
      })
    case 'workflow_notifications':
      return renderTemplateEmail(templateFor(ctx, 'stage_assigned_started'), {
        name: ctx.recipient.name,
        email: ctx.recipient.email,
        project_name: 'Water heater replacement',
        stage_name: 'Rough-in',
        assigned_to_name: ctx.sender?.name ?? 'The office',
        workflow_link: `${origin}/projects/sample`,
      })
    case 'task_reminder_fallback': {
      const text = `Reminder: Pull the permit for ${SAMPLE_HOMEOWNER.name} — due today.\n\nOpen your checklist: ${origin}/checklist`
      return { subject: 'Task reminder', text, html: escapeEmailHtml(text).replace(/\n/g, '<br>') }
    }
    case 'lien_desk_summary': {
      const p = sampleLienStatusPayload(ctx.todayYmd)
      const o = { appUrl: origin, senderName: ctx.sender?.name ?? 'The office', note: '', readerIsLeader: ctx.recipient.role === 'master_technician' }
      return { subject: lienStatusSubject(p), html: lienStatusEmailHtml(p, o), text: lienStatusEmailText(p, o) }
    }
    case 'test_email': {
      const text = `This is a test from Settings → Email templates.\n\nIf you can read this, Resend delivered it and the From line is right.`
      return { subject: 'Test — whatever the tester typed', text, html: text.replace(/\n/g, '<br>') }
    }
  }
}
