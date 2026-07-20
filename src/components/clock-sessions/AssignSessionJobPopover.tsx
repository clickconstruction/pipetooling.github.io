import type { CSSProperties } from 'react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  fetchDispatchScheduledJobsForAssigneeDay,
  type DispatchScheduledJobForAssign,
} from '../../lib/jobScheduleBlocks'
import { supabase } from '../../lib/supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import {
  formatUnifiedResult,
  serviceTypeTagForUnifiedRow,
  type JobSearchResult,
  type BidSearchResult,
  type UnifiedSearchResult,
} from '../../utils/unifiedJobBidSearch'
import { useLedgerDisplayPrefixes } from '../../contexts/LedgerDisplayPrefixContext'
import type { ClockSessionRow } from '../../types/clockSessions'
import { isDraftPeopleHoursSessionId } from '../../lib/peopleHoursManualDraftSession'

export type AssignSessionJobPopoverSession = Pick<ClockSessionRow, 'id' | 'job_ledger_id' | 'bid_id'>

/** After a successful assign or clear; `selection: null` means job/bid cleared. */
export type AssignSessionJobSavedPatch = {
  sessionId: string
  selection: UnifiedSearchResult | null
}

type Props = {
  session: AssignSessionJobPopoverSession
  /** When set, runs before DB update to e.g. persist splits so `session.id` targets only this segment. Return null to abort. */
  resolveSessionForAssign?: () => Promise<AssignSessionJobPopoverSession | null>
  onSaved: (patch?: AssignSessionJobSavedPatch) => void
  onError?: (msg: string) => void
  /** Default 100; use higher value when opened inside another modal (e.g. 1250). */
  popoverZIndex?: number
  /**
   * When unassigned: 'default' is the blue Assign button; 'combined' is one chip (No Job or Bid | Add).
   * Ignored when session already has a job or bid.
   */
  unassignedTrigger?: 'default' | 'combined'
  /** Shorter Assign/Change control for dense tables (e.g. dashboard clock strip). */
  compactTrigger?: boolean
  /** When false and session already has job/bid, render no trigger (e.g. strip where day editor handles changes). Default true. */
  showChangeWhenAssigned?: boolean
  /**
   * When both set, load Dispatch (`job_schedule_blocks`) jobs for this assignee + work date and show quick-picks above search.
   */
  dispatchScheduleAssigneeUserId?: string
  dispatchScheduleWorkDateYmd?: string
  /**
   * People Hours draft rows are not in `clock_sessions` yet. When set, assign/clear updates parent state only (no DB).
   */
  draftLocalJobBidAssign?: (
    target: AssignSessionJobPopoverSession,
    selection: UnifiedSearchResult | null,
  ) => void
  /**
   * Day editor only: show an "Apply Schedule %" action across from the Dispatch header that
   * proportionally splits the worked session across the day's scheduled jobs. Gated by the parent
   * to days where no session is linked to a job/bid yet.
   */
  showApplyScheduleProportions?: boolean
  /** Called with the loaded Dispatch picks when "Apply Schedule %" is clicked. */
  onApplyScheduleProportions?: (picks: DispatchScheduledJobForAssign[]) => void
}

const ASSIGN_POPOVER_ESTIMATED_HEIGHT = 360

function dispatchPickToUnified(p: DispatchScheduledJobForAssign): UnifiedSearchResult {
  return {
    source: 'job',
    id: p.jobId,
    service_type_id: p.service_type_id,
    hcp_number: p.hcp_number,
    job_name: p.job_name,
    job_address: p.job_address,
  }
}

const assignButtonStyle = {
  padding: '0.2rem 0.5rem',
  fontSize: '0.8125rem' as const,
  border: '1px solid #3b82f6',
  borderRadius: 4,
  background: 'var(--bg-blue-tint)',
  color: 'var(--text-link)',
  cursor: 'pointer' as const,
}

const changeButtonStyle = {
  padding: '0.2rem 0.5rem',
  fontSize: '0.8125rem' as const,
  border: '1px solid var(--border-strong)',
  borderRadius: 4,
  background: 'var(--surface)',
  color: 'var(--text-muted)',
  cursor: 'pointer' as const,
}

