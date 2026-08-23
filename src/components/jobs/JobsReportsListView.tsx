import { useState, type CSSProperties, type ReactNode } from 'react'
import { Folder, Images, Pencil, PanelRightOpen } from 'lucide-react'
import { looksLikeRawJobIdName } from '../../lib/jobs/jobFormatting'
import { displayReportTemplateName } from '../../lib/reportTemplateDisplayName'
import { formatReportFieldValueInlineList } from '../../lib/reportSignatureField'
import { groupReportsByDay, reportDayLabel, reportPreviewLines, reportTimeLabel } from '../../lib/reports/reportsFeed'
import ReportViewModal, { type ReportForView } from '../ReportViewModal'
import type { UserRole } from '../../hooks/useAuth'

/**
 * Jobs → Reports list body (vFEED — the Option A refresh, owner-approved
 * mockup "Job Reports Refresh"): three views over the same rows.
 *
 * - **Newest** (default): a day-grouped feed of readable cards — template,
 *   job, author, short time, the first two field lines, and "Read report ›"
 *   pinned bottom-right (owner amendment). Tap anywhere on the card for the
 *   full report. No expanding required to know what came in.
 * - **By job / By person**: the old groups, restyled — name first with a
 *   quiet subtitle (Jnnn · last report <day> · missing links noted in words),
 *   count on the right, and the four glyph buttons replaced by labeled
 *   buttons inside the open card. A missing link is muted+dashed, never red.
 *
 * Presentation only: same `list_reports_with_job_info` rows, same callbacks
 * into the tab (edit job, preview panel, toasts, dev delete).
 */

export type ReportsListRow = {
  id: string
  template_name: string
  created_by_user_id: string
  created_by_name: string
  created_at: string
  field_values: Record<string, string>
  job_ledger_id: string | null
  project_id: string | null
  job_display_name: string
  job_hcp_number: string
  job_google_drive_link?: string | null
  job_job_pictures_link?: string | null
  job_address?: string | null
}

export type JobsReportsListViewProps = {
  rows: ReportsListRow[]
  viewMode: 'newest' | 'job' | 'person'
  authRole: UserRole | null
  isDev: boolean
  deletingId: string | null
  onDelete: (id: string) => void
  onOpenFiles: (row: ReportsListRow) => void
  onOpenPictures: (row: ReportsListRow) => void
  onEditJob: (jobId: string) => void
  onPreviewJob: (row: ReportsListRow) => void
}

const CARD: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }

function jobLabel(r: ReportsListRow): string {
  const name = r.job_display_name && !looksLikeRawJobIdName(r.job_display_name) ? r.job_display_name : ''
  if (name) return name
  return r.job_hcp_number ? `Job ${r.job_hcp_number}` : 'Unknown job'
}

function toReportForView(r: ReportsListRow): ReportForView {
  return {
    id: r.id,
    template_name: r.template_name,
    job_display_name: `${jobLabel(r)}${r.job_hcp_number ? ` (J${r.job_hcp_number})` : ''}`,
    created_at: r.created_at,
    created_by_name: r.created_by_name,
    field_values: r.field_values,
  }
}

