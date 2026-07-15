import { Fragment } from 'react'
import { ChecklistTitleWithLinks } from './ChecklistTitleWithLinks'
import { DispatchNoteCombobox } from './DispatchNoteCombobox'
import {
  formatDispatchNoteDaysAgoShort,
  formatDispatchNoteDaysAgoShortPhrase,
  getDispatchNoteDisplayMeta,
} from '../utils/dispatchNoteDisplay'
import { useNarrowViewport640 } from '../hooks/useNarrowViewport640'

export type EstimatorInboxRow = {
  id: string
  title: string
  links: string[] | null
  created_at: string | null
  from_user_id: string
  reference_summary: string | null
  location_lat: number | null
  location_lng: number | null
  sender: { name: string | null; email: string | null } | null
  status: 'open' | 'closed'
  closed_at: string | null
  closed_by_user_id: string | null
  closed_by: { name: string | null } | null
  closed_note: string | null
  /** Thread notes on this request (from estimator_request_notes). */
  note_count?: number
  last_note_at?: string | null
}

export type EstimatorThreadNoteRow = {
  id: string
  body: string
  created_at: string
  author: { name: string | null } | null
}

function formatDatetime(iso: string | null): string {
  if (!iso) return 'unknown'
  const date = new Date(iso)
  const weekday = date.toLocaleDateString(undefined, { weekday: 'short' })
  const dateTime = date.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
  return `${weekday}, ${dateTime}`
}

function formatDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'short' })
}

type EstimatorInboxSectionProps = {
  /** Collapsible header title. Default "Estimator inbox". */
  sectionTitle?: string
  /** Badge in header: count open, count closed, or hide. Default open count. */
  headerBadge?: 'open' | 'closed' | 'none'
  sectionOpen: boolean
  onToggleSection: () => void
  requests: EstimatorInboxRow[]
  loading: boolean
  expandedRequestId: string | null
  onToggleExpandRequest: (requestId: string) => void
  notesByRequestId: Record<string, EstimatorThreadNoteRow[]>
  notesLoadingRequestId: string | null
  noteSubmitRequestId: string | null
  canAddNotes: boolean
  estimatorRequestDismissingId: string | null
  noteDraft: string
  onNoteDraftChange: (draft: string) => void
  onSubmitNote: (requestId: string) => void
  onSubmitNoteAndClose: (requestId: string) => void
  onDismiss: (requestId: string) => void
}

