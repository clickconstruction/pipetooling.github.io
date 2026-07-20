import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { withSupabaseRetry } from '../utils/errorHandling'
import {
  formatUnifiedResult,
  getBidServiceTypeTag,
  type JobSearchResult,
  type BidSearchResult,
  type UnifiedSearchResult,
} from '../utils/unifiedJobBidSearch'
import { useLedgerDisplayPrefixes } from '../contexts/LedgerDisplayPrefixContext'

type Props = {
  sessionIds: string[]
  label: string
  onSaved: () => void
  onClose: () => void
  /** Default 1100; raise when stacking above another modal (e.g. 1300). */
  overlayZIndex?: number
}

export function AssignFocusModal({ sessionIds, label, onSaved, onClose, overlayZIndex = 1100 }: Props) {
  const { prefixMap } = useLedgerDisplayPrefixes()
  const [searchText, setSearchText] = useState('')
  const [searchResults, setSearchResults] = useState<UnifiedSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedItem, setSelectedItem] = useState<UnifiedSearchResult | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const id = setTimeout(() => searchInputRef.current?.focus(), 0)
    return () => clearTimeout(id)
  }, [])

  useEffect(() => {
    const t = setTimeout(() => {
      const q = searchText.trim()
      if (!q) {
        setSearchResults([])
        setSelectedItem(null)
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
        setSelectedItem(null)
      })
    }, 300)
    return () => clearTimeout(t)
  }, [searchText])

  async function handleAdd() {
    if (!selectedItem || sessionIds.length === 0) return
    setLoading(true)
    try {
      await withSupabaseRetry(
        async () =>
          supabase
            .from('clock_sessions')
            .update({
              job_ledger_id: selectedItem.source === 'job' ? selectedItem.id : null,
              bid_id: selectedItem.source === 'bid' ? selectedItem.id : null,
            })
            .in('id', sessionIds),
        'assign focus sessions to job/bid'
      )
      onSaved()
      onClose()
    } catch {
      setLoading(false)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: overlayZIndex,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--surface)',
          borderRadius: 8,
          padding: '1rem 1.25rem',
          maxWidth: 400,
          maxHeight: '85vh',
          overflow: 'auto',
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: '0 0 0.75rem', fontSize: '1.125rem' }}>
          Add &quot;{label}&quot; to job or bid
        </h3>
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
            maxHeight: 220,
            overflowY: 'auto',
            marginBottom: '1rem',
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
                const isSelected = selectedItem && selectedItem.source === item.source && selectedItem.id === item.id
                return (
                  <button
                    key={`${item.source}:${item.id}`}
                    type="button"
                    onClick={() => setSelectedItem(item)}
                    style={{
                      display: 'block',
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      textAlign: 'left',
                      border: 'none',
                      borderBottom: '1px solid var(--border)',
                      background: isSelected ? 'var(--bg-blue-tint)' : 'none',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                    }}
                  >
                    <div style={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      {item.source === 'bid' &&
                        (() => {
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
                      {formatUnifiedResult(item, prefixMap)}
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
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '0.35rem 0.75rem',
              border: '1px solid var(--border-strong)',
              borderRadius: 4,
              background: 'var(--surface)',
              cursor: 'pointer',
              fontSize: '0.875rem',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleAdd}
            disabled={!selectedItem || loading}
            style={{
              padding: '0.35rem 0.75rem',
              border: 'none',
              borderRadius: 4,
              background: selectedItem && !loading ? '#2563eb' : '#d1d5db',
              color: 'white',
              cursor: selectedItem && !loading ? 'pointer' : 'not-allowed',
              fontSize: '0.875rem',
            }}
          >
            {loading ? 'Adding…' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  )
}
