/**
 * HTML renderer for the Crew Day email (crew-day-email-dispatch, v2.2603).
 * The Dashboard Crew Day section's day, regrouped BY JOB so the email reads
 * like a site diary (owner-approved mockup): each job with the people who
 * worked it (clock spans + hours), their field-report excerpts, % movement,
 * and the same three attention flags the dashboard derives. Hours only —
 * never wages. Email-safe markup: inline-styled tables, light colors only.
 */
import { APP_CALENDAR_TZ } from '../_shared/appTimeZone.ts'

export type CrewDayEmailPayload = {
  day: string
  sessions: Array<{ user_id: string; job_id: string | null; clocked_in_at: string; clocked_out_at: string | null }>
  blocks: Array<{ user_id: string; job_id: string | null; bid_id: string | null; time_start: string; time_end: string; note: string | null }>
  reports: Array<{ id: string; user_id: string; job_id: string; created_at: string; template_name: string; field_values: unknown }>
  pct_notes: Array<{ job_id: string; body: string; created_at: string }>
  users: Array<{ id: string; name: string | null }>
  jobs: Array<{ id: string; hcp_number: string | null; click_number: string | null; job_name: string | null; job_address: string | null; status: string | null; pct_complete: number | null }>
}

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const clockFmt = new Intl.DateTimeFormat('en-US', { timeZone: APP_CALENDAR_TZ, hour: 'numeric', minute: '2-digit' })
const compactClock = (iso: string): string => {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return clockFmt.format(d).replace(' AM', 'a').replace(' PM', 'p')
}

function hoursLabel(ms: number): string {
  if (ms <= 0) return '—'
  return `${(ms / 3_600_000).toFixed(1)} h`
}

function sessionMs(inAt: string, outAt: string | null, nowMs: number): number {
  const a = Date.parse(inAt)
  if (Number.isNaN(a)) return 0
  const b = outAt ? Date.parse(outAt) : nowMs
  if (Number.isNaN(b)) return 0
  return Math.max(0, b - a)
}

function reportExcerpt(fieldValues: unknown, maxLen = 200): string {
  if (fieldValues == null || typeof fieldValues !== 'object' || Array.isArray(fieldValues)) return ''
  const parts: string[] = []
  for (const v of Object.values(fieldValues as Record<string, unknown>)) {
    if (typeof v !== 'string') continue
    const t = v.trim()
    if (!t || t.startsWith('data:')) continue
    parts.push(t)
  }
  const joined = parts.join(' · ')
  return joined.length <= maxLen ? joined : `${joined.slice(0, maxLen - 1).trimEnd()}…`
}

/**
 * "Status Report" is the default template — its name shortens to "Report"
 * (v2.2623). Copy of crewDayReportLabel in src/lib/crewDay.ts — keep in sync.
 */
function reportLabel(templateName: string | null | undefined): string {
  const t = (templateName ?? '').trim()
  if (!t || /^status report$/i.test(t)) return 'Report'
  return t
}

function pctFromNote(body: string): number | null {
  const m = /(\d{1,3})\s*%\s*complete/i.exec(body)
  if (!m?.[1]) return null
  const n = Number(m[1])
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n : null
}

type PersonLine = { name: string; spans: string; hoursMs: number; open: boolean; unscheduled: boolean; noReport: boolean }
type FlagLine = { text: string; tone: 'amber' | 'red' }
type JobGroup = {
  label: string
  address: string | null
  pct: { from: number; to: number } | null
  people: PersonLine[]
  reports: Array<{ byName: string; at: string; excerpt: string; templateName: string }>
  flags: FlagLine[]
}
export type CrewDayEmailView = {
  day: string
  groups: JobGroup[]
  summary: { people: number; jobs: number; hoursMs: number; reports: number; flags: number }
}

