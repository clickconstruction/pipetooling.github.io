import { useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  formatUnifiedResult,
  serviceTypeTagForUnifiedRow,
  type JobSearchResult,
  type BidSearchResult,
  type UnifiedSearchResult,
} from '../utils/unifiedJobBidSearch'
import { useLedgerDisplayPrefixes } from '../contexts/LedgerDisplayPrefixContext'
import { formatErrorMessage, withSupabaseRetry } from '../utils/errorHandling'

export type ClockSessionStripActionsPayload = {
  sessionId: string
  personName: string
  timeRangeLabel: string
  stripStatus: 'pending' | 'approved'
  hasJobOrBid: boolean
  notes: string | null
  job_ledger_id: string | null
  bid_id: string | null
  /** Full one-line label from embeds, or "Job linked" / "Bid linked" if embeds missing. */
  assignmentLabel: string | null
  /** Compact label for density; may match assignmentLabel. */
  assignmentShortLabel: string | null
  /** Modal: first line (e.g. J523 · Mission Hills); second line is address when present. */
  assignmentModalLine1: string | null
  assignmentModalLine2: string | null
  jobEditHref: string | null
  bidEditHref: string | null
}

type Props = {
  open: boolean
  payload: ClockSessionStripActionsPayload | null
  zIndex: number
  /** Popover / overlays inside modal (job search is inline; reserved for parity). */
  innerPopoverZIndex: number
  busy: boolean
  onClose: () => void
  onApprove: () => Promise<boolean>
  onRequestReject: () => void
  onRevoke: () => Promise<boolean>
  onSaved: () => void
  onError: (msg: string) => void
}

