import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../../lib/supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import {
  formatUnifiedResult,
  getBidServiceTypeTag,
  type JobSearchResult,
  type BidSearchResult,
  type UnifiedSearchResult,
} from '../../utils/unifiedJobBidSearch'
import type { ClockSessionRow } from '../../types/clockSessions'

export type AssignSessionJobPopoverSession = Pick<ClockSessionRow, 'id' | 'job_ledger_id' | 'bid_id'>

type Props = {
  session: AssignSessionJobPopoverSession
  onSaved: () => void
  onError?: (msg: string) => void
  /** Default 100; use higher value when opened inside another modal (e.g. 1250). */
  popoverZIndex?: number
  /**
   * When unassigned: 'default' is the blue Assign button; 'combined' is one chip (No Job or Bid | Add).
   * Ignored when session already has a job or bid.
   */
  unassignedTrigger?: 'default' | 'combined'
}

const assignButtonStyle = {
  padding: '0.2rem 0.5rem',
  fontSize: '0.8125rem' as const,
  border: '1px solid #3b82f6',
  borderRadius: 4,
  background: '#eff6ff',
  color: '#2563eb',
  cursor: 'pointer' as const,
}

const changeButtonStyle = {
  padding: '0.2rem 0.5rem',
  fontSize: '0.8125rem' as const,
  border: '1px solid #d1d5db',
  borderRadius: 4,
  background: 'white',
  color: '#6b7280',
  cursor: 'pointer' as const,
}

export function AssignSessionJobPopover({
  session,
  onSaved,
  onError,
  popoverZIndex = 100,
  unassignedTrigger = 'default',
}: Props) {
  const [open, setOpen] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [searchResults, setSearchResults] = useState<UnifiedSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [popoverRect, setPopoverRect] = useState<{ top: number; left: number } | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const hasJobOrBid = !!(session.job_ledger_id || session.bid_id)

  useEffect(() => {
    const t = setTimeout(() => {
      if (!open || searchText === undefined) return
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
    if (open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      const popoverHeight = 280
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
      await withSupabaseRetry(
        async () =>
          supabase
            .from('clock_sessions')
            .update({
              job_ledger_id: item.source === 'job' ? item.id : null,
              bid_id: item.source === 'bid' ? item.id : null,
            })
            .eq('id', session.id),
        'assign session job/bid'
      )
      setOpen(false)
      setSearchText('')
      setSearchResults([])
      onSaved()
    } catch (e) {
      onError?.(e instanceof Error ? e.message : 'Failed to assign')
    } finally {
      setLoading(false)
    }
  }

  async function handleClear() {
    setLoading(true)
    try {
      await withSupabaseRetry(
        async () =>
          supabase
            .from('clock_sessions')
            .update({ job_ledger_id: null, bid_id: null })
            .eq('id', session.id),
        'clear session job/bid'
      )
      setOpen(false)
      setSearchText('')
      setSearchResults([])
      onSaved()
    } catch (e) {
      onError?.(e instanceof Error ? e.message : 'Failed to clear')
    } finally {
      setLoading(false)
    }
  }

  const triggerButton =
    hasJobOrBid ? (
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={loading}
        style={{ ...changeButtonStyle, opacity: loading ? 0.7 : 1 }}
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
          border: '1px solid #e5e7eb',
          borderRadius: 4,
          background: '#f9fafb',
          color: '#374151',
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
            background: '#e5e7eb',
          }}
          aria-hidden
        />
        <span style={{ color: '#2563eb', fontWeight: 600, flexShrink: 0 }} aria-hidden>
          Add
        </span>
      </button>
    ) : (
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={loading}
        style={{ ...assignButtonStyle, opacity: loading ? 0.7 : 1 }}
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
              background: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: 8,
              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
            }}
          >
            <div style={{ marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.875rem' }}>
              Assign job or bid
            </div>
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
                border: '1px solid #d1d5db',
                borderRadius: 4,
                boxSizing: 'border-box',
              }}
            />
            <div
              style={{
                maxHeight: 200,
                overflowY: 'auto',
                marginBottom: '0.5rem',
                border: '1px solid #e5e7eb',
                borderRadius: 4,
              }}
            >
              {searchText.trim() ? (
                searchResults.length === 0 ? (
                  <div style={{ padding: '0.75rem', color: '#6b7280', fontSize: '0.875rem' }}>
                    No results
                  </div>
                ) : (
                  searchResults.map((item) => (
                    <button
                      key={`${item.source}:${item.id}`}
                      type="button"
                      onClick={() => handleSelect(item)}
                      disabled={loading}
                      style={{
                        display: 'block',
                        width: '100%',
                        padding: '0.5rem 0.75rem',
                        textAlign: 'left',
                        border: 'none',
                        borderBottom: '1px solid #f3f4f6',
                        background: 'none',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        fontSize: '0.875rem',
                      }}
                    >
                      <div style={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        {item.source === 'bid' && (() => {
                          const t = getBidServiceTypeTag(item.service_type_name)
                          return t ? (
                            <span
                              style={{
                                padding: '0.1rem 0.35rem',
                                fontSize: '0.6875rem',
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
                        {formatUnifiedResult(item)}
                      </div>
                    </button>
                  ))
                )
              ) : (
                <div style={{ padding: '0.75rem', color: '#6b7280', fontSize: '0.875rem' }}>
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
                  border: '1px solid #d1d5db',
                  borderRadius: 4,
                  background: 'white',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  color: '#6b7280',
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
