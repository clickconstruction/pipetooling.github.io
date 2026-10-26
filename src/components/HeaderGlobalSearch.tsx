import {
  Fragment,
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
import { useAuth, type UserRole } from '../hooks/useAuth'
import { useZzTestJobsHidden } from '../lib/jobs/zzTestJobSwitch'
import { loadZzTestJobIds } from '../lib/jobs/zzTestJobRows'
import { withoutZzTestJobRows } from '../lib/jobs/zzTestJobVisibility'
import { isZzTestName } from '../lib/jobs/zzTestJobSweep'
import { fieldRoleServiceTypeIdsForUser, isSubcontractorLikeRole } from '../lib/subcontractorLikeRole'
import {
  escapeLike,
  type JobSearchResult,
  type BidSearchResult,
  type CustomerSearchResult,
  type EstimateNavSearchResult,
  type UnifiedSearchResult,
} from '../utils/unifiedJobBidSearch'
import { CustomerSnapshotModal } from './customers/CustomerSnapshotModal'
import {
  fetchBidSearchEvidence,
  fetchJobSearchEvidence,
  type BidSearchEvidence,
  type JobSearchEvidence,
} from '../lib/jobSearchEvidence'
import { UnifiedSearchResultRow } from './search/UnifiedSearchResultRow'
import { useLedgerDisplayPrefixes } from '../contexts/LedgerDisplayPrefixContext'
import { effectiveJobLedgerNumber } from '../lib/ledgerDisplayPrefixes'
import { buildFieldJobLookupCard, officeTelHref, type FieldJobLookupCard } from '../lib/fieldJobLookup'
import { PORTAL_COMPANY } from '../../supabase/functions/_shared/portalCompany'
import type { LedgerPrefixMap } from '../lib/ledgerDisplayPrefixes'
import {
  GO_ANYWHERE_CONTROL,
  GO_ANYWHERE_WORDS,
  doorQuery,
  doorsFor,
  nextGroupStart,
  searchDoors,
  type Door,
  type DoorGroup,
  type DoorGroupKey,
  type DoorSources,
  type DoorViewer,
} from '../lib/search/doors'
import { readRecentDoorIds, recentDoorsFor, rememberDoor } from '../lib/search/recentDoors'
import { recordNavClick } from '../lib/navClickTelemetry'
import { canOpenPunchList } from '../lib/todos/punchListAccess'
import type { BoardItem } from '../lib/todos/todoBoard'

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
  /** Field job lookup (helpers / subcontractor): jobs only, read-only card, no money evidence. */
  fieldLookup: boolean
  navOverlayBackground: string
  prefixMap: LedgerPrefixMap
  /** Lazy evidence for rich rows (job money rail / bid outcome+value), keyed by row id. */
  jobEvidence: Map<string, JobSearchEvidence>
  bidEvidence: Map<string, BidSearchEvidence>
  /**
   * Go anywhere (punch list #181, PR 2): the door groups drawn under today's rows for the typed words, or the Recent
   * group when nothing is typed. The rows of every group follow today's rows in the ↑ ↓ walk, so `activeResultIndex`
   * runs over both.
   */
  doorGroups: ShownDoorGroup[]
  /** A group's "N more" press: that group alone, whole. `null` is every group, three rows each. */
  onlyGroup: DoorGroupKey | null
  setOnlyGroup: (key: DoorGroupKey | null) => void
  openDoor: (door: Door, there?: boolean) => void
  /** The phone's strip placement: no keys line, since there is no Tab to say. */
  isMobile: boolean
}

/** A group as the box draws it: the kinds' groups from `searchDoors`, or the Recent list when nothing is typed. */
export type ShownDoorGroup = { key: DoorGroupKey | 'recent'; label: string; hint?: string; doors: Door[]; more: number }

const HeaderGlobalSearchContext = createContext<HeaderGlobalSearchContextValue | null>(null)