export function EstimatorInboxSection({
  sectionTitle = 'Estimator inbox',
  headerBadge = 'open',
  sectionOpen,
  onToggleSection,
  requests,
  loading,
  expandedRequestId,
  onToggleExpandRequest,
  notesByRequestId,
  notesLoadingRequestId,
  noteSubmitRequestId,
  canAddNotes,
  estimatorRequestDismissingId,
  noteDraft,
  onNoteDraftChange,
  onSubmitNote,
  onSubmitNoteAndClose,
  onDismiss,
}: EstimatorInboxSectionProps) {
  const narrow = useNarrowViewport640()
  // An empty inbox compresses to a single slim line — no body, no full-size header.
  if (!loading && requests.length === 0 && headerBadge === 'open') {
    return (
      <div
        style={{
          marginBottom: '0.5rem',
          border: '1px solid var(--border)',
          borderRadius: 8,
          background: 'var(--bg-subtle)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.3rem 1rem',
          color: 'var(--text-muted)',
          fontSize: '0.8125rem',
        }}
      >
        <span style={{ fontWeight: 600 }}>{sectionTitle}</span>
        <span>— empty</span>
      </div>
    )
  }

  // Amber header while work is waiting, so a collapsed inbox still signals at a glance.
  const hasOpenWork = !loading && headerBadge === 'open' && requests.some((r) => r.status === 'open')

  return (
    <div
      style={{
        marginBottom: '1.5rem',
        border: `1px solid ${hasOpenWork ? 'var(--border-orange)' : 'var(--border)'}`,
        borderRadius: 8,
        overflow: 'hidden',
      }}
    >
      <button
        type="button"
        onClick={onToggleSection}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.35rem',
          width: '100%',
          padding: '0.75rem 1rem',
          margin: 0,
          background: hasOpenWork ? 'var(--bg-amber-tint)' : 'var(--bg-subtle)',
          border: 'none',
          cursor: 'pointer',
          fontSize: '1rem',
          fontWeight: 600,
          textAlign: 'left',
        }}
      >
        <span aria-hidden>{sectionOpen ? '▼' : '▶'}</span>
        {sectionTitle}
        {!loading && requests.length > 0 && headerBadge !== 'none' ? (
          <span
            style={{
              marginLeft: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: 500,
              color: hasOpenWork ? 'var(--text-amber-800)' : 'var(--text-link)',
            }}
          >
            {headerBadge === 'open'
              ? `(${requests.filter((r) => r.status === 'open').length} open)`
              : `(${requests.filter((r) => r.status === 'closed').length} closed)`}
          </span>
        ) : null}
      </button>
      {sectionOpen && (
        <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid var(--border)' }}>
          {loading ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading…</p>
          ) : requests.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No estimator requests.</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {requests.map((req, index) => {
                const isFirstClosed =
                  req.status === 'closed' &&
                  (index === 0 || requests[index - 1]!.status === 'open')
                const fromLabel = req.sender?.name?.trim() || req.sender?.email?.trim() || 'Unknown'
                const isClosed = req.status === 'closed'
                const closedByLabel = req.closed_by?.name?.trim() || 'Unknown'
                const expanded = expandedRequestId === req.id
                const threadNotes = notesByRequestId[req.id] ?? []
                const notesLoading = notesLoadingRequestId === req.id
                const hasDispatchNoteContent = noteDraft.trim().length > 0
                const dispatchRowSaving = noteSubmitRequestId === req.id
                const dispatchHintText = 'Type freely or use arrow keys / click to pick a suggestion.'
                const dispatchBtnTransition = 'background-color 0.15s ease, color 0.15s ease, border-color 0.15s ease'
                const noteCount = req.note_count ?? 0
                const noteCountLabel =
                  noteCount === 0 ? 'No messages' : noteCount === 1 ? '1 message' : `${noteCount} messages`
                // Narrow closed rows: full-width green bar across the card bottom —
                // the phone-sized counterpart of the desktop Dismiss rail.
                const dismissBottomBar = (
                  <button
                    type="button"
                    onClick={() => onDismiss(req.id)}
                    disabled={estimatorRequestDismissingId === req.id}
                    title="Dismiss from inbox"
                    style={{
                      width: '100%',
                      marginTop: '0.5rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      padding: '0.45rem 0.75rem',
                      border: '1px solid var(--border)',
                      borderRadius: 6,
                      background: 'var(--bg-green-tint)',
                      color: 'var(--text-green-800)',
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      cursor: estimatorRequestDismissingId === req.id ? 'not-allowed' : 'pointer',
                    }}
                  >
                    <span aria-hidden>✓</span>
                    {estimatorRequestDismissingId === req.id ? '…' : 'Dismiss'}
                  </button>
                )
                // Desktop closed rows: full-height Dismiss rail on the left — reads as
                // "done, ready to archive" and gives dismissal a big obvious target.
                const showDismissRail = isClosed && !narrow
                const dismissRail = (
                  <button
                    type="button"
                    onClick={() => onDismiss(req.id)}
                    disabled={estimatorRequestDismissingId === req.id}
                    title="Dismiss from inbox"
                    style={{
                      flexShrink: 0,
                      alignSelf: 'stretch',
                      width: 88,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 4,
                      border: 'none',
                      borderRight: '1px solid var(--border)',
                      background: 'var(--bg-green-tint)',
                      color: 'var(--text-green-800)',
                      fontSize: '0.8125rem',
                      fontWeight: 600,
                      cursor: estimatorRequestDismissingId === req.id ? 'not-allowed' : 'pointer',
                    }}
                  >
                    <span aria-hidden style={{ fontSize: '1rem', lineHeight: 1 }}>✓</span>
                    {estimatorRequestDismissingId === req.id ? '…' : 'Dismiss'}
                  </button>
                )
                return (
                  <Fragment key={req.id}>
                    {isFirstClosed ? (
                      <li
                        style={{
                          listStyle: 'none',
                          padding: '0.75rem 0 0',
                          margin: 0,
                          borderBottom: 'none',
                        }}
                      >
                        <div
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            color: 'var(--text-muted)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                          }}
                        >
                          Closed
                        </div>
                      </li>
                    ) : null}
                    <li
                      style={
                        showDismissRail
                          ? {
                              padding: 0,
                              borderBottom: '1px solid #f3f4f6',
                              background: 'var(--bg-muted)',
                              display: 'flex',
                              alignItems: 'stretch',
                              gap: '0.75rem',
                            }
                          : {
                              padding: '0.75rem 0',
                              borderBottom: '1px solid #f3f4f6',
                              background: isClosed ? 'var(--bg-muted)' : undefined,
                            }
                      }
                    >
                    {showDismissRail ? dismissRail : null}
                    <div style={showDismissRail ? { flex: 1, minWidth: 0, padding: '0.75rem 0.75rem 0.75rem 0' } : undefined}>
                    <div
                      // Whole collapsed row toggles the thread; the guard lets clicks on links
                      // and action buttons (Dismiss) through untouched.
                      role="button"
                      tabIndex={0}
                      aria-expanded={expanded}
                      onKeyDown={(e) => {
                        if ((e.target as HTMLElement).closest('a, button, input, textarea, select')) return
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          onToggleExpandRequest(req.id)
                        }
                      }}
                      onClick={(e) => {
                        if ((e.target as HTMLElement).closest('a, button, input, textarea, select')) return
                        onToggleExpandRequest(req.id)
                      }}
                      style={
                        narrow
                          ? {
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'stretch',
                              gap: '0.5rem',
                              cursor: 'pointer',
                            }
                          : {
                              display: 'flex',
                              flexWrap: 'wrap',
                              alignItems: 'flex-start',
                              gap: '0.5rem',
                              cursor: 'pointer',
                            }
                      }
                    >
                      <div
                        style={
                          narrow
                            ? {
                                flex: 'none',
                                minWidth: 0,
                                width: '100%',
                                textAlign: 'left',
                                paddingRight: 0,
                              }
                            : {
                                flex: 1,
                                minWidth: 200,
                                textAlign: 'left',
                                paddingRight: '0.5rem',
                              }
                        }
                      >
                        <div style={{ fontWeight: 500 }}>
                          <ChecklistTitleWithLinks title={req.title} links={req.links ?? []} />
                        </div>
                        <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: 4 }}>
                          <span style={{ fontSize: '0.75rem', marginRight: 6 }} aria-hidden>
                            {expanded ? '▼' : '▶'}
                          </span>
                          From {fromLabel}
                          {req.created_at ? (
                            <span style={{ marginLeft: '0.5rem' }} title={formatDatetime(req.created_at)}>
                              · {formatDateShort(req.created_at)} ({formatDispatchNoteDaysAgoShort(req.created_at)})
                            </span>
                          ) : null}
                          <span style={{ marginLeft: '0.5rem' }}>
                            · <span style={{ fontWeight: 600, color: 'var(--text-700)' }}>{noteCountLabel}</span>
                            {req.last_note_at ? `, ${formatDispatchNoteDaysAgoShortPhrase(req.last_note_at)}` : null}
                          </span>
                        </div>
                        {req.reference_summary?.trim() ? (
                          <div style={{ marginTop: 6, fontSize: '0.8125rem', color: 'var(--text-600)' }}>
                            Ref: {req.reference_summary.trim()}
                          </div>
                        ) : null}
                        {req.location_lat != null && req.location_lng != null ? (
                          <div style={{ marginTop: 4, fontSize: '0.8125rem' }}>
                            <a
                              href={`https://www.google.com/maps?q=${req.location_lat},${req.location_lng}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="View location in Google Maps"
                              style={{ color: 'var(--text-link)', textDecoration: 'none' }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              View location
                            </a>
                          </div>
                        ) : null}
                      </div>
                    </div>
                    {expanded && (
                      <div
                        style={{
                          marginTop: '0.75rem',
                          padding: '0.75rem',
                          background: 'var(--surface)',
                          border: '1px solid var(--border)',
                          borderRadius: 6,
                        }}
                      >
                        <div style={{ fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-700)' }}>
                          Activity / notes (Central Time)
                        </div>
                        {notesLoading ? (
                          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading notes…</p>
                        ) : (
                          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 0.75rem 0' }}>
                            {threadNotes.map((n) => {
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
                                  <div style={{ color: 'var(--text-muted)', marginBottom: 2 }}>
                                    <strong style={{ color: 'var(--text-strong)' }}>{authorName}</strong>
                                    <span style={{ marginLeft: '0.5rem' }}>
                                      {weekdayTimeChicago} · {daysAgoLabel}
                                    </span>
                                  </div>
                                  <div style={{ color: 'var(--text-gray-800)' }}>{n.body}</div>
                                </li>
                              )
                            })}
                            {isClosed && req.closed_at ? (
                              <li
                                style={{
                                  padding: '0.5rem 0',
                                  fontSize: '0.8125rem',
                                  background: 'var(--bg-green-tint)',
                                  margin: '0 -0.5rem -0.5rem',
                                  paddingLeft: '0.5rem',
                                  paddingRight: '0.5rem',
                                  borderTop: '1px solid #bbf7d0',
                                }}
                              >
                                <div style={{ color: 'var(--text-green-800)', fontWeight: 600, marginBottom: 4 }}>Marked closed (final)</div>
                                <div style={{ color: 'var(--text-muted)', marginBottom: 2 }}>
                                  <strong style={{ color: '#14532d' }}>{closedByLabel}</strong>
                                  {req.closed_at ? (
                                    <span style={{ marginLeft: '0.5rem' }}>
                                      {getDispatchNoteDisplayMeta(req.closed_at).weekdayTimeChicago} ·{' '}
                                      {getDispatchNoteDisplayMeta(req.closed_at).daysAgoLabel}
                                    </span>
                                  ) : null}
                                </div>
                                {req.closed_note?.trim() ? (
                                  <div style={{ color: '#14532d' }}>&ldquo;{req.closed_note.trim()}&rdquo;</div>
                                ) : null}
                              </li>
                            ) : null}
                          </ul>
                        )}
                        {canAddNotes && (
                          <div
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '0.5rem',
                              marginTop: '0.5rem',
                            }}
                          >
                            {isClosed ? (
                              <div
                                style={{
                                  fontSize: '0.75rem',
                                  color: 'var(--text-muted)',
                                  padding: '0.5rem 0.6rem',
                                  background: 'var(--bg-subtle)',
                                  borderRadius: 4,
                                  border: '1px solid var(--border)',
                                }}
                              >
                                This task is closed. Your message will be added to the thread and reopen it.
                              </div>
                            ) : null}
                            <label htmlFor={`estimator-note-combobox-${req.id}`} style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>
                              <DispatchNoteCombobox
                                id={`estimator-note-combobox-${req.id}`}
                                value={noteDraft}
                                onChange={onNoteDraftChange}
                                disabled={dispatchRowSaving}
                                placeholder="Type a note or click here and pick a suggestion..."
                              />
                            </label>
                            {isClosed ? (
                              <div
                                style={{
                                  display: 'flex',
                                  flexWrap: 'wrap',
                                  gap: '0.5rem',
                                  alignItems: 'center',
                                  width: '100%',
                                }}
                              >
                                <span
                                  style={{
                                    flex: '1 1 140px',
                                    minWidth: 0,
                                    textAlign: 'center',
                                    fontSize: '0.75rem',
                                    fontWeight: 400,
                                    color: 'var(--text-faint)',
                                    lineHeight: 1.35,
                                  }}
                                >
                                  {dispatchHintText}
                                </span>
                                <button
                                  type="button"
                                  disabled={!hasDispatchNoteContent || dispatchRowSaving}
                                  onClick={() => onSubmitNote(req.id)}
                                  style={{
                                    flexShrink: 0,
                                    marginLeft: 'auto',
                                    padding: '0.35rem 0.75rem',
                                    border: 'none',
                                    borderRadius: 4,
                                    fontSize: '0.875rem',
                                    transition: dispatchBtnTransition,
                                    ...(dispatchRowSaving
                                      ? {
                                          background: '#d1d5db',
                                          color: 'white',
                                          cursor: 'not-allowed',
                                        }
                                      : hasDispatchNoteContent
                                        ? {
                                            background: '#2563eb',
                                            color: 'white',
                                            cursor: 'pointer',
                                          }
                                        : {
                                            background: 'var(--bg-muted)',
                                            color: 'var(--text-faint)',
                                            cursor: 'not-allowed',
                                          }),
                                  }}
                                >
                                  {dispatchRowSaving ? 'Saving…' : 'Send and reopen'}
                                </button>
                              </div>
                            ) : (
                              <div
                                style={{
                                  display: 'flex',
                                  flexWrap: 'wrap',
                                  gap: '0.5rem',
                                  alignItems: 'center',
                                  width: '100%',
                                }}
                              >
                                <button
                                  type="button"
                                  disabled={!hasDispatchNoteContent || dispatchRowSaving}
                                  onClick={() => onSubmitNote(req.id)}
                                  style={{
                                    flexShrink: 0,
                                    padding: '0.35rem 0.75rem',
                                    border: 'none',
                                    borderRadius: 4,
                                    fontSize: '0.875rem',
                                    transition: dispatchBtnTransition,
                                    ...(dispatchRowSaving
                                      ? {
                                          background: '#d1d5db',
                                          color: 'white',
                                          cursor: 'not-allowed',
                                        }
                                      : hasDispatchNoteContent
                                        ? {
                                            background: '#2563eb',
                                            color: 'white',
                                            cursor: 'pointer',
                                          }
                                        : {
                                            background: 'var(--bg-muted)',
                                            color: 'var(--text-faint)',
                                            cursor: 'not-allowed',
                                          }),
                                  }}
                                >
                                  {dispatchRowSaving ? 'Saving…' : 'Add note'}
                                </button>
                                <span
                                  style={{
                                    flex: '1 1 140px',
                                    minWidth: 0,
                                    textAlign: 'center',
                                    fontSize: '0.75rem',
                                    fontWeight: 400,
                                    color: 'var(--text-faint)',
                                    lineHeight: 1.35,
                                  }}
                                >
                                  {dispatchHintText}
                                </span>
                                <button
                                  type="button"
                                  disabled={!hasDispatchNoteContent || dispatchRowSaving}
                                  onClick={() => onSubmitNoteAndClose(req.id)}
                                  style={{
                                    flexShrink: 0,
                                    marginLeft: 'auto',
                                    padding: '0.35rem 0.75rem',
                                    borderRadius: 4,
                                    fontSize: '0.875rem',
                                    transition: dispatchBtnTransition,
                                    ...(dispatchRowSaving
                                      ? {
                                          background: 'var(--bg-200)',
                                          color: 'var(--text-faint)',
                                          border: '1px solid var(--border-strong)',
                                          cursor: 'not-allowed',
                                        }
                                      : hasDispatchNoteContent
                                        ? {
                                            background: 'var(--surface)',
                                            color: 'var(--text-red-700)',
                                            border: '1px solid #fecaca',
                                            cursor: 'pointer',
                                          }
                                        : {
                                            background: 'var(--bg-subtle)',
                                            color: 'var(--text-faint)',
                                            border: '1px solid var(--border)',
                                            cursor: 'not-allowed',
                                          }),
                                  }}
                                >
                                  {dispatchRowSaving ? 'Saving…' : 'Add & Close'}
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    {narrow && isClosed ? dismissBottomBar : null}
                    </div>
                  </li>
                  </Fragment>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
