/**
 * The Job activity report email — its payload types and renderers, lifted verbatim out of
 * `recurringJobReportCore.ts` in v2.4179 (punch list #60, lift 10 of 14) so Settings → What
 * the team sees renders it on sample data. Pure: the core keeps the Supabase reads that build
 * the payload and re-exports everything here.
 */

export type ReportingPeriodKind = 'daily' | 'weekly'

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

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
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

  body += `<p style="margin:24px 0 0;color:#9ca3af;font-size:12px;">ClickTooling — recurring job reports</p></div>`
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
