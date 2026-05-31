import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from 'react'
import { supabase } from '../../lib/supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { useToastContext } from '../../contexts/ToastContext'
import { useUserMercuryWindow } from '../../hooks/useUserMercuryWindow'
import {
  buildUserDateFlatBreakdown,
  buildUserJobLabelBreakdown,
  buildUserLabelTopBreakdown,
  UNLABELED_GROUP_KEY,
  type UserReviewBreakdownTx,
  type UserReviewBreakdownTxWithJob,
  type UserReviewDateRow,
  type UserReviewJobRow,
  type UserReviewLabelGroup,
  type UserReviewLabelTopRow,
} from '../../lib/buildUserJobLabelBreakdown'
import {
  MercuryTransactionAllocationsModal,
  type MercuryJobSplit,
} from '../MercuryTransactionAllocationsModal'
import type { SearchableSelectOption } from '../SearchableSelect'
import type { Database } from '../../types/database'
import { APP_CALENDAR_TZ } from '../../utils/dateUtils'

type MercuryTxRow = Database['public']['Tables']['mercury_transactions']['Row']

export type UserMercuryWindowSectionProps = {
  userId: string
  displayName: string
  /** Inclusive YYYY-MM-DD start of the company-calendar window. */
  startYmd: string
  /** Inclusive YYYY-MM-DD end of the company-calendar window. */
  endYmd: string
}

type TxSortMode = 'job' | 'label' | 'date'
const TX_SORT_STORAGE_KEY = 'user_review_tx_sort_v1'

function readSortModeFromStorage(): TxSortMode {
  if (typeof window === 'undefined') return 'job'
  try {
    const v = window.localStorage.getItem(TX_SORT_STORAGE_KEY)
    if (v === 'label' || v === 'date') return v
    return 'job'
  } catch {
    return 'job'
  }
}

function writeSortModeToStorage(mode: TxSortMode): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(TX_SORT_STORAGE_KEY, mode)
  } catch {
    // ignore
  }
}

function formatUsd(amount: number): string {
  return amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function amountColor(amount: number): string {
  if (amount > 0) return '#047857'
  if (amount < 0) return '#b91c1c'
  return '#374151'
}

function formatBankingDate(iso: string | null): string {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return '—'
    return new Intl.DateTimeFormat('en-US', {
      timeZone: APP_CALENDAR_TZ,
      month: 'short',
      day: 'numeric',
    }).format(d)
  } catch {
    return '—'
  }
}

const sectionShell: CSSProperties = {
  marginTop: '1.25rem',
  borderTop: '2px solid #e5e7eb',
  paddingTop: '1rem',
}

const headerStrip: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '0.1rem',
  marginBottom: '0.75rem',
  textAlign: 'center',
}

const cardShell: CSSProperties = {
  border: '1px solid #e5e7eb',
  borderRadius: 8,
  overflow: 'hidden',
  background: '#fff',
}

const cardHeaderButton: CSSProperties = {
  all: 'unset',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '0.75rem',
  width: '100%',
  padding: '0.65rem 0.85rem',
  cursor: 'pointer',
  boxSizing: 'border-box',
  background: '#f9fafb',
}

const detailThStyle: CSSProperties = {
  padding: '0.4rem 0.55rem',
  textAlign: 'left',
  fontWeight: 600,
  fontSize: '0.7rem',
  color: '#374151',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  borderBottom: '1px solid #e5e7eb',
}

const detailTdStyle: CSSProperties = {
  padding: '0.4rem 0.55rem',
  verticalAlign: 'top',
}

const editLinkButtonStyle: CSSProperties = {
  all: 'unset',
  fontSize: '0.75rem',
  color: '#2563eb',
  cursor: 'pointer',
  padding: '0.15rem 0.4rem',
  borderRadius: 4,
  border: '1px solid #bfdbfe',
  background: '#eff6ff',
}

