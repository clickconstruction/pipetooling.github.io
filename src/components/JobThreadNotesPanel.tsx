import { getDispatchNoteDisplayMeta } from '../utils/dispatchNoteDisplay'

export type JobThreadNoteRow = {
  id: string
  body: string
  created_at: string
  author: { name: string | null } | null
}

type JobThreadNotesPanelProps = {
  notes: JobThreadNoteRow[]
  loading: boolean
  canPost: boolean
  draft: string
  onDraftChange: (v: string) => void
  onSubmit: () => void
  submitting: boolean
  emptyLabel?: string
  /** Jobs Stages: open Schedule modal (planner roles only). */
  scheduleAction?: { onClick: () => void; disabled?: boolean }
  /** Week grid: navigate to Schedule dispatch (same roles + superintendent when job has team). */
  scheduleDispatchAction?: { onClick: () => void; disabled?: boolean }
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
  notes,
  loading,
  canPost,
  draft,
  onDraftChange,
  onSubmit,
  submitting,
  emptyLabel = 'No thread notes yet.',
  scheduleAction,
  scheduleDispatchAction,
}: JobThreadNotesPanelProps) {
  return (
    <div
      style={{
        padding: '0.75rem',
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: 6,
      }}
    >
      <div style={{ marginBottom: '0.5rem' }}>
        <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#374151' }}>
          Job activity / notes (Central Time)
        </div>
      </div>
      {loading ? (
        <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: '0 0 0.75rem 0' }}>Loading notes…</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 0.75rem 0' }}>
          {notes.length === 0 ? (
            <li style={{ color: '#6b7280', fontSize: '0.875rem' }}>{emptyLabel}</li>
          ) : (
            notes.map((n) => {
              const authorName = n.author?.name?.trim() || 'Unknown'
              const { weekdayTimeChicago, daysAgoLabel } = getDispatchNoteDisplayMeta(n.created_at)
              return (
                <li
                  key={n.id}
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
            })
          )}
        </ul>
      )}
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
          <label htmlFor="job-thread-note-body" style={{ fontSize: '0.75rem', color: '#6b7280', display: 'block' }}>
            Add a note
          </label>
          <textarea
            id="job-thread-note-body"
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
              }}
            >
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
                }}
              >
                {submitting ? 'Posting…' : 'Post note'}
              </button>
              {scheduleAction ? <JobThreadScheduleButton action={scheduleAction} /> : null}
              {scheduleDispatchAction ? <JobThreadWeekDispatchButton action={scheduleDispatchAction} /> : null}
            </div>
          ) : (
            <button
              type="button"
              onClick={onSubmit}
              disabled={submitting || draft.trim().length === 0}
              style={{
                alignSelf: 'flex-start',
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
