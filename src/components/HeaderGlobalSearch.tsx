import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type LegacyRef,
  type RefObject,
  type ReactNode,
} from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useBidPreview } from '../contexts/BidPreviewModalContext'
import { useJobDetailModal } from '../contexts/JobDetailModalContext'
import { supabase } from '../lib/supabase'
import { buildClockBidsSearchParams } from '../lib/clockBidsSearchParams'
import type { UserRole } from '../hooks/useAuth'
import { fieldRoleServiceTypeIdsForUser, isSubcontractorLikeRole } from '../lib/subcontractorLikeRole'
import {
  customerTypePillForUnifiedRow,
  escapeLike,
  formatUnifiedResult,
  serviceTypeTagForUnifiedRow,
  type JobSearchResult,
  type BidSearchResult,
  type CustomerSearchResult,
  type EstimateNavSearchResult,
  type UnifiedSearchResult,
} from '../utils/unifiedJobBidSearch'
import { CustomerSnapshotModal } from './customers/CustomerSnapshotModal'
import { useLedgerDisplayPrefixes } from '../contexts/LedgerDisplayPrefixContext'
import { effectiveJobLedgerNumber } from '../lib/ledgerDisplayPrefixes'
import type { LedgerPrefixMap } from '../lib/ledgerDisplayPrefixes'

const HEADER_ROW_MIN_HEIGHT = 'calc(1rem + 1.25em)'
const MIN_HEADER_SEARCH_CHARS = 2

/** When search is closed, skip ⌘K / Ctrl+K (and plain "s" on the dashboard) so we do not hijack typing in other fields. */
function isTypingSurface(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const el = target.closest('input, textarea, select, [contenteditable="true"]')
  if (!el) return false
  if (el instanceof HTMLInputElement) {
    const t = el.type
    if (t === 'button' || t === 'submit' || t === 'checkbox' || t === 'radio' || t === 'file' || t === 'reset') return false
  }
  return true
}

type Placement = 'strip' | 'toolbar'

type HeaderGlobalSearchContextValue = {
  open: boolean
  openSearch: (from: Placement) => void
  closeSearch: () => void
  query: string
  setQuery: (q: string) => void
  results: UnifiedSearchResult[]
  /** Keyboard-highlighted result row (-1 = none); arrows move it, Enter selects it, typing resets it. */
  activeResultIndex: number
  setActiveResultIndex: (i: number) => void
  inputRef: RefObject<HTMLInputElement | null>
  stripButtonRef: RefObject<HTMLButtonElement | null>
  toolbarButtonRef: RefObject<HTMLButtonElement | null>
  selectResult: (r: UnifiedSearchResult) => void
  navOverlayBackground: string
  prefixMap: LedgerPrefixMap
}

const HeaderGlobalSearchContext = createContext<HeaderGlobalSearchContextValue | null>(null)

const searchIcon = (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="1.25em" height="1.25em" fill="currentColor" aria-hidden="true">
    <path d="M480 272C480 317.9 465.1 360.3 440 394.7L566.6 521.4C579.1 533.9 579.1 554.2 566.6 566.7C554.1 579.2 533.8 579.2 521.3 566.7L394.7 440C360.3 465.1 317.9 480 272 480C157.1 480 64 386.9 64 272C64 157.1 157.1 64 272 64C386.9 64 480 157.1 480 272zM272 416C351.5 416 416 351.5 416 272C416 192.5 351.5 128 272 128C192.5 128 128 192.5 128 272C128 351.5 192.5 416 272 416z" />
  </svg>
)

