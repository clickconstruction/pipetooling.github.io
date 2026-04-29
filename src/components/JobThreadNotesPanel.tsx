import { useState } from 'react'
import { getDispatchNoteDisplayMeta } from '../utils/dispatchNoteDisplay'
import type { UserRole } from '../hooks/useAuth'
import { displayReportTemplateName } from '../lib/reportTemplateDisplayName'
import ReportViewModal, { type ReportForView } from './ReportViewModal'
import { firstNonEmptyFieldValueSummary } from '../lib/reportForViewFromJobLedgerRow'

export type JobThreadNoteRow = {
  id: string
  body: string
  created_at: string
  author: { name: string | null } | null
}

export type JobThreadActivityItem =
  | { kind: 'note'; note: JobThreadNoteRow }
  | { kind: 'report'; report: ReportForView }

type JobThreadNotesPanelProps = {
  /** Merged notes + job field reports (Jobs Stages / Workflow). When set, `notes` is ignored. */
  activity?: JobThreadActivityItem[]
  /** Note-only (e.g. Job detail modal). Used when `activity` is omitted. */
  notes?: JobThreadNoteRow[]
  loading: boolean
  canPost: boolean
  draft: string
  onDraftChange: (v: string) => void
  onSubmit: () => void
  submitting: boolean
  emptyLabel?: string
  /** Centered heading when `showSectionTitle` is true. */
  sectionTitle?: string
  /** When false, hide the centered section title (e.g. Job detail modal). */
  showSectionTitle?: boolean
  /** When false, no placeholder row when there are no notes yet. */
  showEmptyPlaceholder?: boolean
  /** When false, hide the visible "Add a note" label; textarea keeps placeholder / aria-label. */
  showComposerLabel?: boolean
  /** Jobs Stages: open Schedule modal (planner roles only). */
  scheduleAction?: { onClick: () => void; disabled?: boolean }
  /** Week grid: navigate to Schedule dispatch (same roles + superintendent when job has team). */
  scheduleDispatchAction?: { onClick: () => void; disabled?: boolean }
  /** Passed to {@link displayReportTemplateName} for report row titles and ReportViewModal. */
  viewerRole?: UserRole | null
}

function JobThreadScheduleButton({
  action,
}: {
  action: NonNullable<JobThreadNotesPanelProps['scheduleAction']>
}) {
  return (
    <button
      type="button"
      onClick={action.onClick}
      disabled={action.disabled}
      style={{
        padding: '0.3rem 0.65rem',
        fontSize: '0.75rem',
        fontWeight: 600,
        background: action.disabled ? '#e5e7eb' : '#15803d',
        color: action.disabled ? '#6b7280' : '#ffffff',
        border: `1px solid ${action.disabled ? '#d1d5db' : '#166534'}`,
        borderRadius: 4,
        cursor: action.disabled ? 'not-allowed' : 'pointer',
        flexShrink: 0,
      }}
    >
      Schedule
    </button>
  )
}

function JobThreadWeekDispatchButton({
  action,
}: {
  action: NonNullable<JobThreadNotesPanelProps['scheduleDispatchAction']>
}) {
  return (
    <button
      type="button"
      onClick={action.onClick}
      disabled={action.disabled}
      style={{
        padding: '0.3rem 0.65rem',
        fontSize: '0.75rem',
        fontWeight: 600,
        background: action.disabled ? '#e5e7eb' : '#ffffff',
        color: action.disabled ? '#6b7280' : '#1d4ed8',
        border: `1px solid ${action.disabled ? '#d1d5db' : '#2563eb'}`,
        borderRadius: 4,
        cursor: action.disabled ? 'not-allowed' : 'pointer',
        flexShrink: 0,
      }}
    >
      Week dispatch
    </button>
  )
}