const searchIcon = (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="1.25em" height="1.25em" fill="currentColor" aria-hidden="true">
    <path d="M480 272C480 317.9 465.1 360.3 440 394.7L566.6 521.4C579.1 533.9 579.1 554.2 566.6 566.7C554.1 579.2 533.8 579.2 521.3 566.7L394.7 440C360.3 465.1 317.9 480 272 480C157.1 480 64 386.9 64 272C64 157.1 157.1 64 272 64C386.9 64 480 157.1 480 272zM272 416C351.5 416 416 351.5 416 272C416 192.5 351.5 128 272 128C192.5 128 128 192.5 128 272C128 351.5 192.5 416 272 416z" />
  </svg>
)

export function HeaderGlobalSearchProvider({
  enabled,
  fieldLookup = false,
  authUserId,
  navOverlayBackground,
  isMobile,
  farmModeActive = false,
  children,
}: {
  /** Role gate (dev|master|assistant-like). The provider mounts for every role so the
   * Layout tree stays STABLE across the cold-load null→role transition (a conditional
   * wrapper remounted the whole app body, wiping page state — v2.860); when false, the
   * hotkeys and data load are inert and no UI entry points render (they gate themselves). */
  enabled: boolean
  /** T5-01: helpers + subcontractors search jobs only and get a read-only card (no Job Detail, no money). */
  fieldLookup?: boolean
  authUserId: string | null
  navOverlayBackground: string
  isMobile: boolean
  /** Farm Mode hides the Roadmap and Map doors, as it hides their nav entries; the box itself is inert under it. */
  farmModeActive?: boolean
  children: ReactNode
}) {
  const navigate = useNavigate()
  const location = useLocation()
  const { role, estimatorProspectsAccess, teamProspectsAccess } = useAuth()
  /** ZZ test jobs (punch list #61, v2.5122): job hits drop by name and the shared ids, customer hits by name. */
  const { role: authRole } = useAuth()
  const hideZz = useZzTestJobsHidden(authRole)
  const bidPreview = useBidPreview()
  const jobDetailModal = useJobDetailModal()
  const { prefixMap } = useLedgerDisplayPrefixes()
  const [open, setOpen] = useState(false)
  const [query, setQueryState] = useState('')
  const [results, setResults] = useState<UnifiedSearchResult[]>([])
  const [jobEvidence, setJobEvidence] = useState<Map<string, JobSearchEvidence>>(() => new Map())
  const [bidEvidence, setBidEvidence] = useState<Map<string, BidSearchEvidence>>(() => new Map())
  const [activeResultIndex, setActiveResultIndex] = useState(-1)
  /** Header-owned customer snapshot; opened on selecting a customer result. Kept out of the context value. */
  const [snapshotCustomerId, setSnapshotCustomerId] = useState<string | null>(null)
  /** Field lookup card (T5-01); opened on selecting a job result in field mode. */
  const [lookupCard, setLookupCard] = useState<FieldJobLookupCard | null>(null)
  const [serviceTypes, setServiceTypes] = useState<Array<{ id: string; name: string }>>([])
  const [enabledBidServiceTypeIds, setEnabledBidServiceTypeIds] = useState<string[]>([])
  const [subcontractorServiceTypeIds, setSubcontractorServiceTypeIds] = useState<string[] | null>(null)

  const openedFromRef = useRef<Placement>('toolbar')
  const inputRef = useRef<HTMLInputElement>(null)
  const stripButtonRef = useRef<HTMLButtonElement>(null)
  const toolbarButtonRef = useRef<HTMLButtonElement>(null)

  // Go anywhere (punch list #181, PR 2): the doors this viewer may open, from the one gated index. The field lookup
  // keeps its job card alone (PR 4 is the owner's call on the box for every role).
  const viewer = useMemo<DoorViewer | null>(
    () => (role && enabled && !fieldLookup ? { role, estimatorProspectsAccess, teamProspectsAccess, farmModeActive } : null),
    [role, enabled, fieldLookup, estimatorProspectsAccess, teamProspectsAccess, farmModeActive],
  )
  // The guides and the punch list live in Vite-only modules (`import.meta.glob`, `virtual:punch-list`), so they load
  // once per sign-in, in an idle moment after the role lands, and only for a viewer who may open them (PR 3). Never
  // on the first open: in dev the guides are hundreds of module requests, and a load cancelled by a quick Escape would
  // have left the groups empty for the session.
  const [sources, setSources] = useState<DoorSources>({})
  const sourcesLoadedForRef = useRef<string | null>(null)
  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])
  useEffect(() => {
    if (!viewer) return
    const key = `${viewer.role}`
    if (sourcesLoadedForRef.current === key) return
    sourcesLoadedForRef.current = key
    const load = () => {
      // A chunk that fails to load leaves its group out for the session; the rest of the box still answers.
      void import('../lib/helpGuideRegistry')
        .then((m) => {
          if (mountedRef.current) setSources((s) => ({ ...s, guides: m.HELP_GUIDES }))
        })
        .catch(() => {})
      if (canOpenPunchList(viewer.role)) {
        // The module is typed loosely (`src/vite-env.d.ts`), so its rows are read as the punch list page reads them.
        void import('virtual:punch-list')
          .then((m) => {
            const items = m.default.items as BoardItem[]
            if (mountedRef.current) setSources((s) => ({ ...s, todos: items.map((i) => ({ number: i.number, name: i.name, group: i.group })) }))
          })
          .catch(() => {})
      } else {
        setSources((s) => ({ ...s, todos: [] }))
      }
    }
    const w = window as Window & { requestIdleCallback?: (cb: () => void) => number }
    if (typeof w.requestIdleCallback === 'function') w.requestIdleCallback(load)
    else window.setTimeout(load, 0)
  }, [viewer])
  const doors = useMemo<Door[]>(() => (viewer ? doorsFor(viewer, sources) : []), [viewer, sources])
  const [onlyGroup, setOnlyGroup] = useState<DoorGroupKey | null>(null)
  const [recentIds, setRecentIds] = useState<string[]>([])
  useEffect(() => {
    if (open) setRecentIds(readRecentDoorIds(authUserId))
  }, [open, authUserId])
  const doorGroups = useMemo<ShownDoorGroup[]>(() => {
    if (doors.length === 0) return []
    const q = query.trim()
    if (q === '') {
      const recent = recentDoorsFor(recentIds, doors)
      return recent.length > 0 ? [{ key: 'recent', label: GO_ANYWHERE_WORDS.recent, hint: GO_ANYWHERE_WORDS.recentHint, doors: recent, more: 0 }] : []
    }
    return searchDoors(q, doors, { only: onlyGroup }).map((g: DoorGroup) => ({ key: g.key, label: g.label, doors: g.doors, more: g.more }))
  }, [doors, query, recentIds, onlyGroup])

  useEffect(() => {
    if (!authUserId || !enabled || fieldLookup) return
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
  }, [authUserId, enabled, fieldLookup])

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
    setOnlyGroup(null)
    queueMicrotask(() => {
      const ref = openedFromRef.current === 'strip' ? stripButtonRef : toolbarButtonRef
      ref.current?.focus()
    })
  }, [])

  const selectResult = useCallback(
    (r: UnifiedSearchResult) => {
      if (r.source === 'job' && fieldLookup) {
        setLookupCard(buildFieldJobLookupCard(r, effectiveJobLedgerNumber(r.hcp_number, r.click_number)))
      } else if (r.source === 'job') {
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
    [navigate, closeSearch, bidPreview, jobDetailModal, fieldLookup],
  )

  /**
   * A door opens by its link, is remembered on this device, and counts as a nav click with the door as the target.
   * A guide's **Go there** opens the door's `also` link instead, and the click's target says so.
   */
  const openDoor = useCallback(
    (door: Door, there = false) => {
      const to = there && door.also ? door.also.to : door.to
      setRecentIds(rememberDoor(authUserId, door.id))
      recordNavClick(authUserId, role, GO_ANYWHERE_CONTROL, there ? `${door.id}#there` : door.id)
      closeSearch()
      navigate(to)
    },
    [authUserId, role, closeSearch, navigate],
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
      // A prefix (`>`) narrows the box to the doors: today's rows stay out and nothing is asked of the server.
      if (doorQuery(q).only != null) {
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
      // Search is a lookup, not a total: a failed ZZ read degrades to names alone (a ZZ customer's job whose
      // own name is real can then show) rather than wiping every result.
      const zzIdsPromise: Promise<ReadonlySet<string> | null> = hideZz
        ? loadZzTestJobIds(authUserId).catch(() => null)
        : Promise.resolve(null)
      const shownJobs = (jobs: JobSearchResult[], zzIds: ReadonlySet<string> | null) =>
        hideZz ? withoutZzTestJobRows(jobs, (j) => j.id, zzIds) : jobs
      if (fieldLookup) {
        // Field lookup: jobs only. Bids, estimates and customers are office surfaces.
        void Promise.all([supabase.rpc('search_jobs_ledger', { search_text: q }), zzIdsPromise]).then(([jobsRes, zzIds]) => {
          const jobs = shownJobs((jobsRes.data ?? []) as JobSearchResult[], zzIds)
          setResults(jobs.map((j) => ({ source: 'job' as const, ...j })))
          setActiveResultIndex(-1)
        })
        return
      }
      void Promise.all([
        // The office's search finds a GC job's billing job too; the field lookup above never does.
        supabase.rpc('search_jobs_ledger', { search_text: q, include_billing_only: true }),
        supabase.rpc('search_bids_for_clock', bidsParams),
        supabase.rpc('search_estimates_for_nav', { search_text: q }),
        customersPromise,
        zzIdsPromise,
      ]).then(([jobsRes, bidsRes, estRes, customersRead, zzIds]) => {
        const jobs = shownJobs((jobsRes.data ?? []) as JobSearchResult[], zzIds)
        const customers = hideZz ? customersRead.filter((c) => !isZzTestName(c.name)) : customersRead
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
  }, [open, query, serviceTypes, enabledBidServiceTypeIds, subcontractorServiceTypeIds, fieldLookup, hideZz, authUserId])

  /** Rich-row evidence for job and bid results. `enabled` is already the office gate
   * (dev/master/assistant-like), so job evidence always uses money mode here. */
  useEffect(() => {
    if (!open || results.length === 0 || fieldLookup) return
    const jobIds = results.filter((r) => r.source === 'job').slice(0, 20).map((r) => r.id)
    const bidIds = results.filter((r) => r.source === 'bid').slice(0, 20).map((r) => r.id)
    const missingJobs = jobIds.filter((id) => !jobEvidence.has(id))
    const missingBids = bidIds.filter((id) => !bidEvidence.has(id))
    if (missingJobs.length === 0 && missingBids.length === 0) return
    let cancelled = false
    const t = window.setTimeout(() => {
      void (async () => {
        try {
          const [jobs, bids] = await Promise.all([
            missingJobs.length > 0 ? fetchJobSearchEvidence(missingJobs, 'money') : Promise.resolve(new Map<string, JobSearchEvidence>()),
            missingBids.length > 0 ? fetchBidSearchEvidence(missingBids) : Promise.resolve(new Map<string, BidSearchEvidence>()),
          ])
          if (cancelled) return
          if (jobs.size > 0)
            setJobEvidence((prev) => {
              const next = new Map(prev)
              for (const [k, v] of jobs) next.set(k, v)
              return next
            })
          if (bids.size > 0)
            setBidEvidence((prev) => {
              const next = new Map(prev)
              for (const [k, v] of bids) next.set(k, v)
              return next
            })
        } catch {
          // Rows render without the evidence spans.
        }
      })()
    }, 200)
    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
  }, [open, results, jobEvidence, bidEvidence, fieldLookup])

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
        fieldLookup,
        navOverlayBackground,
        prefixMap,
        jobEvidence,
        bidEvidence,
        doorGroups,
        onlyGroup,
        setOnlyGroup,
        openDoor,
        isMobile,
      }) satisfies HeaderGlobalSearchContextValue,
    [open, openSearch, closeSearch, query, setQuery, results, activeResultIndex, selectResult, fieldLookup, navOverlayBackground, prefixMap, jobEvidence, bidEvidence, doorGroups, onlyGroup, openDoor, isMobile],
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
      {lookupCard ? <FieldJobLookupCardModal card={lookupCard} onClose={() => setLookupCard(null)} /> : null}
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
      title={ctx.fieldLookup ? 'Find a job — number, name or address' : 'Search jobs, bids, estimates, customers — ⌘K / Ctrl+K toggles'}
      aria-label={ctx.fieldLookup ? 'Find a job' : 'Search jobs, bids, estimates, customers'}
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
  // Go anywhere (punch list #181, PR 2): the door rows follow today's rows in one walk. The panel also opens on an
  // empty box when this device remembers a door.
  const doorRows = ctx.doorGroups.flatMap((g) => g.doors)
  const rowCount = ctx.results.length + doorRows.length
  const showResultsPanel = qTrim.length >= MIN_HEADER_SEARCH_CHARS || (qTrim === '' && doorRows.length > 0)
  /** The lit row: the one the arrows chose, else the first, so Enter alone opens the best match. */
  const active = ctx.activeResultIndex >= 0 ? ctx.activeResultIndex : rowCount > 0 ? 0 : -1
  const groupStarts: number[] = []
  {
    let offset = 0
    if (ctx.results.length > 0) {
      groupStarts.push(0)
      offset = ctx.results.length
    }
    for (const g of ctx.doorGroups) {
      if (g.doors.length === 0) continue
      groupStarts.push(offset)
      offset += g.doors.length
    }
  }
  const scrollRowIntoView = (idx: number) =>
    queueMicrotask(() => document.getElementById(`header-search-option-${idx}`)?.scrollIntoView({ block: 'nearest' }))

  /** Arrow keys move the highlight (wrapping) while focus — and typing — stay in the input. */
  const moveActiveResult = (delta: 1 | -1) => {
    const n = rowCount
    if (n === 0) return
    const next = (active + delta + n) % n
    ctx.setActiveResultIndex(next)
    scrollRowIntoView(next)
  }
  /** Tab lands on the next group's first row, Shift+Tab on the one before; with one group it does what Tab does. */
  const jumpGroup = (step: 1 | -1): boolean => {
    const next = nextGroupStart(active, groupStarts, step)
    if (next == null) return false
    ctx.setActiveResultIndex(next)
    scrollRowIntoView(next)
    return true
  }
  const openActive = (): boolean => {
    if (active < 0) return false
    if (active < ctx.results.length) {
      const r = ctx.results[active]
      if (r) ctx.selectResult(r)
      return true
    }
    const d = doorRows[active - ctx.results.length]
    if (d) ctx.openDoor(d)
    return true
  }

  return (
    <>
      <div
        role="dialog"
        aria-label={ctx.fieldLookup ? 'Find a job' : 'Search jobs, bids, estimates, customers'}
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 41,
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          gap: '0.5rem',
          minHeight: HEADER_ROW_MIN_HEIGHT,
          // Mirror .appNav's vertical padding (incl. the iOS safe-area clamp) so the input
          // lands on the header row it replaces instead of centering up into the notch zone.
          padding: 'max(var(--app-nav-pad-y), env(safe-area-inset-top, 0px)) 0.25rem var(--app-nav-pad-y)',
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
            if (!showResultsPanel || rowCount === 0) return
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
            if (e.key === 'Tab') {
              if (jumpGroup(e.shiftKey ? -1 : 1)) e.preventDefault()
              return
            }
            if (e.key === 'Enter') {
              if (openActive()) e.preventDefault()
            }
          }}
          placeholder={ctx.fieldLookup ? 'Job number, name or address…' : GO_ANYWHERE_WORDS.placeholder}
          autoComplete="off"
          aria-label="Search query"
          role="combobox"
          aria-expanded={showResultsPanel && rowCount > 0}
          aria-controls="header-global-search-results"
          aria-activedescendant={active >= 0 ? `header-search-option-${active}` : undefined}
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
        rowCount > 0 ? (
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
              const isActive = idx === active
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
                    <UnifiedSearchResultRow
                      result={r}
                      prefixMap={ctx.prefixMap}
                      jobEvidence={r.source === 'job' ? ctx.jobEvidence.get(r.id) : null}
                      bidEvidence={r.source === 'bid' ? ctx.bidEvidence.get(r.id) : null}
                    />
                  </button>
                </li>
              )
            })}
            <DoorGroupRows groups={ctx.doorGroups} firstIndex={ctx.results.length} active={active} onlyGroup={ctx.onlyGroup} setOnlyGroup={ctx.setOnlyGroup} openDoor={ctx.openDoor} />
            {!ctx.isMobile ? (
              <li role="presentation" aria-hidden="true" style={{ padding: '0.35rem 0.6rem 0.2rem', fontSize: '0.72rem', color: 'var(--text-faint)', display: 'flex', gap: '0.7rem', flexWrap: 'wrap' }}>
                {GO_ANYWHERE_WORDS.keys.map((k) => (
                  <span key={k}>{k}</span>
                ))}
              </li>
            ) : null}
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
            {ctx.fieldLookup ? 'No matches.' : GO_ANYWHERE_WORDS.noMatches}
          </p>
        )
      ) : null}
    </>
  )
}

