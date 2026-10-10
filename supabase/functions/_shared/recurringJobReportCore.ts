import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

import {
  REPORT_FIELD_LABEL_JOB_COMPLETION,
  REPORT_FIELD_LABEL_LEGACY_WHO,
  REPORT_SIGNATURE_ON_FILE,
  displayLabelForFieldKey,
  formatReportFieldValueForRead,
  isReportSignatureImageDataUrl,
} from './recurringJobReportFieldEmail.ts'

// The email itself (payload types + renderers) is `./recurringJobReportEmail.ts` (v2.4179); re-exported so importers keep their path.
import { escapeHtml, type JobRow, type RecurringJobReportClockRow, type RecurringJobReportPayload, type ReportingPeriodKind } from './recurringJobReportEmail.ts'
export { buildRecurringJobReportHtml, buildRecurringJobReportTextFallback, recurringJobReportEmailSubject } from './recurringJobReportEmail.ts'
export type { JobRow, RecurringJobReportClockRow, RecurringJobReportPayload, ReportingPeriodKind } from './recurringJobReportEmail.ts'
import { addDaysToYmd } from './recurringJobReportTimezone.ts'
import { APP_CALENDAR_TZ } from './appTimeZone.ts'
import { EMAIL_FROM } from './emailFrom.ts'
import { logEmailSendBestEffort } from './logEmailSend.ts'

export type ActivityScopeMode =
  | 'calendar_yesterday'
  | 'calendar_today'
  | 'calendar_week'
  | 'calendar_last_week'

/** 'my_team' (the people the recipient led) went with the Team leads list in v2.5088. */
export type CrewFilterMode = 'all_users'

export interface ReportingWindowUtc {
  windowStartUtc: string
  windowEndUtc: string
  reportingDate: string
  periodKind?: ReportingPeriodKind
}

export interface SessionRow {
  id: string
  user_id: string
  job_ledger_id: string | null
  clocked_in_at: string
  clocked_out_at: string | null
  notes: string
}

export interface ReportRow {
  id: string
  job_ledger_id: string | null
  created_at: string
  created_by_user_id: string
  template_id: string
  field_values: Record<string, unknown>
  report_templates: { name: string } | null
}

function reportingWindowUtcFromWeeklyRow(row: {
  window_start_utc: string
  window_end_utc: string
  reporting_date: string
}): ReportingWindowUtc {
  return {
    windowStartUtc: row.window_start_utc,
    windowEndUtc: row.window_end_utc,
    reportingDate: row.reporting_date,
    periodKind: 'weekly',
  }
}

/** Chunks `.in(...)` queries to avoid URL / PostgREST limits. */
const ID_CHUNK = 100

function hourlyWageToNumber(raw: unknown): number | null {
  if (raw == null) return null
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : Number.NaN
  if (!Number.isFinite(n) || n < 0) return null
  return n
}

export async function getReportingWindowForPreset(
  admin: SupabaseClient,
  timezone: string,
  preset: string,
  anchorDateLocal?: string | null,
): Promise<ReportingWindowUtc | null> {
  const { data, error } = await admin.rpc('reporting_window_for_recurring_job_email', {
    p_timezone: timezone,
    p_preset: preset,
    p_anchor_date: anchorDateLocal?.trim() || null,
  })
  if (error || data == null) return null
  const rows = Array.isArray(data) ? data : [data]
  const row = rows[0] as {
    window_start_utc: string
    window_end_utc: string
    reporting_date: string
  } | undefined
  if (!row) return null
  return {
    windowStartUtc: row.window_start_utc,
    windowEndUtc: row.window_end_utc,
    reportingDate: row.reporting_date,
    periodKind: 'daily',
  }
}