export function buildCrewDayEmailView(payload: CrewDayEmailPayload, nowMs: number): CrewDayEmailView {
  const names = new Map(payload.users.map((u) => [u.id, (u.name ?? '').trim() || 'Unknown']))
  const jobsById = new Map(payload.jobs.map((j) => [j.id, j]))

  const sessionsByUser = new Map<string, typeof payload.sessions>()
  for (const s of payload.sessions) {
    const arr = sessionsByUser.get(s.user_id) ?? []
    arr.push(s)
    sessionsByUser.set(s.user_id, arr)
  }
  const reportsByUser = new Map<string, number>()
  for (const r of payload.reports) reportsByUser.set(r.user_id, (reportsByUser.get(r.user_id) ?? 0) + 1)

  const jobKey = (id: string | null) => id ?? '∅'
  const groups = new Map<string, JobGroup>()
  const order: string[] = []
  const groupFor = (jobId: string | null): JobGroup => {
    const key = jobKey(jobId)
    let g = groups.get(key)
    if (!g) {
      const job = jobId != null ? jobsById.get(jobId) : undefined
      const num = ((job?.hcp_number ?? '').trim() || (job?.click_number ?? '').trim() || '').trim()
      const name = (job?.job_name ?? '').trim() || (job?.job_address ?? '').trim()
      const label = jobId == null ? 'No job association' : num && name ? `${num} · ${name}` : num || name || 'Job'
      const firstPct = payload.pct_notes.filter((n) => n.job_id === jobId).map((n) => pctFromNote(n.body)).find((v) => v != null) ?? null
      const to = job?.pct_complete ?? null
      g = {
        label,
        address: job?.job_address ?? null,
        pct: firstPct != null && to != null && to !== firstPct ? { from: firstPct, to } : null,
        people: [],
        reports: [],
        flags: [],
      }
      groups.set(key, g)
      order.push(key)
    }
    return g
  }

  // People who clocked a job.
  const pairSeen = new Set<string>()
  let totalMs = 0
  for (const s of payload.sessions) {
    totalMs += sessionMs(s.clocked_in_at, s.clocked_out_at, nowMs)
    const pk = `${s.user_id}|${jobKey(s.job_id)}`
    if (pairSeen.has(pk)) continue
    pairSeen.add(pk)
    const mine = (sessionsByUser.get(s.user_id) ?? []).filter((x) => jobKey(x.job_id) === jobKey(s.job_id))
    const ms = mine.reduce((a, x) => a + sessionMs(x.clocked_in_at, x.clocked_out_at, nowMs), 0)
    const open = mine.some((x) => x.clocked_out_at == null)
    const scheduledHere = payload.blocks.some((b) => b.user_id === s.user_id && jobKey(b.job_id) === jobKey(s.job_id))
    const closedAny = (sessionsByUser.get(s.user_id) ?? []).some((x) => x.clocked_out_at != null)
    const noReport = closedAny && (reportsByUser.get(s.user_id) ?? 0) === 0
    groupFor(s.job_id).people.push({
      name: names.get(s.user_id) ?? 'Unknown',
      spans: mine.map((x) => `${compactClock(x.clocked_in_at)} – ${x.clocked_out_at ? compactClock(x.clocked_out_at) : 'now'}`).join(', '),
      hoursMs: ms,
      open,
      unscheduled: !scheduledHere,
      noReport,
    })
  }

  // Scheduled-but-never-clocked people become red flag lines on their job.
  for (const b of payload.blocks) {
    if ((sessionsByUser.get(b.user_id) ?? []).length > 0) continue
    const g = groupFor(b.job_id)
    const text = `${names.get(b.user_id) ?? 'Unknown'} scheduled ${b.time_start.slice(0, 5)} – ${b.time_end.slice(0, 5)} — never clocked in`
    if (!g.flags.some((f) => f.text === text)) g.flags.push({ text, tone: 'red' })
  }

  for (const r of payload.reports) {
    groupFor(r.job_id).reports.push({
      byName: names.get(r.user_id) ?? 'Unknown',
      at: compactClock(r.created_at),
      excerpt: reportExcerpt(r.field_values),
      templateName: r.template_name,
    })
  }

  // Per-job amber "no report" lines for people who worked it and reported nothing.
  for (const g of groups.values()) {
    for (const p of g.people) {
      if (p.noReport) g.flags.push({ text: `${p.name} — no report left today`, tone: 'amber' })
    }
  }

  const peopleIds = new Set<string>([
    ...payload.sessions.map((s) => s.user_id),
    ...payload.blocks.map((b) => b.user_id),
    ...payload.reports.map((r) => r.user_id),
  ])
  const jobIds = new Set(order.filter((k) => k !== '∅'))
  const flagCount = [...groups.values()].reduce((a, g) => a + g.flags.length, 0)

  const sorted = order
    .map((k) => groups.get(k))
    .filter((g): g is JobGroup => g != null)
    .sort((a, b) => b.people.reduce((x, p) => x + p.hoursMs, 0) - a.people.reduce((x, p) => x + p.hoursMs, 0))

  return {
    day: payload.day,
    groups: sorted,
    summary: {
      people: peopleIds.size,
      jobs: jobIds.size,
      hoursMs: totalMs,
      reports: payload.reports.length,
      flags: flagCount,
    },
  }
}

const dayFmt = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' })
function dayLabel(ymd: string): string {
  return dayFmt.format(new Date(`${ymd}T12:00:00Z`))
}

export function crewDayEmailSubject(view: CrewDayEmailView): string {
  const s = view.summary
  return `Crew Day — ${dayLabel(view.day)} · ${s.people} people · ${hoursLabel(s.hoursMs)} · ${s.reports} report${s.reports === 1 ? '' : 's'}${s.flags > 0 ? ` · ${s.flags} flag${s.flags === 1 ? '' : 's'}` : ''}`
}

