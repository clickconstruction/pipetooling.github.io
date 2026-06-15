import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

import {
  REPORT_FIELD_LABEL_JOB_COMPLETION,
  REPORT_FIELD_LABEL_LEGACY_WHO,
  REPORT_SIGNATURE_ON_FILE,
  displayLabelForFieldKey,
  formatReportFieldValueForRead,
  isReportSignatureImageDataUrl,
} from './recurringJobReportFieldEmail.ts'

import { addDaysToYmd } from './recurringJobReportTimezone.ts'
import { APP_CALENDAR_TZ } from './appTimeZone.ts'

export type ActivityScopeMode =
  | 'calendar_yesterday'
  | 'calendar_today'
  | 'calendar_week'
  | 'calendar_last_week'

export type CrewFilterMode = 'all_users' | 'my_team'

export type ReportingPeriodKind = 'daily' | 'weekly'

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

export interface JobRow {
  id: string
  job_name: string
  hcp_number: string
  job_address: string
}

export type RecurringJobReportClockRow = {
  displayName: string
  hours: number
  notes: string[]
  /** Wage × hours when `includeCosts` was true for the build; otherwise null. */
  costDollars: number | null
}

export interface RecurringJobReportPayload {
  reportingDate: string
  weekEndYmd?: string
  periodKind: ReportingPeriodKind
  windowStartUtc: string
  windowEndUtc: string
  jobs: Array<{
    job: JobRow
    byUserId: Map<string, RecurringJobReportClockRow>
    reports: Array<{
      id: string
      created_at: string
      created_by_user_id: string
      creatorName: string
      template_name: string
      fieldPairs: Array<{ label: string; htmlValue: string }>
    }>
  }>
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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

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

async function crewUserIdsForFilter(
  admin: SupabaseClient,
  recipientUserId: string,
  crewFilter: CrewFilterMode,
): Promise<string[] | null> {
  if (crewFilter === 'all_users') return null
  const { data } = await admin
    .from('team_leader_assignments')
    .select('member_user_id')
    .eq('leader_user_id', recipientUserId)
  const ids = new Set<string>([recipientUserId])
  for (const r of data ?? []) {
    ids.add((r as { member_user_id: string }).member_user_id)
  }
  return [...ids]
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
  const { scopeMasterUserId, recipientUserId, crewFilter, window, includeCosts = false } = params
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

  const crewIds = await crewUserIdsForFilter(admin, recipientUserId, crewFilter)
  const jobById = new Map(masterJobs.map((j) => [j.id, j]))

  const sessions: SessionRow[] = []
  for (let i = 0; i < masterIds.length; i += ID_CHUNK) {
    const chunk = masterIds.slice(i, i + ID_CHUNK)
    let q = admin
      .from('clock_sessions')
      .select('id, user_id, job_ledger_id, clocked_in_at, clocked_out_at, notes')
      .in('job_ledger_id', chunk)
      .not('job_ledger_id', 'is', null)
      .not('clocked_out_at', 'is', null)
      .lt('clocked_in_at', we)
      .gt('clocked_out_at', ws)
      .is('revoked_at', null)
      .is('rejected_at', null)
    if (crewIds && crewIds.length > 0) {
      q = q.in('user_id', crewIds)
    }
    const { data } = await q
    sessions.push(...((data ?? []) as SessionRow[]))
  }

  const reportsBare: Array<Omit<ReportRow, 'report_templates'>> = []
  for (let i = 0; i < masterIds.length; i += ID_CHUNK) {
    const chunk = masterIds.slice(i, i + ID_CHUNK)
    let q = admin
      .from('reports')
      .select('id, job_ledger_id, created_at, created_by_user_id, field_values, template_id')
      .in('job_ledger_id', chunk)
      .gte('created_at', ws)
      .lt('created_at', we)
      .order('created_at', { ascending: false })
    if (crewIds && crewIds.length > 0) {
      q = q.in('created_by_user_id', crewIds)
    }
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

export function recurringJobReportEmailSubject(payload: Pick<
  RecurringJobReportPayload,
  'reportingDate' | 'periodKind' | 'weekEndYmd'
>): string {
  if (payload.periodKind === 'weekly' && payload.weekEndYmd) {
    return `Job activity summary — week ${payload.reportingDate} to ${payload.weekEndYmd}`
  }
  return `Job activity summary — ${payload.reportingDate}`
}

export function buildRecurringJobReportHtml(
  payload: RecurringJobReportPayload,
  bannerNote?: string,
  includeCosts = false,
): string {
  const dateLabel =
    payload.periodKind === 'weekly' && payload.weekEndYmd
      ? `${escapeHtml(payload.reportingDate)} – ${escapeHtml(payload.weekEndYmd)}`
      : escapeHtml(payload.reportingDate)
  const headline =
    payload.periodKind === 'weekly' ? 'Weekly summary (Sun–Sat)' : 'Daily summary'
  let body = `
<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:14px;line-height:1.45;color:#111827;background:#fafafa;padding:24px;">
  ${bannerNote ? `<p style="margin:0 0 12px;color:#92400e;background:#fef3c7;padding:8px 12px;border-radius:8px;">${bannerNote}</p>` : ''}
  <p style="margin:0 0 16px;"><strong>${headline}</strong> — ${dateLabel}</p>`
  if (payload.jobs.length === 0) {
    body += `<p style="color:#6b7280;">No org job activity in this window for the selected filter.</p></div>`
    return body
  }

  for (const { job, byUserId, reports } of payload.jobs) {
    const jobTitle = escapeHtml(`${job.hcp_number} · ${job.job_name}`)
    body += `<div style="margin-bottom:28px;border:1px solid #e5e7eb;border-radius:10px;padding:16px;background:#fff;">
      <h2 style="margin:0 0 8px;font-size:16px;">${jobTitle}</h2>`
    const addrTrim = (job.job_address ?? '').trim()
    if (addrTrim) {
      const addrHtml = escapeHtml(addrTrim).replace(/\n/g, '<br/>')
      body += `<div style="font-size:13px;color:#6b7280;margin:0 0 12px;line-height:1.4;">${addrHtml}</div>`
    }

    if (byUserId.size === 0 && reports.length === 0) {
      body += `<p style="color:#6b7280;margin:0;">No clock sessions or reports in this window.</p>`
    } else {
      if (byUserId.size > 0) {
        body += `<h3 style="margin:0 0 8px;font-size:14px;color:#374151;">Clock time</h3><table style="width:100%;border-collapse:collapse;margin-bottom:12px;"><thead><tr>
          <th align="left" style="padding:6px;border-bottom:1px solid #e5e7eb;">Person</th>
          <th align="left" style="padding:6px;border-bottom:1px solid #e5e7eb;">Hours</th>${
          includeCosts
            ? '<th align="left" style="padding:6px;border-bottom:1px solid #e5e7eb;">Cost</th>'
            : ''
        }
          <th align="left" style="padding:6px;border-bottom:1px solid #e5e7eb;">Session notes</th>
          </tr></thead><tbody>`
        const rows = [...byUserId.entries()].sort((a, b) =>
          a[1].displayName.localeCompare(b[1].displayName, undefined, { sensitivity: 'base' }),
        )
        for (const [, u] of rows) {
          const notesHtml = escapeHtml(u.notes.join('\n---\n')).replace(/\n/g, '<br/>')
          const costCell =
            includeCosts &&
            u.costDollars != null &&
            Number.isFinite(u.costDollars)
              ? escapeHtml(`$${u.costDollars.toFixed(2)}`)
              : includeCosts
              ? '—'
              : ''
          body += `<tr>
            <td style="padding:6px;border-bottom:1px solid #f3f4f6;vertical-align:top;">${escapeHtml(u.displayName)}</td>
            <td style="padding:6px;border-bottom:1px solid #f3f4f6;vertical-align:top;">${escapeHtml(u.hours.toFixed(2))}</td>${
            includeCosts
              ? `<td style="padding:6px;border-bottom:1px solid #f3f4f6;vertical-align:top;">${costCell}</td>`
              : ''
          }
            <td style="padding:6px;border-bottom:1px solid #f3f4f6;vertical-align:top;color:#374151;font-size:13px;">${notesHtml || '—'}</td>
          </tr>`
        }
        body += `</tbody></table>`
      }

      if (reports.length > 0) {
        body += `<h3 style="margin:0 0 8px;font-size:14px;color:#374151;">Field reports</h3>`
        for (const r of reports) {
          const when = escapeHtml(new Date(r.created_at).toLocaleString('en-US', { hour12: true }))
          const creator = escapeHtml(r.creatorName)
          body += `<div style="margin-bottom:14px;padding:12px;background:#f9fafb;border-radius:8px;border:1px solid #eef2ff;">
            <div style="font-size:13px;color:#6b7280;margin-bottom:6px;">${when} · ${creator} · <strong>${escapeHtml(r.template_name)}</strong></div>`
          if (r.fieldPairs.length === 0) {
            body += `<div style="color:#6b7280;">(No text fields)</div>`
          } else {
            for (const fp of r.fieldPairs) {
              body += `<div style="margin-bottom:6px;"><span style="color:#6b7280;font-weight:600;">${fp.label}</span> — <span>${fp.htmlValue}</span></div>`
            }
          }
          body += `</div>`
        }
      }
    }
    body += `</div>`
  }

  body += `<p style="margin:24px 0 0;color:#9ca3af;font-size:12px;">PipeTooling — recurring job reports</p></div>`
  return body
}

export function buildRecurringJobReportTextFallback(payload: RecurringJobReportPayload, includeCosts: boolean): string {
  let textFallback = ''
  for (const j of payload.jobs) {
    textFallback += `${j.job.hcp_number} ${j.job.job_name}\n`
    const ta = (j.job.job_address ?? '').trim()
    if (ta) textFallback += `${ta.split('\n').map((ln) => `  ${ln}`).join('\n')}\n`
    for (const [, row] of j.byUserId) {
      if (includeCosts) {
        const costPart =
          row.costDollars != null && Number.isFinite(row.costDollars)
            ? `$${row.costDollars.toFixed(2)}`
            : '—'
        textFallback += `  ${row.displayName}: ${row.hours.toFixed(2)}h  ${costPart}\n`
      } else {
        textFallback += `  ${row.displayName}: ${row.hours.toFixed(2)}h\n`
      }
    }
  }
  return textFallback
}

export async function sendResendHtmlEmail(opts: {
  to: string
  subject: string
  html: string
  textFallback: string
  resendApiKey: string
}): Promise<{ ok: boolean; error?: string; id?: string }> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${opts.resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'PipeTooling <team@noreply.pipetooling.com>',
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
  return { ok: true, id: data.id }
}