/** Per-recipient activity window from `activity_scope`; `anchorDateLocal` = civil today in schedule TZ (`YYYY-MM-DD`). */
export async function getReportingWindowForActivityScope(
  admin: SupabaseClient,
  params: {
    timezone: string
    activityScope: ActivityScopeMode
    /** Civil “today” in `timezone`; required for deterministic `calendar_today` / weekly anchors; may be omitted only if callers pass via RPC-internal now for yesterday. */
    anchorDateLocal: string | null
  },
): Promise<ReportingWindowUtc | null> {
  const tz = params.timezone.trim() || APP_CALENDAR_TZ
  const anchor = params.anchorDateLocal?.trim() || null

  if (params.activityScope === 'calendar_last_week') {
    const { data, error } = await admin.rpc('reporting_window_calendar_week_prior_to_anchor', {
      p_timezone: tz,
      p_anchor_date: anchor,
    })
    if (error || data == null) return null
    const rows = Array.isArray(data) ? data : [data]
    const row = rows[0] as {
      window_start_utc: string
      window_end_utc: string
      reporting_date: string
    } | undefined
    return row ? reportingWindowUtcFromWeeklyRow(row) : null
  }

  if (params.activityScope === 'calendar_week') {
    const { data, error } = await admin.rpc('reporting_window_calendar_week_containing_anchor', {
      p_timezone: tz,
      p_anchor_date: anchor,
    })
    if (error || data == null) return null
    const rows = Array.isArray(data) ? data : [data]
    const row = rows[0] as {
      window_start_utc: string
      window_end_utc: string
      reporting_date: string
    } | undefined
    return row ? reportingWindowUtcFromWeeklyRow(row) : null
  }

  if (params.activityScope === 'calendar_yesterday') {
    return getReportingWindowForPreset(admin, tz, 'calendar_yesterday', anchor)
  }

  if (params.activityScope === 'calendar_today') {
    const civil = anchor?.trim()
    if (!civil) return null
    const { data, error } = await admin.rpc('reporting_window_calendar_civil_day', {
      p_timezone: tz,
      p_civil_day: civil,
    })
    if (error || data == null) return null
    const rows = Array.isArray(data) ? data : [data]
    const row = rows[0] as {
      window_start_utc: string
      window_end_utc: string
      reporting_date: string
    } | undefined
    if (!row) return null
    return {
      windowStartUtc: row.window_start_utc,
      windowEndUtc: row.window_end_utc,
      reportingDate: row.reporting_date,
      periodKind: 'daily',
    }
  }

  return null
}