export function ClockSessionStripActionsModal({
  open,
  payload,
  zIndex,
  innerPopoverZIndex: _innerPopoverZIndex,
  busy,
  onClose,
  onApprove,
  onRequestReject,
  onRevoke,
  onSaved,
  onError,
}: Props) {
  void _innerPopoverZIndex
  const { prefixMap } = useLedgerDisplayPrefixes()
  const titleId = useId()
  const assignmentRegionId = useId()
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [memoDraft, setMemoDraft] = useState('')
  const [memoSaving, setMemoSaving] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [searchResults, setSearchResults] = useState<UnifiedSearchResult[]>([])
  const [assignLoading, setAssignLoading] = useState(false)
  const [assignmentSearchExpanded, setAssignmentSearchExpanded] = useState(true)

  useEffect(() => {
    if (open && payload) {
      setMemoDraft(payload.notes ?? '')
      setSearchText('')
      setSearchResults([])
      setAssignmentSearchExpanded(!payload.hasJobOrBid)
    }
  }, [open, payload?.sessionId, payload?.notes, payload?.hasJobOrBid, payload?.job_ledger_id, payload?.bid_id])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || busy) return
      e.preventDefault()
      onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, busy, onClose])

  useEffect(() => {
    if (!open || !payload) return
    const t = setTimeout(() => {
      const q = searchText.trim()
      if (!q) {
        setSearchResults([])
        return
      }
      Promise.all([
        supabase.rpc('search_jobs_ledger', { search_text: q }),
        supabase.rpc('search_bids_for_clock', { p_search_text: q }),
      ]).then(([jobsRes, bidsRes]) => {
        const jobs = (jobsRes.data ?? []) as JobSearchResult[]
        const bids = (bidsRes.data ?? []) as BidSearchResult[]
        setSearchResults([
          ...jobs.map((j) => ({ source: 'job' as const, ...j })),
          ...bids.map((b) => ({ source: 'bid' as const, ...b })),
        ])
      })
    }, 300)
    return () => clearTimeout(t)
  }, [open, payload, searchText])

  if (!open || !payload) return null

  const p = payload
  const sid = p.sessionId
  const hasJobOrBid = !!(p.job_ledger_id || p.bid_id)
  const footerBusy = busy || memoSaving || assignLoading
  const showAssignmentSearch = !hasJobOrBid || assignmentSearchExpanded
  const assignmentFallbackSingle =
    p.assignmentLabel ?? (hasJobOrBid ? (p.job_ledger_id ? 'Job linked' : 'Bid linked') : null)
  const assignmentLine1 = p.assignmentModalLine1 ?? assignmentFallbackSingle
  const assignmentLine2 = (p.assignmentModalLine2 ?? '').trim() || null
  const showAssignmentTwoLines = assignmentLine1 != null && assignmentLine2 != null

  async function handleSelect(item: UnifiedSearchResult) {
    setAssignLoading(true)
    try {
      await withSupabaseRetry(
        async () =>
          supabase
            .from('clock_sessions')
            .update({
              job_ledger_id: item.source === 'job' ? item.id : null,
              bid_id: item.source === 'bid' ? item.id : null,
            })
            .eq('id', sid),
        'assign session job/bid from strip modal',
      )
      onSaved()
    } catch (e) {
      onError(formatErrorMessage(e))
    } finally {
      setAssignLoading(false)
    }
  }

  async function handleClearAssignment() {
    setAssignLoading(true)
    try {
      await withSupabaseRetry(
        async () =>
          supabase.from('clock_sessions').update({ job_ledger_id: null, bid_id: null }).eq('id', sid),
        'clear session job/bid from strip modal',
      )
      onSaved()
    } catch (e) {
      onError(formatErrorMessage(e))
    } finally {
      setAssignLoading(false)
    }
  }

  async function handleSaveMemo() {
    const next = memoDraft.trim()
    const prev = (p.notes ?? '').trim()
    if (next === prev) return
    setMemoSaving(true)
    try {
      await withSupabaseRetry(
        async () =>
          supabase.from('clock_sessions').update({ notes: next }).eq('id', sid),
        'save clock session notes from strip modal',
      )
      onSaved()
    } catch (e) {
      onError(formatErrorMessage(e))
    } finally {
      setMemoSaving(false)
    }
  }

  return (
    <div
      role="presentation"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex,
      }}
      onClick={(e) => {
        if (e.target !== e.currentTarget || footerBusy) return
        onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={{
          background: 'white',
          padding: '1.5rem',
          borderRadius: 8,
          minWidth: 320,
          maxWidth: 460,
          maxHeight: '90vh',
          overflow: 'auto',
          margin: '1rem',
          boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ textAlign: 'center' as const, marginBottom: '1rem' }}>
          <h2 id={titleId} style={{ margin: '0 0 0.5rem', fontSize: '1.125rem' }}>
            Session actions
          </h2>
          <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280' }}>
            <strong style={{ color: '#374151' }}>{p.personName}</strong>
            {' · '}
            {p.timeRangeLabel}
            {' · '}
            <span style={{ color: p.stripStatus === 'approved' ? '#16a34a' : '#6b7280' }}>
              {p.stripStatus === 'approved' ? 'Approved' : 'Pending'}
            </span>
          </p>
        </div>

        <div
          style={{
            border: '1px solid #e5e7eb',
            borderRadius: 8,
            padding: '0.75rem',
            marginBottom: '1rem',
            background: '#fafafa',
          }}
        >
          {hasJobOrBid ? (
            <section
              id={assignmentRegionId}
              aria-label="Job or bid assigned to this session"
              style={{ marginBottom: '0.75rem' }}
            >
              {showAssignmentTwoLines ? (
                <>
                  <div
                    style={{
                      fontSize: '0.875rem',
                      color: '#374151',
                      marginBottom: 4,
                      lineHeight: 1.35,
                      wordBreak: 'break-word' as const,
                    }}
                  >
                    {assignmentLine1}
                  </div>
                  <div
                    style={{
                      fontSize: '0.875rem',
                      color: '#6b7280',
                      marginBottom: 8,
                      lineHeight: 1.35,
                      wordBreak: 'break-word' as const,
                    }}
                  >
                    {assignmentLine2}
                  </div>
                </>
              ) : (
                <div
                  style={{
                    fontSize: '0.875rem',
                    color: '#374151',
                    marginBottom: 8,
                    lineHeight: 1.35,
                    wordBreak: 'break-word' as const,
                  }}
                >
                  {assignmentLine1}
                </div>
              )}
              <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '0.35rem', alignItems: 'center', marginBottom: 8 }}>
                {p.jobEditHref ? (
                  <Link
                    to={p.jobEditHref}
                    style={{ fontSize: '0.8125rem', color: '#2563eb' }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    Open job
                  </Link>
                ) : null}
                {p.bidEditHref ? (
                  <Link
                    to={p.bidEditHref}
                    style={{ fontSize: '0.8125rem', color: '#2563eb' }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    Open bid
                  </Link>
                ) : null}
                <button
                  type="button"
                  disabled={footerBusy}
                  onClick={() => {
                    setAssignmentSearchExpanded(true)
                    requestAnimationFrame(() => searchInputRef.current?.focus())
                  }}
                  style={{
                    padding: '0.25rem 0.5rem',
                    fontSize: '0.8125rem',
                    border: '1px solid #d1d5db',
                    borderRadius: 4,
                    background: 'white',
                    cursor: footerBusy ? 'not-allowed' : 'pointer',
                    color: '#374151',
                  }}
                >
                  Change assignment
                </button>
                <button
                  type="button"
                  aria-label="Clear job or bid assignment"
                  onClick={() => void handleClearAssignment()}
                  disabled={footerBusy}
                  style={{
                    padding: '0.25rem 0.5rem',
                    fontSize: '0.8125rem',
                    border: '1px solid #d1d5db',
                    borderRadius: 4,
                    background: 'white',
                    cursor: footerBusy ? 'not-allowed' : 'pointer',
                    color: '#6b7280',
                  }}
                >
                  Clear
                </button>
              </div>
            </section>
          ) : null}

          <textarea
            id={`${titleId}-memo`}
            aria-label="Session notes"
            value={memoDraft}
            onChange={(e) => setMemoDraft(e.target.value)}
            rows={3}
            disabled={footerBusy}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '0.5rem',
              border: '1px solid #d1d5db',
              borderRadius: 4,
              fontSize: '0.875rem',
              marginBottom: '0.5rem',
              resize: 'vertical' as const,
            }}
          />
          <button
            type="button"
            disabled={footerBusy || memoDraft.trim() === (p.notes ?? '').trim()}
            onClick={() => void handleSaveMemo()}
            style={{
              padding: '0.35rem 0.65rem',
              fontSize: '0.8125rem',
              border: '1px solid #d1d5db',
              borderRadius: 4,
              background: 'white',
              cursor: footerBusy ? 'not-allowed' : 'pointer',
              marginBottom: '0.75rem',
            }}
          >
            {memoSaving ? 'Saving…' : 'Save memo'}
          </button>

          {showAssignmentSearch ? (
            <>
              <label htmlFor={`${titleId}-assign-search`} style={{ fontSize: '0.75rem', color: '#6b7280', display: 'block', marginBottom: 4 }}>
                {hasJobOrBid && assignmentSearchExpanded ? 'Replace assignment' : 'Search for a job or bid'}
              </label>
              <input
                ref={searchInputRef}
                id={`${titleId}-assign-search`}
                type="search"
                aria-label="Search jobs and bids to assign to this session"
                placeholder="Search HCP, bid #, job name…"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                disabled={footerBusy}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  marginBottom: '0.5rem',
                  border: '1px solid #d1d5db',
                  borderRadius: 4,
                  boxSizing: 'border-box',
                }}
              />
              <div
                style={{
                  maxHeight: 160,
                  overflowY: 'auto',
                  marginBottom: '0.5rem',
                  border: '1px solid #e5e7eb',
                  borderRadius: 4,
                  background: 'white',
                }}
              >
                {searchText.trim() ? (
                  searchResults.length === 0 ? (
                    <div style={{ padding: '0.5rem', color: '#6b7280', fontSize: '0.8125rem' }}>No results</div>
                  ) : (
                    searchResults.map((item) => (
                      <button
                        key={`${item.source}:${item.id}`}
                        type="button"
                        onClick={() => void handleSelect(item)}
                        disabled={footerBusy}
                        style={{
                          display: 'block',
                          width: '100%',
                          padding: '0.4rem 0.5rem',
                          textAlign: 'left',
                          border: 'none',
                          borderBottom: '1px solid #f3f4f6',
                          background: 'none',
                          cursor: footerBusy ? 'not-allowed' : 'pointer',
                          fontSize: '0.8125rem',
                        }}
                      >
                        <span style={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          {(() => {
                            const t = serviceTypeTagForUnifiedRow(item)
                            return t ? (
                              <span
                                style={{
                                  padding: '0.1rem 0.35rem',
                                  fontSize: '0.65rem',
                                  fontWeight: 500,
                                  background: t.color,
                                  color: '#fff',
                                  borderRadius: 4,
                                }}
                              >
                                [{t.tag}]
                              </span>
                            ) : null
                          })()}
                          {formatUnifiedResult(item, prefixMap)}
                        </span>
                      </button>
                    ))
                  )
                ) : (
                  <div style={{ padding: '0.5rem', color: '#6b7280', fontSize: '0.8125rem' }}>Type to search</div>
                )}
              </div>
            </>
          ) : null}
        </div>

        <div
          style={{
            display: 'flex',
            width: '100%',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.5rem',
          }}
        >
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {p.stripStatus === 'pending' ? (
              <button
                type="button"
                disabled={footerBusy}
                onClick={() => {
                  onRequestReject()
                }}
                style={{
                  padding: '0.5rem 1rem',
                  border: '1px solid #dc2626',
                  background: '#fef2f2',
                  color: '#b91c1c',
                  borderRadius: 4,
                  cursor: footerBusy ? 'not-allowed' : 'pointer',
                  fontWeight: 600,
                }}
              >
                Reject…
              </button>
            ) : null}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginLeft: 'auto' }}>
            <button
              type="button"
              disabled={footerBusy}
              onClick={onClose}
              style={{
                padding: '0.5rem 1rem',
                border: '1px solid #d1d5db',
                background: 'white',
                borderRadius: 4,
                cursor: footerBusy ? 'not-allowed' : 'pointer',
              }}
            >
              Close
            </button>
            {p.stripStatus === 'pending' ? (
              <button
                type="button"
                disabled={footerBusy}
                onClick={() => void onApprove().then((ok) => { if (ok) onClose() })}
                style={{
                  padding: '0.5rem 1rem',
                  border: '1px solid #22c55e',
                  background: '#f0fdf4',
                  color: '#15803d',
                  borderRadius: 4,
                  cursor: footerBusy ? 'not-allowed' : 'pointer',
                  fontWeight: 600,
                }}
              >
                Approve
              </button>
            ) : (
              <button
                type="button"
                disabled={footerBusy}
                onClick={() => {
                  void (async () => {
                    if (await onRevoke()) onClose()
                  })()
                }}
                style={{
                  padding: '0.5rem 1rem',
                  border: '1px solid #d97706',
                  background: '#fffbeb',
                  color: '#b45309',
                  borderRadius: 4,
                  cursor: footerBusy ? 'not-allowed' : 'pointer',
                  fontWeight: 600,
                }}
              >
                Revoke approval…
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