function compactAssignStyle(base: typeof assignButtonStyle): CSSProperties {
  return {
    ...base,
    padding: '1px 5px',
    fontSize: '0.68rem',
    lineHeight: 1.1,
  }
}

function compactChangeStyle(base: typeof changeButtonStyle): CSSProperties {
  return {
    ...base,
    padding: '1px 5px',
    fontSize: '0.68rem',
    lineHeight: 1.1,
  }
}

export function AssignSessionJobPopover({
  session,
  resolveSessionForAssign,
  onSaved,
  onError,
  popoverZIndex = 100,
  unassignedTrigger = 'default',
  compactTrigger = false,
  showChangeWhenAssigned = true,
  dispatchScheduleAssigneeUserId,
  dispatchScheduleWorkDateYmd,
  draftLocalJobBidAssign,
  showApplyScheduleProportions = false,
  onApplyScheduleProportions,
}: Props) {
  const { prefixMap } = useLedgerDisplayPrefixes()
  const [open, setOpen] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [searchResults, setSearchResults] = useState<UnifiedSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [popoverRect, setPopoverRect] = useState<{ top: number; left: number } | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [dispatchPicks, setDispatchPicks] = useState<DispatchScheduledJobForAssign[]>([])
  const [dispatchPicksLoading, setDispatchPicksLoading] = useState(false)
  const [dispatchPicksError, setDispatchPicksError] = useState<string | null>(null)

  const hasJobOrBid = !!(session.job_ledger_id || session.bid_id)
  const dispatchScheduleEnabled =
    (dispatchScheduleAssigneeUserId?.trim() ?? '') !== '' &&
    (dispatchScheduleWorkDateYmd?.trim() ?? '') !== ''

  useEffect(() => {
    if (hasJobOrBid && !showChangeWhenAssigned) setOpen(false)
  }, [hasJobOrBid, showChangeWhenAssigned])

  useEffect(() => {
    const t = setTimeout(() => {
      if (!open || searchText === undefined) return
      const q = searchText.trim()
      if (!q) {
        setSearchResults([])
        return
      }
      void Promise.all([
        supabase.rpc('search_jobs_ledger', { search_text: q }),
        supabase.rpc('search_bids_for_clock', { p_search_text: q }),
      ]).then(async ([jobsRes, bidsRes]) => {
        const jobs = (jobsRes.data ?? []) as JobSearchResult[]
        let bids = (bidsRes.data ?? []) as BidSearchResult[]
        const firstBid = bids[0] as (BidSearchResult & Record<string, unknown>) | undefined
        const rpcHasServiceTypeName =
          firstBid != null && Object.prototype.hasOwnProperty.call(firstBid, 'service_type_name')

        if (!rpcHasServiceTypeName && bids.length > 0) {
          try {
            const ids = bids.map((b) => b.id)
            type EnrichRow = { id: string; service_type: { name: string } | null }
            const rows = await withSupabaseRetry(
              async () =>
                supabase.from('bids').select('id, service_type:service_types(name)').in('id', ids),
              'assign popover enrich bid service types',
            )
            const nameById = new Map<string, string | null>(
              (rows ?? []).map((r: EnrichRow) => [r.id, r.service_type?.name ?? null]),
            )
            bids = bids.map((b) => ({
              ...b,
              service_type_name: nameById.get(b.id) ?? null,
            }))
          } catch {
            /* RLS or network: keep RPC-shaped rows without service_type_name */
          }
        }

        const merged: UnifiedSearchResult[] = [
          ...jobs.map((j) => ({ source: 'job' as const, ...j })),
          ...bids.map((b) => ({ source: 'bid' as const, ...b })),
        ]
        setSearchResults(merged)
      })
    }, 300)
    return () => clearTimeout(t)
  }, [open, searchText])

  useEffect(() => {
    if (!open || !dispatchScheduleEnabled) {
      setDispatchPicks([])
      setDispatchPicksLoading(false)
      setDispatchPicksError(null)
      return
    }
    let cancelled = false
    setDispatchPicksLoading(true)
    setDispatchPicksError(null)
    setDispatchPicks([])
    void (async () => {
      try {
        const { data, error } = await fetchDispatchScheduledJobsForAssigneeDay(
          dispatchScheduleAssigneeUserId!.trim(),
          dispatchScheduleWorkDateYmd!.trim(),
        )
        if (cancelled) return
        if (error) {
          setDispatchPicksError(error)
          setDispatchPicks([])
        } else {
          setDispatchPicks(data)
        }
      } catch (e) {
        if (!cancelled) {
          setDispatchPicksError(e instanceof Error ? e.message : 'Failed to load schedule')
          setDispatchPicks([])
        }
      } finally {
        if (!cancelled) setDispatchPicksLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, dispatchScheduleEnabled, dispatchScheduleAssigneeUserId, dispatchScheduleWorkDateYmd])

  useEffect(() => {
    if (open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      const popoverHeight = ASSIGN_POPOVER_ESTIMATED_HEIGHT
      const showAbove = spaceBelow < popoverHeight && rect.top > spaceBelow
      setPopoverRect({
        left: rect.left,
        top: showAbove ? rect.top - popoverHeight - 4 : rect.bottom + 4,
      })
      const id = setTimeout(() => searchInputRef.current?.focus(), 0)
      return () => clearTimeout(id)
    } else {
      setPopoverRect(null)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      const target = e.target as Node
      if (buttonRef.current?.contains(target)) return
      const popoverEl = document.getElementById('assign-session-popover')
      if (popoverEl?.contains(target)) return
      setOpen(false)
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  async function handleSelect(item: UnifiedSearchResult) {
    setLoading(true)
    try {
      let target = session
      if (resolveSessionForAssign) {
        const resolved = await resolveSessionForAssign()
        if (!resolved) return
        target = resolved
      }
      if (isDraftPeopleHoursSessionId(target.id)) {
        if (!draftLocalJobBidAssign) {
          onError?.('This block is not saved yet. Close the editor to save the session, then assign a job.')
          return
        }
        draftLocalJobBidAssign(target, item)
        setOpen(false)
        setSearchText('')
        setSearchResults([])
        onSaved({ sessionId: target.id, selection: item })
        return
      }
      await withSupabaseRetry(
        async () =>
          supabase
            .from('clock_sessions')
            .update({
              job_ledger_id: item.source === 'job' ? item.id : null,
              bid_id: item.source === 'bid' ? item.id : null,
            })
            .eq('id', target.id),
        'assign session job/bid'
      )
      setOpen(false)
      setSearchText('')
      setSearchResults([])
      onSaved({ sessionId: target.id, selection: item })
    } catch (e) {
      onError?.(e instanceof Error ? e.message : 'Failed to assign')
    } finally {
      setLoading(false)
    }
  }

  async function handleClear() {
    setLoading(true)
    try {
      let target = session
      if (resolveSessionForAssign) {
        const resolved = await resolveSessionForAssign()
        if (!resolved) return
        target = resolved
      }
      if (isDraftPeopleHoursSessionId(target.id)) {
        if (!draftLocalJobBidAssign) {
          onError?.('This block is not saved yet. Close the editor to save the session, then clear or change the job.')
          return
        }
        draftLocalJobBidAssign(target, null)
        setOpen(false)
        setSearchText('')
        setSearchResults([])
        onSaved({ sessionId: target.id, selection: null })
        return
      }
      await withSupabaseRetry(
        async () =>
          supabase
            .from('clock_sessions')
            .update({ job_ledger_id: null, bid_id: null })
            .eq('id', target.id),
        'clear session job/bid'
      )
      setOpen(false)
      setSearchText('')
      setSearchResults([])
      onSaved({ sessionId: target.id, selection: null })
    } catch (e) {
      onError?.(e instanceof Error ? e.message : 'Failed to clear')
    } finally {
      setLoading(false)
    }
  }

  const assignSt = compactTrigger ? compactAssignStyle(assignButtonStyle) : assignButtonStyle
  const changeSt = compactTrigger ? compactChangeStyle(changeButtonStyle) : changeButtonStyle

  const triggerButton =
    hasJobOrBid && !showChangeWhenAssigned ? null : hasJobOrBid ? (
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={loading}
        style={{ ...changeSt, opacity: loading ? 0.7 : 1 }}
      >
        Change
      </button>
    ) : unassignedTrigger === 'combined' ? (
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={loading}
        aria-label="No Job or Bid linked. Add job or bid."
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '2px 8px',
          margin: 0,
          fontSize: '0.68rem',
          lineHeight: 1.2,
          border: '1px solid #f59e0b',
          borderRadius: 4,
          background: 'var(--bg-amber-tint)',
          color: 'var(--text-amber-800)',
          cursor: loading ? 'not-allowed' : 'pointer',
          opacity: loading ? 0.7 : 1,
          maxWidth: '100%',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} aria-hidden>
          No Job or Bid
        </span>
        <span
          style={{
            width: 1,
            height: '0.9em',
            flexShrink: 0,
            background: '#fbbf24',
          }}
          aria-hidden
        />
        <span style={{ color: 'var(--text-amber-700)', fontWeight: 600, flexShrink: 0 }} aria-hidden>
          Add
        </span>
      </button>
    ) : (
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={loading}
        style={{ ...assignSt, opacity: loading ? 0.7 : 1 }}
      >
        Assign
      </button>
    )

  return (
    <>
      {triggerButton}
      {open &&
        popoverRect &&
        createPortal(
          <div
            id="assign-session-popover"
            role="dialog"
            aria-label="Assign job or bid"
            style={{
              position: 'fixed',
              left: popoverRect.left,
              top: popoverRect.top,
              zIndex: popoverZIndex,
              minWidth: 280,
              maxWidth: 360,
              padding: '0.75rem',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
            }}
          >
            <div style={{ marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.875rem' }}>
              Assign job or bid
            </div>
            {dispatchScheduleEnabled ? (
              <div style={{ marginBottom: '0.65rem' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.5rem',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    color: 'var(--text-700)',
                    marginBottom: '0.35rem',
                  }}
                >
                  <span>Scheduled this day (Dispatch)</span>
                  {showApplyScheduleProportions &&
                  onApplyScheduleProportions &&
                  !dispatchPicksLoading &&
                  !dispatchPicksError &&
                  dispatchPicks.length > 0 ? (
                    <button
                      type="button"
                      disabled={loading}
                      title="Split this session across the day's scheduled jobs, proportional to their scheduled time"
                      onClick={() => {
                        onApplyScheduleProportions(dispatchPicks)
                        setOpen(false)
                      }}
                      style={{
                        flexShrink: 0,
                        padding: '2px 8px',
                        fontSize: '0.68rem',
                        fontWeight: 600,
                        lineHeight: 1.2,
                        border: '1px solid #2563eb',
                        borderRadius: 4,
                        background: '#2563eb',
                        color: '#fff',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        opacity: loading ? 0.7 : 1,
                      }}
                    >
                      Apply Schedule %
                    </button>
                  ) : null}
                </div>
                {dispatchPicksLoading ? (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Loading schedule…</div>
                ) : dispatchPicksError ? (
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-amber-800)' }}>{dispatchPicksError}</div>
                ) : dispatchPicks.length === 0 ? (
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    No Dispatch jobs for this person on this day.
                  </div>
                ) : (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.35rem',
                      alignItems: 'stretch',
                    }}
                  >
                    {dispatchPicks.map((p) => {
                      const item = dispatchPickToUnified(p)
                      const isCurrent = session.job_ledger_id === p.jobId
                      const label = `${isCurrent ? 'Current: ' : ''}${formatUnifiedResult(item, prefixMap)}`
                      const a11yRanges =
                        p.windowSpans.length > 0
                          ? p.windowSpans.map((s) => `${s.startLabel} to ${s.endLabel}`).join(', ')
                          : ''
                      const a11y =
                        a11yRanges !== '' ? `${label}. Scheduled ${a11yRanges}.` : `${label}.`
                      return (
                        <button
                          key={p.jobId}
                          type="button"
                          disabled={loading || isCurrent}
                          title={
                            isCurrent
                              ? 'Already assigned to this job'
                              : p.windowsLabel
                                ? `Scheduled: ${p.windowsLabel}`
                                : undefined
                          }
                          aria-label={a11y}
                          onClick={() => void handleSelect(item)}
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            justifyContent: 'space-between',
                            gap: '0.5rem',
                            padding: '0.28rem 0.5rem',
                            fontSize: '0.68rem',
                            lineHeight: 1.25,
                            border: `1px solid ${isCurrent ? 'var(--border-green)' : 'var(--border-blue)'}`,
                            borderRadius: 4,
                            background: isCurrent ? 'var(--bg-green-tint)' : 'var(--bg-blue-tint)',
                            color: isCurrent ? 'var(--text-green-800)' : 'var(--text-blue-700)',
                            cursor: loading || isCurrent ? 'not-allowed' : 'pointer',
                            width: '100%',
                            maxWidth: '100%',
                            textAlign: 'left',
                          }}
                        >
                          <span style={{ wordBreak: 'break-word', minWidth: 0, flex: '1 1 auto' }}>
                            {label}
                          </span>
                          {p.windowSpans.length > 0 ? (
                            <span
                              style={{
                                flex: '0 0 auto',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'flex-end',
                                gap: '0.2rem',
                                textAlign: 'right',
                                color: isCurrent ? '#15803d' : 'var(--text-blue-800)',
                                fontVariantNumeric: 'tabular-nums',
                              }}
                            >
                              {p.windowSpans.map((span, i) => (
                                <span
                                  key={i}
                                  style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'flex-end',
                                  }}
                                >
                                  <span style={{ whiteSpace: 'nowrap' }}>{span.startLabel}</span>
                                  <span style={{ whiteSpace: 'nowrap' }}>{span.endLabel}</span>
                                </span>
                              ))}
                            </span>
                          ) : null}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            ) : null}
            <input
              ref={searchInputRef}
              type="search"
              placeholder="Search HCP, bid #, job name, project, address…"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem',
                marginBottom: '0.5rem',
                border: '1px solid var(--border-strong)',
                borderRadius: 4,
                boxSizing: 'border-box',
              }}
            />
            <div
              style={{
                maxHeight: 200,
                overflowY: 'auto',
                marginBottom: '0.5rem',
                border: '1px solid var(--border)',
                borderRadius: 4,
              }}
            >
              {searchText.trim() ? (
                searchResults.length === 0 ? (
                  <div style={{ padding: '0.75rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                    No results
                  </div>
                ) : (
                  searchResults.map((item) => {
                    const tradeTag = serviceTypeTagForUnifiedRow(item)
                    /* Unknown service_type_name: left gutter stays 4px transparent (no gray stripe — avoids implying a trade). */
                    const stripeColor = tradeTag?.color ?? 'transparent'
                    return (
                      <button
                        key={`${item.source}:${item.id}`}
                        type="button"
                        onClick={() => handleSelect(item)}
                        disabled={loading}
                        style={{
                          display: 'flex',
                          alignItems: 'stretch',
                          width: '100%',
                          padding: 0,
                          border: 'none',
                          borderBottom: '1px solid var(--border)',
                          background: 'none',
                          cursor: loading ? 'not-allowed' : 'pointer',
                          fontSize: '0.875rem',
                          textAlign: 'left',
                        }}
                      >
                        <div
                          aria-hidden
                          style={{
                            width: 4,
                            flexShrink: 0,
                            alignSelf: 'stretch',
                            background: stripeColor,
                          }}
                        />
                        <div
                          style={{
                            flex: 1,
                            minWidth: 0,
                            padding: '0.5rem 0.75rem',
                          }}
                        >
                          <div style={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            {tradeTag ? (
                              <span
                                style={{
                                  padding: '0.1rem 0.35rem',
                                  fontSize: '0.6875rem',
                                  fontWeight: 500,
                                  background: tradeTag.color,
                                  color: '#fff',
                                  borderRadius: 4,
                                }}
                              >
                                [{tradeTag.tag}]
                              </span>
                            ) : null}
                            {formatUnifiedResult(item, prefixMap)}
                          </div>
                        </div>
                      </button>
                    )
                  })
                )
              ) : (
                <div style={{ padding: '0.75rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                  Type to search jobs and bids
                </div>
              )}
            </div>
            {hasJobOrBid && (
              <button
                type="button"
                onClick={handleClear}
                disabled={loading}
                style={{
                  padding: '0.25rem 0.5rem',
                  fontSize: '0.8125rem',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 4,
                  background: 'var(--surface)',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  color: 'var(--text-muted)',
                }}
              >
                Clear assignment
              </button>
            )}
          </div>,
          document.body
        )}
    </>
  )
}