export async function buildRecurringJobReportPayload(
  admin: SupabaseClient,
  params: {
    scopeMasterUserId: string
    recipientUserId: string
    crewFilter: CrewFilterMode
    window: ReportingWindowUtc
    /** When true, resolve hourly wages from `users.name` ↔ `people_pay_config.person_name` for each clock row. */
    includeCosts?: boolean
  },
): Promise<RecurringJobReportPayload> {
  const { scopeMasterUserId, window, includeCosts = false } = params
  const ws = window.windowStartUtc
  const we = window.windowEndUtc
  const periodKind: ReportingPeriodKind = window.periodKind ?? 'daily'
  const weekEndYmd =
    periodKind === 'weekly' ? (addDaysToYmd(window.reportingDate, 6) ?? undefined) : undefined

  const payloadHead = (): Pick<
    RecurringJobReportPayload,
    'reportingDate' | 'weekEndYmd' | 'periodKind' | 'windowStartUtc' | 'windowEndUtc'
  > => ({
    reportingDate: window.reportingDate,
    weekEndYmd,
    periodKind,
    windowStartUtc: ws,
    windowEndUtc: we,
  })

  const { data: jlRows } = await admin
    .from('jobs_ledger')
    .select('id, job_name, hcp_number, master_user_id, job_address')
    .eq('master_user_id', scopeMasterUserId)

  const masterJobs = ((jlRows ?? []) as JobRow[]).map((row) => ({
    ...row,
    job_address: row.job_address ?? '',
  }))
  const masterIds = masterJobs.map((j) => j.id)
  if (masterIds.length === 0) {
    return { ...payloadHead(), jobs: [] }
  }

  const jobById = new Map(masterJobs.map((j) => [j.id, j]))

  const sessions: SessionRow[] = []
  for (let i = 0; i < masterIds.length; i += ID_CHUNK) {
    const chunk = masterIds.slice(i, i + ID_CHUNK)
    const q = admin
      .from('clock_sessions')
      .select('id, user_id, job_ledger_id, clocked_in_at, clocked_out_at, notes')
      .in('job_ledger_id', chunk)
      .not('job_ledger_id', 'is', null)
      .not('clocked_out_at', 'is', null)
      .lt('clocked_in_at', we)
      .gt('clocked_out_at', ws)
      .is('revoked_at', null)
      .is('rejected_at', null)
    const { data } = await q
    sessions.push(...((data ?? []) as SessionRow[]))
  }

  const reportsBare: Array<Omit<ReportRow, 'report_templates'>> = []
  for (let i = 0; i < masterIds.length; i += ID_CHUNK) {
    const chunk = masterIds.slice(i, i + ID_CHUNK)
    const q = admin
      .from('reports')
      .select('id, job_ledger_id, created_at, created_by_user_id, field_values, template_id')
      .in('job_ledger_id', chunk)
      .gte('created_at', ws)
      .lt('created_at', we)
      .order('created_at', { ascending: false })
    const { data } = await q
    reportsBare.push(...((data ?? []) as Array<Omit<ReportRow, 'report_templates'>>))
  }

  const jobIdsSet = new Set<string>()
  for (const s of sessions) {
    if (s.job_ledger_id) jobIdsSet.add(s.job_ledger_id)
  }
  for (const r of reportsBare) {
    if (r.job_ledger_id) jobIdsSet.add(r.job_ledger_id)
  }

  const jobIds = [...jobIdsSet].sort()

  const templateIds = [...new Set(reportsBare.map((r) => r.template_id))]
  let templateNames = new Map<string, string>()
  if (templateIds.length > 0) {
    const { data: tpl } = await admin.from('report_templates').select('id, name').in('id', templateIds)
    for (const t of tpl ?? []) {
      templateNames.set((t as { id: string }).id, ((t as { name: string }).name ?? '').trim())
    }
  }

  const reports: ReportRow[] = reportsBare.map((r) => ({
    ...r,
    report_templates: { name: templateNames.get(r.template_id) ?? 'Report' },
  }))

  const userIds = new Set<string>()
  for (const s of sessions) userIds.add(s.user_id)
  for (const r of reports) userIds.add(r.created_by_user_id)

  const names = new Map<string, string>()
  const payNameByUserId = new Map<string, string>()
  if (userIds.size > 0) {
    const { data: usersRows } = await admin
      .from('users')
      .select('id, name')
      .in('id', [...userIds])
    for (const u of usersRows ?? []) {
      const row = u as { id: string; name: string | null }
      const trimmed = (row.name ?? '').trim()
      names.set(row.id, trimmed || row.id)
      payNameByUserId.set(row.id, trimmed)
    }
  }

  const hourlyRateByUserId = new Map<string, number | null>()
  if (includeCosts && userIds.size > 0) {
    const uniquePayNames = [
      ...new Set(
        [...userIds].map((id) => payNameByUserId.get(id) ?? '').filter((pn) => pn.length > 0),
      ),
    ]
    const wageByPersonName = new Map<string, number | null>()
    for (let i = 0; i < uniquePayNames.length; i += ID_CHUNK) {
      const chunk = uniquePayNames.slice(i, i + ID_CHUNK)
      const { data: pcRows } = await admin
        .from('people_pay_config')
        .select('person_name, hourly_wage')
        .in('person_name', chunk)
      for (const pr of pcRows ?? []) {
        const p = pr as { person_name: string; hourly_wage: unknown }
        const pn = (p.person_name ?? '').trim()
        if (!pn) continue
        wageByPersonName.set(pn, hourlyWageToNumber(p.hourly_wage))
      }
    }
    for (const uid of userIds) {
      const pn = payNameByUserId.get(uid) ?? ''
      hourlyRateByUserId.set(uid, pn ? wageByPersonName.get(pn) ?? null : null)
    }
  }

  const payloadJobs: RecurringJobReportPayload['jobs'] = []

  for (const jid of jobIds) {
    const job = jobById.get(jid)
    if (!job) continue

    const byUserId = new Map<string, RecurringJobReportClockRow>()

    for (const s of sessions.filter((x) => x.job_ledger_id === jid)) {
      const nm = names.get(s.user_id) ?? s.user_id
      const inMs = new Date(s.clocked_in_at).getTime()
      const outMs = s.clocked_out_at ? new Date(s.clocked_out_at).getTime() : 0
      const hrs = Math.max(0, (outMs - inMs) / 3600000)
      const prev = byUserId.get(s.user_id)
      const notesTxt = (s.notes ?? '').trim()
      if (!prev) {
        byUserId.set(s.user_id, {
          displayName: nm,
          hours: hrs,
          notes: notesTxt ? [notesTxt] : [],
          costDollars: null,
        })
      } else {
        prev.hours += hrs
        if (notesTxt) prev.notes.push(notesTxt)
      }
    }

    if (!includeCosts) {
      for (const row of byUserId.values()) row.costDollars = null
    } else {
      for (const [uid, row] of byUserId) {
        const rate = hourlyRateByUserId.get(uid) ?? null
        row.costDollars =
          rate != null ? Math.round(row.hours * rate * 100) / 100 : null
      }
    }

    const jobReports = reports.filter((r) => r.job_ledger_id === jid)
    const reportBlocks = jobReports.map((r) => {
      const rawFv = (r.field_values ?? {}) as Record<string, string>
      const hasNewCompletion = Object.prototype.hasOwnProperty.call(rawFv, REPORT_FIELD_LABEL_JOB_COMPLETION)
      const fieldPairs: Array<{ label: string; htmlValue: string }> = []
      for (const [k, v] of Object.entries(rawFv)) {
        if (k === REPORT_FIELD_LABEL_LEGACY_WHO && hasNewCompletion) continue
        const str = v == null ? '' : String(v).trim()
        if (!str) continue
        const disp = displayLabelForFieldKey(k)
        if (isReportSignatureImageDataUrl(str)) {
          fieldPairs.push({ label: escapeHtml(disp), htmlValue: escapeHtml(REPORT_SIGNATURE_ON_FILE) })
          continue
        }
        const formatted = formatReportFieldValueForRead(k, str)
        fieldPairs.push({
          label: escapeHtml(disp),
          htmlValue: escapeHtml(formatted).replace(/\n/g, '<br/>'),
        })
      }
      return {
        id: r.id,
        created_at: r.created_at,
        created_by_user_id: r.created_by_user_id,
        creatorName: names.get(r.created_by_user_id) ?? r.created_by_user_id,
        template_name: (r.report_templates as { name?: string } | null)?.name ?? 'Report',
        fieldPairs,
      }
    })

    payloadJobs.push({ job, byUserId, reports: reportBlocks })
  }

  payloadJobs.sort((a, b) => {
    const ha = a.job.hcp_number ?? ''
    const hb = b.job.hcp_number ?? ''
    if (ha !== hb) return ha.localeCompare(hb, undefined, { numeric: true })
    return (a.job.job_name ?? '').localeCompare(b.job.job_name ?? '', undefined, {
      sensitivity: 'base',
    })
  })

  return {
    ...payloadHead(),
    jobs: payloadJobs,
  }
}

export async function sendResendHtmlEmail(opts: {
  to: string
  subject: string
  html: string
  textFallback: string
  resendApiKey: string
  /** EMAIL_CATALOG id — sends through this helper were invisible to email_send_log until v2.2656. */
  emailType?: string
  /** The sender mailbox — `COMPANY_EMAIL_FROM` for a customer-facing email (v2.4132); defaults to `EMAIL_FROM`. */
  from?: string
}): Promise<{ ok: boolean; error?: string; id?: string }> {
  const from = opts.from?.trim() || EMAIL_FROM
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${opts.resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [opts.to],
      subject: opts.subject,
      html: opts.html,
      text: opts.textFallback,
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    return {
      ok: false,
      error: typeof (err as { message?: string }).message === 'string'
        ? (err as { message: string }).message
        : `Resend HTTP ${res.status}`,
    }
  }
  const data = (await res.json()) as { id?: string }
  await logEmailSendBestEffort({
    resendEmailId: data.id ?? null,
    to: [opts.to],
    from,
    subject: opts.subject,
    emailType: opts.emailType ?? null,
  })
  return { ok: true, id: data.id }
}