export function HeaderGlobalSearchProvider({
  enabled,
  authUserId,
  navOverlayBackground,
  isMobile,
  children,
}: {
  /** Role gate (dev|master|assistant-like). The provider mounts for every role so the
   * Layout tree stays STABLE across the cold-load null→role transition (a conditional
   * wrapper remounted the whole app body, wiping page state — v2.860); when false, the
   * hotkeys and data load are inert and no UI entry points render (they gate themselves). */
  enabled: boolean
  authUserId: string | null
  navOverlayBackground: string
  isMobile: boolean
  children: ReactNode
}) {
  const navigate = useNavigate()
  const location = useLocation()
  const bidPreview = useBidPreview()
  const jobDetailModal = useJobDetailModal()
  const { prefixMap } = useLedgerDisplayPrefixes()
  const [open, setOpen] = useState(false)
  const [query, setQueryState] = useState('')
  const [results, setResults] = useState<UnifiedSearchResult[]>([])
  const [activeResultIndex, setActiveResultIndex] = useState(-1)
  /** Header-owned customer snapshot; opened on selecting a customer result. Kept out of the context value. */
  const [snapshotCustomerId, setSnapshotCustomerId] = useState<string | null>(null)
  const [serviceTypes, setServiceTypes] = useState<Array<{ id: string; name: string }>>([])
  const [enabledBidServiceTypeIds, setEnabledBidServiceTypeIds] = useState<string[]>([])
  const [subcontractorServiceTypeIds, setSubcontractorServiceTypeIds] = useState<string[] | null>(null)

  const openedFromRef = useRef<Placement>('toolbar')
  const inputRef = useRef<HTMLInputElement>(null)
  const stripButtonRef = useRef<HTMLButtonElement>(null)
  const toolbarButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!authUserId || !enabled) return
    const load = async () => {
      const { data: stData } = await supabase.from('service_types').select('id, name').order('sequence_order', { ascending: true })
      const types = (stData ?? []) as Array<{ id: string; name: string }>
      const { data: meData } = await supabase
        .from('users')
        .select(
          'role, estimator_service_type_ids, primary_service_type_ids, subcontractor_service_type_ids, helpers_service_type_ids',
        )
        .eq('id', authUserId)
        .single()
      const me = meData as {
        role?: string
        estimator_service_type_ids?: string[] | null
        primary_service_type_ids?: string[] | null
        subcontractor_service_type_ids?: string[] | null
        helpers_service_type_ids?: string[] | null
      } | null
      const ur = me?.role as UserRole | undefined
      const scopedFieldIds = ur ? fieldRoleServiceTypeIdsForUser(ur, me ?? {}) : null
      if (isSubcontractorLikeRole(ur)) {
        setSubcontractorServiceTypeIds(scopedFieldIds && scopedFieldIds.length > 0 ? scopedFieldIds : null)
      } else {
        setSubcontractorServiceTypeIds(null)
      }
      const estIds = me?.estimator_service_type_ids
      const primIds = me?.primary_service_type_ids
      const filtered =
        me?.role === 'estimator' && estIds && estIds.length > 0
          ? types.filter((t) => estIds.includes(t.id))
          : me?.role === 'primary' && primIds && primIds.length > 0
            ? types.filter((t) => primIds.includes(t.id))
            : scopedFieldIds && scopedFieldIds.length > 0 && isSubcontractorLikeRole(ur)
              ? types.filter((t) => scopedFieldIds.includes(t.id))
              : types
      const filteredIds = filtered.map((t) => t.id)
      if (filtered.length === 1) {
        setEnabledBidServiceTypeIds([filtered[0]!.id])
      } else {
        setEnabledBidServiceTypeIds(filteredIds)
      }
      setServiceTypes(filtered)
    }
    void load()
  }, [authUserId, enabled])

  const setQuery = useCallback((q: string) => {
    setQueryState(q)
    setActiveResultIndex(-1)
    if (q.trim().length < MIN_HEADER_SEARCH_CHARS) {
      setResults([])
    }
  }, [])

  const openSearch = useCallback((from: Placement) => {
    openedFromRef.current = from
    setOpen(true)
    setQueryState('')
    setResults([])
    setActiveResultIndex(-1)
    queueMicrotask(() => inputRef.current?.focus())
  }, [])

  const closeSearch = useCallback(() => {
    setOpen(false)
    setQueryState('')
    setResults([])
    queueMicrotask(() => {
      const ref = openedFromRef.current === 'strip' ? stripButtonRef : toolbarButtonRef
      ref.current?.focus()
    })
  }, [])

  const selectResult = useCallback(
    (r: UnifiedSearchResult) => {
      if (r.source === 'job') {
        const h = effectiveJobLedgerNumber(r.hcp_number, r.click_number) || '—'
        const n = (r.job_name ?? '').trim() || 'Job'
        jobDetailModal?.openJobDetail({
          jobId: r.id,
          prefillRowLabel: `${h} · ${n}`,
          prefillAddress: (r.job_address ?? '').trim() || null,
        })
      } else if (r.source === 'bid') {
        bidPreview?.openBidPreview(r.id)
      } else if (r.source === 'customer') {
        setSnapshotCustomerId(r.id)
      } else navigate(`/estimates/${r.estimate_number}`)
      closeSearch()
    },
    [navigate, closeSearch, bidPreview, jobDetailModal],
  )

  useEffect(() => {
    if (!enabled) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (!open) return
        e.preventDefault()
        e.stopPropagation()
        closeSearch()
        return
      }
      if (
        e.key.toLowerCase() === 's' &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        !open &&
        location.pathname === '/dashboard'
      ) {
        if (isTypingSurface(e.target)) return
        e.preventDefault()
        e.stopPropagation()
        openSearch(isMobile ? 'strip' : 'toolbar')
        return
      }
      if (e.key.toLowerCase() !== 'k' || (!e.metaKey && !e.ctrlKey)) return
      if (open) {
        e.preventDefault()
        e.stopPropagation()
        closeSearch()
        return
      }
      if (isTypingSurface(e.target)) return
      e.preventDefault()
      e.stopPropagation()
      openSearch(isMobile ? 'strip' : 'toolbar')
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [enabled, open, closeSearch, openSearch, isMobile, location.pathname])

  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => {
      const q = query.trim()
      if (!q) {
        setResults([])
        return
      }
      if (q.length < MIN_HEADER_SEARCH_CHARS) {
        setResults([])
        return
      }
      const bidsParams = buildClockBidsSearchParams(q, {
        serviceTypes,
        enabledBidServiceTypeIds,
        subcontractorServiceTypeIds,
      })
      // Client-side, RLS-scoped customer lookup. Name-only `ilike` (no `.or()`) + escapeLike so
      // punctuation can't break the filter; failures degrade to [] so they never wipe other results.
      const customersPromise: Promise<CustomerSearchResult[]> = Promise.resolve(
        supabase
          .from('customers')
          .select('id,name,address,customer_type')
          .ilike('name', `%${escapeLike(q)}%`)
          .order('name', { ascending: true })
          .limit(8),
      )
        .then((r) => (r.data ?? []) as CustomerSearchResult[])
        .catch((): CustomerSearchResult[] => [])
      void Promise.all([
        supabase.rpc('search_jobs_ledger', { search_text: q }),
        supabase.rpc('search_bids_for_clock', bidsParams),
        supabase.rpc('search_estimates_for_nav', { search_text: q }),
        customersPromise,
      ]).then(([jobsRes, bidsRes, estRes, customers]) => {
        const jobs = (jobsRes.data ?? []) as JobSearchResult[]
        const bids = (bidsRes.data ?? []) as BidSearchResult[]
        const estimates = (estRes.data ?? []) as EstimateNavSearchResult[]
        const merged: UnifiedSearchResult[] = [
          ...jobs.map((j) => ({ source: 'job' as const, ...j })),
          ...bids.map((b) => ({ source: 'bid' as const, ...b })),
          ...estimates.map((e) => ({
            source: 'estimate' as const,
            id: e.id,
            estimate_number: e.estimate_number,
            title: e.title,
            customer_name: e.customer_name,
            subtitle: e.subtitle,
          })),
          ...customers.map((c) => ({
            source: 'customer' as const,
            id: c.id,
            name: c.name,
            address: c.address,
            customer_type: c.customer_type,
          })),
        ]
        setResults(merged)
        setActiveResultIndex(-1)
      })
    }, 300)
    return () => clearTimeout(t)
  }, [open, query, serviceTypes, enabledBidServiceTypeIds, subcontractorServiceTypeIds])

  const value = useMemo(
    () =>
      ({
        open,
        openSearch,
        closeSearch,
        query,
        setQuery,
        results,
        activeResultIndex,
        setActiveResultIndex,
        inputRef,
        stripButtonRef,
        toolbarButtonRef,
        selectResult,
        navOverlayBackground,
        prefixMap,
      }) satisfies HeaderGlobalSearchContextValue,
    [open, openSearch, closeSearch, query, setQuery, results, activeResultIndex, selectResult, navOverlayBackground, prefixMap],
  )

  return (
    <HeaderGlobalSearchContext.Provider value={value}>
      {children}
      <CustomerSnapshotModal
        open={snapshotCustomerId !== null}
        customerId={snapshotCustomerId}
        gcBuilder={null}
        onClose={() => setSnapshotCustomerId(null)}
      />
    </HeaderGlobalSearchContext.Provider>
  )
}