export function JobThreadNotesPanel({
  activity: activityProp,
  notes,
  loading,
  canPost,
  draft,
  onDraftChange,
  onSubmit,
  submitting,
  emptyLabel = 'No activity yet.',
  sectionTitle = 'Job activity / notes',
  showSectionTitle = true,
  showEmptyPlaceholder = true,
  showComposerLabel = true,
  scheduleAction,
  scheduleDispatchAction,
  viewerRole,
}: JobThreadNotesPanelProps) {
  const [viewingReport, setViewingReport] = useState<ReportForView | null>(null)

  const activity: JobThreadActivityItem[] =
    activityProp ??
    (notes ?? []).map((n) => ({
      kind: 'note' as const,
      note: n,
    }))

  return (
    <div
      style={{
        padding: '0.75rem',
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: 6,
      }}
    >
      {showSectionTitle ? (
        <div style={{ marginBottom: '0.5rem', textAlign: 'center' }}>
          <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#374151' }}>
            {sectionTitle}
          </div>
        </div>
      ) : null}
      {loading ? (
        <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: '0 0 0.75rem 0' }}>Loading…</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 0.75rem 0' }}>
          {activity.length === 0 ? (
            showEmptyPlaceholder ? (
              <li style={{ color: '#6b7280', fontSize: '0.875rem' }}>{emptyLabel}</li>
            ) : null
          ) : (
            activity.map((item) => {
              if (item.kind === 'note') {
                const n = item.note
                const authorName = n.author?.name?.trim() || 'Unknown'
                const { weekdayTimeChicago, daysAgoLabel } = getDispatchNoteDisplayMeta(n.created_at)
                return (
                  <li
                    key={`n-${n.id}`}
                    style={{
                      padding: '0.5rem 0',
                      borderBottom: '1px solid #f3f4f6',
                      fontSize: '0.8125rem',
                    }}
                  >
                    <div style={{ color: '#6b7280', marginBottom: 2 }}>
                      <strong style={{ color: '#111827' }}>{authorName}</strong>
                      <span style={{ marginLeft: '0.5rem' }}>
                        {weekdayTimeChicago} · {daysAgoLabel}
                      </span>
                    </div>
                    <div style={{ color: '#1f2937', whiteSpace: 'pre-wrap' }}>{n.body}</div>
                  </li>
                )
              }
              const r = item.report
              const { weekdayTimeChicago, daysAgoLabel } = getDispatchNoteDisplayMeta(r.created_at)
              const summary = firstNonEmptyFieldValueSummary(r)
              return (
                <li
                  key={`r-${r.id}`}
                  style={{
                    padding: '0.5rem 0',
                    borderBottom: '1px solid #f3f4f6',
                    fontSize: '0.8125rem',
                    borderLeft: '3px solid #93c5fd',
                    paddingLeft: '0.5rem',
                    marginLeft: 0,
                  }}
                >
                  <div style={{ color: '#6b7280', marginBottom: 2 }}>
                    <span
                      style={{
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        color: '#2563eb',
                        marginRight: '0.35rem',
                        verticalAlign: 'middle',
                      }}
                    >
                      Report
                    </span>
                    <strong style={{ color: '#111827' }}>{r.created_by_name?.trim() || 'Unknown'}</strong>
                    <span style={{ marginLeft: '0.5rem' }}>
                      {weekdayTimeChicago} · {daysAgoLabel}
                    </span>
                  </div>
                  <div style={{ color: '#1f2937' }}>
                    <span style={{ fontWeight: 600 }}>{displayReportTemplateName(r.template_name, viewerRole)}</span>
                    {summary ? (
                      <div style={{ marginTop: 4, whiteSpace: 'pre-wrap' }}>{summary}</div>
                    ) : null}
                    <div style={{ marginTop: 6 }}>
                      <button
                        type="button"
                        onClick={() => setViewingReport(r)}
                        style={{
                          padding: '0.2rem 0.5rem',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          background: '#eff6ff',
                          color: '#1d4ed8',
                          border: '1px solid #93c5fd',
                          borderRadius: 4,
                          cursor: 'pointer',
                        }}
                      >
                        View full report
                      </button>
                    </div>
                  </div>
                </li>
              )
            })
          )}
        </ul>
      )}
      <ReportViewModal open={viewingReport != null} report={viewingReport} onClose={() => setViewingReport(null)} viewerRole={viewerRole} />
      {!canPost && (scheduleAction || scheduleDispatchAction) ? (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            flexWrap: 'wrap',
            gap: '0.35rem',
            marginTop: '0.5rem',
          }}
        >
          {scheduleAction ? <JobThreadScheduleButton action={scheduleAction} /> : null}
          {scheduleDispatchAction ? <JobThreadWeekDispatchButton action={scheduleDispatchAction} /> : null}
        </div>
      ) : null}
      {canPost && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
          {showComposerLabel ? (
            <label htmlFor="job-thread-note-body" style={{ fontSize: '0.75rem', color: '#6b7280', display: 'block' }}>
              Add a note
            </label>
          ) : null}
          <textarea
            id="job-thread-note-body"
            aria-label={showComposerLabel ? undefined : 'Add a note'}
            value={draft}
            onChange={(e) => onDraftChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter' || e.shiftKey) return
              e.preventDefault()
              if (submitting || draft.trim().length === 0) return
              onSubmit()
            }}
            disabled={submitting}
            maxLength={2000}
            rows={3}
            placeholder="Type a note… (Enter to post, Shift+Enter for new line)"
            style={{
              width: '100%',
              padding: '0.5rem',
              fontSize: '0.875rem',
              border: '1px solid #d1d5db',
              borderRadius: 4,
              boxSizing: 'border-box',
              resize: 'vertical',
            }}
          />
          {scheduleAction || scheduleDispatchAction ? (
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: '0.5rem',
                width: '100%',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: '0.5rem',
                  marginRight: 'auto',
                }}
              >
                {scheduleAction ? <JobThreadScheduleButton action={scheduleAction} /> : null}
                {scheduleDispatchAction ? <JobThreadWeekDispatchButton action={scheduleDispatchAction} /> : null}
              </div>
              <button
                type="button"
                onClick={onSubmit}
                disabled={submitting || draft.trim().length === 0}
                style={{
                  padding: '0.35rem 0.75rem',
                  fontSize: '0.8125rem',
                  background: submitting || draft.trim().length === 0 ? '#e5e7eb' : '#3b82f6',
                  color: submitting || draft.trim().length === 0 ? '#6b7280' : 'white',
                  border: 'none',
                  borderRadius: 4,
                  cursor: submitting || draft.trim().length === 0 ? 'not-allowed' : 'pointer',
                  flexShrink: 0,
                }}
              >
                {submitting ? 'Posting…' : 'Post note'}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onSubmit}
              disabled={submitting || draft.trim().length === 0}
              style={{
                alignSelf: 'flex-end',
                padding: '0.35rem 0.75rem',
                fontSize: '0.8125rem',
                background: submitting || draft.trim().length === 0 ? '#e5e7eb' : '#3b82f6',
                color: submitting || draft.trim().length === 0 ? '#6b7280' : 'white',
                border: 'none',
                borderRadius: 4,
                cursor: submitting || draft.trim().length === 0 ? 'not-allowed' : 'pointer',
              }}
            >
              {submitting ? 'Posting…' : 'Post note'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
