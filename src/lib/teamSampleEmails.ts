/**
 * The sample team emails What the team sees renders in the browser (punch list #60, v2.4142):
 * the same builders the edge functions run, fed the sample company — and, for the four
 * template-driven emails, the live `email_templates` rows with sample variables, so an edit
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
      ref_date: (r.billed_at ?? '').slice(0, 10),
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

export function buildTeamSampleEmail(id: TeamSampleEmailId, ctx: TeamSampleContext): BuiltTeamEmail {
  const origin = ctx.origin
  switch (id) {
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
    case 'test_email': {
      const text = `This is a test from Settings → Email templates.\n\nIf you can read this, Resend delivered it and the From line is right.`
      return { subject: 'Test — whatever the tester typed', text, html: text.replace(/\n/g, '<br>') }
    }
  }
}