export function HeaderGlobalSearchOpenButton({
  placement,
  isMobile,
  style,
}: {
  placement: Placement
  isMobile: boolean
  style?: CSSProperties
}) {
  const ctx = useContext(HeaderGlobalSearchContext)
  if (!ctx) return null
  if (placement === 'strip' && !isMobile) return null
  if (placement === 'toolbar' && isMobile) return null

  const ref = placement === 'strip' ? ctx.stripButtonRef : ctx.toolbarButtonRef
  const iconLinkStyle = {
    display: 'inline-flex' as const,
    alignItems: 'center',
    padding: '0.5rem',
    color: 'inherit',
    background: 'none',
    border: 'none',
    cursor: 'pointer' as const,
  }

  return (
    <button
      ref={ref as LegacyRef<HTMLButtonElement>}
      type="button"
      title="Search jobs, bids, estimates, customers — ⌘K / Ctrl+K toggles"
      aria-label="Search jobs, bids, estimates, customers"
      aria-expanded={ctx.open}
      aria-haspopup="dialog"
      onClick={() => ctx.openSearch(placement)}
      style={{ ...iconLinkStyle, ...style }}
    >
      {searchIcon}
    </button>
  )
}

const resultsPanelBaseStyle = {
  position: 'absolute' as const,
  top: '100%',
  left: 'var(--app-nav-pad-x)',
  right: 'var(--app-nav-pad-x)',
  zIndex: 42,
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderTop: 'none',
  borderRadius: '0 0 8px 8px',
  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
  boxSizing: 'border-box' as const,
  maxHeight: 'min(60vh, 22rem)',
  overflowY: 'auto' as const,
}