export function JobsReportsListView(p: JobsReportsListViewProps) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
  const [viewing, setViewing] = useState<ReportsListRow | null>(null)
  const now = new Date()

  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const empty = <p style={{ color: 'var(--text-muted)' }}>No reports yet. Tap New report to add one.</p>

  /** One feed card — the whole card opens the report; "Read report ›" sits bottom-right. */
  const feedCard = (r: ReportsListRow, opts: { showJobLine: boolean; dayInTime?: boolean }) => {
    const preview = reportPreviewLines(r.field_values, 2)
    return (
      <button
        key={r.id}
        type="button"
        onClick={() => setViewing(r)}
        aria-label={`Read report — ${displayReportTemplateName(r.template_name, p.authRole)} on ${jobLabel(r)}`}
        style={{ ...CARD, display: 'block', width: '100%', textAlign: 'left', padding: '0.75rem 0.9rem', font: 'inherit', color: 'inherit', cursor: 'pointer' }}
      >
        <span style={{ display: 'flex', justifyContent: 'space-between', gap: '0.6rem', alignItems: 'baseline' }}>
          <span style={{ minWidth: 0, fontWeight: 650 }}>
            <span style={{ background: 'var(--bg-blue-tint)', color: 'var(--text-link)', borderRadius: 6, padding: '0.1rem 0.5rem', fontSize: '0.78rem', fontWeight: 600, marginRight: '0.45rem', verticalAlign: '1px', whiteSpace: 'nowrap' }}>
            {displayReportTemplateName(r.template_name, p.authRole)}
            </span>
            {opts.showJobLine ? jobLabel(r) : null}
          </span>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
            {opts.dayInTime ? `${reportDayLabel(r.created_at, now)} ` : ''}
            {reportTimeLabel(r.created_at)}
          </span>
        </span>
        <span style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-700)', marginTop: 2 }}>
          {r.job_hcp_number ? <b style={{ fontWeight: 650 }}>J{r.job_hcp_number}</b> : null}
          <span style={{ color: 'var(--text-muted)' }}>{r.job_hcp_number ? ' · ' : ''}by {r.created_by_name || 'Unknown'}</span>
        </span>
        <span style={{ display: 'block', borderTop: '1px solid var(--border)', marginTop: '0.5rem', paddingTop: '0.5rem', fontSize: '0.85rem' }}>
          {preview.length === 0 ? (
            <span style={{ color: 'var(--text-muted)' }}>No details written.</span>
          ) : (
            preview.map((l) => (
              <span key={l.label} style={{ display: 'block', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <span style={{ color: 'var(--text-muted)' }}>{l.label}:</span> {l.value}
              </span>
            ))
          )}
          {/* Owner amendment: the read affordance lives bottom-RIGHT on every card. */}
          <span style={{ display: 'block', textAlign: 'right', color: 'var(--text-link)', fontWeight: 650, fontSize: '0.82rem', marginTop: 4 }}>
            Read report ›
          </span>
        </span>
      </button>
    )
  }

  /** Full report rows inside an open group (kept from the old view, + dev delete). */
  const groupReportRow = (r: ReportsListRow, showJob: boolean) => (
    <div key={r.id} style={{ padding: '0.6rem 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'baseline' }}>
        <span style={{ fontWeight: 600, minWidth: 0 }}>
          {displayReportTemplateName(r.template_name, p.authRole)}
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: '0.5rem', fontWeight: 400 }}>
            {reportDayLabel(r.created_at, now)} {reportTimeLabel(r.created_at)} · {r.created_by_name}
            {showJob ? ` · ${jobLabel(r)}${r.job_hcp_number ? ` (J${r.job_hcp_number})` : ''}` : ''}
          </span>
        </span>
        {p.isDev ? (
          <button
            type="button"
            onClick={() => p.onDelete(r.id)}
            disabled={p.deletingId === r.id}
            style={{ font: 'inherit', fontSize: '0.78rem', color: 'var(--text-red-600)', background: 'none', border: 'none', cursor: p.deletingId === r.id ? 'not-allowed' : 'pointer', padding: '0.15rem 0.3rem', flexShrink: 0 }}
          >
            {p.deletingId === r.id ? '…' : 'Delete'}
          </button>
        ) : null}
      </div>
      {r.field_values && Object.keys(r.field_values).length > 0 ? (
        <div style={{ fontSize: '0.875rem', marginTop: 4 }}>
          {Object.entries(r.field_values).map(([label, val]) =>
            val ? (
              <div key={label} style={{ marginBottom: '0.25rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>{label}:</span> {formatReportFieldValueInlineList(val)}
              </div>
            ) : null,
          )}
        </div>
      ) : null}
    </div>
  )

  const actionButton = (label: string, icon: ReactNode, onClick: () => void, missing = false) => (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        font: 'inherit',
        fontSize: '0.85rem',
        padding: '0.5rem 0.8rem',
        borderRadius: 10,
        border: missing ? '1px dashed var(--border-strong)' : '1px solid var(--border-strong)',
        background: 'var(--surface)',
        color: missing ? 'var(--text-muted)' : 'var(--text-700)',
        cursor: 'pointer',
      }}
    >
      {icon}
      {label}
    </button>
  )

  /** Group card shared by By job / By person. */
  const groupCard = (opts: {
    key: string
    title: string
    subtitle: string
    reps: ReportsListRow[]
    actions?: ReactNode
    showJobOnRows: boolean
  }) => {
    const isOpen = expanded.has(opts.key)
    return (
      <div key={opts.key} style={CARD}>
        <button
          type="button"
          onClick={() => toggle(opts.key)}
          aria-expanded={isOpen}
          style={{ display: 'flex', width: '100%', alignItems: 'center', gap: '0.6rem', padding: '0.7rem 0.9rem', font: 'inherit', color: 'inherit', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer' }}
        >
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontWeight: 650, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{opts.title}</span>
            <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 1 }}>{opts.subtitle}</span>
          </span>
          <span style={{ color: 'var(--text-link)', fontWeight: 650, fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
            {opts.reps.length} report{opts.reps.length !== 1 ? 's' : ''} {isOpen ? '⌄' : '›'}
          </span>
        </button>
        {isOpen ? (
          <div style={{ padding: '0 0.9rem 0.7rem' }}>
            {opts.actions ? <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: '0.35rem' }}>{opts.actions}</div> : null}
            {opts.reps.map((r) => groupReportRow(r, opts.showJobOnRows))}
          </div>
        ) : null}
      </div>
    )
  }

  let body: ReactNode
  if (p.viewMode === 'newest') {
    const groups = groupReportsByDay(p.rows, now)
    body =
      p.rows.length === 0 ? (
        empty
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {groups.map((g) => (
            <div key={g.label}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', margin: '0.6rem 2px 0.35rem' }}>
                {g.label}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>{g.rows.map((r) => feedCard(r, { showJobLine: true }))}</div>
            </div>
          ))}
        </div>
      )
  } else if (p.viewMode === 'person') {
    const byPerson = new Map<string, ReportsListRow[]>()
    for (const r of p.rows) {
      const arr = byPerson.get(r.created_by_user_id) ?? []
      arr.push(r)
      byPerson.set(r.created_by_user_id, arr)
    }
    const groups = Array.from(byPerson.entries())
      .map(([key, reps]) => ({ key: `p-${key}`, reps: reps.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) }))
      .sort((a, b) => new Date(b.reps[0]!.created_at).getTime() - new Date(a.reps[0]!.created_at).getTime())
    body =
      groups.length === 0 ? (
        empty
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {groups.map(({ key, reps }) =>
            groupCard({
              key,
              title: reps[0]!.created_by_name || 'Unknown',
              subtitle: `last report ${reportDayLabel(reps[0]!.created_at, now)}`,
              reps,
              showJobOnRows: true,
            }),
          )}
        </div>
      )
  } else {
    const byJob = new Map<string, ReportsListRow[]>()
    for (const r of p.rows) {
      const key = `${r.job_ledger_id ?? ''}-${r.project_id ?? ''}`
      const arr = byJob.get(key) ?? []
      arr.push(r)
      byJob.set(key, arr)
    }
    const groups = Array.from(byJob.entries())
      .map(([key, reps]) => ({ key: `j-${key}`, reps: reps.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) }))
      .sort((a, b) => new Date(b.reps[0]!.created_at).getTime() - new Date(a.reps[0]!.created_at).getTime())
    body =
      groups.length === 0 ? (
        empty
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {groups.map(({ key, reps }) => {
            const job = reps[0]!
            const missing: string[] = []
            if (job.job_ledger_id) {
              if (!(job.job_google_drive_link ?? '').trim()) missing.push('Files')
              if (!(job.job_job_pictures_link ?? '').trim()) missing.push('Pictures')
            }
            const subtitle = [
              job.job_hcp_number ? `J${job.job_hcp_number}` : null,
              `last report ${reportDayLabel(job.created_at, now)}`,
              missing.length ? `${missing.join(' + ')} not linked yet` : null,
            ]
              .filter(Boolean)
              .join(' · ')
            return groupCard({
              key,
              title: jobLabel(job),
              subtitle,
              reps,
              showJobOnRows: false,
              actions: job.job_ledger_id ? (
                <>
                  {actionButton('Files', <Folder size={15} strokeWidth={2} aria-hidden />, () => p.onOpenFiles(job), !(job.job_google_drive_link ?? '').trim())}
                  {actionButton('Pictures', <Images size={15} strokeWidth={2} aria-hidden />, () => p.onOpenPictures(job), !(job.job_job_pictures_link ?? '').trim())}
                  {actionButton('Edit job', <Pencil size={15} strokeWidth={2} aria-hidden />, () => job.job_ledger_id && p.onEditJob(job.job_ledger_id))}
                  {actionButton('Preview', <PanelRightOpen size={15} strokeWidth={2} aria-hidden />, () => p.onPreviewJob(job))}
                </>
              ) : undefined,
            })
          })}
        </div>
      )
  }

  return (
    <>
      {body}
      <ReportViewModal open={viewing != null} report={viewing ? toReportForView(viewing) : null} onClose={() => setViewing(null)} viewerRole={p.authRole} />
    </>
  )
}
