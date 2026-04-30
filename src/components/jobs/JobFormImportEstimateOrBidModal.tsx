import { useEffect, useId, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { useLedgerPrefixMap } from '../../contexts/LedgerDisplayPrefixContext'
import { formatBidLedgerDocTitle, type LedgerPrefixMap } from '../../lib/ledgerDisplayPrefixes'
import type { EstimateNavSearchResult, BidSearchResult } from '../../utils/unifiedJobBidSearch'

/** Match header global search minimum character gate. */
const MIN_IMPORT_SEARCH_CHARS = 2

const SEARCH_DEBOUNCE_MS = 300

type MergedRow =
  | { kind: 'estimate'; row: EstimateNavSearchResult }
  | { kind: 'bid'; row: BidSearchResult }

function bidSearchRowTitle(b: BidSearchResult, prefixMap: LedgerPrefixMap): string {
  const name = (b.project_name ?? '').trim() || 'Untitled'
  const n = b.bid_number != null && String(b.bid_number).trim() !== '' ? String(b.bid_number).trim() : null
  return n ? formatBidLedgerDocTitle(prefixMap, b.service_type_id ?? null, n, name) : name
}

type Props = {
  open: boolean
  onClose: () => void
  zIndex: number
  onSelectBid: (id: string) => void
  onSelectEstimate: (id: string) => void
}

export function JobFormImportEstimateOrBidModal({ open, onClose, zIndex, onSelectBid, onSelectEstimate }: Props) {
  const prefixMap = useLedgerPrefixMap()
  const titleId = useId()
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [estimates, setEstimates] = useState<EstimateNavSearchResult[]>([])
  const [bids, setBids] = useState<BidSearchResult[]>([])

  useEffect(() => {
    if (!open) {
      setQuery('')
      setEstimates([])
      setBids([])
      setLoading(false)
      return
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    const q = query.trim()
    if (q.length < MIN_IMPORT_SEARCH_CHARS) {
      setEstimates([])
      setBids([])
      setLoading(false)
      return
    }
    setLoading(true)
    const t = window.setTimeout(() => {
      void (async () => {
        try {
          const [estRes, bidRes] = await Promise.all([
            withSupabaseRetry(
              async () => await supabase.rpc('search_estimates_for_nav', { search_text: q }),
              'job form import search estimates',
            ),
            withSupabaseRetry(
              async () => await supabase.rpc('search_bids_for_clock', { p_search_text: q }),
              'job form import search bids',
            ),
          ])
          setEstimates((estRes ?? []) as EstimateNavSearchResult[])
          setBids((bidRes ?? []) as BidSearchResult[])
        } catch {
          setEstimates([])
          setBids([])
        } finally {
          setLoading(false)
        }
      })()
    }, SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(t)
  }, [open, query])

  const merged: MergedRow[] = useMemo(() => {
    const out: MergedRow[] = []
    for (const row of estimates) out.push({ kind: 'estimate', row })
    for (const row of bids) out.push({ kind: 'bid', row })
    return out
  }, [estimates, bids])

  if (!open) return null

  const showHint = query.trim().length > 0 && query.trim().length < MIN_IMPORT_SEARCH_CHARS

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex,
        padding: '1rem',
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={{
          background: 'white',
          borderRadius: 8,
          padding: '1.25rem',
          maxWidth: 480,
          width: '100%',
          maxHeight: 'min(80vh, 520px)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
          <h2 id={titleId} style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600 }}>
            Import from estimate or bid
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              border: 'none',
              background: '#f3f4f6',
              borderRadius: 6,
              padding: '0.35rem 0.65rem',
              cursor: 'pointer',
              fontSize: '0.8125rem',
              fontWeight: 500,
            }}
          >
            Cancel
          </button>
        </div>
        <input
          type="search"
          autoComplete="off"
          autoFocus
          placeholder={`Type at least ${MIN_IMPORT_SEARCH_CHARS} characters…`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-controls="job-form-import-results"
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: '0.5rem 0.65rem',
            fontSize: '1rem',
            border: '1px solid #d1d5db',
            borderRadius: 6,
          }}
        />
        {showHint ? (
          <p style={{ margin: 0, fontSize: '0.8125rem', color: '#9ca3af' }}>Enter more characters to search.</p>
        ) : null}

        <div
          id="job-form-import-results"
          style={{
            flex: 1,
            minHeight: 120,
            overflow: 'auto',
            border: '1px solid #e5e7eb',
            borderRadius: 6,
            background: '#fafafa',
          }}
        >
          {loading ? (
            <div style={{ padding: '1rem', fontSize: '0.875rem', color: '#6b7280' }}>Searching…</div>
          ) : query.trim().length < MIN_IMPORT_SEARCH_CHARS ? (
            <div style={{ padding: '1rem', fontSize: '0.875rem', color: '#9ca3af' }}>
              Enter at least {MIN_IMPORT_SEARCH_CHARS} characters to search estimates and bids.
            </div>
          ) : merged.length === 0 ? (
            <div style={{ padding: '1rem', fontSize: '0.875rem', color: '#6b7280' }}>No matches.</div>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {merged.map((item) => {
                if (item.kind === 'estimate') {
                  const e = item.row
                  const label = `#${e.estimate_number} · ${(e.title ?? '').trim() || '—'}`
                  return (
                    <li key={`e-${e.id}`} style={{ borderBottom: '1px solid #e5e7eb' }}>
                      <button
                        type="button"
                        onClick={() => {
                          onSelectEstimate(e.id)
                          onClose()
                        }}
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          padding: '0.65rem 0.75rem',
                          border: 'none',
                          background: 'white',
                          cursor: 'pointer',
                          font: 'inherit',
                        }}
                      >
                        <div style={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.06em', color: '#6b7280' }}>
                          ESTIMATE
                        </div>
                        <div style={{ fontWeight: 500, marginTop: 2 }}>{label}</div>
                        <div style={{ fontSize: '0.8125rem', color: '#6b7280', marginTop: 2 }}>
                          {e.customer_name || '—'}
                          {e.subtitle ? ` · ${e.subtitle}` : ''}
                        </div>
                      </button>
                    </li>
                  )
                }
                const b = item.row
                const title = bidSearchRowTitle(b, prefixMap)
                return (
                  <li key={`b-${b.id}`} style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <button
                      type="button"
                      onClick={() => {
                        onSelectBid(b.id)
                        onClose()
                      }}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '0.65rem 0.75rem',
                        border: 'none',
                        background: 'white',
                        cursor: 'pointer',
                        font: 'inherit',
                      }}
                    >
                      <div style={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.06em', color: '#6b7280' }}>
                        BID
                      </div>
                      <div style={{ fontWeight: 500, marginTop: 2 }}>{title}</div>
                      <div style={{ fontSize: '0.8125rem', color: '#6b7280', marginTop: 2 }}>
                        {(b.address ?? '').trim() || '—'} · {b.customer_name || '—'}
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