const sortToggleButtonStyle = (active: boolean): CSSProperties => ({
  padding: '0.2rem 0.55rem',
  fontSize: '0.75rem',
  border: '1px solid #d1d5db',
  background: active ? '#1d4ed8' : '#fff',
  color: active ? '#fff' : '#374151',
  cursor: 'pointer',
  fontWeight: active ? 600 : 500,
})

const SORT_MODE_BUTTONS: ReadonlyArray<{ mode: TxSortMode; label: string }> = [
  { mode: 'job', label: 'By Job' },
  { mode: 'label', label: 'By Label' },
  { mode: 'date', label: 'By Date' },
]

export function UserMercuryWindowSection({
  userId,
  displayName,
  startYmd,
  endYmd,
}: UserMercuryWindowSectionProps): JSX.Element | null {
  const { showToast } = useToastContext()

  const { rows, loading, error, reload } = useUserMercuryWindow({
    userId,
    startYmd,
    endYmd,
    includePersonAttributed: true,
  })

  // Fetch job display labels for the set of allocation job_ids in the window.
  const allocationJobIds = useMemo(() => {
    const set = new Set<string>()
    for (const r of rows) {
      if (r.job_id) set.add(r.job_id)
    }
    return [...set].sort()
  }, [rows])
  const allocationJobIdsKey = useMemo(() => allocationJobIds.join('|'), [allocationJobIds])

  const [jobLabelById, setJobLabelById] = useState<Record<string, string>>({})

  useEffect(() => {
    let cancelled = false
    if (allocationJobIds.length === 0) {
      setJobLabelById({})
      return
    }
    void (async () => {
      try {
        const data = await withSupabaseRetry(
          () =>
            supabase
              .from('jobs_ledger')
              .select('id, hcp_number, job_name')
              .in('id', allocationJobIds),
          'user review window job labels',
        )
        if (cancelled) return
        const next: Record<string, string> = {}
        for (const row of (data ?? []) as {
          id: string
          hcp_number?: string | null
          job_name?: string | null
        }[]) {
          const label = `${row.hcp_number ?? ''} · ${row.job_name ?? ''}`.trim()
          next[row.id] = label && label !== '·' ? label : row.id
        }
        setJobLabelById(next)
      } catch (e) {
        if (cancelled) return
        showToast(e instanceof Error ? e.message : 'Could not load job labels', 'warning')
        setJobLabelById({})
      }
    })()
    return () => {
      cancelled = true
    }
    // allocationJobIdsKey is the stable serialized dependency for allocationJobIds.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allocationJobIdsKey])

  // Memoize all three breakdowns from the same `rows` so mode switching is instant.
  // Totals are byte-identical across all three (shared `scanDistinctTxs`).
  const breakdown = useMemo(
    () => buildUserJobLabelBreakdown({ rows, jobLabelById }),
    [rows, jobLabelById],
  )
  const labelBreakdown = useMemo(
    () => buildUserLabelTopBreakdown({ rows, jobLabelById }),
    [rows, jobLabelById],
  )
  const dateBreakdown = useMemo(
    () => buildUserDateFlatBreakdown({ rows, jobLabelById }),
    [rows, jobLabelById],
  )

  // Sort mode (persisted across modal opens via localStorage).
  const [sortMode, setSortMode] = useState<TxSortMode>(readSortModeFromStorage)
  useEffect(() => {
    writeSortModeToStorage(sortMode)
  }, [sortMode])

  // Expanded state.
  const [unallocatedOpen, setUnallocatedOpen] = useState(false)
  const [expandedJobs, setExpandedJobs] = useState<Set<string>>(new Set())
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  // By-Label top cards. Per-mode keying isn't needed here since By-Job has its own state above
  // and By-Date renders no cards; collisions would be impossible.
  const [expandedLabels, setExpandedLabels] = useState<Set<string>>(new Set())

  // Auto-expand the unallocated card when content arrives so staff act on it.
  useEffect(() => {
    if (breakdown.unallocated.count > 0) setUnallocatedOpen(true)
    else setUnallocatedOpen(false)
  }, [breakdown.unallocated.count])

  const toggleJob = useCallback((jobId: string) => {
    setExpandedJobs((prev) => {
      const next = new Set(prev)
      if (next.has(jobId)) next.delete(jobId)
      else next.add(jobId)
      return next
    })
  }, [])

  const toggleGroup = useCallback((key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  const toggleLabel = useCallback((key: string) => {
    setExpandedLabels((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  // Lazy-load users options for the allocations modal on first Edit click.
  const [usersOptions, setUsersOptions] = useState<SearchableSelectOption[] | null>(null)
  const ensureUsersOptions = useCallback(async () => {
    if (usersOptions != null) return usersOptions
    try {
      const data = await withSupabaseRetry(
        () => supabase.rpc('list_users_for_banking_attribution'),
        'user review list_users_for_banking_attribution',
      )
      const list = ((data ?? []) as { id: string; name: string }[]).map((p) => ({
        value: p.id,
        label: p.name,
      }))
      setUsersOptions(list)
      return list
    } catch (e) {
      showToast(
        e instanceof Error ? e.message : 'Could not load users for attribution editing',
        'error',
      )
      setUsersOptions([])
      return []
    }
  }, [usersOptions, showToast])

  // Alloc modal state.
  const [allocModal, setAllocModal] = useState<{
    tx: MercuryTxRow
    initialAllocations: MercuryJobSplit[]
    initialUserId: string | null
    initialPersonId: string | null
    jobLabelById: Record<string, string>
  } | null>(null)
  const [editLoadingTxId, setEditLoadingTxId] = useState<string | null>(null)

  const openEditForTx = useCallback(
    async (txId: string) => {
      setEditLoadingTxId(txId)
      try {
        const [txData, allocData, attrData] = await Promise.all([
          withSupabaseRetry(
            () =>
              supabase
                .from('mercury_transactions')
                .select('*')
                .eq('id', txId)
                .maybeSingle(),
            'user review fetch mercury_transactions row',
          ),
          withSupabaseRetry(
            () =>
              supabase
                .from('mercury_transaction_job_allocations')
                .select('job_id, amount')
                .eq('mercury_transaction_id', txId),
            'user review fetch mercury_transaction_job_allocations',
          ),
          withSupabaseRetry(
            () =>
              supabase
                .from('mercury_transaction_attributions')
                .select('user_id, person_id')
                .eq('mercury_transaction_id', txId)
                .maybeSingle(),
            'user review fetch mercury_transaction_attributions',
          ),
        ])
        const tx = txData as MercuryTxRow | null
        if (!tx) {
          showToast('Transaction no longer exists.', 'error')
          return
        }
        const initialAllocations: MercuryJobSplit[] = (
          (allocData ?? []) as { job_id: string; amount: number | string }[]
        ).map((r) => ({ job_id: r.job_id, amount: Number(r.amount) }))
        const attribution = attrData as { user_id: string | null; person_id: string | null } | null
        // Ensure all job IDs (incl. ones we already had labels for) are in the modal's jobLabelById.
        const modalJobIds = new Set<string>(initialAllocations.map((a) => a.job_id))
        for (const id of Object.keys(jobLabelById)) modalJobIds.add(id)
        const missingIds = [...modalJobIds].filter((id) => !jobLabelById[id])
        const labels: Record<string, string> = { ...jobLabelById }
        if (missingIds.length > 0) {
          try {
            const more = await withSupabaseRetry(
              () =>
                supabase
                  .from('jobs_ledger')
                  .select('id, hcp_number, job_name')
                  .in('id', missingIds),
              'user review extra job labels',
            )
            for (const row of (more ?? []) as {
              id: string
              hcp_number?: string | null
              job_name?: string | null
            }[]) {
              const label = `${row.hcp_number ?? ''} · ${row.job_name ?? ''}`.trim()
              labels[row.id] = label && label !== '·' ? label : row.id
            }
          } catch {
            // Non-fatal — modal will fall back to job ids.
          }
        }
        await ensureUsersOptions()
        setAllocModal({
          tx,
          initialAllocations,
          initialUserId: attribution?.user_id ?? null,
          initialPersonId: attribution?.person_id ?? null,
          jobLabelById: labels,
        })
      } catch (e) {
        showToast(e instanceof Error ? e.message : 'Could not load transaction details', 'error')
      } finally {
        setEditLoadingTxId(null)
      }
    },
    [jobLabelById, ensureUsersOptions, showToast],
  )

  // Auto-refresh after a save.
  const onAllocSaved = useCallback(() => {
    setAllocModal(null)
    void reload()
  }, [reload])

  return (
    <div style={sectionShell} aria-label={`Transactions for ${displayName}`}>
      <div style={headerStrip}>
        <TotalsBlock
          grand={breakdown.grandTotal}
          byUser={breakdown.totals.byUser}
          byPerson={breakdown.totals.byPerson}
          displayName={displayName}
        />
        <TxSortToggle value={sortMode} onChange={setSortMode} />
      </div>

      {error ? (
        <div
          style={{
            margin: '0.5rem 0',
            padding: '0.65rem 0.85rem',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: 6,
            color: '#991b1b',
            fontSize: '0.8125rem',
          }}
        >
          {error}
        </div>
      ) : null}

      {loading ? (
        <div
          style={{
            margin: '0.5rem 0',
            padding: '0.5rem 0.75rem',
            background: '#f3f4f6',
            border: '1px solid #e5e7eb',
            borderRadius: 4,
            color: '#374151',
            fontSize: '0.8125rem',
          }}
        >
          Loading transactions…
        </div>
      ) : null}

      {!loading && !error && breakdown.grandTotal.count === 0 ? (
        <div
          style={{
            padding: '1.25rem',
            border: '1px dashed #d1d5db',
            borderRadius: 6,
            textAlign: 'center',
            color: '#6b7280',
            fontSize: '0.875rem',
          }}
        >
          No Mercury transactions attributed to {displayName} in this window.
        </div>
      ) : null}

      {sortMode === 'job' && breakdown.unallocated.count > 0 ? (
        <div style={{ ...cardShell, marginBottom: '0.65rem' }}>
          <button
            type="button"
            onClick={() => setUnallocatedOpen((v) => !v)}
            aria-expanded={unallocatedOpen}
            style={{ ...cardHeaderButton, background: '#fef2f2' }}
          >
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                color: '#991b1b',
                fontWeight: 600,
                fontSize: '0.875rem',
                minWidth: 0,
              }}
            >
              <span aria-hidden style={{ fontSize: '0.75rem', width: '0.75rem', textAlign: 'center' }}>
                {unallocatedOpen ? '▾' : '▸'}
              </span>
              <span>Unallocated</span>
              <span
                style={{
                  display: 'inline-block',
                  padding: '0.1rem 0.5rem',
                  borderRadius: 999,
                  background: '#dc2626',
                  color: '#fff',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                }}
              >
                {breakdown.unallocated.count.toLocaleString()}
              </span>
            </span>
            <span
              style={{
                fontVariantNumeric: 'tabular-nums',
                color: amountColor(breakdown.unallocated.totalAmount),
                fontWeight: 600,
                fontSize: '0.875rem',
                whiteSpace: 'nowrap',
              }}
            >
              {formatUsd(breakdown.unallocated.totalAmount)}
            </span>
          </button>
          {unallocatedOpen ? (
            <TransactionsTable
              rows={breakdown.unallocated.rows}
              showLabelColumn={true}
              onEdit={(txId) => void openEditForTx(txId)}
              editLoadingTxId={editLoadingTxId}
              amountField="amount"
            />
          ) : null}
        </div>
      ) : null}

      {sortMode === 'job' && breakdown.perJob.length > 0 ? (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '0.55rem' }}>
          {breakdown.perJob.map((job) => (
            <JobCard
              key={job.jobId}
              job={job}
              expanded={expandedJobs.has(job.jobId)}
              onToggle={() => toggleJob(job.jobId)}
              expandedGroups={expandedGroups}
              onToggleGroup={toggleGroup}
              onEdit={(txId) => void openEditForTx(txId)}
              editLoadingTxId={editLoadingTxId}
            />
          ))}
        </ul>
      ) : null}

      {sortMode === 'label' && labelBreakdown.perLabel.length > 0 ? (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '0.55rem' }}>
          {labelBreakdown.perLabel.map((bucket) => {
            const key = bucket.labelId ?? UNLABELED_GROUP_KEY
            return (
              <LabelCard
                key={key}
                bucket={bucket}
                expanded={expandedLabels.has(key)}
                onToggle={() => toggleLabel(key)}
                onEdit={(txId) => void openEditForTx(txId)}
                editLoadingTxId={editLoadingTxId}
              />
            )
          })}
        </ul>
      ) : null}

      {sortMode === 'date' && dateBreakdown.rows.length > 0 ? (
        <div style={cardShell}>
          <TransactionsTable<UserReviewDateRow>
            rows={dateBreakdown.rows}
            showLabelColumn
            showJobColumn
            jobLabelOf={(r) => r.jobLabel}
            hasMultipleAllocationsOf={(r) => r.hasMultipleAllocations}
            onEdit={(txId) => void openEditForTx(txId)}
            editLoadingTxId={editLoadingTxId}
            amountField="amount"
          />
        </div>
      ) : null}

      {allocModal ? (
        <MercuryTransactionAllocationsModal
          open={true}
          onClose={() => setAllocModal(null)}
          transaction={allocModal.tx}
          initialAllocations={allocModal.initialAllocations}
          initialPersonId={allocModal.initialPersonId}
          initialUserId={allocModal.initialUserId}
          jobLabelById={allocModal.jobLabelById}
          usersOptions={usersOptions ?? []}
          recentPersonPicksStorageKey={null}
          onSaved={onAllocSaved}
        />
      ) : null}
    </div>
  )
}

function TotalsBlock({
  grand,
  byUser,
  byPerson,
  displayName,
}: {
  grand: { totalAmount: number; count: number }
  byUser: { totalAmount: number; count: number }
  byPerson: { totalAmount: number; count: number }
  displayName: string
}) {
  return (
    <div style={{ textAlign: 'center', fontSize: '0.8125rem' }}>
      <div style={{ fontSize: '0.95rem' }}>
        <span style={{ fontWeight: 600, color: '#111827' }}>Transactions:</span>{' '}
        <span
          style={{
            fontWeight: 600,
            color: amountColor(grand.totalAmount),
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {formatUsd(grand.totalAmount)}
        </span>{' '}
        <span style={{ color: '#6b7280' }}>· {grand.count.toLocaleString()} tx</span>
      </div>
      {/* Only show per-source breakdowns when both sources contribute — otherwise the
          grand total above already conveys the same number. */}
      {byUser.count > 0 && byPerson.count > 0 ? (
        <div style={{ color: '#374151', marginTop: '0.1rem' }}>
          Attributed to {displayName}:{' '}
          <span style={{ color: amountColor(byUser.totalAmount), fontVariantNumeric: 'tabular-nums' }}>
            {formatUsd(byUser.totalAmount)}
          </span>{' '}
          <span style={{ color: '#9ca3af' }}>({byUser.count.toLocaleString()} tx)</span>
        </div>
      ) : null}
      {byUser.count > 0 && byPerson.count > 0 ? (
        <div style={{ color: '#374151', marginTop: '0.1rem' }}>
          Via person record:{' '}
          <span style={{ color: amountColor(byPerson.totalAmount), fontVariantNumeric: 'tabular-nums' }}>
            {formatUsd(byPerson.totalAmount)}
          </span>{' '}
          <span style={{ color: '#9ca3af' }}>({byPerson.count.toLocaleString()} tx)</span>
        </div>
      ) : null}
    </div>
  )
}

function TxSortToggle({
  value,
  onChange,
}: {
  value: TxSortMode
  onChange: (mode: TxSortMode) => void
}) {
  return (
    <div
      role="group"
      aria-label="Transaction sort"
      style={{
        display: 'inline-flex',
        borderRadius: 4,
        overflow: 'hidden',
        marginTop: '0.35rem',
      }}
    >
      {SORT_MODE_BUTTONS.map((btn, i) => {
        const isFirst = i === 0
        const isLast = i === SORT_MODE_BUTTONS.length - 1
        const active = value === btn.mode
        return (
          <button
            key={btn.mode}
            type="button"
            onClick={() => onChange(btn.mode)}
            aria-pressed={active}
            style={{
              ...sortToggleButtonStyle(active),
              borderTopLeftRadius: isFirst ? 4 : 0,
              borderBottomLeftRadius: isFirst ? 4 : 0,
              borderTopRightRadius: isLast ? 4 : 0,
              borderBottomRightRadius: isLast ? 4 : 0,
              borderRight: isLast ? '1px solid #d1d5db' : 'none',
            }}
          >
            {btn.label}
          </button>
        )
      })}
    </div>
  )
}

function JobCard({
  job,
  expanded,
  onToggle,
  expandedGroups,
  onToggleGroup,
  onEdit,
  editLoadingTxId,
}: {
  job: UserReviewJobRow
  expanded: boolean
  onToggle: () => void
  expandedGroups: Set<string>
  onToggleGroup: (key: string) => void
  onEdit: (txId: string) => void
  editLoadingTxId: string | null
}) {
  return (
    <li style={cardShell}>
      <button type="button" onClick={onToggle} aria-expanded={expanded} style={cardHeaderButton}>
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            color: '#111827',
            fontWeight: 600,
            fontSize: '0.875rem',
            minWidth: 0,
            overflow: 'hidden',
          }}
        >
          <span aria-hidden style={{ fontSize: '0.75rem', width: '0.75rem', textAlign: 'center' }}>
            {expanded ? '▾' : '▸'}
          </span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {job.jobLabel}
          </span>
          <span style={{ color: '#9ca3af', fontSize: '0.75rem', fontWeight: 500 }}>
            {job.count.toLocaleString()} tx
          </span>
        </span>
        <span
          style={{
            fontVariantNumeric: 'tabular-nums',
            color: amountColor(job.totalAmount),
            fontWeight: 600,
            fontSize: '0.875rem',
            whiteSpace: 'nowrap',
          }}
        >
          {formatUsd(job.totalAmount)}
        </span>
      </button>
      {expanded ? (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {job.labelGroups.map((group) => {
            const key = `${job.jobId}::${group.labelId ?? UNLABELED_GROUP_KEY}`
            const isOpen = expandedGroups.has(key)
            return (
              <li key={key} style={{ borderTop: '1px solid #f3f4f6' }}>
                <button
                  type="button"
                  onClick={() => onToggleGroup(key)}
                  aria-expanded={isOpen}
                  style={{
                    ...cardHeaderButton,
                    background: '#ffffff',
                    paddingLeft: '1.5rem',
                  }}
                >
                  <span
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      color: group.labelId == null ? '#9ca3af' : '#111827',
                      fontStyle: group.labelId == null ? 'italic' : 'normal',
                      fontSize: '0.8125rem',
                      fontWeight: 500,
                      minWidth: 0,
                      overflow: 'hidden',
                    }}
                  >
                    <span aria-hidden style={{ fontSize: '0.75rem', width: '0.75rem', textAlign: 'center' }}>
                      {isOpen ? '▾' : '▸'}
                    </span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {group.labelName}
                    </span>
                    <span style={{ color: '#9ca3af', fontSize: '0.75rem', fontStyle: 'normal', fontWeight: 500 }}>
                      {group.count.toLocaleString()} tx
                    </span>
                  </span>
                  <span
                    style={{
                      fontVariantNumeric: 'tabular-nums',
                      color: amountColor(group.totalAmount),
                      fontWeight: 500,
                      fontSize: '0.8125rem',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {formatUsd(group.totalAmount)}
                  </span>
                </button>
                {isOpen ? (
                  <LabelGroupRows
                    group={group}
                    onEdit={onEdit}
                    editLoadingTxId={editLoadingTxId}
                  />
                ) : null}
              </li>
            )
          })}
        </ul>
      ) : null}
    </li>
  )
}

function LabelGroupRows({
  group,
  onEdit,
  editLoadingTxId,
}: {
  group: UserReviewLabelGroup
  onEdit: (txId: string) => void
  editLoadingTxId: string | null
}) {
  return (
    <div style={{ padding: '0 0.85rem 0.85rem 2rem' }}>
      <TransactionsTable
        rows={group.rows}
        showLabelColumn={false}
        onEdit={onEdit}
        editLoadingTxId={editLoadingTxId}
        amountField="allocation"
      />
    </div>
  )
}

function LabelCard({
  bucket,
  expanded,
  onToggle,
  onEdit,
  editLoadingTxId,
}: {
  bucket: UserReviewLabelTopRow
  expanded: boolean
  onToggle: () => void
  onEdit: (txId: string) => void
  editLoadingTxId: string | null
}) {
  const isUnlabeled = bucket.labelId == null
  return (
    <li style={cardShell}>
      <button type="button" onClick={onToggle} aria-expanded={expanded} style={cardHeaderButton}>
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            color: isUnlabeled ? '#9ca3af' : '#111827',
            fontStyle: isUnlabeled ? 'italic' : 'normal',
            fontWeight: 600,
            fontSize: '0.875rem',
            minWidth: 0,
            overflow: 'hidden',
          }}
        >
          <span aria-hidden style={{ fontSize: '0.75rem', width: '0.75rem', textAlign: 'center' }}>
            {expanded ? '▾' : '▸'}
          </span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {bucket.labelName}
          </span>
          <span style={{ color: '#9ca3af', fontSize: '0.75rem', fontStyle: 'normal', fontWeight: 500 }}>
            {bucket.count.toLocaleString()} tx
          </span>
        </span>
        <span
          style={{
            fontVariantNumeric: 'tabular-nums',
            color: amountColor(bucket.totalAmount),
            fontWeight: 600,
            fontSize: '0.875rem',
            whiteSpace: 'nowrap',
          }}
        >
          {formatUsd(bucket.totalAmount)}
        </span>
      </button>
      {expanded ? (
        <div style={{ padding: '0 0.85rem 0.85rem 1.5rem' }}>
          <TransactionsTable<UserReviewBreakdownTxWithJob>
            rows={bucket.rows}
            showLabelColumn={false}
            showJobColumn
            jobLabelOf={(r) => r.jobLabel}
            onEdit={onEdit}
            editLoadingTxId={editLoadingTxId}
            amountField="allocation"
          />
        </div>
      ) : null}
    </li>
  )
}

