import { Fragment } from 'react'
import { ChecklistTitleWithLinks } from './ChecklistTitleWithLinks'
import { DispatchNoteCombobox } from './DispatchNoteCombobox'
import { getDispatchNoteDisplayMeta } from '../utils/dispatchNoteDisplay'
import { useNarrowViewport640 } from '../hooks/useNarrowViewport640'

export type DispatchInboxRow = {
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
  /** Stable in-app action affordance token (e.g. 'link_job_pictures'). */
  pending_action: string | null
  /** Job this dispatch refers to (used by action affordances). */
  job_ledger_id: string | null
  /** Thread notes on this request (from dispatch_request_notes). */
  note_count?: number
  last_note_at?: string | null
}

export type DispatchThreadNoteRow = {
  id: string
  body: string
  created_at: string
  author: { name: string | null } | null
}

/** Dismissed archive row: same as inbox row plus when this user dismissed it. */
export type DispatchInboxDismissedRow = DispatchInboxRow & { dismissed_at: string }

function formatDatetime(iso: string | null): string {
  if (!iso) return 'unknown'
  const date = new Date(iso)
  const weekday = date.toLocaleDateString(undefined, { weekday: 'short' })
  const dateTime = date.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
  return `${weekday}, ${dateTime}`
}

type DispatchInboxSectionProps = {
  /** Dashboard: bordered card + collapsible header. Quickfill: body only (parent supplies title). */
  variant?: 'card' | 'embedded'
  /** Card header only. Default "Dispatch inbox". */
  sectionTitle?: string
  /** Header count badge. Default open count; use "closed" for a closed-only list. */
  headerBadge?: 'open' | 'closed' | 'none'
  sectionOpen: boolean
  onToggleSection: () => void
  requests: DispatchInboxRow[]
  loading: boolean
  expandedRequestId: string | null
  onToggleExpandRequest: (requestId: string) => void
  notesByRequestId: Record<string, DispatchThreadNoteRow[]>
  notesLoadingRequestId: string | null
  noteSubmitRequestId: string | null
  canAddNotes: boolean
  dispatchRequestDismissingId: string | null
  noteDraft: string
  onNoteDraftChange: (draft: string) => void
  onSubmitNote: (requestId: string) => void
  onSubmitNoteAndClose: (requestId: string) => void
  onDismiss: (requestId: string) => void
  onOpenDismissedArchive?: () => void
  /** Opens Edit Job with the Customer Pictures input scrolled into view and focused. */
  onLinkJobPictures?: (jobId: string) => void
}