export function crewDayEmailText(view: CrewDayEmailView): string {
  const lines: string[] = [`Crew Day — ${dayLabel(view.day)}`, '']
  if (view.groups.length === 0) lines.push('No crew activity recorded for this day.')
  for (const g of view.groups) {
    lines.push(g.label + (g.pct ? ` (${g.pct.from}% -> ${g.pct.to}%)` : ''))
    for (const p of g.people) {
      lines.push(`  ${p.name} · ${p.spans}${p.unscheduled ? ' (unscheduled)' : ''} · ${hoursLabel(p.hoursMs)}${p.open ? ' (on the clock)' : ''}`)
    }
    for (const r of g.reports) lines.push(`  ${r.byName} ${r.at}: ${r.excerpt || reportLabel(r.templateName)}`)
    for (const f of g.flags) lines.push(`  ! ${f.text}`)
    lines.push('')
  }
  return lines.join('\n')
}

export function renderCrewDayEmail(view: CrewDayEmailView, senderName?: string): string {
  const s = view.summary
  const chips = [
    `${s.people} people`,
    `${s.jobs} jobs`,
    hoursLabel(s.hoursMs),
    `${s.reports} report${s.reports === 1 ? '' : 's'}`,
    ...(s.flags > 0 ? [`${s.flags} flag${s.flags === 1 ? '' : 's'}`] : []),
  ]
    .map(
      (c) =>
        `<span style="display:inline-block;border:1px solid #e2e8f0;border-radius:999px;padding:2px 10px;font-size:12px;font-weight:600;color:#334155;margin:0 4px 4px 0;">${esc(c)}</span>`,
    )
    .join('')

  const groupsHtml =
    view.groups.length === 0
      ? `<p style="color:#64748b;font-size:14px;">No crew activity recorded for this day.</p>`
      : view.groups
          .map((g) => {
            const people = g.people
              .map(
                (p) => `
        <tr>
          <td style="padding:2px 0;font-size:13px;color:#0f172a;">${esc(p.name)} <span style="color:#64748b;">· ${esc(p.spans)}${p.unscheduled ? ' (unscheduled)' : ''}</span></td>
          <td style="padding:2px 0;font-size:13px;color:#334155;text-align:right;white-space:nowrap;">${esc(hoursLabel(p.hoursMs))}${p.open ? ' <span style="color:#64748b;">· on the clock</span>' : ''}</td>
        </tr>`,
              )
              .join('')
            const reports = g.reports
              .map(
                (r) => `
        <div style="border-left:3px solid #15803d;background:#f0fdf4;border-radius:0 6px 6px 0;padding:5px 9px;margin:5px 0 0;font-size:12.5px;color:#334155;">
          <b style="color:#15803d;">${esc(r.byName)} · ${esc(r.at)}</b>${r.excerpt ? ` — ${esc(r.excerpt)}` : ` — ${esc(reportLabel(r.templateName))}`}
        </div>`,
              )
              .join('')
            const flags = g.flags
              .map(
                (f) =>
                  `<div style="color:${f.tone === 'red' ? '#b91c1c' : '#b45309'};font-size:12.5px;font-weight:600;margin-top:4px;">&#9888; ${esc(f.text)}</div>`,
              )
              .join('')
            return `
      <div style="border-top:1px solid #e2e8f0;padding:10px 0;">
        <div style="font-size:14px;font-weight:700;color:#0f172a;">${esc(g.label)}${g.pct ? ` <span style="color:#15803d;font-weight:600;font-size:12.5px;">&#9650; ${g.pct.from}% &#8594; ${g.pct.to}%</span>` : ''}</div>
        ${g.address ? `<div style="font-size:12px;color:#64748b;margin:1px 0 4px;">${esc(g.address)}</div>` : ''}
        ${people ? `<table style="width:100%;border-collapse:collapse;">${people}</table>` : ''}
        ${reports}
        ${flags}
      </div>`
          })
          .join('')

  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f8fafc;">
  <div style="max-width:640px;margin:0 auto;padding:20px 16px;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;padding:18px 20px;">
      <h1 style="margin:0 0 2px;font-size:18px;color:#0f172a;">Your crews — ${esc(dayLabel(view.day))}</h1>
      <p style="margin:0 0 10px;font-size:12.5px;color:#64748b;">Rebuilt fresh at send time · hours only${senderName ? ` · from ${esc(senderName)}` : ''}</p>
      <div style="margin-bottom:8px;">${chips}</div>
      ${groupsHtml}
    </div>
    <p style="font-size:11px;color:#94a3b8;margin:10px 4px;">Manage this email in Settings &#8594; My email schedule.</p>
  </div>
</body></html>`
}
