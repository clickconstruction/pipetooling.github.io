import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { canOpenBillingNotifications } from '../../lib/jobs/stagesRoleGates'
import { estInputBase, estPrimaryButton, estSecondaryButton } from './estimatesPageStyles'
import { ESTIMATE_LIST_CUSTOMER_SNAPSHOT_BTN_CLASS, EstimateListCards, EstimateListTable, type EstimateListStagesThread } from './EstimateListTable'
import { estimateDeclinedRowLabel, estimateListRowMatchesSearch, formatEstimateMoney as formatMoney, type EstimateListCustomerEvent, type EstimateListRow } from '../../lib/estimates/estimateListRows'
import {
  defaultDraftFirstLine,
} from '../../lib/estimates/estimateDraftLines'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useNarrowViewport640 } from '../../hooks/useNarrowViewport640'
import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'
import { resolveEstimateMasterUserId as resolveMasterUserId } from '../../lib/estimateMasterUser'
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext'
import { computeLedgerTotals, ledgerRowPasses, type LedgerKindFilter, isEmptyEstimateDraft, splitFollowupRows } from '../../lib/estimatePipelineRefresh'
import { estimateOpenState, groupEventsByEstimateId, type EstimateOpenState } from '../../lib/estimateOpenState'
import { fetchAllRowsChunkedIn } from '../../lib/supabasePaging'
import { useToastContext } from '../../contexts/ToastContext'
import CustomerAcceptanceRecordModal from './CustomerAcceptanceRecordModal'
import EstimateAcceptedNotifySettingsModal from './EstimateAcceptedNotifySettingsModal'
import { EmptyState } from '../EmptyState'
import { estimateLaneEmptyWords, estimatesLedgerEmptyWords, estimatesListEmptyWords, estimatesSearchEmptyWords } from '../../lib/estimates/estimatesEmptyWords'
import CreateJobFromEstimateModal from './CreateJobFromEstimateModal'
import { CustomerSnapshotModal } from '../customers/CustomerSnapshotModal'
import { recordNavClick } from '../../lib/navClickTelemetry'
import { pageTabStyle } from '../../lib/pageTabStyle'
import { tapHintCss } from '../../lib/tapHint'
import { useEstimateThreadNotes } from '../../hooks/useEstimateThreadNotes'
import { ESTIMATES_PAGE_CLASS, estimatesFocusVisibleCss, estimatesPageShellCss } from './estimatesPageCss'
import { MoneyText } from '../Money'

/**
 * The Estimates list, `/estimates`: the Pipeline's lanes (Unsent, Sent, Declined, Accepted) and the
 * Ledger's money view, over one read of the newest 200 estimates. Moved whole from
 * `src/pages/Estimates.tsx` (v2.7629, punch list #46 row 3, cut 8 of the Estimates map); the code is the
 * page's own. It shares no state with the detail page: the address is what selects an estimate.
 */

const estimatesListCustomerSnapshotBtnCss = `
  .${ESTIMATES_PAGE_CLASS} .${ESTIMATE_LIST_CUSTOMER_SNAPSHOT_BTN_CLASS}:hover {
    background: var(--bg-muted);
  }
`

const estimatesListPageCss = `${estimatesPageShellCss}\n${estimatesFocusVisibleCss}\n${estimatesListCustomerSnapshotBtnCss}\n${tapHintCss('.estimate-card--tap-hint')}`

/** Keeps wide estimate tables from widening the whole page (flex min-width chain). */
const estimateListTableScrollWrapStyle: CSSProperties = {
  overflowX: 'auto',
  maxWidth: '100%',
  minWidth: 0,
}

type EstimateListTab = 'all' | 'followup'