export function DispatchInboxSection({
  variant = 'card',
  sectionTitle = 'Dispatch inbox',
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
  dispatchRequestDismissingId,
  noteDraft,
  onNoteDraftChange,
  onSubmitNote,
  onSubmitNoteAndClose,
  onDismiss,
  onOpenDismissedArchive,
  onLinkJobPictures,
}: DispatchInboxSectionProps) {
  const narrow = useNarrowViewport640()
  const body = (
        <div
          style={
            variant === 'embedded'
              ? { padding: 0 }
              : { padding: '0.75rem 1rem', borderTop: '1px solid #e5e7eb' }
          }
        >
          {loading ? (
            <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>Loading…</p>
          ) : requests.length === 0 ? (
            <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>
              {headerBadge === 'closed' ? 'No closed dispatch items.' : 'No dispatch requests.'}
            </p>
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
                const lastNoteMeta = req.last_note_at ? getDispatchNoteDisplayMeta(req.last_note_at) : null
                const statsEl = (
                  <div
                    style={{
                      fontSize: '0.75rem',
                      color: '#6b7280',
                      lineHeight: 1.35,
                    }}
                  >
                    <div style={{ fontWeight: 600, color: '#374151' }}>{noteCountLabel}</div>
                    {lastNoteMeta ? (
                      narrow ? (
                        <div
                          style={{
                            marginTop: 2,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 2,
                          }}
                        >
                          <span>Last {lastNoteMeta.weekdayTimeChicago}</span>
                          <span>{lastNoteMeta.daysAgoLabel}</span>
                        </div>
                      ) : (
                        <div style={{ marginTop: 2 }}>
                          Last {lastNoteMeta.weekdayTimeChicago} · {lastNoteMeta.daysAgoLabel}
                        </div>
                      )
                    ) : null}
                  </div>
                )
                const dismissBtn = (
                  <button
                    type="button"
                    onClick={() => onDismiss(req.id)}
                    disabled={dispatchRequestDismissingId === req.id}
                    style={{
                      padding: '0.35rem 0.75rem',
                      background: '#e5e7eb',
                      border: 'none',
                      borderRadius: 4,
                      cursor: dispatchRequestDismissingId === req.id ? 'not-allowed' : 'pointer',
                      fontSize: '0.875rem',
                      flexShrink: 0,
                    }}
                  >
                    {dispatchRequestDismissingId === req.id ? '…' : 'Dismiss'}
                  </button>
                )
                const showLinkJobPicturesAction =
                  !isClosed &&
                  req.pending_action === 'link_job_pictures' &&
                  !!req.job_ledger_id &&
                  !!onLinkJobPictures
                const linkJobPicturesBtn = showLinkJobPicturesAction ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      if (req.job_ledger_id && onLinkJobPictures) {
                        onLinkJobPictures(req.job_ledger_id)
                      }
                    }}
                    title="Open Edit Job and focus the Customer Pictures input"
                    aria-label="Add Customer Pictures URL"
                    style={{
                      padding: '0.35rem 0.75rem',
                      background: 'white',
                      border: '1px solid #93c5fd',
                      borderRadius: 4,
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      color: '#1d4ed8',
                      fontWeight: 500,
                      flexShrink: 0,
                    }}
                  >
                    Add Customer Pictures URL
                  </button>
                ) : null
                return (
                  <Fragment key={req.id}>
                    {isFirstClosed ? (
                      <li
                        style={{
                          listStyle: 'none',
                          padding: '0.75rem 0 0',
                          margin: 0,
                          borderBottom: 'none',
                          textAlign: 'center',
                        }}
                      >
                        <div
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            color: '#6b7280',
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                          }}
                        >
                          Closed
                        </div>
                      </li>
                    ) : null}
                    <li
                      style={{
                        padding: '0.75rem 0',
                        borderBottom: '1px solid #f3f4f6',
                        background: isClosed ? '#f3f4f6' : undefined,
                      }}
                    >
                    <div
                      style={
                        narrow
                          ? {
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'stretch',
                              gap: '0.5rem',
                            }
                          : {
                              display: 'flex',
                              flexWrap: 'wrap',
                              alignItems: 'flex-start',
                              gap: '0.5rem',
                            }
                      }
                    >
                      <div
                        role="button"
                        tabIndex={0}
                        aria-expanded={expanded}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            onToggleExpandRequest(req.id)
                          }
                        }}
                        onClick={(e) => {
                          if ((e.target as HTMLElement).closest('a')) return
                          onToggleExpandRequest(req.id)
                        }}
                        style={
                          narrow
                            ? {
                                flex: 'none',
                                minWidth: 0,
                                width: '100%',
                                cursor: 'pointer',
                                textAlign: 'left',
                                paddingRight: 0,
                              }
                            : {
                                flex: 1,
                                minWidth: 200,
                                cursor: 'pointer',
                                textAlign: 'left',
                                paddingRight: '0.5rem',
                              }
                        }
                      >
                        <span style={{ fontSize: '0.75rem', color: '#6b7280', marginRight: 6 }} aria-hidden>
                          {expanded ? '▼' : '▶'}
                        </span>
                        <div style={{ fontSize: '0.8125rem', color: '#6b7280', marginBottom: 4, display: 'inline' }}>
                          From {fromLabel}
                          {req.created_at ? (
                            <span style={{ marginLeft: '0.5rem' }}>· {formatDatetime(req.created_at)}</span>
                          ) : null}
                        </div>
                        <div style={{ fontWeight: 500 }}>
                          <ChecklistTitleWithLinks title={req.title} links={req.links ?? []} />
                        </div>
                        {req.reference_summary?.trim() ? (
                          <div style={{ marginTop: 6, fontSize: '0.8125rem', color: '#4b5563' }}>
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
                              style={{ color: '#2563eb', textDecoration: 'none' }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              View location
                            </a>
                          </div>
                        ) : null}
                      </div>
                      <div
                        style={
                          narrow
                            ? {
                                flexShrink: 0,
                                width: '100%',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'flex-start',
                                gap: 6,
                                textAlign: 'left',
                              }
                            : {
                                flexShrink: 0,
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'flex-end',
                                gap: 6,
                                textAlign: 'right',
                                maxWidth: 'min(220px, 45%)',
                              }
                        }
                      >
                        {narrow && isClosed ? (
                          <div
                            style={{
                              display: 'flex',
                              flexDirection: 'row',
                              alignItems: 'flex-start',
                              gap: '0.5rem',
                              width: '100%',
                            }}
                          >
                            <div style={{ flex: 1, minWidth: 0 }}>{statsEl}</div>
                            <div
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'flex-end',
                                gap: 4,
                                flexShrink: 0,
                              }}
                            >
                              {dismissBtn}
                              {noteCount > 0 ? (
                                <div style={{ fontSize: '0.75rem', color: '#6b7280', textAlign: 'right' }}>
                                  Expand for thread
                                </div>
                              ) : null}
                            </div>
                          </div>
                        ) : narrow && !isClosed ? (
                          <>
                            {statsEl}
                            {linkJobPicturesBtn}
                          </>
                        ) : (
                          <>
                            {statsEl}
                            {linkJobPicturesBtn}
                            {isClosed ? (
                              <>
                                <div style={{ display: 'contents' }}>{dismissBtn}</div>
                                {noteCount > 0 ? (
                                  <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Expand for thread</div>
                                ) : null}
                              </>
                            ) : null}
                          </>
                        )}
                      </div>
                    </div>
                    {expanded && (
                      <div
                        style={{
                          marginTop: '0.75rem',
                          padding: '0.75rem',
                          background: '#fff',
                          border: '1px solid #e5e7eb',
                          borderRadius: 6,
                        }}
                      >
                        <div style={{ fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.5rem', color: '#374151' }}>
                          Activity / notes (Central Time)
                        </div>
                        {notesLoading ? (
                          <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>Loading notes…</p>
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
                                  <div style={{ color: '#6b7280', marginBottom: 2 }}>
                                    <strong style={{ color: '#111827' }}>{authorName}</strong>
                                    <span style={{ marginLeft: '0.5rem' }}>
                                      {weekdayTimeChicago} · {daysAgoLabel}
                                    </span>
                                  </div>
                                  <div style={{ color: '#1f2937' }}>{n.body}</div>
                                </li>
                              )
                            })}
                            {isClosed && req.closed_at ? (
                              <li
                                style={{
                                  padding: '0.5rem 0',
                                  fontSize: '0.8125rem',
                                  background: '#f0fdf4',
                                  margin: '0 -0.5rem -0.5rem',
                                  paddingLeft: '0.5rem',
                                  paddingRight: '0.5rem',
                                  borderTop: '1px solid #bbf7d0',
                                }}
                              >
                                <div style={{ color: '#166534', fontWeight: 600, marginBottom: 4 }}>Marked closed (final)</div>
                                <div style={{ color: '#6b7280', marginBottom: 2 }}>
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
                                  color: '#6b7280',
                                  padding: '0.5rem 0.6rem',
                                  background: '#f9fafb',
                                  borderRadius: 4,
                                  border: '1px solid #e5e7eb',
                                }}
                              >
                                This task is closed. Your message will be added to the thread and reopen it.
                              </div>
                            ) : null}
                            <label htmlFor={`dispatch-note-combobox-${req.id}`} style={{ fontSize: '0.75rem', color: '#6b7280', display: 'block' }}>
                              <DispatchNoteCombobox
                                id={`dispatch-note-combobox-${req.id}`}
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
                                    color: '#9ca3af',
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
                                            background: '#f3f4f6',
                                            color: '#9ca3af',
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
                                            background: '#f3f4f6',
                                            color: '#9ca3af',
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
                                    color: '#9ca3af',
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
                                          background: '#e5e7eb',
                                          color: '#9ca3af',
                                          border: '1px solid #d1d5db',
                                          cursor: 'not-allowed',
                                        }
                                      : hasDispatchNoteContent
                                        ? {
                                            background: 'white',
                                            color: '#b91c1c',
                                            border: '1px solid #fecaca',
                                            cursor: 'pointer',
                                          }
                                        : {
                                            background: '#f9fafb',
                                            color: '#9ca3af',
                                            border: '1px solid #e5e7eb',
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
                  </li>
                  </Fragment>
                )
              })}
            </ul>
          )}
          {onOpenDismissedArchive ? (
            <div
              style={{
                marginTop: '0.75rem',
                paddingTop: '0.75rem',
                borderTop: '1px solid #e5e7eb',
              }}
            >
              <button
                type="button"
                onClick={onOpenDismissedArchive}
                style={{
                  padding: '0.4rem 0.75rem',
                  fontSize: '0.875rem',
                  background: '#f3f4f6',
                  border: '1px solid #d1d5db',
                  borderRadius: 4,
                  cursor: 'pointer',
                  color: '#374151',
                }}
              >
                View dismissed…
              </button>
            </div>
          ) : null}
        </div>
  )

  if (variant === 'embedded') {
    return sectionOpen ? body : null
  }

  return (
    <div style={{ marginBottom: '1.5rem', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
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
          background: '#f9fafb',
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
          <span style={{ marginLeft: '0.5rem', fontSize: '0.875rem', fontWeight: 500, color: '#2563eb' }}>
            {headerBadge === 'open'
              ? `(${requests.filter((r) => r.status === 'open').length} open)`
              : `(${requests.filter((r) => r.status === 'closed').length} closed)`}
          </span>
        ) : null}
      </button>
      {sectionOpen && body}
    </div>
  )
}
