import { Fragment, useState } from 'react'
import { Link } from 'react-router-dom'
import { Archive } from 'lucide-react'
import { ChecklistTitleWithLinks } from './ChecklistTitleWithLinks'
import { DispatchNoteCombobox } from './DispatchNoteCombobox'
import {
  formatDispatchNoteDaysAgoShort,
  formatDispatchNoteDaysAgoShortPhrase,
  getDispatchNoteDisplayMeta,
} from '../utils/dispatchNoteDisplay'
import { useNarrowViewport640 } from '../hooks/useNarrowViewport640'
import { useAuth } from '../hooks/useAuth'
import { useJobFormModal } from '../contexts/JobFormModalContext'
import { OPEN_JOB_FROM_BID_ACTION } from '../lib/bids/wonDispatchHandoff'
import { CustomerWaitingRequestCard } from './CustomerWaitingRequestCard'
import { RequestPrioritySheet } from './RequestPrioritySheet'
import { isCustomerWaiting, portalKindLabel, type RequestPriority } from '../lib/requestPriority'
import { parsePortalRequestPayload } from '../lib/portalRequestPayload'
import { recordNavClick } from '../lib/navClickTelemetry'
import {
  AGING_ITEM_OPENED_CONTROL,
  ageChipStyle,
  agingItemOpenedTarget,
  describeAge,
  DISPATCH_REQUEST_AGE,
  shouldRecordAgingOpen,
} from '../lib/ageState'

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
  /** Bid this dispatch refers to (v2.3143: the "open the job" to-do). */
  bid_id?: string | null
  /** Customer Waiting (v2.3247): 'high' = a customer is waiting; open high rows lead the list. */
  priority?: 'normal' | 'high' | null
  priority_changed_at?: string | null
  /** Who last tapped Call on this request, and when (log_request_call). */
  last_called_at?: string | null
  last_called_by?: { name: string | null } | null
  /** Structured context (portal requests: customer, words, phone). Parsed by portalRequestPayload.ts. */
  pending_payload?: unknown
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

function formatDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'short' })
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
  /** find_property_owner requests (v2.1610): opens Job Detail with the Share-with-supply-house modal on top. */
  onOpenSupplyHouseShare?: (jobId: string) => void
  /** Opens the Create Trip Charge modal for a Turnaway request (pending_action 'trip_charge_turnaway'). */
  onCreateTripCharge?: (args: { requestId: string; jobId: string; referenceSummary: string | null }) => void
  /** Customer Waiting (v2.3247): raise or lower a request's priority (RPC set_request_priority). */
  onSetPriority?: (requestId: string, priority: RequestPriority, note: string | null) => Promise<boolean> | void
  /** Customer Waiting (v2.3247): Call / Text was used on a waiting row — log it (RPC log_request_call). */
  onLogCall?: (requestId: string, phoneDisplay: string) => void
  /** Row whose priority change is in flight. */
  prioritySavingId?: string | null
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
  onOpenSupplyHouseShare,
  onCreateTripCharge,
  onSetPriority,
  onLogCall,
  prioritySavingId = null,
}: DispatchInboxSectionProps) {
  // v2.3143: the "open the job" to-do's one button runs the app-level New Job door itself.
  const jobFormModal = useJobFormModal()
  const narrow = useNarrowViewport640()
  const { user: authUser, role } = useAuth()
  // Customer Waiting (v2.3247): which row the lower/raise sheet is open for.
  const [prioritySheet, setPrioritySheet] = useState<{ requestId: string; direction: 'lower' | 'raise'; label: string } | null>(null)
  const prioritySheetEl =
    prioritySheet && onSetPriority ? (
      <RequestPrioritySheet
        direction={prioritySheet.direction}
        requestLabel={prioritySheet.label}
        saving={prioritySavingId === prioritySheet.requestId}
        onConfirm={async (note) => {
          const ok = await onSetPriority(prioritySheet.requestId, prioritySheet.direction === 'raise' ? 'high' : 'normal', note)
          if (ok !== false) setPrioritySheet(null)
        }}
        onClose={() => setPrioritySheet(null)}
      />
    ) : null
  const body = (
        <div
          style={
            variant === 'embedded'
              ? { padding: 0 }
              : { padding: '0.75rem 1rem', borderTop: '1px solid var(--border)' }
          }
        >
          {loading ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading…</p>
          ) : requests.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
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
                const waiting = isCustomerWaiting(req)
                const waitingPortal = waiting ? parsePortalRequestPayload(req.pending_payload) : null
                const waitingLabel = waitingPortal?.customerName ? `${waitingPortal.customerName} · ${portalKindLabel(waitingPortal.kind)}` : req.title.slice(0, 80)
                // Age chip on OPEN rows (journey-map #40): fresh / amber / red at
                // DISPATCH_REQUEST_AGE — 46 days no longer looks like 4. Opening an
                // aging row records `aging_item_opened` so the backlog stays measurable.
                const openAge = isClosed ? null : describeAge(req.created_at, undefined, DISPATCH_REQUEST_AGE)
                const toggleThread = () => {
                  if (!expanded && openAge && shouldRecordAgingOpen(openAge.state)) {
                    recordNavClick(
                      authUser?.id,
                      role,
                      AGING_ITEM_OPENED_CONTROL,
                      agingItemOpenedTarget('dispatch-request', openAge.days, openAge.state),
                    )
                  }
                  onToggleExpandRequest(req.id)
                }
                // Narrow closed rows: full-width green bar across the card bottom —
                // the phone-sized counterpart of the desktop Dismiss rail.
                const dismissBottomBar = (
                  <button
                    type="button"
                    onClick={() => onDismiss(req.id)}
                    disabled={dispatchRequestDismissingId === req.id}
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
                      cursor: dispatchRequestDismissingId === req.id ? 'not-allowed' : 'pointer',
                    }}
                  >
                    <span aria-hidden>✓</span>
                    {dispatchRequestDismissingId === req.id ? '…' : 'Dismiss'}
                  </button>
                )
                // Desktop closed rows: full-height Dismiss rail on the left — reads as
                // "done, ready to archive" and gives dismissal a big obvious target.
                const showDismissRail = isClosed && !narrow
                const dismissRail = (
                  <button
                    type="button"
                    onClick={() => onDismiss(req.id)}
                    disabled={dispatchRequestDismissingId === req.id}
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
                      cursor: dispatchRequestDismissingId === req.id ? 'not-allowed' : 'pointer',
                    }}
                  >
                    <span aria-hidden style={{ fontSize: '1rem', lineHeight: 1 }}>✓</span>
                    {dispatchRequestDismissingId === req.id ? '…' : 'Dismiss'}
                  </button>
                )
                const openJobBidId = !isClosed && req.pending_action === OPEN_JOB_FROM_BID_ACTION && jobFormModal ? (req.bid_id ?? null) : null
                const openJobFromBidBtn = openJobBidId ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      jobFormModal?.openNewJob({ prefillBidId: openJobBidId })
                    }}
                    title="Open New Job filled in from the bid — customer, address, links and the price question. Press Create Job and this to-do closes itself."
                    aria-label="Open the job from this bid"
                    style={{
                      padding: '0.35rem 0.75rem',
                      background: 'var(--surface)',
                      border: '1px solid var(--border-green)',
                      borderRadius: 4,
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      color: 'var(--text-green-700)',
                      fontWeight: 600,
                      flexShrink: 0,
                    }}
                  >
                    Open the job
                  </button>
                ) : null
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
                      background: 'var(--surface)',
                      border: '1px solid #93c5fd',
                      borderRadius: 4,
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      color: 'var(--text-blue-700)',
                      fontWeight: 500,
                      flexShrink: 0,
                    }}
                  >
                    Add Customer Pictures URL
                  </button>
                ) : null
                const showOpenSupplyShareAction =
                  !isClosed &&
                  req.pending_action === 'find_property_owner' &&
                  !!req.job_ledger_id &&
                  !!onOpenSupplyHouseShare
                const openSupplyShareBtn = showOpenSupplyShareAction ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      if (req.job_ledger_id && onOpenSupplyHouseShare) {
                        onOpenSupplyHouseShare(req.job_ledger_id)
                      }
                    }}
                    title="Open Job Detail with the Share-with-supply-house modal — fill the owner and send"
                    aria-label="Open Share with supply house"
                    style={{
                      padding: '0.35rem 0.75rem',
                      background: 'var(--surface)',
                      border: '1px solid #93c5fd',
                      borderRadius: 4,
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      color: 'var(--text-blue-700)',
                      fontWeight: 500,
                      flexShrink: 0,
                    }}
                  >
                    Open Share with supply house
                  </button>
                ) : null
                // Quick Estimate (v2.2293): field write-up → open the draft the
                // wizard created (links[0] is /estimates/<number>).
                const fieldEstimateLink =
                  !isClosed && req.pending_action === 'review_field_estimate' ? (req.links?.[0] ?? null) : null
                const openFieldEstimateBtn = fieldEstimateLink ? (
                  <Link
                    to={fieldEstimateLink}
                    onClick={(e) => e.stopPropagation()}
                    title="Open the draft the field sent — finish pricing and send it to the customer"
                    style={{
                      padding: '0.35rem 0.75rem',
                      background: 'var(--surface)',
                      border: '1px solid var(--border-amber)',
                      borderRadius: 4,
                      fontSize: '0.875rem',
                      color: 'var(--text-amber-700)',
                      fontWeight: 500,
                      flexShrink: 0,
                      textDecoration: 'none',
                    }}
                  >
                    Open the draft
                  </Link>
                ) : null
                const showCreateTripChargeAction =
                  !isClosed &&
                  req.pending_action === 'trip_charge_turnaway' &&
                  !!req.job_ledger_id &&
                  !!onCreateTripCharge
                const createTripChargeBtn = showCreateTripChargeAction ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      if (req.job_ledger_id && onCreateTripCharge) {
                        onCreateTripCharge({
                          requestId: req.id,
                          jobId: req.job_ledger_id,
                          referenceSummary: req.reference_summary,
                        })
                      }
                    }}
                    title="Create a ready-to-bill trip charge for this Turnaway"
                    aria-label="Create trip charge"
                    style={{
                      padding: '0.35rem 0.75rem',
                      background: 'var(--surface)',
                      border: '1px solid var(--border-amber)',
                      borderRadius: 4,
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      color: 'var(--text-amber-700)',
                      fontWeight: 500,
                      flexShrink: 0,
                    }}
                  >
                    Create trip charge
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
                              borderBottom: '1px solid var(--border)',
                              background: 'var(--bg-muted)',
                              display: 'flex',
                              alignItems: 'stretch',
                              gap: '0.75rem',
                            }
                          : {
                              padding: '0.75rem 0',
                              borderBottom: '1px solid var(--border)',
                              background: isClosed ? 'var(--bg-muted)' : undefined,
                            }
                      }
                    >
                    {showDismissRail ? dismissRail : null}
                    <div style={showDismissRail ? { flex: 1, minWidth: 0, padding: '0.75rem 0.75rem 0.75rem 0' } : undefined}>
                    <div
                      // Whole collapsed row toggles the thread; the guard lets clicks on links
                      // and action buttons (Dismiss, Add Pictures, Trip Charge) through untouched.
                      role="button"
                      tabIndex={0}
                      aria-expanded={expanded}
                      onKeyDown={(e) => {
                        if ((e.target as HTMLElement).closest('a, button, input, textarea, select')) return
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          toggleThread()
                        }
                      }}
                      onClick={(e) => {
                        if ((e.target as HTMLElement).closest('a, button, input, textarea, select')) return
                        toggleThread()
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
                        {waiting ? (
                          <CustomerWaitingRequestCard
                            row={req}
                            narrow={narrow}
                            onCall={(phoneDisplay) => onLogCall?.(req.id, phoneDisplay)}
                            onLower={() => setPrioritySheet({ requestId: req.id, direction: 'lower', label: waitingLabel })}
                            onClose={() => {
                              if (!expanded) toggleThread()
                            }}
                          />
                        ) : (
                          <div style={{ fontWeight: 500 }}>
                            <ChecklistTitleWithLinks title={req.title} links={req.links ?? []} />
                          </div>
                        )}
                        <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: 4 }}>
                          <span style={{ fontSize: '0.75rem', marginRight: 6 }} aria-hidden>
                            {expanded ? '▼' : '▶'}
                          </span>
                          From {fromLabel}
                          {req.created_at ? (
                            <span style={{ marginLeft: '0.5rem' }} title={formatDatetime(req.created_at)}>
                              · {formatDateShort(req.created_at)}
                              {openAge ? (
                                <span
                                  style={{
                                    marginLeft: '0.35rem',
                                    fontSize: '0.72rem',
                                    fontWeight: 600,
                                    padding: '0.08rem 0.45rem',
                                    borderRadius: 7,
                                    whiteSpace: 'nowrap',
                                    ...ageChipStyle(openAge.state),
                                  }}
                                >
                                  {openAge.label}
                                </span>
                              ) : (
                                <> ({formatDispatchNoteDaysAgoShort(req.created_at)})</>
                              )}
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
                        {openJobFromBidBtn}
                        {linkJobPicturesBtn}
                        {openSupplyShareBtn}
                        {createTripChargeBtn}
                        {openFieldEstimateBtn}
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
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.5rem' }}>
                          <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-700)' }}>Activity / notes (Central Time)</div>
                          {!isClosed && !waiting && onSetPriority ? (
                            <button
                              type="button"
                              onClick={() => setPrioritySheet({ requestId: req.id, direction: 'raise', label: req.title.slice(0, 80) })}
                              title="Mark it a customer waiting — red rail, top of the list, banner for the whole team"
                              style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem', fontWeight: 600, borderRadius: 999, border: '1px solid var(--border-red)', background: 'var(--surface)', color: 'var(--text-red-700)', cursor: 'pointer' }}
                            >
                              Raise priority
                            </button>
                          ) : null}
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
                                    borderBottom: '1px solid var(--border)',
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
                                  borderTop: '1px solid var(--border-green)',
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
                            <label htmlFor={`dispatch-note-combobox-${req.id}`} style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>
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
          {prioritySheetEl}
        </div>
  )

  if (variant === 'embedded') {
    return sectionOpen ? body : null
  }

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
        {onOpenDismissedArchive ? (
          <button
            type="button"
            onClick={onOpenDismissedArchive}
            title="View dismissed dispatch items"
            style={{
              marginLeft: 'auto',
              padding: 0,
              background: 'none',
              border: 'none',
              fontSize: '0.75rem',
              fontWeight: 600,
              color: 'var(--text-muted)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            View dismissed…
          </button>
        ) : null}
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
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          background: hasOpenWork ? 'var(--bg-amber-tint)' : 'var(--bg-subtle)',
        }}
      >
        <button
          type="button"
          onClick={onToggleSection}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            flex: 1,
            minWidth: 0,
            padding: '0.75rem 1rem',
            margin: 0,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '1rem',
            fontWeight: 600,
            textAlign: 'left',
          }}
        >
          <span aria-hidden>{sectionOpen ? '▼' : '▶'}</span>
          {/* One-line header (v2.1238): the title ellipsizes and the count is a
              nowrap chip, so neither can wrap under the archive button. */}
          <span style={{ minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {sectionTitle}
          </span>
          {!loading && requests.length > 0 && headerBadge !== 'none' ? (
            <span
              style={{
                flexShrink: 0,
                marginLeft: '0.35rem',
                padding: '0.1rem 0.6rem',
                borderRadius: 999,
                fontSize: '0.75rem',
                fontWeight: 700,
                whiteSpace: 'nowrap',
                background: hasOpenWork ? '#f59e0b' : 'var(--bg-muted)',
                color: hasOpenWork ? '#ffffff' : 'var(--text-700)',
              }}
            >
              {headerBadge === 'open'
                ? `${requests.filter((r) => r.status === 'open').length} open`
                : `${requests.filter((r) => r.status === 'closed').length} closed`}
            </span>
          ) : null}
        </button>
        {onOpenDismissedArchive ? (
          narrow ? (
            <button
              type="button"
              onClick={onOpenDismissedArchive}
              title="View dismissed dispatch items"
              aria-label="View dismissed dispatch items"
              style={{
                flexShrink: 0,
                marginRight: '0.75rem',
                width: 30,
                height: 30,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
                background: 'var(--surface)',
                border: '1px solid var(--border-strong)',
                borderRadius: 999,
                color: 'var(--text-700)',
                cursor: 'pointer',
              }}
            >
              <Archive size={15} aria-hidden />
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenDismissedArchive}
              title="View dismissed dispatch items"
              style={{
                flexShrink: 0,
                marginRight: '0.75rem',
                padding: '0.25rem 0.75rem',
                fontSize: '0.75rem',
                fontWeight: 600,
                background: 'var(--surface)',
                border: '1px solid var(--border-strong)',
                borderRadius: 999,
                color: 'var(--text-700)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              View dismissed…
            </button>
          )
        ) : null}
      </div>
      {sectionOpen && body}
    </div>
  )
}