function TransactionsTable<R extends UserReviewBreakdownTx>({
  rows,
  showLabelColumn,
  showJobColumn = false,
  jobLabelOf,
  hasMultipleAllocationsOf,
  onEdit,
  editLoadingTxId,
  amountField,
}: {
  rows: ReadonlyArray<R>
  showLabelColumn: boolean
  /** When true, render a Job column between Counterparty and Label/Amount. */
  showJobColumn?: boolean
  /** Resolver for the Job column cell; required when showJobColumn is true. */
  jobLabelOf?: (row: R) => string | null
  /** When provided, returns true for txs with 2+ allocations so we can render a small marker. */
  hasMultipleAllocationsOf?: (row: R) => boolean
  onEdit: (txId: string) => void
  editLoadingTxId: string | null
  /** 'allocation' shows allocationAmount when present, 'amount' always shows the full tx amount. */
  amountField: 'amount' | 'allocation'
}) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
        <thead>
          <tr style={{ background: '#f9fafb' }}>
            <th style={{ ...detailThStyle, textAlign: 'right' }}>Amount</th>
            <th style={detailThStyle}>Posted</th>
            <th style={detailThStyle}>Counterparty</th>
            {showJobColumn ? <th style={detailThStyle}>Job</th> : null}
            {showLabelColumn ? <th style={detailThStyle}>Label</th> : null}
            <th style={{ ...detailThStyle, textAlign: 'right' }}>{/* Edit */}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const displayAmount =
              amountField === 'allocation' && r.allocationAmount != null
                ? r.allocationAmount
                : r.amount
            const isEditing = editLoadingTxId === r.mercuryTransactionId
            const jobLabel = showJobColumn && jobLabelOf ? jobLabelOf(r) : null
            const isSplit = hasMultipleAllocationsOf ? hasMultipleAllocationsOf(r) : false
            return (
              <tr key={r.rowKey} style={{ borderTop: '1px solid #f3f4f6' }}>
                <td
                  style={{
                    ...detailTdStyle,
                    textAlign: 'right',
                    fontVariantNumeric: 'tabular-nums',
                    color: amountColor(displayAmount),
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {formatUsd(displayAmount)}
                  {amountField === 'allocation' && r.allocationAmount != null && r.allocationAmount !== r.amount ? (
                    <span style={{ display: 'block', fontSize: '0.6875rem', color: '#9ca3af', fontWeight: 400 }}>
                      of {formatUsd(r.amount)}
                    </span>
                  ) : null}
                </td>
                <td style={detailTdStyle}>{formatBankingDate(r.postedAt ?? r.createdAt)}</td>
                <td style={detailTdStyle}>
                  {r.counterpartyName?.trim() || <span style={{ color: '#9ca3af' }}>—</span>}
                </td>
                {showJobColumn ? (
                  <td style={detailTdStyle}>
                    {jobLabel ? (
                      <span style={{ color: '#111827' }}>{jobLabel}</span>
                    ) : (
                      <span style={{ color: '#9ca3af' }}>—</span>
                    )}
                    {isSplit ? (
                      <span
                        style={{
                          display: 'inline-block',
                          marginLeft: '0.4rem',
                          padding: '0.05rem 0.35rem',
                          borderRadius: 999,
                          background: '#f3f4f6',
                          color: '#6b7280',
                          fontSize: '0.6875rem',
                          fontWeight: 500,
                          verticalAlign: 'middle',
                        }}
                        title="This transaction is split across multiple allocations"
                      >
                        split
                      </span>
                    ) : null}
                  </td>
                ) : null}
                {showLabelColumn ? (
                  <td style={detailTdStyle}>
                    <span style={{ color: r.labelId == null ? '#9ca3af' : '#111827', fontStyle: r.labelId == null ? 'italic' : 'normal' }}>
                      {r.labelName}
                    </span>
                  </td>
                ) : null}
                <td style={{ ...detailTdStyle, textAlign: 'right' }}>
                  <button
                    type="button"
                    onClick={() => onEdit(r.mercuryTransactionId)}
                    disabled={isEditing}
                    style={{
                      ...editLinkButtonStyle,
                      opacity: isEditing ? 0.5 : 1,
                      cursor: isEditing ? 'progress' : 'pointer',
                    }}
                    aria-label={`Edit allocations for transaction ${r.mercuryTransactionId}`}
                  >
                    {isEditing ? 'Loading…' : 'Edit…'}
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
