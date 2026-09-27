/**
 * The estimate list's two renderings — the table, and the phone cards — with the props seam
 * `EstimateList` hands them (rows, the two modal setters, the optional Customer column, the
 * thread-notes bundle, the opened / declined chips). Moved whole out of `src/pages/Estimates.tsx`
 * (step 2 of the Estimates map, v2.3869): no state moved, no behavior changed — the only hook
 * is `useAuth()` for the viewer's role on the thread panel, and the cards' tap-hint timer.
 */
import { computeEstimateListReadiness, computeSentWait, isBidProposalDocKind, estimateDraftMeaningfulLineCount, readinessDots } from '../../lib/estimatePipelineRefresh'
import { EstimateChangeOrderChip, EstimateLegacyChangeOrderTitleChip } from './EstimateKindChips'
import { estimateLinkedJobHcp, estimateListCustomerColumnLines, estimateListCustomerSubline, estimateListOptionsSuffix, estimateStatusLabel as statusLabel, formatEstimateMoney as formatMoney, type EstimateListRow } from '../../lib/estimates/estimateListRows'
import { formatEstimateListUpdatedLines } from '../../lib/formatEstimateListUpdated'
import { Fragment, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react'
import { getDispatchNoteDisplayMeta } from '../../utils/dispatchNoteDisplay'
import { isChangeOrderDocKind, isLegacyChangeOrderTitledEstimate } from '../../lib/estimateChangeOrder'
import { JobThreadNotesPanel, type JobThreadNoteRow } from '../../components/JobThreadNotesPanel'
import { Link } from 'react-router-dom'
import { TAP_HINT_DURATION_MS, isDeadTap } from '../../lib/tapHint'
import { type EstimateOpenState } from '../../lib/estimateOpenState'
import { type EstimateThreadNoteStats } from '../../hooks/useEstimateThreadNotes'
import { useAuth } from '../../hooks/useAuth'

/** Slim outline button for “Create job” in Estimates list Status column. */
const estimateListCreateJobButtonStyle: CSSProperties = {
  padding: '0.22rem 0.55rem',
  fontSize: '0.75rem',
  lineHeight: 1.2,
  fontWeight: 600,
  border: '1px solid var(--border-strong)',
  borderRadius: 6,
  background: 'var(--bg-subtle)',
  color: 'var(--text-strong)',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}

export const ESTIMATE_LIST_CUSTOMER_SNAPSHOT_BTN_CLASS = 'estimate-customer-snapshot-cell-btn'

/** Violet "Bid ✍" pill (v2.2470): a signed bid-room proposal riding the estimates rails. */
function EstimateBidProposalChip({ compact }: { compact?: boolean }) {
  return (
    <span
      style={{
        display: 'inline-block',
        background: 'var(--bg-violet-100)',
        color: 'var(--text-indigo-800)',
        border: '1px solid var(--border-strong)',
        borderRadius: 999,
        padding: compact ? '0 0.4rem' : '0.05rem 0.5rem',
        fontSize: compact ? '0.625rem' : '0.6875rem',
        fontWeight: 600,
        whiteSpace: 'nowrap',
        verticalAlign: 'middle',
      }}
    >
      Bid ✍
    </span>
  )
}

/** Amber "With Dispatch" chip on drafts a field write-up handed to Dispatch (Quick Estimate, v2.2293). */
function withDispatchChip(r: EstimateListRow): ReactNode {
  if (r.status !== 'draft' || !r.sent_to_dispatch_at) return null
  return (
    <span
      style={{
        display: 'inline-block',
        fontSize: '0.65rem',
        fontWeight: 800,
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
        padding: '2px 8px',
        borderRadius: 999,
        background: 'var(--bg-amber-100)',
        color: 'var(--text-amber-800)',
        marginRight: 6,
      }}
      title="Sent to Dispatch from the field — Dispatch owns finishing this draft"
    >
      With Dispatch
    </span>
  )
}

export type EstimateListStagesThread = {
  estimateThreadStatsByEstimateId: Record<string, EstimateThreadNoteStats>
  estimateThreadNotesByEstimateId: Record<string, JobThreadNoteRow[]>
  estimateThreadNotesLoadingId: string | null
  expandedEstimateThreadId: string | null
  toggleEstimateThreadExpanded: (estimateId: string) => void
  estimateThreadDraft: string
  setEstimateThreadDraft: (v: string) => void
  estimateThreadSubmittingId: string | null
  submitEstimateThreadNote: (estimateId: string) => void
  canPostNotes: boolean
}

export type EstimateListTableProps = {
  rows: EstimateListRow[]
  setAcceptanceModalEstimateId: (id: string | null) => void
  setCreateJobFromListRow: (row: EstimateListRow | null) => void
  /** When true (Stages Unsent/Sent), show Customer as its own column; Title omits the grey subline. */
  showCustomerColumn?: boolean
  /** When set with a linked `customer_id`, Customer column opens CustomerSnapshotModal. */
  onCustomerSnapshotRequest?: (customerId: string) => void
  /** Estimates Stages: Last activity column + expandable thread notes. */
  stagesThread?: EstimateListStagesThread
  /**
   * v2.2873 (J17-F1): opened / never opened per Sent row, from the list's one chunked
   * `estimate_customer_events` fetch. Absent (still loading) → the chip falls back to
   * `computeSentWait` alone, exactly as before.
   */
  sentOpenStateById?: Record<string, EstimateOpenState | null>
  /** v2.2873: "Declined by customer · 2d ago" for rows in the Declined bucket. */
  declinedLabelById?: Record<string, string>
}

const estimateListCustomerCellStyle: CSSProperties = {
  fontSize: '0.85rem',
  color: 'var(--text-muted)',
  overflowWrap: 'anywhere',
  wordBreak: 'break-word',
}

const estimateListCustomerColumnNameStyle: CSSProperties = {
  fontSize: '0.85rem',
  fontWeight: 500,
  color: 'var(--text-strong)',
  overflowWrap: 'anywhere',
  wordBreak: 'break-word',
}

const estimateListCustomerSnapshotButtonStyle: CSSProperties = {
  display: 'block',
  width: '100%',
  margin: 0,
  padding: 0,
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  textAlign: 'left',
  font: 'inherit',
  borderRadius: 4,
}

export function EstimateListTable({
  rows,
  setAcceptanceModalEstimateId,
  setCreateJobFromListRow,
  showCustomerColumn = false,
  onCustomerSnapshotRequest,
  stagesThread,
  sentOpenStateById,
  declinedLabelById,
}: EstimateListTableProps) {
  const { role: estimateListViewerRole } = useAuth()
  const showStagesActivity = stagesThread != null
  const threadColSpan = 6 + (showCustomerColumn ? 1 : 0)

  const tdShellStyle: CSSProperties = {
    padding: '0.5rem',
    verticalAlign: 'top',
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: '0.35rem',
  }

  function renderExpandButton(estimateId: string) {
    if (!stagesThread) return null
    const expanded = stagesThread.expandedEstimateThreadId === estimateId
    const stat = stagesThread.estimateThreadStatsByEstimateId[estimateId]
    const count = stat?.note_count ?? 0
    return (
      <button
        type="button"
        onClick={() => stagesThread.toggleEstimateThreadExpanded(estimateId)}
        aria-expanded={expanded}
        title={count > 0 ? `${count} thread note(s)` : 'Estimate notes thread'}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2,
          padding: '0.25rem',
          border: 'none',
          background: 'none',
          cursor: 'pointer',
          color: 'var(--text-700)',
          fontSize: '0.75rem',
          lineHeight: 1.1,
          flexShrink: 0,
          alignSelf: 'flex-start',
        }}
      >
        <span aria-hidden>{expanded ? '\u25BC' : '\u25B6'}</span>
        {count > 0 ? (
          <span style={{ fontSize: '0.65rem', color: 'var(--text-link)', fontWeight: 600 }}>{count}</span>
        ) : null}
      </button>
    )
  }

  function lastActivityBodyInteractiveProps(
    st: EstimateListStagesThread,
    estimateId: string,
    title: string,
    expanded: boolean,
  ): {
    role: 'button'
    tabIndex: number
    title: string
    'aria-expanded': boolean
    onClick: () => void
    onKeyDown: (e: ReactKeyboardEvent<HTMLDivElement>) => void
    style: CSSProperties
  } {
    return {
      role: 'button',
      tabIndex: 0,
      title,
      'aria-expanded': expanded,
      onClick: () => st.toggleEstimateThreadExpanded(estimateId),
      onKeyDown: (e: ReactKeyboardEvent<HTMLDivElement>) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          st.toggleEstimateThreadExpanded(estimateId)
        }
      },
      style: {
        flex: 1,
        minWidth: 0,
        cursor: 'pointer',
      },
    }
  }

  function renderLastActivityCell(r: EstimateListRow) {
    if (!stagesThread) return null
    const st = stagesThread
    const estimateId = r.id
    const stat = st.estimateThreadStatsByEstimateId[estimateId]
    const count = stat?.note_count ?? 0
    const notes = st.estimateThreadNotesByEstimateId[estimateId]
    const lastNote = notes?.length ? notes[notes.length - 1] : undefined
    const fromThreadBody = (lastNote?.body ?? '').trim()
    const titleForEmpty = 'Estimate notes thread'
    const titleWithNotes = count > 0 ? `${count} thread note(s)` : titleForEmpty
    const expanded = st.expandedEstimateThreadId === estimateId

    if (count === 0 || !stat?.last_note_at) {
      return (
        <td style={tdShellStyle}>
          <div
            style={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'flex-start',
              gap: 2,
              flexShrink: 0,
            }}
          >
            {renderExpandButton(estimateId)}
          </div>
          <div {...lastActivityBodyInteractiveProps(st, estimateId, titleForEmpty, expanded)}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-faint)' }}>—</span>
          </div>
        </td>
      )
    }
    const meta = getDispatchNoteDisplayMeta(stat.last_note_at)
    const author = stat.last_note_author_name?.trim() || lastNote?.author?.name?.trim() || ''
    const body = (stat.last_note_body ?? '').trim() || fromThreadBody
    return (
      <td style={{ ...tdShellStyle, maxWidth: 280 }}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: 2,
            flexShrink: 0,
          }}
        >
          {renderExpandButton(estimateId)}
        </div>
        <div {...lastActivityBodyInteractiveProps(st, estimateId, titleWithNotes, expanded)}>
          <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
            {author ? <span>{author}</span> : null}
            {author ? <span style={{ margin: '0 0.35rem' }}>·</span> : null}
            <span>{meta.weekdayTimeChicago}</span>
            <span style={{ marginLeft: '0.35rem' }}>({meta.daysAgoLabel})</span>
          </div>
          <div
            style={{
              fontSize: '0.8125rem',
              color: 'var(--text-700)',
              lineHeight: 1.35,
              wordBreak: 'break-word',
              whiteSpace: 'pre-wrap',
              maxHeight: '4.2em',
              overflow: 'hidden',
            }}
          >
            {body || '—'}
          </div>
        </div>
      </td>
    )
  }

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
      <thead>
        <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
          <th style={{ padding: '0.5rem', whiteSpace: 'nowrap' }}>#</th>
          <th style={{ padding: '0.5rem', lineHeight: 1.3 }}>
            <div>Title</div>
            {showCustomerColumn ? null : (
              <div style={{ fontSize: '0.8rem', fontWeight: 400, color: 'var(--text-muted)' }}>Customer</div>
            )}
          </th>
          {showCustomerColumn ? (
            <th style={{ padding: '0.5rem' }}>Customer</th>
          ) : null}
          <th style={{ padding: '0.5rem' }}>Status</th>
          <th style={{ padding: '0.5rem' }}>Total</th>
          <th style={{ padding: '0.5rem' }}>Updated</th>
          {showStagesActivity ? (
            <th style={{ padding: '0.5rem', minWidth: 200 }}>Last activity</th>
          ) : null}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const updatedLines = formatEstimateListUpdatedLines(r.updated_at)
          const mainRow = (
            <>
              <td style={{ padding: '0.5rem', fontVariantNumeric: 'tabular-nums' }}>{r.estimate_number}</td>
              <td style={{ padding: '0.5rem', minWidth: 0 }}>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.15rem',
                    minWidth: 0,
                  }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', minWidth: 0, flexWrap: 'wrap' }}>
                    <Link to={`/estimates/${r.estimate_number}`}>{r.title || '—'}</Link>
                    {isChangeOrderDocKind(r.doc_kind) ? <EstimateChangeOrderChip compact /> : isBidProposalDocKind(r.doc_kind) ? <EstimateBidProposalChip compact /> : isLegacyChangeOrderTitledEstimate(r.doc_kind, r.title) ? <EstimateLegacyChangeOrderTitleChip compact /> : null}
                  </span>
                  {showCustomerColumn ? null : (
                    <span style={estimateListCustomerCellStyle}>{estimateListCustomerSubline(r)}</span>
                  )}
                </div>
              </td>
              {showCustomerColumn ? (
                <td style={{ padding: '0.5rem', minWidth: 0 }}>
                  {(() => {
                    const { primary, secondary } = estimateListCustomerColumnLines(r)
                    const cust = r.customers
                    const hasCustomerName = cust != null && (cust.name ?? '').trim() !== ''
                    const primaryIsName = hasCustomerName && (secondary != null || (cust.address ?? '').trim() === '')
                    const cid = r.customer_id
                    const inner = (
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.15rem',
                          minWidth: 0,
                        }}
                      >
                        <span style={primaryIsName ? estimateListCustomerColumnNameStyle : estimateListCustomerCellStyle}>
                          {primary}
                        </span>
                        {secondary ? <span style={estimateListCustomerCellStyle}>{secondary}</span> : null}
                      </div>
                    )
                    if (cid && onCustomerSnapshotRequest) {
                      const labelName = (cust?.name ?? primary).trim() || 'customer'
                      return (
                        <button
                          type="button"
                          className={ESTIMATE_LIST_CUSTOMER_SNAPSHOT_BTN_CLASS}
                          onClick={() => onCustomerSnapshotRequest(cid)}
                          style={estimateListCustomerSnapshotButtonStyle}
                          aria-label={`View customer details for ${labelName}`}
                        >
                          {inner}
                        </button>
                      )
                    }
                    return inner
                  })()}
                </td>
              ) : null}
              <td style={{ padding: '0.5rem' }}>
                {r.status === 'customer_accepted' ? (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      gap: '0.35rem',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setAcceptanceModalEstimateId(r.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        cursor: 'pointer',
                        color: 'var(--text-blue-700)',
                        textDecoration: 'underline',
                        font: 'inherit',
                        textAlign: 'left',
                      }}
                      aria-label={`View acceptance record for estimate ${r.estimate_number}`}
                    >
                      Accepted — view
                    </button>
                    {r.job_ledger_id ? (
                      <Link
                        to={`/jobs?edit=${r.job_ledger_id}`}
                        style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-green-600)' }}
                      >
                        {(() => {
                          const hcp = estimateLinkedJobHcp(r)
                          return hcp ? `Job #${hcp}` : 'Job linked'
                        })()}
                      </Link>
                    ) : (
                      <>
                      <span
                        style={{
                          display: 'inline-block',
                          background: 'var(--bg-amber-tint)',
                          border: '1px solid #f59e0b',
                          color: 'var(--text-amber-800)',
                          borderRadius: 999,
                          padding: '0.05rem 0.5rem',
                          fontSize: '0.68rem',
                          fontWeight: 600,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        not on a job yet
                      </span>
                      <button
                        type="button"
                        onClick={() => setCreateJobFromListRow(r)}
                        style={estimateListCreateJobButtonStyle}
                        title={isChangeOrderDocKind(r.doc_kind) ? 'Apply this change order to a job' : 'Create a linked job from this estimate'}
                        aria-label={isChangeOrderDocKind(r.doc_kind) ? 'Apply change order to job' : 'Create job from estimate'}
                      >
                        {isChangeOrderDocKind(r.doc_kind) ? 'Apply to job' : 'Create job'}
                      </button>
                      </>
                    )}
                  </div>
                ) : (
                  (r.status === 'draft' ? (() => {
                    const d = readinessDots(computeEstimateListReadiness(r))
                    return (
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: d.ready ? 'var(--text-green-600)' : 'var(--text-muted)' }}>
                        {withDispatchChip(r)}
                        <span aria-hidden style={{ letterSpacing: '0.1em' }}>
                          <span style={{ color: 'var(--text-green-600)' }}>{'●'.repeat(d.done)}</span>
                          <span style={{ color: 'var(--border-strong)' }}>{'○'.repeat(d.todo)}</span>
                        </span>{' '}
                        {d.label}
                      </span>
                    )
                  })() : r.status === 'sent' ? (() => {
                    // v2.2873 (J17-F1): "opened Tue · quiet 2d" / "never opened · sent 7d ago — nudge?"
                    // once the list's events fetch has landed; computeSentWait alone until then.
                    const w = sentOpenStateById?.[r.id] ?? computeSentWait(r, Date.now())
                    if (!w) return statusLabel(r.status)
                    return (
                      <span
                        title={'opened' in w ? (w.opened ? `Customer opened this ${w.openCount} time${w.openCount === 1 ? '' : 's'}` : 'No customer has opened the link yet') : undefined}
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          color:
                            w.level === 'overdue' ? 'var(--text-red-700)'
                            : w.level === 'warn' ? 'var(--text-amber-800)'
                            : 'var(--text-muted)',
                        }}
                      >
                        {w.label}
                      </span>
                    )
                  })() : r.status === 'declined' ? (
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                      {declinedLabelById?.[r.id] ?? statusLabel(r.status)}
                    </span>
                  ) : statusLabel(r.status))
                )}
              </td>
              <td style={{ padding: '0.5rem' }}>{r.status === 'draft' && estimateDraftMeaningfulLineCount(r.line_items_snapshot, isChangeOrderDocKind(r.doc_kind)) === 0 ? '—' : <>{formatMoney(r.total_cents)}<span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{estimateListOptionsSuffix(r)}</span></>}</td>
              <td style={{ padding: '0.5rem', color: 'var(--text-muted)' }}>
                {updatedLines ? (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.15rem',
                      lineHeight: 1.25,
                    }}
                  >
                    <span>{updatedLines.short}</span>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-faint)' }}>{updatedLines.relative}</span>
                  </div>
                ) : (
                  '—'
                )}
              </td>
              {showStagesActivity ? renderLastActivityCell(r) : null}
            </>
          )

          if (!showStagesActivity) {
            return (
              <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                {mainRow}
              </tr>
            )
          }

          const st = stagesThread
          const expanded = st.expandedEstimateThreadId === r.id
          return (
            <Fragment key={r.id}>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>{mainRow}</tr>
              {expanded ? (
                <tr>
                  <td
                    colSpan={threadColSpan}
                    style={{
                      padding: '0.5rem 0.75rem',
                      background: 'var(--bg-subtle)',
                      borderBottom: '1px solid var(--border)',
                    }}
                  >
                    <JobThreadNotesPanel
                      sectionTitle="Estimate activity / notes"
                      showComposerLabel={false}
                      notes={st.estimateThreadNotesByEstimateId[r.id] ?? []}
                      loading={st.estimateThreadNotesLoadingId === r.id}
                      canPost={st.canPostNotes}
                      draft={st.estimateThreadDraft}
                      onDraftChange={st.setEstimateThreadDraft}
                      onSubmit={() => void st.submitEstimateThreadNote(r.id)}
                      submitting={st.estimateThreadSubmittingId === r.id}
                      viewerRole={estimateListViewerRole}
                    />
                  </td>
                </tr>
              ) : null}
            </Fragment>
          )
        })}
      </tbody>
    </table>
  )
}