/**
 * The door groups under today's rows (punch list #181, PR 2): a small-caps header a group, three rows and "N more",
 * which shows that group alone with "All kinds" to come back. Each row carries the same option id as today's rows,
 * continuing their index, so the ↑ ↓ walk and the screen reader see one list.
 */
function DoorGroupRows({
  groups,
  firstIndex,
  active,
  onlyGroup,
  setOnlyGroup,
  openDoor,
}: {
  groups: ShownDoorGroup[]
  firstIndex: number
  active: number
  onlyGroup: DoorGroupKey | null
  setOnlyGroup: (key: DoorGroupKey | null) => void
  openDoor: (door: Door, there?: boolean) => void
}) {
  let offset = firstIndex
  const smallPress: CSSProperties = {
    border: '1px solid var(--border-strong)',
    borderRadius: 999,
    background: 'var(--surface)',
    color: 'var(--text-link)',
    font: 'inherit',
    fontSize: '0.75rem',
    fontWeight: 600,
    padding: '0.05rem 0.55rem',
    cursor: 'pointer',
    marginLeft: 'auto',
  }
  return (
    <>
      {groups.map((g) => {
        const start = offset
        offset += g.doors.length
        if (g.doors.length === 0) return null
        const groupKey: DoorGroupKey | null = g.key === 'recent' ? null : g.key
        return (
          <Fragment key={g.key}>
            <li
              role="presentation"
              data-testid={`go-anywhere-group-${g.key}`}
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: '0.5rem',
                padding: '0.45rem 0.6rem 0.15rem',
                fontSize: '0.68rem',
                fontWeight: 700,
                letterSpacing: '0.07em',
                textTransform: 'uppercase',
                color: 'var(--text-muted)',
              }}
            >
              <span>{g.label}</span>
              <span style={{ fontWeight: 600, letterSpacing: 0, color: 'var(--text-faint)' }}>{g.hint ?? g.doors.length + g.more}</span>
              {g.more > 0 && groupKey != null ? (
                <button type="button" tabIndex={-1} onClick={() => setOnlyGroup(groupKey)} style={{ ...smallPress, textTransform: 'none', letterSpacing: 0 }}>
                  {GO_ANYWHERE_WORDS.more(g.more)} ▸
                </button>
              ) : onlyGroup != null && g.key === onlyGroup ? (
                <button type="button" tabIndex={-1} onClick={() => setOnlyGroup(null)} style={{ ...smallPress, textTransform: 'none', letterSpacing: 0 }}>
                  {GO_ANYWHERE_WORDS.allKinds}
                </button>
              ) : null}
            </li>
            {g.doors.map((d, j) => {
              const idx = start + j
              const isActive = idx === active
              return (
                <li key={d.id} id={`header-search-option-${idx}`} role="option" aria-selected={isActive}>
                  <button
                    type="button"
                    data-testid={`go-anywhere-door-${d.id}`}
                    onClick={() => openDoor(d)}
                    tabIndex={-1}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.6rem',
                      width: '100%',
                      textAlign: 'left',
                      padding: '0.45rem 0.6rem',
                      border: 'none',
                      background: isActive ? 'var(--bg-blue-tint)' : 'transparent',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      color: 'var(--text-strong)',
                      borderBottom: '1px solid var(--border)',
                    }}
                  >
                    <span style={{ minWidth: 0, flex: 1, display: 'grid', gap: '0.05rem' }}>
                      <span style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.label}</span>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.where}</span>
                    </span>
                    {d.kind === 'window' ? <span style={{ flex: 'none', fontSize: '0.72rem', color: 'var(--text-faint)' }}>{GO_ANYWHERE_WORDS.window}</span> : null}
                    {d.also ? (
                      <span
                        role="button"
                        tabIndex={-1}
                        data-testid={`go-anywhere-there-${d.id}`}
                        title={d.also.to}
                        onClick={(e) => {
                          e.stopPropagation()
                          openDoor(d, true)
                        }}
                        style={{ ...smallPress, marginLeft: 0, borderColor: 'var(--border)', padding: '0.1rem 0.6rem' }}
                      >
                        {d.also.label} →
                      </span>
                    ) : null}
                  </button>
                </li>
              )
            })}
          </Fragment>
        )
      })}
    </>
  )
}