export default function EstimatesListPage() {
  const { user, role, profileName } = useAuth()
  const narrowViewport640 = useNarrowViewport640()
  const { showToast } = useToastContext()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  /** `load()` only filters by this URL param; matches Jobs `?customer=`. */
  const customerParamForEstimatesReload = searchParams.get('customer')
  const [listTab, setListTab] = useState<EstimateListTab>('followup')
  // Ledger money view (pipeline refresh part 3)
  const [ledgerKind, setLedgerKind] = useState<LedgerKindFilter>('all')
  const [ledgerDays, setLedgerDays] = useState(90)
  const [ledgerIncludeClosed, setLedgerIncludeClosed] = useState(false)
  /** ⚙ next to New estimate: org-wide "who gets emailed when an estimate is accepted". */
  const [acceptNotifySettingsOpen, setAcceptNotifySettingsOpen] = useState(false)
  const [listSearch, setListSearch] = useState('')
  const [rows, setRows] = useState<EstimateListRow[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [acceptanceModalEstimateId, setAcceptanceModalEstimateId] = useState<string | null>(null)
  const [createJobFromListRow, setCreateJobFromListRow] = useState<EstimateListRow | null>(null)
  const [customerSnapshotId, setCustomerSnapshotId] = useState<string | null>(null)

  const {
    expandedEstimateThreadId,
    setExpandedEstimateThreadId,
    estimateThreadNotesByEstimateId,
    estimateThreadNotesLoadingId,
    estimateThreadSubmittingId,
    estimateThreadDraft,
    setEstimateThreadDraft,
    submitEstimateThreadNote,
    estimateThreadStatsByEstimateId,
    refreshEstimateThreadStatsForEstimateIds,
  } = useEstimateThreadNotes(showToast, user?.id, profileName)

  const toggleEstimateThreadExpanded = useCallback((id: string) => {
    setExpandedEstimateThreadId((prev) => (prev === id ? null : id))
  }, [setExpandedEstimateThreadId])

  const load = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    try {
      const customerFilter = customerParamForEstimatesReload?.trim() || null
      const data = await withSupabaseRetry(
        async () => {
          let q = supabase
            .from('estimates')
            .select('*, customers(name, address, contact_info), jobs_ledger(hcp_number)')
          if (customerFilter) {
            q = q.eq('customer_id', customerFilter)
          }
          return await q.order('updated_at', { ascending: false }).limit(200)
        },
        'load estimates',
      )
      setRows((data ?? []) as EstimateListRow[])
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not load estimates'), 'error')
    } finally {
      setLoading(false)
    }
  }, [user?.id, showToast, customerParamForEstimatesReload])

  useEffect(() => {
    void load()
  }, [load])

  const filteredRows = useMemo(() => {
    if (!listSearch.trim()) return rows
    return rows.filter((r) => estimateListRowMatchesSearch(r, listSearch))
  }, [rows, listSearch])

  const followupBuckets = useMemo(() => splitFollowupRows(filteredRows), [filteredRows])

  // v2.2873 (J17-F1 / N2): one chunked fetch of every sent + declined row's customer events,
  // so the Sent chip can say opened / never opened and a Declined row can say who said no.
  // The list select stays `estimates` alone — a join would multiply rows per event.
  const [listCustomerEvents, setListCustomerEvents] = useState<Record<string, EstimateListCustomerEvent[]> | null>(null)
  const eventRowIdsKey = useMemo(
    () => rows.filter((r) => r.status === 'sent' || r.status === 'declined').map((r) => r.id).sort().join(','),
    [rows],
  )
  useEffect(() => {
    const ids = eventRowIdsKey ? eventRowIdsKey.split(',') : []
    if (ids.length === 0) {
      setListCustomerEvents({})
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const events = await fetchAllRowsChunkedIn<EstimateListCustomerEvent, string>(
          ids,
          (chunk, from, to) =>
            supabase
              .from('estimate_customer_events')
              .select('estimate_id, event_type, occurred_at, client_ip, metadata')
              .in('estimate_id', chunk)
              .order('occurred_at', { ascending: false })
              .range(from, to),
          'estimate list customer events',
        )
        if (!cancelled) setListCustomerEvents(groupEventsByEstimateId(events))
      } catch {
        // Best-effort: the chip falls back to computeSentWait alone.
        if (!cancelled) setListCustomerEvents({})
      }
    })()
    return () => {
      cancelled = true
    }
  }, [eventRowIdsKey])
  const sentOpenStateById = useMemo(() => {
    if (!listCustomerEvents) return undefined
    const nowMs = Date.now()
    const out: Record<string, EstimateOpenState | null> = {}
    for (const r of followupBuckets.sent) out[r.id] = estimateOpenState(listCustomerEvents[r.id] ?? [], r, nowMs)
    return out
  }, [listCustomerEvents, followupBuckets.sent])
  const declinedLabelById = useMemo(() => {
    const out: Record<string, string> = {}
    for (const r of followupBuckets.declined) out[r.id] = estimateDeclinedRowLabel(listCustomerEvents?.[r.id])
    return out
  }, [listCustomerEvents, followupBuckets.declined])

  // Pipeline refresh: empty-draft debris collapses behind one sweep button.
  const listConfirmDialog = useConfirmDialog()
  const emptyDraftIds = useMemo(
    () => followupBuckets.unsent.filter((r) => isEmptyEstimateDraft(r)).map((r) => r.id),
    [followupBuckets.unsent],
  )
  const unsentVisibleRows = useMemo(
    () => followupBuckets.unsent.filter((r) => !isEmptyEstimateDraft(r)),
    [followupBuckets.unsent],
  )
  const [cleaningEmpties, setCleaningEmpties] = useState(false)

  const ledgerRows = useMemo(() => {
    const nowMs = Date.now()
    return filteredRows.filter((r) =>
      ledgerRowPasses(r, { kind: ledgerKind, includeClosed: ledgerIncludeClosed, withinDays: ledgerDays }, nowMs),
    )
  }, [filteredRows, ledgerKind, ledgerIncludeClosed, ledgerDays])
  const ledgerTotals = useMemo(() => computeLedgerTotals(ledgerRows, Date.now()), [ledgerRows])

  async function cleanUpEmptyDrafts() {
    if (cleaningEmpties || emptyDraftIds.length === 0) return
    const n = emptyDraftIds.length
    const ok = await listConfirmDialog({
      message: `Delete ${n} empty draft${n === 1 ? '' : 's'}? These have no customer, title, or line items.`,
      confirmLabel: `Delete ${n} draft${n === 1 ? '' : 's'}`,
      danger: true,
    })
    if (!ok) return
    setCleaningEmpties(true)
    try {
      await withSupabaseRetry(
        async () => await supabase.from('estimates').delete().in('id', emptyDraftIds).eq('status', 'draft'),
        'clean up empty drafts',
      )
      showToast(`Deleted ${n} empty draft${n === 1 ? '' : 's'}`, 'success')
      await load()
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not clean up drafts'), 'error')
    } finally {
      setCleaningEmpties(false)
    }
  }

  const THREAD_STATS_ESTIMATES_DEBOUNCE_MS = 320
  useEffect(() => {
    if (!user?.id || listTab !== 'followup') return
    const ids = [...new Set(filteredRows.map((r) => r.id))]
    const t = window.setTimeout(() => {
      void refreshEstimateThreadStatsForEstimateIds(ids)
    }, THREAD_STATS_ESTIMATES_DEBOUNCE_MS)
    return () => window.clearTimeout(t)
  }, [user?.id, listTab, filteredRows, refreshEstimateThreadStatsForEstimateIds])

  useEffect(() => {
    if (listTab !== 'followup') setExpandedEstimateThreadId(null)
  }, [listTab, setExpandedEstimateThreadId])

  // Projects card "+ Estimate" deep link (?newEstimate=true&project=<id>):
  // create a draft pre-linked to the project, then navigate to it. This INSERTS
  // a row, so it fires once per mount (ref guard) and strips its params before
  // creating (deep-link contract; no e2e spec — cold-loading it would write to prod).
  // v2.2885: like the button, the row is marked fresh — leave it untouched and
  // the editor deletes it again on the way out.
  const newEstimateParamFiredRef = useRef(false)
  useEffect(() => {
    if (searchParams.get('newEstimate') !== 'true') return
    if (!user?.id || newEstimateParamFiredRef.current) return
    newEstimateParamFiredRef.current = true
    const projectParam = searchParams.get('project')?.trim() || null
    setSearchParams((p) => {
      const next = new URLSearchParams(p)
      next.delete('newEstimate')
      next.delete('project')
      return next
    }, { replace: true })
    void createDraft(projectParam, 'estimate', 'deeplink')
    // createDraft reads latest state when it runs; ref guard prevents refire.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, user?.id, setSearchParams])

  async function createDraft(
    projectId?: string | null,
    docKind: 'estimate' | 'change_order' = 'estimate',
    trigger: 'button' | 'deeplink' = 'button',
  ) {
    if (!user?.id || creating) return
    setCreating(true)
    try {
      const masterUserId = await resolveMasterUserId(user.id, role)
      if (!masterUserId) {
        showToast('Could not determine account owner for estimate.', 'error')
        return
      }
      const inserted = await withSupabaseRetry(
        async () =>
          await supabase
            .from('estimates')
            .insert({
              master_user_id: masterUserId,
              created_by: user.id,
              title: '',
              // COs start with no lines: Impact on cost opens with the guided
              // prompt instead of the estimate's "Custom Service Visit" stub.
              line_items_snapshot: docKind === 'change_order' ? [] : [defaultDraftFirstLine()],
              terms_snapshot: '',
              total_cents: 0,
              project_id: projectId?.trim() || null,
              // CO train (v2.1831): a change order is an estimate flavor.
              ...(docKind === 'change_order' ? { doc_kind: 'change_order', change_order_fields: {} } : {}),
            })
            .select('id, estimate_number')
            .single(),
        'create estimate',
      )
      const ins = inserted as { id: string; estimate_number: number } | null
      if (ins?.estimate_number != null) {
        recordNavClick(user.id, role, 'estimate_draft_created', `#${trigger}:${docKind}`)
        // Fresh-draft marker (decision 17, v2.2885): the editor deletes this row
        // again on leave if nothing was ever committed to it — the button is not
        // the insert, the first real edit / Save / Send is.
        navigate(`/estimates/${ins.estimate_number}`, { state: { freshEstimateDraft: true } })
      }
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not create estimate'), 'error')
    } finally {
      setCreating(false)
    }
  }

  if (!user) return null

  // Primary scoping (v2.2175): a primary's list is the estimates they created or
  // that hang off a job they are the Account Man for (RLS enforces it) — say so
  // when the list is empty instead of implying the company has none.
  // Empty words (punch list #184, sweep C): New estimate adds the first, and the customer filter's Clear filter shows every estimate.
  const estimatesListEmpty = estimatesListEmptyWords({
    customerFiltered: !!customerParamForEstimatesReload?.trim(),
    primary: role === 'primary',
    newEstimate: () => void createDraft(),
    clearCustomer: () =>
      setSearchParams((p) => {
        const n = new URLSearchParams(p)
        n.delete('customer')
        return n
      }),
  })
  const clearListSearch = () => setListSearch('')

  const estimatesStagesThread: EstimateListStagesThread = {
    estimateThreadStatsByEstimateId,
    estimateThreadNotesByEstimateId,
    estimateThreadNotesLoadingId,
    expandedEstimateThreadId,
    toggleEstimateThreadExpanded,
    estimateThreadDraft,
    setEstimateThreadDraft,
    estimateThreadSubmittingId,
    submitEstimateThreadNote,
    canPostNotes: !!user,
  }

  return (
    <div className={`${ESTIMATES_PAGE_CLASS} estimates-page-shell--list`}>
      <style>{estimatesListPageCss}</style>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <h1 style={{ margin: 0 }}>Estimates</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          {canOpenBillingNotifications(role) ? (
            <button
              type="button"
              onClick={() => setAcceptNotifySettingsOpen(true)}
              title="Who gets emailed when a customer accepts an estimate"
              aria-label="Estimate accepted notification settings"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: 36,
                width: 36,
                border: '1px solid var(--border-strong)',
                borderRadius: 4,
                background: 'var(--surface)',
                cursor: 'pointer',
                color: 'var(--text-700)',
                fontSize: '1rem',
              }}
            >
              <span aria-hidden>⚙</span>
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void createDraft(null, 'change_order')}
            disabled={creating}
            title="Write a change order and send it for signature — same flow as an estimate"
            style={estSecondaryButton(creating)}
          >
            New change order
          </button>
          <button type="button" onClick={() => void createDraft()} disabled={creating} style={estPrimaryButton(creating)}>
            {creating ? 'Creating…' : 'New estimate'}
          </button>
        </div>
      </div>
      {acceptNotifySettingsOpen ? (
        <EstimateAcceptedNotifySettingsModal onClose={() => setAcceptNotifySettingsOpen(false)} />
      ) : null}
      <div
        role="tablist"
        aria-label="Estimates views"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.25rem',
          marginTop: '0.75rem',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <button
          type="button"
          role="tab"
          aria-selected={listTab === 'followup'}
          id="estimates-tab-stages"
          onClick={() => setListTab('followup')}
          style={pageTabStyle(listTab === 'followup')}
        >
          Pipeline
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={listTab === 'all'}
          id="estimates-tab-ledger"
          onClick={() => setListTab('all')}
          style={pageTabStyle(listTab === 'all')}
        >
          Ledger
        </button>
      </div>
      {customerParamForEstimatesReload ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            marginTop: '0.75rem',
            padding: '0.5rem 0.75rem',
            background: 'var(--bg-blue-tint)',
            border: '1px solid var(--border-blue)',
            borderRadius: 6,
            fontSize: '0.875rem',
          }}
        >
          <span style={{ color: 'var(--text-blue-800)' }}>Filtered by customer</span>
          <button
            type="button"
            onClick={() =>
              setSearchParams((p) => {
                const n = new URLSearchParams(p)
                n.delete('customer')
                return n
              })
            }
            style={{
              padding: '0.25rem 0.5rem',
              background: 'var(--surface)',
              border: '1px solid #93c5fd',
              borderRadius: 4,
              cursor: 'pointer',
              color: 'var(--text-blue-800)',
              fontSize: '0.8125rem',
            }}
          >
            Clear filter
          </button>
        </div>
      ) : null}
      {listTab === 'all' ? (
        <div role="tabpanel" aria-labelledby="estimates-tab-ledger">
          <div style={{ marginTop: '0.75rem', width: '100%' }}>
            <input
              id="estimates-list-search"
              type="search"
              value={listSearch}
              onChange={(e) => setListSearch(e.target.value)}
              placeholder="Search estimates…"
              autoComplete="off"
              aria-label="Search estimates"
              style={{ ...estInputBase, width: '100%', padding: '0.5rem' }}
            />
          </div>
          <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'center', flexWrap: 'wrap', marginTop: '0.6rem' }}>
            <button type="button" onClick={() => setLedgerKind('all')} style={{ padding: '0.22rem 0.7rem', fontSize: '0.75rem', fontWeight: 600, borderRadius: 999, border: '1px solid ' + (ledgerKind === 'all' ? 'var(--text-link, #2563eb)' : 'var(--border-strong)'), background: ledgerKind === 'all' ? '#2563eb' : 'var(--surface)', color: ledgerKind === 'all' ? 'white' : 'var(--text-700)', cursor: 'pointer' }}>All kinds</button>
            <button type="button" onClick={() => setLedgerKind('estimate')} style={{ padding: '0.22rem 0.7rem', fontSize: '0.75rem', fontWeight: 600, borderRadius: 999, border: '1px solid ' + (ledgerKind === 'estimate' ? 'var(--text-link, #2563eb)' : 'var(--border-strong)'), background: ledgerKind === 'estimate' ? '#2563eb' : 'var(--surface)', color: ledgerKind === 'estimate' ? 'white' : 'var(--text-700)', cursor: 'pointer' }}>Estimates</button>
            <button type="button" onClick={() => setLedgerKind('change_order')} style={{ padding: '0.22rem 0.7rem', fontSize: '0.75rem', fontWeight: 600, borderRadius: 999, border: '1px solid ' + (ledgerKind === 'change_order' ? 'var(--text-link, #2563eb)' : 'var(--border-strong)'), background: ledgerKind === 'change_order' ? '#2563eb' : 'var(--surface)', color: ledgerKind === 'change_order' ? 'white' : 'var(--text-700)', cursor: 'pointer' }}>Change orders</button>
            <button type="button" onClick={() => setLedgerKind('bid_proposal')} style={{ padding: '0.22rem 0.7rem', fontSize: '0.75rem', fontWeight: 600, borderRadius: 999, border: '1px solid ' + (ledgerKind === 'bid_proposal' ? 'var(--text-link, #2563eb)' : 'var(--border-strong)'), background: ledgerKind === 'bid_proposal' ? '#2563eb' : 'var(--surface)', color: ledgerKind === 'bid_proposal' ? 'white' : 'var(--text-700)', cursor: 'pointer' }}>Bid proposals</button>
            <select
              value={ledgerDays}
              onChange={(e) => setLedgerDays(Number(e.target.value))}
              aria-label="Date range"
              style={{ ...estInputBase, padding: '0.22rem 0.5rem', fontSize: '0.75rem', fontWeight: 600, width: 'auto' }}
            >
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
              <option value={365}>Last year</option>
              <option value={0}>All time</option>
            </select>
            <button type="button" onClick={() => setLedgerIncludeClosed((p) => !p)} style={{ padding: '0.22rem 0.7rem', fontSize: '0.75rem', fontWeight: 600, borderRadius: 999, border: '1px solid ' + (ledgerIncludeClosed ? 'var(--text-link, #2563eb)' : 'var(--border-strong)'), background: ledgerIncludeClosed ? '#2563eb' : 'var(--surface)', color: ledgerIncludeClosed ? 'white' : 'var(--text-700)', cursor: 'pointer' }}>Include superseded & declined</button>
          </div>
          {loading ? (
            <p>Loading…</p>
          ) : rows.length === 0 ? (
            <EmptyState {...estimatesListEmpty} />
          ) : ledgerRows.length === 0 ? (
            <EmptyState
              {...estimatesLedgerEmptyWords({
                query: listSearch,
                searchHidesAll: filteredRows.length === 0,
                clearSearch: clearListSearch,
                clearFilters: () => {
                  setLedgerKind('all')
                  setLedgerDays(0)
                  setLedgerIncludeClosed(true)
                },
              })}
            />
          ) : (
            <div style={{ ...estimateListTableScrollWrapStyle, marginTop: '1rem' }}>
              {narrowViewport640 ? (
                <EstimateListCards
                  rows={ledgerRows}
                  setAcceptanceModalEstimateId={setAcceptanceModalEstimateId}
                  setCreateJobFromListRow={setCreateJobFromListRow}
                  showCustomerColumn
                  onCustomerSnapshotRequest={setCustomerSnapshotId}
                />
              ) : (
                <EstimateListTable
                  rows={ledgerRows}
                  setAcceptanceModalEstimateId={setAcceptanceModalEstimateId}
                  setCreateJobFromListRow={setCreateJobFromListRow}
                  showCustomerColumn
                  onCustomerSnapshotRequest={setCustomerSnapshotId}
                />
              )}
            </div>
          )}
          <div style={{ display: 'flex', gap: '1.6rem', flexWrap: 'wrap', borderTop: '2px solid var(--border-strong)', marginTop: '0.9rem', paddingTop: '0.6rem', fontSize: '0.85rem' }}>
            <span><span style={{ color: 'var(--text-muted)', marginRight: '0.35rem' }}>Accepted this month</span><strong style={{ color: 'var(--text-green-600)', fontVariantNumeric: 'tabular-nums' }}><MoneyText text={formatMoney(ledgerTotals.acceptedThisMonthCents)} /></strong></span>
            <span><span style={{ color: 'var(--text-muted)', marginRight: '0.35rem' }}>Outstanding sent</span><strong style={{ color: 'var(--text-amber-800)', fontVariantNumeric: 'tabular-nums' }}><MoneyText text={formatMoney(ledgerTotals.outstandingSentCents)} /></strong></span>
            <span><span style={{ color: 'var(--text-muted)', marginRight: '0.35rem' }}>Accepted, not on a job</span><strong style={{ color: ledgerTotals.acceptedUnlinkedCents > 0 ? 'var(--text-red-700)' : 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}><MoneyText text={formatMoney(ledgerTotals.acceptedUnlinkedCents)} /></strong></span>
          </div>
        </div>
      ) : (
        <div role="tabpanel" aria-labelledby="estimates-tab-stages" style={{ marginTop: '0.75rem' }}>
          <div style={{ width: '100%' }}>
            <input
              id="estimates-list-search-stages"
              type="search"
              value={listSearch}
              onChange={(e) => setListSearch(e.target.value)}
              placeholder="Search estimates…"
              autoComplete="off"
              aria-label="Search estimates"
              style={{ ...estInputBase, width: '100%', padding: '0.5rem' }}
            />
          </div>
          {loading ? (
            <p style={{ marginTop: '1rem' }}>Loading…</p>
          ) : rows.length === 0 ? (
            <EmptyState {...estimatesListEmpty} />
          ) : filteredRows.length === 0 ? (
            <EmptyState {...estimatesSearchEmptyWords(listSearch, clearListSearch)} />
          ) : (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '1.75rem',
                marginTop: '1.25rem',
              }}
            >
              <section>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', margin: '0 0 0.5rem', flexWrap: 'wrap' }}>
                  <h2 style={{ fontSize: '1.1rem', margin: 0, fontWeight: 600 }}>Unsent</h2>
                  {emptyDraftIds.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => void cleanUpEmptyDrafts()}
                      disabled={cleaningEmpties}
                      style={{
                        marginLeft: 'auto',
                        padding: '0.25rem 0.7rem',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        border: '1px solid var(--border-strong)',
                        borderRadius: 5,
                        background: 'var(--bg-muted)',
                        color: 'var(--text-muted)',
                        cursor: cleaningEmpties ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {cleaningEmpties ? 'Cleaning…' : `🧹 Clean up ${emptyDraftIds.length} empty draft${emptyDraftIds.length === 1 ? '' : 's'}`}
                    </button>
                  ) : null}
                </div>
                {unsentVisibleRows.length === 0 ? (
                  <EmptyState compact {...estimateLaneEmptyWords('unsent', { query: listSearch, clearSearch: clearListSearch, emptyDrafts: emptyDraftIds.length })} />
                ) : (
                  <div style={estimateListTableScrollWrapStyle}>
                    {narrowViewport640 ? (
                      <EstimateListCards
                        rows={unsentVisibleRows}
                        setAcceptanceModalEstimateId={setAcceptanceModalEstimateId}
                        setCreateJobFromListRow={setCreateJobFromListRow}
                        showCustomerColumn
                        onCustomerSnapshotRequest={setCustomerSnapshotId}
                        stagesThread={estimatesStagesThread}
                      />
                    ) : (
                      <EstimateListTable
                        rows={unsentVisibleRows}
                        setAcceptanceModalEstimateId={setAcceptanceModalEstimateId}
                        setCreateJobFromListRow={setCreateJobFromListRow}
                        showCustomerColumn
                        onCustomerSnapshotRequest={setCustomerSnapshotId}
                        stagesThread={estimatesStagesThread}
                      />
                    )}
                  </div>
                )}
              </section>
              <section>
                <h2 style={{ fontSize: '1.1rem', margin: '0 0 0.5rem', fontWeight: 600 }}>Sent</h2>
                {followupBuckets.sent.length === 0 ? (
                  <EmptyState compact {...estimateLaneEmptyWords('sent', { query: listSearch, clearSearch: clearListSearch, emptyDrafts: 0 })} />
                ) : (
                  <div style={estimateListTableScrollWrapStyle}>
                    {narrowViewport640 ? (
                      <EstimateListCards
                        rows={followupBuckets.sent}
                        setAcceptanceModalEstimateId={setAcceptanceModalEstimateId}
                        setCreateJobFromListRow={setCreateJobFromListRow}
                        showCustomerColumn
                        onCustomerSnapshotRequest={setCustomerSnapshotId}
                        stagesThread={estimatesStagesThread}
                        sentOpenStateById={sentOpenStateById}
                      />
                    ) : (
                      <EstimateListTable
                        rows={followupBuckets.sent}
                        setAcceptanceModalEstimateId={setAcceptanceModalEstimateId}
                        setCreateJobFromListRow={setCreateJobFromListRow}
                        showCustomerColumn
                        onCustomerSnapshotRequest={setCustomerSnapshotId}
                        stagesThread={estimatesStagesThread}
                        sentOpenStateById={sentOpenStateById}
                      />
                    )}
                  </div>
                )}
              </section>
              {followupBuckets.declined.length > 0 ? (
                <section>
                  <h2 style={{ fontSize: '1.1rem', margin: '0 0 0.5rem', fontWeight: 600 }}>Declined</h2>
                  <div style={estimateListTableScrollWrapStyle}>
                    {narrowViewport640 ? (
                      <EstimateListCards
                        rows={followupBuckets.declined}
                        setAcceptanceModalEstimateId={setAcceptanceModalEstimateId}
                        setCreateJobFromListRow={setCreateJobFromListRow}
                        showCustomerColumn
                        onCustomerSnapshotRequest={setCustomerSnapshotId}
                        stagesThread={estimatesStagesThread}
                        declinedLabelById={declinedLabelById}
                      />
                    ) : (
                      <EstimateListTable
                        rows={followupBuckets.declined}
                        setAcceptanceModalEstimateId={setAcceptanceModalEstimateId}
                        setCreateJobFromListRow={setCreateJobFromListRow}
                        showCustomerColumn
                        onCustomerSnapshotRequest={setCustomerSnapshotId}
                        stagesThread={estimatesStagesThread}
                        declinedLabelById={declinedLabelById}
                      />
                    )}
                  </div>
                </section>
              ) : null}
              <section>
                <h2 style={{ fontSize: '1.1rem', margin: '0 0 0.5rem', fontWeight: 600 }}>Accepted</h2>
                {followupBuckets.accepted.length === 0 ? (
                  <EmptyState compact {...estimateLaneEmptyWords('accepted', { query: listSearch, clearSearch: clearListSearch, emptyDrafts: 0 })} />
                ) : (
                  <div style={estimateListTableScrollWrapStyle}>
                    {narrowViewport640 ? (
                      <EstimateListCards
                        rows={followupBuckets.accepted}
                        setAcceptanceModalEstimateId={setAcceptanceModalEstimateId}
                        setCreateJobFromListRow={setCreateJobFromListRow}
                        showCustomerColumn
                        onCustomerSnapshotRequest={setCustomerSnapshotId}
                        stagesThread={estimatesStagesThread}
                      />
                    ) : (
                      <EstimateListTable
                        rows={followupBuckets.accepted}
                        setAcceptanceModalEstimateId={setAcceptanceModalEstimateId}
                        setCreateJobFromListRow={setCreateJobFromListRow}
                        showCustomerColumn
                        onCustomerSnapshotRequest={setCustomerSnapshotId}
                        stagesThread={estimatesStagesThread}
                      />
                    )}
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      )}
      <CustomerAcceptanceRecordModal
        open={acceptanceModalEstimateId != null}
        estimateId={acceptanceModalEstimateId}
        onClose={() => setAcceptanceModalEstimateId(null)}
      />
      <CustomerSnapshotModal
        open={customerSnapshotId != null}
        onClose={() => setCustomerSnapshotId(null)}
        customerId={customerSnapshotId}
        gcBuilder={null}
      />
      <CreateJobFromEstimateModal
        open={createJobFromListRow != null}
        estimate={createJobFromListRow}
        customerIdForPayload={createJobFromListRow?.customer_id ?? null}
        linkedCustomerPrefill={
          createJobFromListRow?.customers != null
            ? {
                name: createJobFromListRow.customers.name ?? '',
                address: createJobFromListRow.customers.address ?? '',
              }
            : null
        }
        onClose={() => setCreateJobFromListRow(null)}
        onSuccess={(jobId) => {
          void (async () => {
            await load()
            navigate(`/jobs?edit=${jobId}`)
          })()
        }}
      />
    </div>
  )
}