export function HeaderGlobalSearchNavLayer() {
  const ctx = useContext(HeaderGlobalSearchContext)
  if (!ctx || !ctx.open) return null

  const qTrim = ctx.query.trim()
  const showResultsPanel = qTrim.length >= MIN_HEADER_SEARCH_CHARS

  /** Arrow keys move the highlight (wrapping) while focus — and typing — stay in the input. */
  const moveActiveResult = (delta: 1 | -1) => {
    const n = ctx.results.length
    if (n === 0) return
    const cur = ctx.activeResultIndex
    const next = cur < 0 ? (delta > 0 ? 0 : n - 1) : (cur + delta + n) % n
    ctx.setActiveResultIndex(next)
    queueMicrotask(() =>
      document.getElementById(`header-search-option-${next}`)?.scrollIntoView({ block: 'nearest' }),
    )
  }

  return (
    <>
      <div
        role="dialog"
        aria-label="Search jobs, bids, estimates, customers"
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 41,
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          gap: '0.5rem',
          minHeight: HEADER_ROW_MIN_HEIGHT,
          padding: '0 0.25rem',
          background: ctx.navOverlayBackground,
          boxSizing: 'border-box',
        }}
      >
        <input
          ref={ctx.inputRef as LegacyRef<HTMLInputElement>}
          type="search"
          value={ctx.query}
          onChange={(e) => ctx.setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (!showResultsPanel || ctx.results.length === 0) return
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              moveActiveResult(1)
              return
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault()
              moveActiveResult(-1)
              return
            }
            if (e.key === 'Enter') {
              const r = ctx.activeResultIndex >= 0 ? ctx.results[ctx.activeResultIndex] : undefined
              if (r) {
                e.preventDefault()
                ctx.selectResult(r)
              }
            }
          }}
          placeholder="Search jobs, bids, estimates, customers…"
          autoComplete="off"
          aria-label="Search query"
          role="combobox"
          aria-expanded={showResultsPanel && ctx.results.length > 0}
          aria-controls="header-global-search-results"
          aria-activedescendant={
            ctx.activeResultIndex >= 0 ? `header-search-option-${ctx.activeResultIndex}` : undefined
          }
          aria-autocomplete="list"
          style={{
            flex: 1,
            minWidth: 0,
            padding: '0.45rem 0.6rem',
            fontSize: '1rem',
            border: '1px solid var(--border-strong)',
            borderRadius: 6,
            boxSizing: 'border-box',
          }}
        />
        <button
          type="button"
          onClick={() => ctx.closeSearch()}
          style={{
            flex: '0 0 auto',
            padding: '0.45rem 0.75rem',
            fontSize: '0.875rem',
            border: '1px solid var(--border-strong)',
            borderRadius: 6,
            background: 'var(--bg-subtle)',
            cursor: 'pointer',
            color: 'var(--text-strong)',
          }}
        >
          Back
        </button>
      </div>
      {showResultsPanel ? (
        ctx.results.length > 0 ? (
          <ul
            id="header-global-search-results"
            role="listbox"
            aria-label="Search results"
            style={{
              ...resultsPanelBaseStyle,
              listStyle: 'none',
              margin: 0,
              padding: '0.25rem 0',
            }}
          >
            {ctx.results.map((r, idx) => {
              const tradePill = serviceTypeTagForUnifiedRow(r)
              const pill = tradePill ?? customerTypePillForUnifiedRow(r)
              const isActive = idx === ctx.activeResultIndex
              return (
                <li
                  key={`${r.source}-${r.id}`}
                  id={`header-search-option-${idx}`}
                  role="option"
                  aria-selected={isActive}
                >
                  <button
                    type="button"
                    onClick={() => ctx.selectResult(r)}
                    tabIndex={-1}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      padding: '0.5rem 0.6rem',
                      border: 'none',
                      background: isActive ? 'var(--bg-blue-tint)' : 'transparent',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      color: 'var(--text-strong)',
                      borderBottom: '1px solid var(--border)',
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                      {pill ? (
                        <span
                          style={{
                            fontSize: '0.65rem',
                            fontWeight: 700,
                            padding: '0.1rem 0.28rem',
                            borderRadius: 3,
                            background: pill.color,
                            // Trade tags keep their bright literal bg in both themes, so
                            // they need theme-invariant dark text; customer pills flip
                            // with their bg token and text-strong flips with them.
                            color: tradePill ? 'var(--text-on-bright-solid)' : 'var(--text-strong)',
                            lineHeight: 1.2,
                          }}
                        >
                          {pill.tag}
                        </span>
                      ) : null}
                      <span>{formatUnifiedResult(r, ctx.prefixMap)}</span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        ) : (
          <p
            style={{
              ...resultsPanelBaseStyle,
              margin: 0,
              padding: '0.5rem 0.6rem',
              fontSize: '0.875rem',
              color: 'var(--text-muted)',
              overflowY: 'visible',
              maxHeight: 'none',
            }}
          >
            No matches.
          </p>
        )
      ) : null}
    </>
  )
}