export function EstimateListCards({
  rows,
  setAcceptanceModalEstimateId,
  setCreateJobFromListRow,
  showCustomerColumn = false,
  onCustomerSnapshotRequest,
  stagesThread,
  sentOpenStateById,
  declinedLabelById,
}: EstimateListTableProps) {
  const { role: estimateListViewerRole } = useAuth()

  // Dead-tap hint (v2.2289): tapping a card where nothing is clickable
  // flashes the card's real click zones (mockup-approved). Fires only on
  // dead taps — a tap on a link/button just does its job.
  const [tapHintCardId, setTapHintCardId] = useState<string | null>(null)
  const tapHintTimerRef = useRef<number | null>(null)
  const showTapHint = (cardId: string) => {
    if (tapHintTimerRef.current != null) window.clearTimeout(tapHintTimerRef.current)
    setTapHintCardId(cardId)
    tapHintTimerRef.current = window.setTimeout(() => setTapHintCardId(null), TAP_HINT_DURATION_MS)
  }

  function renderExpandControl(estimateId: string) {
    if (!stagesThread) return null
    const expanded = stagesThread.expandedEstimateThreadId === estimateId
    const stat = stagesThread.estimateThreadStatsByEstimateId[estimateId]
    const count = stat?.note_count ?? 0
    return (
      <button
        type="button"
        onClick={() => stagesThread.toggleEstimateThreadExpanded(estimateId)}
        aria-expanded={expanded}
        title={count > 0 ? `${count} thread note(s)` : 'Estimate notes thread'}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2,
          padding: '0.25rem',
          border: 'none',
          background: 'none',
          cursor: 'pointer',
          color: 'var(--text-700)',
          fontSize: '0.75rem',
          lineHeight: 1.1,
          flexShrink: 0,
          alignSelf: 'flex-start',
        }}
      >
        <span aria-hidden>{expanded ? '\u25BC' : '\u25B6'}</span>
        {count > 0 ? (
          <span style={{ fontSize: '0.65rem', color: 'var(--text-link)', fontWeight: 600 }}>{count}</span>
        ) : null}
      </button>
    )
  }

  function renderCustomerSection(r: EstimateListRow) {
    if (!showCustomerColumn) {
      return (
        <div style={{ ...estimateListCustomerCellStyle, marginTop: '0.35rem' }}>
          {estimateListCustomerSubline(r)}
        </div>
      )
    }
    const { primary, secondary } = estimateListCustomerColumnLines(r)
    const cust = r.customers
    const hasCustomerName = cust != null && (cust.name ?? '').trim() !== ''
    const primaryIsName =
      hasCustomerName && (secondary != null || (cust.address ?? '').trim() === '')
    const cid = r.customer_id
    const inner = (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', minWidth: 0 }}>
        <span style={primaryIsName ? estimateListCustomerColumnNameStyle : estimateListCustomerCellStyle}>
          {primary}
        </span>
        {secondary ? <span style={estimateListCustomerCellStyle}>{secondary}</span> : null}
      </div>
    )
    if (cid && onCustomerSnapshotRequest) {
      const labelName = (cust?.name ?? primary).trim() || 'customer'
      return (
        <button
          type="button"
          className={ESTIMATE_LIST_CUSTOMER_SNAPSHOT_BTN_CLASS}
          onClick={() => onCustomerSnapshotRequest(cid)}
          style={{ ...estimateListCustomerSnapshotButtonStyle, marginTop: '0.35rem' }}
          aria-label={`View customer details for ${labelName}`}
        >
          {inner}
        </button>
      )
    }
    return <div style={{ marginTop: '0.35rem' }}>{inner}</div>
  }

  function renderStatusSection(r: EstimateListRow) {
    if (r.status === 'customer_accepted') {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            gap: '0.35rem',
            marginTop: '0.5rem',
          }}
        >
          <button
            type="button"
            onClick={() => setAcceptanceModalEstimateId(r.id)}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              color: 'var(--text-blue-700)',
              textDecoration: 'underline',
              font: 'inherit',
              textAlign: 'left',
            }}
            aria-label={`View acceptance record for estimate ${r.estimate_number}`}
          >
            Accepted — view
          </button>
          {r.job_ledger_id ? (
            <Link
              to={`/jobs?edit=${r.job_ledger_id}`}
              style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-green-600)' }}
            >
              {(() => {
                const hcp = estimateLinkedJobHcp(r)
                return hcp ? `Job #${hcp}` : 'Job linked'
              })()}
            </Link>
          ) : (
            <>
            <span
              style={{
                display: 'inline-block',
                background: 'var(--bg-amber-tint)',
                border: '1px solid #f59e0b',
                color: 'var(--text-amber-800)',
                borderRadius: 999,
                padding: '0.05rem 0.5rem',
                fontSize: '0.68rem',
                fontWeight: 600,
                whiteSpace: 'nowrap',
              }}
            >
              not on a job yet
            </span>
            <button
              type="button"
              onClick={() => setCreateJobFromListRow(r)}
              style={estimateListCreateJobButtonStyle}
              title={isChangeOrderDocKind(r.doc_kind) ? 'Apply this change order to a job' : 'Create a linked job from this estimate'}
              aria-label={isChangeOrderDocKind(r.doc_kind) ? 'Apply change order to job' : 'Create job from estimate'}
            >
              {isChangeOrderDocKind(r.doc_kind) ? 'Apply to job' : 'Create job'}
            </button>
            </>
          )}
        </div>
      )
    }
    return (
      <div style={{ marginTop: '0.5rem', fontWeight: 600, color: 'var(--text-700)' }}>{(r.status === 'draft' ? (() => {
                    const d = readinessDots(computeEstimateListReadiness(r))
                    return (
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: d.ready ? 'var(--text-green-600)' : 'var(--text-muted)' }}>
                        {withDispatchChip(r)}
                        <span aria-hidden style={{ letterSpacing: '0.1em' }}>
                          <span style={{ color: 'var(--text-green-600)' }}>{'●'.repeat(d.done)}</span>
                          <span style={{ color: 'var(--border-strong)' }}>{'○'.repeat(d.todo)}</span>
                        </span>{' '}
                        {d.label}
                      </span>
                    )
                  })() : r.status === 'sent' ? (() => {
                    // v2.2873 (J17-F1): "opened Tue · quiet 2d" / "never opened · sent 7d ago — nudge?"
                    // once the list's events fetch has landed; computeSentWait alone until then.
                    const w = sentOpenStateById?.[r.id] ?? computeSentWait(r, Date.now())
                    if (!w) return statusLabel(r.status)
                    return (
                      <span
                        title={'opened' in w ? (w.opened ? `Customer opened this ${w.openCount} time${w.openCount === 1 ? '' : 's'}` : 'No customer has opened the link yet') : undefined}
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          color:
                            w.level === 'overdue' ? 'var(--text-red-700)'
                            : w.level === 'warn' ? 'var(--text-amber-800)'
                            : 'var(--text-muted)',
                        }}
                      >
                        {w.label}
                      </span>
                    )
                  })() : r.status === 'declined' ? (
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                      {declinedLabelById?.[r.id] ?? statusLabel(r.status)}
                    </span>
                  ) : statusLabel(r.status))}</div>
    )
  }

  function renderLastActivitySection(r: EstimateListRow) {
    if (!stagesThread) return null
    const st = stagesThread
    const estimateId = r.id
    const stat = st.estimateThreadStatsByEstimateId[estimateId]
    const count = stat?.note_count ?? 0
    const notes = st.estimateThreadNotesByEstimateId[estimateId]
    const lastNote = notes?.length ? notes[notes.length - 1] : undefined
    const fromThreadBody = (lastNote?.body ?? '').trim()
    const expanded = st.expandedEstimateThreadId === estimateId
    const toggle = () => st.toggleEstimateThreadExpanded(estimateId)

    const previewButtonStyle: CSSProperties = {
      flex: 1,
      minWidth: 0,
      cursor: 'pointer',
      margin: 0,
      padding: 0,
      border: 'none',
      background: 'transparent',
      font: 'inherit',
      textAlign: 'left',
    }

    if (count === 0 || !stat?.last_note_at) {
      return (
        <div
          style={{
            display: 'flex',
            gap: '0.35rem',
            marginTop: '0.65rem',
            alignItems: 'flex-start',
          }}
        >
          {renderExpandControl(estimateId)}
          <button type="button" onClick={toggle} style={previewButtonStyle}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-faint)' }}>—</span>
          </button>
        </div>
      )
    }
    const meta = getDispatchNoteDisplayMeta(stat.last_note_at)
    const author = stat.last_note_author_name?.trim() || lastNote?.author?.name?.trim() || ''
    const body = (stat.last_note_body ?? '').trim() || fromThreadBody
    const titleWithNotes = count > 0 ? `${count} thread note(s)` : 'Estimate notes thread'

    return (
      <div
        style={{
          display: 'flex',
          gap: '0.35rem',
          marginTop: '0.65rem',
          alignItems: 'flex-start',
        }}
      >
        {renderExpandControl(estimateId)}
        <button
          type="button"
          title={titleWithNotes}
          aria-expanded={expanded}
          onClick={toggle}
          style={previewButtonStyle}
        >
          <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
            {author ? <span>{author}</span> : null}
            {author ? <span style={{ margin: '0 0.35rem' }}>·</span> : null}
            <span>{meta.weekdayTimeChicago}</span>
            <span style={{ marginLeft: '0.35rem' }}>({meta.daysAgoLabel})</span>
          </div>
          <div
            style={{
              fontSize: '0.8125rem',
              color: 'var(--text-700)',
              lineHeight: 1.35,
              wordBreak: 'break-word',
              whiteSpace: 'pre-wrap',
              maxHeight: '4.2em',
              overflow: 'hidden',
            }}
          >
            {body || '—'}
          </div>
        </button>
      </div>
    )
  }

  return (
    <div role="list" style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', minWidth: 0 }}>
      {rows.map((r) => {
        const updatedLines = formatEstimateListUpdatedLines(r.updated_at)
        const expanded = stagesThread?.expandedEstimateThreadId === r.id
        const st = stagesThread
        return (
          <div
            key={r.id}
            role="listitem"
            className={tapHintCardId === r.id ? 'estimate-card--tap-hint' : undefined}
            onClick={(e) => {
              if (isDeadTap(e.target)) showTapHint(r.id)
            }}
            style={{
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '0.75rem',
              background: 'var(--surface)',
              minWidth: 0,
            }}
          >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: '0.75rem',
                  alignItems: 'flex-start',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ flex: '1 1 12rem', minWidth: 0 }}>
                  <Link
                    to={`/estimates/${r.estimate_number}`}
                    style={{
                      fontVariantNumeric: 'tabular-nums',
                      fontWeight: 600,
                      fontSize: '0.9rem',
                    }}
                  >
                    #{r.estimate_number}
                  </Link>
                  {isChangeOrderDocKind(r.doc_kind) ? <EstimateChangeOrderChip compact /> : isBidProposalDocKind(r.doc_kind) ? <EstimateBidProposalChip compact /> : isLegacyChangeOrderTitledEstimate(r.doc_kind, r.title) ? <EstimateLegacyChangeOrderTitleChip compact /> : null}
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: '1rem',
                      marginTop: '0.15rem',
                      overflowWrap: 'break-word',
                      wordBreak: 'break-word',
                    }}
                  >
                    <Link to={`/estimates/${r.estimate_number}`} style={{ color: 'var(--text-strong)', textDecoration: 'none' }}>
                      {r.title || '—'}
                    </Link>
                  </div>
                  {renderCustomerSection(r)}
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0, minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>{r.status === 'draft' && estimateDraftMeaningfulLineCount(r.line_items_snapshot, isChangeOrderDocKind(r.doc_kind)) === 0 ? '—' : <>{formatMoney(r.total_cents)}<span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 400 }}>{estimateListOptionsSuffix(r)}</span></>}</div>
                  {updatedLines ? (
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem', lineHeight: 1.25 }}>
                      <span>{updatedLines.short}</span>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-faint)' }}>{updatedLines.relative}</div>
                    </div>
                  ) : (
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-faint)' }}>—</span>
                  )}
                </div>
              </div>
              {renderStatusSection(r)}
              {renderLastActivitySection(r)}
              {st && expanded ? (
                <div
                  style={{
                    marginTop: '0.75rem',
                    paddingTop: '0.75rem',
                    borderTop: '1px solid var(--border)',
                    minWidth: 0,
                  }}
                >
                  <JobThreadNotesPanel
                    sectionTitle="Estimate activity / notes"
                    showComposerLabel={false}
                    notes={st.estimateThreadNotesByEstimateId[r.id] ?? []}
                    loading={st.estimateThreadNotesLoadingId === r.id}
                    canPost={st.canPostNotes}
                    draft={st.estimateThreadDraft}
                    onDraftChange={st.setEstimateThreadDraft}
                    onSubmit={() => void st.submitEstimateThreadNote(r.id)}
                    submitting={st.estimateThreadSubmittingId === r.id}
                    viewerRole={estimateListViewerRole}
                  />
                </div>
              ) : null}
            </div>
        )
      })}
    </div>
  )
}