/**
 * T5-01: the read-only card a helper / subcontractor gets instead of Job Detail —
 * number · name · address · trade, Directions and Call office. Nothing here punches
 * the clock or edits the job; the copy says so.
 */
function FieldJobLookupCardModal({ card, onClose }: { card: FieldJobLookupCard; onClose: () => void }) {
  const tel = officeTelHref(PORTAL_COMPANY.phone)
  const btn: CSSProperties = {
    flex: '1 1 auto',
    textAlign: 'center',
    padding: '0.6rem 0.75rem',
    borderRadius: 8,
    border: '1px solid var(--border-strong)',
    background: 'var(--bg-subtle)',
    color: 'var(--text-strong)',
    textDecoration: 'none',
    fontWeight: 600,
    fontSize: '0.95rem',
  }
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Job ${card.number}`}
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        padding: 'calc(1rem + env(safe-area-inset-top, 0px)) 0.75rem calc(0.75rem + env(safe-area-inset-bottom, 0px))',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 480,
          background: 'var(--surface)',
          color: 'var(--text-strong)',
          borderRadius: 12,
          padding: '1rem 1rem 0.9rem',
          boxSizing: 'border-box',
          display: 'grid',
          gap: '0.6rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
          <strong style={{ fontSize: '1.15rem' }}>{card.number}</strong>
          <span style={{ fontSize: '1.05rem' }}>{card.name}</span>
          {card.serviceType ? (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>{card.serviceType}</span>
          ) : null}
        </div>
        <div style={{ fontSize: '1rem', lineHeight: 1.35 }}>
          {card.address ?? <span style={{ color: 'var(--text-muted)' }}>No address on this job — call the office.</span>}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {card.directionsUrl ? (
            <a href={card.directionsUrl} target="_blank" rel="noopener noreferrer" style={btn}>
              Directions
            </a>
          ) : null}
          {tel ? (
            <a href={tel} style={btn}>
              Call office
            </a>
          ) : null}
          <button type="button" onClick={onClose} style={{ ...btn, cursor: 'pointer', flex: '0 0 auto' }}>
            Close
          </button>
        </div>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          Read only. To start work on it, use the Clock In button.
        </div>
      </div>
    </div>
  )
}
