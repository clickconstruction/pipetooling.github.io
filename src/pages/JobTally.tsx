import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { withSupabaseRetry } from '../utils/errorHandling'
import type { Database } from '../types/database'
import type { UserRole } from '../hooks/useAuth'
import { isSubcontractorLikeRole } from '../lib/subcontractorLikeRole'
import { MercuryTransactionNoteIcon } from '../components/icons/MercuryTransactionNoteIcon'
import { MercuryTransactionAllocationsModal } from '../components/MercuryTransactionAllocationsModal'
import { TallyJobTransactionsModal } from '../components/tally/TallyJobTransactionsModal'
import { TallyClockWindowAllocateModal } from '../components/tally/TallyClockWindowAllocateModal'
import { APP_CALENDAR_TZ } from '../utils/dateUtils'
import { APP_SETTINGS_KEY_JOB_TALLY_MIN_POSTED_YMD, normalizeJobTallyMinPostedYmd } from '../lib/appSettingsKeys'
import { mercuryRowPassesSortingStartDate } from '../lib/bankingSortingConfig'
import { parseTallyJobSplitsJson } from '../lib/tallyJobSplits'
import { filterTallyLinkedMercuryRowsBySearchQuery } from '../lib/tallyTransactionSearch'
import {
  type TallyLinkedMercuryRow,
  mercuryTxRowFromTallyRpc,
  tallyRowIsResolved,
  tallyUniqueJobSplitEntries,
} from '../lib/mercuryTxRowFromTally'
import { mercuryBankDescriptionFromRaw } from '../lib/mercuryBankDescriptionFromRaw'
import { useToastContext } from '../contexts/ToastContext'
import { formatErrorMessage } from '../utils/errorHandling'
import { buildTallyPayrollRuleFlagsToInsert, type TallyPayrollRuleForMatch } from '../lib/tallyPayrollRules'
import { buildPayrollRuleSeedFromTransaction, type TallyPayrollRuleFormSeed } from '../lib/tallyPayrollRuleSeed'
import { TallyPayrollRulesModal } from '../components/tally/TallyPayrollRulesModal'
import { TallyMarkPayrollConfirmModal } from '../components/tally/TallyMarkPayrollConfirmModal'

type TallyLinkedDebitCardRow = Database['public']['Functions']['list_my_linked_mercury_debit_cards_for_tally']['Returns'][number]
type TallyTxSortKey = 'posted_at' | 'amount' | 'counterparty_name'

type JobForTally = { id: string; hcp_number: string; job_name: string; job_address: string }
type ServiceType = { id: string; name: string }
type MaterialPart = Database['public']['Tables']['material_parts']['Row']
type TallyEntry = {
  id: string
  fixtureName: string
  partId: string
  partName: string
  manufacturer: string | null
  quantity: number
  isFixtureSent?: boolean
}

const TOUCH_MIN = 48

type JobTallyTab = 'materials-estimate' | 'transactions'
type TallyTxScope = 'all' | 'unlinked'

function formatTallyCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

function formatTallyPostedParts(iso: string | null): { date: string; weekday: string } | null {
  if (!iso) return null
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return null
    return {
      date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: APP_CALENDAR_TZ }),
      weekday: d.toLocaleDateString('en-US', { weekday: 'long', timeZone: APP_CALENDAR_TZ }),
    }
  } catch {
    return null
  }
}

function TallyPostedDateOpenButton({
  posted,
  onOpen,
}: {
  posted: { date: string; weekday: string }
  onOpen: () => void
}) {
  const [hover, setHover] = useState(false)
  const [focus, setFocus] = useState(false)
  const active = hover || focus
  return (
    <button
      type="button"
      onClick={onOpen}
      title="Split this transaction across jobs from your clock: posted day, previous day, and next day (Chicago calendar)."
      aria-label={`Open clock jobs for ${posted.date} ${posted.weekday}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setFocus(true)}
      onBlur={() => setFocus(false)}
      style={{
        display: 'block',
        margin: 0,
        padding: '0.35rem 0.4rem',
        minHeight: TOUCH_MIN,
        width: '100%',
        textAlign: 'left',
        font: 'inherit',
        cursor: 'pointer',
        borderRadius: 6,
        border: focus ? '1px solid #1d4ed8' : hover ? '1px solid #93c5fd' : '1px solid #e5e7eb',
        background: active ? '#eff6ff' : '#f8fafc',
        boxShadow: focus ? '0 0 0 2px rgba(29, 78, 216, 0.2)' : 'none',
      }}
    >
      <div
        style={{
          color: '#1d4ed8',
          fontWeight: 600,
          textDecoration: 'underline',
          textUnderlineOffset: 3,
        }}
      >
        {posted.date}
      </div>
      <div style={{ color: '#64748b', fontSize: '0.75rem', marginTop: 2 }}>{posted.weekday}</div>
    </button>
  )
}

function formatLinkedCardDisplayLabel(card: TallyLinkedDebitCardRow): string {
  const n = typeof card.nickname === 'string' ? card.nickname.trim() : ''
  if (n !== '') return n
  const id = card.mercury_debit_card_id
  return `Card ${id.slice(0, 8)}…`
}

function tallyCardFilterChipButtonStyle(active: boolean): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.2rem',
    padding: '0.15rem 0.45rem',
    margin: 0,
    font: 'inherit',
    fontSize: '0.8125rem',
    borderRadius: 4,
    cursor: 'pointer',
    textDecoration: 'none',
    color: '#1d4ed8',
    ...(active
      ? { border: '1px solid #2563eb', background: '#eff6ff', fontWeight: 600 }
      : { border: '1px solid #e5e7eb', background: '#fff', fontWeight: 400 }),
  }
}

function tallyJobsSubRowBannerStyle(allocated: boolean): CSSProperties {
  return {
    width: '100%',
    boxSizing: 'border-box',
    padding: '0.4rem 0.65rem',
    borderRadius: 6,
    border: allocated ? '1px solid #a7f3d0' : '1px solid #fcd34d',
    background: allocated ? '#ecfdf5' : '#fffbeb',
    borderLeft: allocated ? '3px solid #059669' : '3px solid #d97706',
  }
}

function sortTallyRowsStable(
  list: TallyLinkedMercuryRow[],
  sort: { key: TallyTxSortKey; dir: 'asc' | 'desc' },
): TallyLinkedMercuryRow[] {
  const mult = sort.dir === 'asc' ? 1 : -1
  const key = sort.key
  return [...list].sort((a, b) => {
    let cmp = 0
    if (key === 'posted_at') {
      const ta = a.posted_at ? new Date(a.posted_at).getTime() : 0
      const tb = b.posted_at ? new Date(b.posted_at).getTime() : 0
      cmp = ta === tb ? 0 : ta < tb ? -1 : 1
    } else if (key === 'amount') {
      const na = Number(a.amount)
      const nb = Number(b.amount)
      cmp = na === nb ? 0 : na < nb ? -1 : 1
    } else if (key === 'counterparty_name') {
      const sa =
        `${a.counterparty_name ?? ''} ${a.note ?? ''} ${a.tally_user_note ?? ''}`.toLowerCase().trim()
      const sb =
        `${b.counterparty_name ?? ''} ${b.note ?? ''} ${b.tally_user_note ?? ''}`.toLowerCase().trim()
      cmp = sa === sb ? 0 : sa < sb ? -1 : 1
    }
    if (cmp !== 0) return cmp * mult
    return a.mercury_transaction_id.localeCompare(b.mercury_transaction_id)
  })
}

function TallySortTh({
  label,
  column,
  sort,
  onSort,
}: {
  label: string
  column: TallyTxSortKey
  sort: { key: TallyTxSortKey; dir: 'asc' | 'desc' }
  onSort: (key: TallyTxSortKey) => void
}) {
  const active = sort.key === column
  const arrow = active ? (sort.dir === 'asc' ? ' ↑' : ' ↓') : ''
  return (
    <th
      role="columnheader"
      aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
      onClick={() => onSort(column)}
      style={{
        padding: '0.5rem 0.6rem',
        borderBottom: '1px solid #e5e7eb',
        cursor: 'pointer',
        userSelect: 'none',
        whiteSpace: 'nowrap',
        textAlign: 'left',
        fontSize: '0.75rem',
        color: '#374151',
      }}
    >
      {label}
      {arrow}
    </th>
  )
}

const tabStyle = (active: boolean) => ({
  padding: '0.75rem 1rem',
  minHeight: TOUCH_MIN,
  border: 'none' as const,
  background: 'none' as const,
  borderBottom: active ? '2px solid #3b82f6' : '2px solid transparent',
  color: active ? '#3b82f6' : '#6b7280',
  fontWeight: active ? 600 : 400,
  cursor: 'pointer' as const,
  fontSize: '0.875rem',
})

export default function JobTally() {
  const { user: authUser } = useAuth()
  const { showToast } = useToastContext()
  const [searchParams, setSearchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState<JobTallyTab>('transactions')
  const [role, setRole] = useState<string | null>(null)
  const isDevTally = role === 'dev'
  // Dev-only "mark as payroll": tx ids currently flagged payroll (merged onto rows for resolved-ness).
  const [payrollFlaggedIds, setPayrollFlaggedIds] = useState<Set<string>>(new Set())
  // Tx ids with any flag row (marked or tombstoned) — rules never re-touch these.
  const [payrollDecidedIds, setPayrollDecidedIds] = useState<Set<string>>(new Set())
  const [payrollRulesModalOpen, setPayrollRulesModalOpen] = useState(false)
  // "Mark payroll" y/n confirm: the row awaiting confirmation, and the seed for "Create rule…".
  const [pendingPayrollTx, setPendingPayrollTx] = useState<TallyLinkedMercuryRow | null>(null)
  const [payrollMarkBusy, setPayrollMarkBusy] = useState(false)
  const [payrollRulesSeed, setPayrollRulesSeed] = useState<TallyPayrollRuleFormSeed | null>(null)
  const [payrollAutoApply, setPayrollAutoApply] = useState(() => {
    try {
      return localStorage.getItem('jobs-tally-payroll-autoapply') === 'true'
    } catch {
      return false
    }
  })
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([])
  const [selectedServiceTypeId, setSelectedServiceTypeId] = useState<string | null>(null)
  const [jobs, setJobs] = useState<JobForTally[]>([])
  const [jobsLoading, setJobsLoading] = useState(true)
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [fixtureName, setFixtureName] = useState('')
  const [partSearch, setPartSearch] = useState('')
  const [partResults, setPartResults] = useState<MaterialPart[]>([])
  const [partSearching, setPartSearching] = useState(false)
  const [selectedPart, setSelectedPart] = useState<MaterialPart | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [entries, setEntries] = useState<TallyEntry[]>([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [lastSaveHadPartEntries, setLastSaveHadPartEntries] = useState(false)
  const [poCreateError, setPoCreateError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [jobPickerOpen, setJobPickerOpen] = useState(false)
  const [showMyJobsOnly, setShowMyJobsOnly] = useState(false)
  const [myJobIds, setMyJobIds] = useState<Set<string> | null>(null)
  const [tallyTxRows, setTallyTxRows] = useState<TallyLinkedMercuryRow[]>([])
  const [linkedDebitCards, setLinkedDebitCards] = useState<TallyLinkedDebitCardRow[]>([])
  const [tallyTxLoading, setTallyTxLoading] = useState(false)
  const [tallyTxError, setTallyTxError] = useState<string | null>(null)
  const [tallyTxSort, setTallyTxSort] = useState<{ key: TallyTxSortKey; dir: 'asc' | 'desc' }>({
    key: 'posted_at',
    dir: 'desc',
  })
  const [tallyAllocModalRow, setTallyAllocModalRow] = useState<TallyLinkedMercuryRow | null>(null)
  const [tallyClockAllocateRow, setTallyClockAllocateRow] = useState<TallyLinkedMercuryRow | null>(null)
  const [tallyJobDrilldown, setTallyJobDrilldown] = useState<{ jobId: string; label: string } | null>(null)
  const [tallyDebitCardFilterId, setTallyDebitCardFilterId] = useState<string | null>(null)
  const [tallyTxScope, setTallyTxScope] = useState<TallyTxScope>('unlinked')
  const [tallyTxSearchQuery, setTallyTxSearchQuery] = useState('')
  const [tallyOpenNoteTxId, setTallyOpenNoteTxId] = useState<string | null>(null)
  const [tallyOpenUserNoteTxId, setTallyOpenUserNoteTxId] = useState<string | null>(null)
  const [tallyUserNoteDraft, setTallyUserNoteDraft] = useState('')
  const [tallyUserNoteSaving, setTallyUserNoteSaving] = useState(false)
  const [tallyUserNoteError, setTallyUserNoteError] = useState<string | null>(null)
  const [tallyGlobalMinPostedYmd, setTallyGlobalMinPostedYmd] = useState<string | null>(null)

  const loadTallyTransactions = useCallback(async () => {
    if (!authUser?.id) return
    setTallyTxLoading(true)
    setTallyTxError(null)
    try {
      const [txData, cardData] = await Promise.all([
        withSupabaseRetry(
          () => supabase.rpc('list_my_linked_mercury_transactions_for_tally'),
          'list tally linked mercury transactions',
        ),
        withSupabaseRetry(
          () => supabase.rpc('list_my_linked_mercury_debit_cards_for_tally'),
          'list tally linked debit cards',
        ),
      ])
      const rows = (txData ?? []) as TallyLinkedMercuryRow[]
      // Dev-only payroll flags: merge is_payroll onto each row + track decided ids.
      if (role === 'dev' && rows.length > 0) {
        try {
          // Fetch the WHOLE flags table (it only holds payroll-decided txs, so it's
          // inherently small). Filtering with .in(<thousands of row ids>) exceeded the
          // request-URL limit, failed, and was swallowed below — marked rows then
          // reappeared under "Show unlinked" because is_payroll never merged.
          const flags = await withSupabaseRetry(
            () =>
              supabase
                .from('mercury_tally_payroll_flags')
                .select('mercury_transaction_id, is_payroll'),
            'load tally payroll flags',
          )
          const flagRows = (flags ?? []) as Array<{ mercury_transaction_id: string; is_payroll: boolean }>
          const flagged = new Set(flagRows.filter((f) => f.is_payroll).map((f) => f.mercury_transaction_id))
          const decided = new Set(flagRows.map((f) => f.mercury_transaction_id))
          for (const r of rows) r.is_payroll = flagged.has(r.mercury_transaction_id)
          setPayrollFlaggedIds(flagged)
          setPayrollDecidedIds(decided)
        } catch (e) {
          // flags are best-effort; rows still render without the payroll chip
          console.error('Tally payroll flags merge failed:', e)
        }
      } else {
        setPayrollFlaggedIds(new Set())
        setPayrollDecidedIds(new Set())
      }
      setTallyTxRows(rows)
      setLinkedDebitCards((cardData ?? []) as TallyLinkedDebitCardRow[])
    } catch (e) {
      setTallyTxError(e instanceof Error ? e.message : 'Could not load transactions.')
      setTallyTxRows([])
      setLinkedDebitCards([])
    } finally {
      setTallyTxLoading(false)
    }
  }, [authUser?.id, role])

  const setTallyPayrollFlag = useCallback(
    async (mercuryTransactionId: string, isPayroll: boolean) => {
      try {
        await withSupabaseRetry(
          () =>
            supabase.rpc('set_tally_payroll_flag', {
              p_mercury_transaction_id: mercuryTransactionId,
              p_is_payroll: isPayroll,
            }),
          'set tally payroll flag',
        )
        await loadTallyTransactions()
        showToast(isPayroll ? 'Marked as payroll' : 'Payroll mark removed', 'success')
      } catch (e) {
        showToast(formatErrorMessage(e, 'Could not update payroll mark'), 'error')
      }
    },
    [loadTallyTransactions, showToast],
  )

  const applyPayrollRules = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (role !== 'dev') return
      try {
        const rulesData = await withSupabaseRetry(
          () => supabase.from('mercury_tally_payroll_rules').select('id, enabled, sort_order, criteria').eq('enabled', true),
          'load tally payroll rules',
        )
        const rules = (rulesData ?? []) as TallyPayrollRuleForMatch[]
        if (rules.length === 0) {
          if (!opts?.silent) showToast('No enabled payroll rules yet.', 'info')
          return
        }
        const txIdsWithJobSplits = new Set(
          tallyTxRows.filter((r) => tallyUniqueJobSplitEntries(r.job_splits).length > 0).map((r) => r.mercury_transaction_id),
        )
        const { toFlag, blockedByJobSplits } = buildTallyPayrollRuleFlagsToInsert({
          txs: tallyTxRows.map((r) => ({
            mercury_transaction_id: r.mercury_transaction_id,
            amount: r.amount,
            counterparty_name: r.counterparty_name ?? null,
            raw: r.raw,
          })),
          rules,
          decidedTxIds: payrollDecidedIds,
          txIdsWithJobSplits,
        })
        if (toFlag.length === 0) {
          if (!opts?.silent) {
            showToast(
              blockedByJobSplits.length > 0
                ? `No new payroll marks. ${blockedByJobSplits.length} matched but are split to jobs — resolve those manually.`
                : 'No new transactions matched the payroll rules.',
              'info',
            )
          }
          return
        }
        const inserted = await withSupabaseRetry(
          () => supabase.rpc('bulk_apply_tally_payroll_rule_flags', { p_rows: toFlag as unknown as Database['public']['Functions']['bulk_apply_tally_payroll_rule_flags']['Args']['p_rows'] }),
          'bulk apply tally payroll rule flags',
        )
        await loadTallyTransactions()
        const n = Number(inserted ?? 0)
        showToast(
          `Marked ${n} transaction${n === 1 ? '' : 's'} as payroll` +
            (blockedByJobSplits.length > 0 ? ` · ${blockedByJobSplits.length} skipped (split to jobs)` : ''),
          'success',
        )
      } catch (e) {
        if (!opts?.silent) showToast(formatErrorMessage(e, 'Could not apply payroll rules'), 'error')
      }
    },
    [role, tallyTxRows, payrollDecidedIds, loadTallyTransactions, showToast],
  )

  // Auto-apply payroll rules on load (dev opt-in). Signature = undecided tx ids, so a pass that
  // flags/decides transactions shrinks the set and won't re-fire for the same ones.
  const payrollAutoApplySigRef = useRef<string>('')
  useEffect(() => {
    if (role !== 'dev' || !payrollAutoApply || tallyTxLoading) return
    const undecided = tallyTxRows
      .map((r) => r.mercury_transaction_id)
      .filter((id) => !payrollDecidedIds.has(id))
      .sort()
    const sig = undecided.join(',')
    if (sig === '' || sig === payrollAutoApplySigRef.current) return
    payrollAutoApplySigRef.current = sig
    void applyPayrollRules({ silent: true })
  }, [role, payrollAutoApply, tallyTxLoading, tallyTxRows, payrollDecidedIds, applyPayrollRules])

  const tallyTxRowsGlobalFiltered = useMemo(() => {
    if (!tallyGlobalMinPostedYmd) return tallyTxRows
    return tallyTxRows.filter((r) => mercuryRowPassesSortingStartDate(r.posted_at, tallyGlobalMinPostedYmd))
  }, [tallyTxRows, tallyGlobalMinPostedYmd])

  const tallyJobLabelById = useMemo(() => {
    const m: Record<string, string> = {}
    for (const j of jobs) {
      m[j.id] = `${j.hcp_number} · ${j.job_name}`.trim() || j.id
    }
    for (const row of tallyTxRowsGlobalFiltered) {
      const splits = row.job_splits
      if (!Array.isArray(splits)) continue
      for (const item of splits) {
        if (!item || typeof item !== 'object') continue
        const o = item as Record<string, unknown>
        const id = typeof o.job_id === 'string' ? o.job_id : null
        if (!id || m[id]) continue
        const hn = typeof o.hcp_number === 'string' ? o.hcp_number : ''
        const jn = typeof o.job_name === 'string' ? o.job_name : ''
        m[id] = `${hn} · ${jn}`.trim() || id
      }
    }
    return m
  }, [jobs, tallyTxRowsGlobalFiltered])

  const tallyNicknameByDebitCard = useMemo(() => {
    const m: Record<string, string> = {}
    for (const c of linkedDebitCards) {
      const nick = typeof c.nickname === 'string' ? c.nickname.trim() : ''
      if (nick === '') continue
      m[String(c.mercury_debit_card_id).toLowerCase()] = nick
    }
    return m
  }, [linkedDebitCards])

  const tallyNicknameByAccount = useMemo(() => {
    const m: Record<string, string> = {}
    for (const row of tallyTxRowsGlobalFiltered) {
      const aid = row.mercury_account_id
      if (!aid) continue
      const nick =
        typeof row.mercury_account_nickname === 'string' ? row.mercury_account_nickname.trim() : ''
      if (nick === '') continue
      m[aid] = nick
    }
    return m
  }, [tallyTxRowsGlobalFiltered])

  const setTallyTxSortForColumn = useCallback((key: TallyTxSortKey) => {
    setTallyTxSort((s) =>
      s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'posted_at' ? 'desc' : 'asc' },
    )
  }, [])

  const tallyTxRowsFiltered = useMemo(() => {
    if (!tallyDebitCardFilterId) return tallyTxRowsGlobalFiltered
    return tallyTxRowsGlobalFiltered.filter((r) => r.mercury_debit_card_id === tallyDebitCardFilterId)
  }, [tallyTxRowsGlobalFiltered, tallyDebitCardFilterId])

  const tallyUnlinkedCountInScope = useMemo(
    () => tallyTxRowsFiltered.filter((r) => !tallyRowIsResolved(r)).length,
    [tallyTxRowsFiltered],
  )

  const tallyTxRowsForTable = useMemo(() => {
    if (tallyTxScope === 'all') return tallyTxRowsFiltered
    return tallyTxRowsFiltered.filter((r) => !tallyRowIsResolved(r))
  }, [tallyTxRowsFiltered, tallyTxScope])

  const tallyTxRowsForSearch = useMemo(
    () => filterTallyLinkedMercuryRowsBySearchQuery(tallyTxRowsForTable, tallyTxSearchQuery, tallyJobLabelById),
    [tallyTxRowsForTable, tallyTxSearchQuery, tallyJobLabelById],
  )

  const tallyTxSorted = useMemo(
    () => sortTallyRowsStable(tallyTxRowsForSearch, tallyTxSort),
    [tallyTxRowsForSearch, tallyTxSort],
  )

  useEffect(() => {
    if (
      tallyDebitCardFilterId &&
      !linkedDebitCards.some((c) => c.mercury_debit_card_id === tallyDebitCardFilterId)
    ) {
      setTallyDebitCardFilterId(null)
    }
  }, [linkedDebitCards, tallyDebitCardFilterId])

  useEffect(() => {
    if (activeTab !== 'transactions' || !authUser?.id) return
    void loadTallyTransactions()
  }, [activeTab, authUser?.id, loadTallyTransactions])

  useEffect(() => {
    if (tallyOpenNoteTxId === null && tallyOpenUserNoteTxId === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setTallyOpenNoteTxId(null)
      setTallyOpenUserNoteTxId(null)
      setTallyUserNoteError(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [tallyOpenNoteTxId, tallyOpenUserNoteTxId])

  useEffect(() => {
    if (!authUser?.id) return
    supabase.from('users').select('role').eq('id', authUser.id).single().then(({ data }) => {
      const r = (data as { role: string } | null)?.role ?? null
      setRole(r)
    })
  }, [authUser?.id])

  useEffect(() => {
    if (!authUser?.id) return
    let cancelled = false
    ;(async () => {
      try {
        const data = await withSupabaseRetry(
          async () =>
            supabase
              .from('app_settings')
              .select('value_text')
              .eq('key', APP_SETTINGS_KEY_JOB_TALLY_MIN_POSTED_YMD)
              .maybeSingle(),
          'load job tally min posted for tally page',
        )
        if (cancelled) return
        const row = data as { value_text: string | null } | null
        setTallyGlobalMinPostedYmd(normalizeJobTallyMinPostedYmd(row?.value_text ?? null))
      } catch {
        if (!cancelled) setTallyGlobalMinPostedYmd(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [authUser?.id])

  // app_settings is not in the supabase_realtime publication, so this
  // listener was always a no-op. The min-posted YMD is read once on mount;
  // a route reload picks up cross-tab changes. Removed in Tier 1 cleanup.

  useEffect(() => {
    const t = searchParams.get('tab')
    if (t === 'transactions') {
      setActiveTab('transactions')
      return
    }
    if (t === 'materials') {
      setActiveTab('materials-estimate')
      return
    }
    setActiveTab('transactions')
    setSearchParams(
      (p) => {
        const next = new URLSearchParams(p)
        next.set('tab', 'transactions')
        return next
      },
      { replace: true }
    )
  }, [searchParams, setSearchParams])

  useEffect(() => {
    if (role == null) return
    setJobsLoading(true)
    if (isSubcontractorLikeRole(role as UserRole)) {
      supabase.rpc('list_jobs_for_tally').then(({ data, error: err }) => {
        setJobsLoading(false)
        if (err) {
          setError(err.message)
          return
        }
        setJobs((data ?? []) as JobForTally[])
        if ((data ?? []).length > 0 && !selectedJobId) {
          setSelectedJobId((data as JobForTally[])[0]?.id ?? null)
        }
      })
    } else {
      supabase
        .from('jobs_ledger')
        .select('id, hcp_number, job_name, job_address')
        .order('hcp_number', { ascending: false })
        .then(({ data, error: err }) => {
          setJobsLoading(false)
          if (err) {
            setError(err.message)
            return
          }
          setJobs((data ?? []) as JobForTally[])
          if ((data ?? []).length > 0 && !selectedJobId) {
            setSelectedJobId((data as JobForTally[])[0]?.id ?? null)
          }
        })
    }
  }, [role])

  useEffect(() => {
    if (!authUser?.id) return
    supabase
      .from('jobs_ledger_team_members')
      .select('job_id')
      .eq('user_id', authUser.id)
      .then(({ data }) => setMyJobIds(new Set((data ?? []).map((r) => r.job_id))))
  }, [authUser?.id])

  useEffect(() => {
    supabase
      .from('service_types')
      .select('id, name')
      .order('sequence_order', { ascending: true })
      .then(({ data, error: err }) => {
        if (err) {
          setError(err.message)
          return
        }
        const types = (data ?? []) as ServiceType[]
        setServiceTypes(types)
        const plumbing = types.find((st) => st.name === 'Plumbing')
        const defaultId = plumbing?.id ?? types[0]?.id ?? null
        if (defaultId) setSelectedServiceTypeId((prev) => (prev && types.some((st) => st.id === prev) ? prev : defaultId))
      })
  }, [])

  const searchParts = useCallback(
    (term: string) => {
      if (!term.trim()) {
        setPartResults([])
        return
      }
      if (!selectedServiceTypeId) {
        setPartResults([])
        return
      }
      setPartSearching(true)
      const q = term.trim().toLowerCase()
      supabase
        .from('material_parts')
        .select('id, name, manufacturer, notes')
        .eq('service_type_id', selectedServiceTypeId)
        .or(`name.ilike.%${q}%,manufacturer.ilike.%${q}%,notes.ilike.%${q}%`)
        .limit(30)
        .order('name')
        .then(({ data, error: err }) => {
          setPartSearching(false)
          if (err) {
            setError(err.message)
            return
          }
          setPartResults((data ?? []) as MaterialPart[])
        })
    },
    [selectedServiceTypeId]
  )

  useEffect(() => {
    const t = setTimeout(() => searchParts(partSearch), 300)
    return () => clearTimeout(t)
  }, [partSearch, searchParts])

  function addEntry() {
    if (!selectedPart || !fixtureName.trim()) return
    setSaved(false)
    setPoCreateError(null)
    const qty = Math.max(1, Math.round(quantity))
    setEntries((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        fixtureName: fixtureName.trim(),
        partId: selectedPart.id,
        partName: selectedPart.name,
        manufacturer: selectedPart.manufacturer,
        quantity: qty,
        isFixtureSent: false,
      },
    ])
    setSelectedPart(null)
    setQuantity(1)
    setPartSearch('')
    setPartResults([])
  }

  function removeEntry(id: string) {
    setEntries((prev) => prev.filter((e) => e.id !== id))
  }

  function adjustEntryQuantity(id: string, delta: number) {
    setEntries((prev) =>
      prev.map((e) =>
        e.id === id && !e.isFixtureSent ? { ...e, quantity: Math.max(1, Math.round(e.quantity) + delta) } : e
      )
    )
  }

  function sendFixtureToOffice() {
    if (!fixtureName.trim()) return
    setSaved(false)
    setPoCreateError(null)
    setEntries((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        fixtureName: fixtureName.trim(),
        partId: '',
        partName: '',
        manufacturer: null,
        quantity: 1,
        isFixtureSent: true,
      },
    ])
    setFixtureName('')
  }

  async function handleSave() {
    if (!authUser?.id || !selectedJobId || entries.length === 0) return
    setSaving(true)
    setError(null)
    setPoCreateError(null)
    const partEntries = entries.filter((e) => !e.isFixtureSent && e.partId)
    const allRows = entries.map((e, i) => ({
      job_id: selectedJobId,
      fixture_name: e.fixtureName,
      part_id: e.isFixtureSent ? null : e.partId,
      quantity: e.quantity,
      sequence_order: i,
      created_by_user_id: authUser.id,
    }))
    const { data: inserted, error: insertErr } = await supabase
      .from('jobs_tally_parts')
      .insert(allRows)
      .select('id')
    if (insertErr) {
      setError(insertErr.message)
      setSaving(false)
      return
    }
    let poId: string | null = null
    if (partEntries.length > 0) {
      const pEntries = partEntries.map((e) => ({ part_id: e.partId, quantity: e.quantity }))
      const { data: poResult, error: poErr } = await supabase.rpc('create_po_from_job_tally', {
        p_job_id: selectedJobId,
        p_entries: pEntries,
      })
      poId = poResult && typeof poResult === 'object' && 'po_id' in poResult ? (poResult as { po_id: string }).po_id : null
      if (poId && inserted?.length) {
        const partInsertedIds = entries
          .map((e, i) => (!e.isFixtureSent ? inserted[i]?.id : null))
          .filter((id): id is string => !!id)
        if (partInsertedIds.length > 0) {
          await supabase
            .from('jobs_tally_parts')
            .update({ purchase_order_id: poId })
            .in('id', partInsertedIds)
        }
      }
      if (poErr || (poResult && typeof poResult === 'object' && 'error' in poResult)) {
        const msg = poErr?.message ?? (poResult as { error?: string })?.error ?? 'Unknown error'
        setPoCreateError(msg)
      }
    }
    setSaving(false)
    setSaved(true)
    setLastSaveHadPartEntries(partEntries.length > 0)
    setEntries([])
    setFixtureName('')
    setSelectedPart(null)
    setQuantity(1)
    setPartSearch('')
  }

  if (role == null) {
    return <div style={{ padding: '1rem' }}>Loading…</div>
  }

  const selectedJob = jobs.find((j) => j.id === selectedJobId)

  return (
    <div style={{ padding: '1rem', maxWidth: 480, margin: '0 auto' }}>
      <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
        <Link to="/dashboard" style={{ fontSize: '0.875rem', color: '#2563eb', textDecoration: 'none' }}>
          ← Dashboard
        </Link>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem' }}>
          <h1 style={{ fontSize: '1.25rem', margin: 0, fontWeight: 700 }}>Job Parts Tally</h1>
          {activeTab === 'materials-estimate' &&
            (serviceTypes.length === 0 ? (
              <span style={{ color: '#6b7280', fontSize: '0.75rem' }}>Loading…</span>
            ) : (
              <select
                value={selectedServiceTypeId ?? ''}
                onChange={(e) => {
                  const id = e.target.value || null
                  setSelectedServiceTypeId(id)
                  setPartResults([])
                  setPartSearch('')
                }}
                style={{
                  padding: '0.25rem 0.5rem',
                  fontSize: '0.8125rem',
                  border: '1px solid #d1d5db',
                  borderRadius: 6,
                  background: '#fff',
                }}
              >
                {serviceTypes.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.name}
                  </option>
                ))}
              </select>
            ))}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 0,
          borderBottom: '1px solid #e5e7eb',
          marginBottom: '1rem',
          width: '100%',
        }}
      >
        <button
          type="button"
          onClick={() => {
            setActiveTab('transactions')
            setSearchParams((p) => {
              const next = new URLSearchParams(p)
              next.set('tab', 'transactions')
              return next
            })
          }}
          style={tabStyle(activeTab === 'transactions')}
        >
          Transactions
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab('materials-estimate')
            setSearchParams((p) => {
              const next = new URLSearchParams(p)
              next.set('tab', 'materials')
              return next
            })
          }}
          style={tabStyle(activeTab === 'materials-estimate')}
        >
          Materials Estimate
        </button>
      </div>

      {activeTab === 'transactions' && (
        <div style={{ padding: '0.5rem 0 1rem' }}>
          <div
            style={{
              display: 'flex',
              flexWrap: 'nowrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.35rem',
              marginBottom: '0.5rem',
              width: '100%',
              maxWidth: '100%',
              overflowX: 'auto',
              WebkitOverflowScrolling: 'touch',
            }}
          >
            <div
              style={{
                flex: '1 1 auto',
                minWidth: 0,
                textAlign: 'left',
                paddingRight: '0.25rem',
              }}
            >
              {!tallyTxLoading && tallyTxRowsGlobalFiltered.length > 0 ? (
                <span
                  aria-live="polite"
                  style={{
                    fontSize: '0.8125rem',
                    color: '#64748b',
                    lineHeight: 1.5,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  <span style={{ fontWeight: 600, color: '#374151' }}>Transactions to sort:</span>
                  {tallyUnlinkedCountInScope > 0 ? (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        marginLeft: '0.35rem',
                        padding: '0.125rem 0.5rem',
                        borderRadius: 9999,
                        background: '#f59e0b',
                        color: '#1c1917',
                        fontWeight: 600,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {tallyUnlinkedCountInScope === 1
                        ? '1 unlinked'
                        : `${tallyUnlinkedCountInScope} unlinked`}
                    </span>
                  ) : (
                    <span>{` ${tallyUnlinkedCountInScope} unlinked`}</span>
                  )}
                  {tallyTxSearchQuery.trim() !== '' ? (
                    <span style={{ color: '#64748b' }}>
                      {' '}
                      · Showing {tallyTxRowsForSearch.length} of {tallyTxRowsForTable.length}
                    </span>
                  ) : null}
                </span>
              ) : null}
            </div>
            <div
              style={{
                display: 'flex',
                flexWrap: 'nowrap',
                alignItems: 'center',
                gap: '0.35rem',
                flexShrink: 0,
              }}
            >
              <button
                type="button"
                onClick={() => setTallyTxScope('all')}
                aria-pressed={tallyTxScope === 'all'}
                aria-label={
                  tallyTxScope === 'all'
                    ? 'Showing all transactions including assigned to jobs (selected)'
                    : 'Show all transactions including those assigned to jobs'
                }
                style={tallyCardFilterChipButtonStyle(tallyTxScope === 'all')}
              >
                Show all
              </button>
              <button
                type="button"
                onClick={() => setTallyTxScope('unlinked')}
                aria-pressed={tallyTxScope === 'unlinked'}
                aria-label={
                  tallyTxScope === 'unlinked'
                    ? 'Showing only transactions not assigned to jobs (selected)'
                    : 'Show only transactions not assigned to jobs'
                }
                style={tallyCardFilterChipButtonStyle(tallyTxScope === 'unlinked')}
              >
                Show unlinked
              </button>
              {isDevTally ? (
                <button
                  type="button"
                  onClick={() => {
                    setPayrollRulesSeed(null)
                    setPayrollRulesModalOpen(true)
                  }}
                  title="Manage payroll auto-mark rules and apply them"
                  style={tallyCardFilterChipButtonStyle(false)}
                >
                  Payroll rules
                </button>
              ) : null}
            </div>
          </div>
          {isDevTally && payrollFlaggedIds.size > 0 ? (
            <div style={{ textAlign: 'center', margin: '0 0 0.5rem', fontSize: '0.8125rem', color: '#7c3aed' }}>
              {(() => {
                const rows = tallyTxRowsFiltered.filter((r) => r.is_payroll)
                const total = rows.reduce((s, r) => s + Math.abs(Number(r.amount) || 0), 0)
                return `Payroll: ${rows.length} · $${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              })()}
            </div>
          ) : null}
          {!tallyTxLoading ? (
            <div
              style={{
                margin: '0 0 0.75rem',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                width: '100%',
              }}
            >
              {linkedDebitCards.length === 0 ? (
                <p
                  style={{
                    color: '#6b7280',
                    fontSize: '0.8125rem',
                    margin: 0,
                    lineHeight: 1.5,
                    textAlign: 'center',
                  }}
                >
                  No debit cards linked
                </p>
              ) : (
                <>
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'nowrap',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '0.35rem',
                      width: '100%',
                      maxWidth: '100%',
                      marginBottom: '0.35rem',
                      overflowX: 'auto',
                      WebkitOverflowScrolling: 'touch',
                    }}
                  >
                    <div
                      style={{
                        color: '#6b7280',
                        fontSize: '0.8125rem',
                        lineHeight: 1.5,
                        textAlign: 'left',
                        flex: '1 1 auto',
                        minWidth: 0,
                        paddingRight: '0.25rem',
                      }}
                    >
                      <span style={{ fontWeight: 500, color: '#374151' }}>Filter by card</span>
                      <span>
                        {' · '}
                        {linkedDebitCards.length} card{linkedDebitCards.length === 1 ? '' : 's'} linked
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setTallyDebitCardFilterId(null)}
                      aria-pressed={tallyDebitCardFilterId === null}
                      aria-label={
                        tallyDebitCardFilterId === null
                          ? 'Showing all cards (selected)'
                          : 'Show transactions from all cards'
                      }
                      style={{
                        ...tallyCardFilterChipButtonStyle(tallyDebitCardFilterId === null),
                        flexShrink: 0,
                      }}
                    >
                      All cards
                    </button>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.35rem',
                      width: '100%',
                    }}
                  >
                    {linkedDebitCards.map((c) => {
                      const label = formatLinkedCardDisplayLabel(c)
                      const active = tallyDebitCardFilterId === c.mercury_debit_card_id
                      return (
                        <button
                          key={c.mercury_debit_card_id}
                          type="button"
                          title={`Full card id: ${c.mercury_debit_card_id}`}
                          onClick={() =>
                            setTallyDebitCardFilterId(active ? null : c.mercury_debit_card_id)
                          }
                          aria-pressed={active}
                          aria-label={
                            active
                              ? `Clear card filter, ${label}`
                              : `Show only transactions for ${label}`
                          }
                          style={tallyCardFilterChipButtonStyle(active)}
                        >
                          {label}
                        </button>
                      )
                    })}
                  </div>
                </>
              )}
            </div>
          ) : null}
          {tallyTxError ? (
            <p style={{ color: '#b91c1c', fontSize: '0.875rem', margin: '0 0 0.75rem' }}>{tallyTxError}</p>
          ) : null}
          {tallyTxLoading ? (
            <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>Loading…</p>
          ) : tallyTxRows.length === 0 ? (
            <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0, lineHeight: 1.5 }}>
              No card transactions to show yet. Once your debit card is linked to your user, purchases will appear here.
            </p>
          ) : tallyTxRowsGlobalFiltered.length === 0 ? (
            <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0, lineHeight: 1.5 }}>
              Every loaded transaction is before the org minimum posted date (
              <strong>{tallyGlobalMinPostedYmd ?? '—'}</strong>). A dev can change or clear this under Settings, Templates
              &amp; testing, Job Parts Tally.
            </p>
          ) : tallyDebitCardFilterId && tallyTxRowsFiltered.length === 0 ? (
            <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0, lineHeight: 1.5 }}>
              No transactions for this card.{' '}
              <button
                type="button"
                onClick={() => setTallyDebitCardFilterId(null)}
                style={{
                  padding: 0,
                  margin: 0,
                  font: 'inherit',
                  color: '#1d4ed8',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  textUnderlineOffset: 2,
                }}
              >
                Show all cards
              </button>
            </p>
          ) : tallyTxScope === 'unlinked' &&
            tallyTxRowsFiltered.length > 0 &&
            tallyTxRowsForTable.length === 0 ? (
            <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0, lineHeight: 1.5 }}>
              {tallyDebitCardFilterId
                ? 'No unlinked transactions for this card.'
                : 'No unlinked transactions.'}{' '}
              <button
                type="button"
                onClick={() => setTallyTxScope('all')}
                style={{
                  padding: 0,
                  margin: 0,
                  font: 'inherit',
                  color: '#1d4ed8',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  textUnderlineOffset: 2,
                }}
              >
                Show all
              </button>
            </p>
          ) : (
            <>
              {!tallyTxLoading && tallyTxRowsGlobalFiltered.length > 0 ? (
                <div
                  style={{
                    marginBottom: '0.65rem',
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.35rem',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      gap: '0.35rem',
                      width: '100%',
                    }}
                  >
                    <input
                      id="job-tally-tx-search"
                      type="search"
                      value={tallyTxSearchQuery}
                      onChange={(e) => setTallyTxSearchQuery(e.target.value)}
                      placeholder="Counterparty, Mercury memo, personal memo, job, amount…"
                      autoComplete="off"
                      aria-label="Search transactions"
                      style={{
                        flex: '1 1 200px',
                        minWidth: 0,
                        padding: '0.45rem 0.55rem',
                        fontSize: '0.875rem',
                        lineHeight: 1.35,
                        border: '1px solid #d1d5db',
                        borderRadius: 6,
                        color: '#111827',
                      }}
                    />
                    {tallyTxSearchQuery.trim() !== '' ? (
                      <button
                        type="button"
                        onClick={() => setTallyTxSearchQuery('')}
                        style={{
                          flexShrink: 0,
                          padding: '0.4rem 0.65rem',
                          fontSize: '0.8125rem',
                          fontWeight: 500,
                          lineHeight: 1.25,
                          borderRadius: 6,
                          border: '1px solid #d1d5db',
                          background: 'white',
                          color: '#374151',
                          cursor: 'pointer',
                        }}
                      >
                        Clear
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}
              {tallyTxRowsForTable.length > 0 &&
              tallyTxSearchQuery.trim() !== '' &&
              tallyTxRowsForSearch.length === 0 ? (
                <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: '0 0 0.75rem', lineHeight: 1.5 }}>
                  No transactions match your search.{' '}
                  <button
                    type="button"
                    onClick={() => setTallyTxSearchQuery('')}
                    style={{
                      padding: 0,
                      margin: 0,
                      font: 'inherit',
                      color: '#1d4ed8',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      textDecoration: 'underline',
                      textUnderlineOffset: 2,
                    }}
                  >
                    Clear search
                  </button>
                </p>
              ) : (
                <div
                  style={{
                    overflowX: 'auto',
                    WebkitOverflowScrolling: 'touch',
                    marginLeft: '-0.25rem',
                    marginRight: '-0.25rem',
                  }}
                >
                  <table style={{ width: '100%', minWidth: 380, borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                <thead>
                  <tr>
                    <TallySortTh label="Posted" column="posted_at" sort={tallyTxSort} onSort={setTallyTxSortForColumn} />
                    <TallySortTh label="Amount" column="amount" sort={tallyTxSort} onSort={setTallyTxSortForColumn} />
                    <TallySortTh label="Counterparty" column="counterparty_name" sort={tallyTxSort} onSort={setTallyTxSortForColumn} />
                  </tr>
                </thead>
                <tbody>
                  {tallyTxSorted.map((row) => {
                    const txId = row.mercury_transaction_id
                    const bankDescription = mercuryBankDescriptionFromRaw(row.raw)
                    const noteText = row.note?.trim() ?? ''
                    const hasNote = noteText.length > 0
                    const noteOpen = tallyOpenNoteTxId === txId
                    const notePanelId = `tally-tx-note-${txId}`
                    const userNoteText = row.tally_user_note?.trim() ?? ''
                    const hasUserNote = userNoteText.length > 0
                    const userNoteOpen = tallyOpenUserNoteTxId === txId
                    const userNotePanelId = `tally-tx-my-note-${txId}`
                    const iconBtnBase: CSSProperties = {
                      flexShrink: 0,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '0.35rem',
                      minWidth: 32,
                      minHeight: 32,
                      margin: 0,
                      borderRadius: 6,
                      cursor: 'pointer',
                    }
                    const saveMyNote = async () => {
                      setTallyUserNoteSaving(true)
                      setTallyUserNoteError(null)
                      try {
                        await withSupabaseRetry(
                          async () =>
                            supabase.rpc('upsert_mercury_tally_transaction_note', {
                              p_mercury_transaction_id: txId,
                              p_body: tallyUserNoteDraft,
                            }),
                          'save tally my note',
                        )
                        const t = tallyUserNoteDraft.trim()
                        setTallyTxRows((prev) =>
                          prev.map((r) => (r.mercury_transaction_id === txId ? { ...r, tally_user_note: t } : r)),
                        )
                      } catch (err) {
                        setTallyUserNoteError(err instanceof Error ? err.message : 'Could not save note.')
                      } finally {
                        setTallyUserNoteSaving(false)
                      }
                    }
                    const clearMyNote = async () => {
                      setTallyUserNoteSaving(true)
                      setTallyUserNoteError(null)
                      try {
                        await withSupabaseRetry(
                          async () =>
                            supabase.rpc('upsert_mercury_tally_transaction_note', {
                              p_mercury_transaction_id: txId,
                              p_body: '',
                            }),
                          'clear tally my note',
                        )
                        setTallyUserNoteDraft('')
                        setTallyTxRows((prev) =>
                          prev.map((r) => (r.mercury_transaction_id === txId ? { ...r, tally_user_note: '' } : r)),
                        )
                      } catch (err) {
                        setTallyUserNoteError(err instanceof Error ? err.message : 'Could not clear note.')
                      } finally {
                        setTallyUserNoteSaving(false)
                      }
                    }
                    return (
                    <Fragment key={txId}>
                      <tr style={{ borderTop: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '0.45rem 0.6rem', verticalAlign: 'top' }}>
                          {(() => {
                            const posted = formatTallyPostedParts(row.posted_at)
                            if (!posted) return '—'
                            return (
                              <TallyPostedDateOpenButton
                                posted={posted}
                                onOpen={() => setTallyClockAllocateRow(row)}
                              />
                            )
                          })()}
                        </td>
                        <td
                          style={{
                            padding: '0.45rem 0.6rem',
                            verticalAlign: 'top',
                            whiteSpace: 'nowrap',
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {formatTallyCurrency(Number(row.amount))}
                        </td>
                        <td style={{ padding: '0.45rem 0.6rem', verticalAlign: 'top', maxWidth: 220 }}>
                          <>
                                <div
                                  style={{
                                    fontWeight: 500,
                                    color: '#111827',
                                    wordBreak: 'break-word',
                                    marginBottom: 4,
                                  }}
                                >
                                  {row.counterparty_name?.trim() || '—'}
                                </div>
                                {bankDescription ? (
                                  <div style={{ fontSize: '0.72rem', color: '#64748b', marginBottom: 4 }}>
                                    {bankDescription}
                                  </div>
                                ) : null}
                                <div
                                  style={{
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    alignItems: 'center',
                                    justifyContent: 'flex-end',
                                    gap: '0.35rem',
                                  }}
                                >
                                  {hasNote ? (
                                    <button
                                      type="button"
                                      title="Mercury memo"
                                      onClick={() =>
                                        setTallyOpenNoteTxId(noteOpen ? null : txId)
                                      }
                                      aria-expanded={noteOpen}
                                      aria-controls={notePanelId}
                                      aria-label={
                                        noteOpen
                                          ? 'Hide Mercury memo from Mercury'
                                          : 'Show Mercury memo from Mercury'
                                      }
                                      style={{
                                        ...iconBtnBase,
                                        border: '1px solid #e5e7eb',
                                        background: '#f9fafb',
                                        color: '#4b5563',
                                      }}
                                    >
                                      <MercuryTransactionNoteIcon />
                                    </button>
                                  ) : null}
                                  <button
                                    type="button"
                                    title="Add or edit personal memo"
                                    onClick={() => {
                                      setTallyUserNoteError(null)
                                      if (userNoteOpen) {
                                        setTallyOpenUserNoteTxId(null)
                                      } else {
                                        setTallyUserNoteDraft(row.tally_user_note?.trim() ?? '')
                                        setTallyOpenUserNoteTxId(txId)
                                      }
                                    }}
                                    aria-expanded={userNoteOpen}
                                    aria-controls={userNotePanelId}
                                    aria-label={
                                      userNoteOpen
                                        ? 'Hide personal memo'
                                        : 'Add or edit personal memo'
                                    }
                                    style={{
                                      ...iconBtnBase,
                                      border: hasUserNote ? '1px solid #93c5fd' : '1px solid #e5e7eb',
                                      background: hasUserNote ? '#eff6ff' : '#f9fafb',
                                      color: '#1d4ed8',
                                      fontSize: '0.6875rem',
                                      fontWeight: 600,
                                      padding: '0.25rem 0.4rem',
                                      minWidth: 0,
                                    }}
                                  >
                                    + memo
                                  </button>
                                </div>
                                {hasNote ? (
                                  <div
                                    id={notePanelId}
                                    role="region"
                                    aria-label="Mercury memo"
                                    hidden={!noteOpen}
                                    style={{
                                      color: '#64748b',
                                      fontSize: '0.75rem',
                                      marginTop: 6,
                                      wordBreak: 'break-word',
                                    }}
                                  >
                                    {noteText}
                                  </div>
                                ) : null}
                          </>
                        </td>
                      </tr>
                      {userNoteOpen ? (
                        <tr>
                          <td
                            colSpan={3}
                            style={{
                              padding: '0.35rem 0.6rem 0.5rem',
                              verticalAlign: 'top',
                              background: '#fafafa',
                              borderTop: '1px solid #f3f4f6',
                            }}
                          >
                            <div
                              id={userNotePanelId}
                              role="region"
                              aria-label="Personal memo"
                              style={{
                                padding: '0.5rem 0.55rem',
                                borderRadius: 6,
                                border: '1px solid #e5e7eb',
                                background: '#fff',
                              }}
                            >
                              <div
                                style={{
                                  fontSize: '0.6875rem',
                                  color: '#6b7280',
                                  marginBottom: 6,
                                }}
                              >
                                Transaction details that will help sorting:{' '}
                                <span style={{ color: '#9ca3af' }}>· max 2000 chars</span>
                              </div>
                              <textarea
                                value={tallyUserNoteDraft}
                                onChange={(e) => setTallyUserNoteDraft(e.target.value)}
                                maxLength={2000}
                                rows={3}
                                style={{
                                  width: '100%',
                                  boxSizing: 'border-box',
                                  font: 'inherit',
                                  fontSize: '0.8125rem',
                                  padding: '0.35rem 0.45rem',
                                  borderRadius: 4,
                                  border: '1px solid #d1d5db',
                                  resize: 'vertical',
                                  minHeight: 64,
                                }}
                                disabled={tallyUserNoteSaving}
                              />
                              <div
                                style={{
                                  display: 'flex',
                                  flexWrap: 'wrap',
                                  gap: '0.35rem',
                                  marginTop: 8,
                                  alignItems: 'center',
                                }}
                              >
                                <button
                                  type="button"
                                  onClick={() => void saveMyNote()}
                                  disabled={tallyUserNoteSaving}
                                  style={{
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    padding: '0.25rem 0.55rem',
                                    borderRadius: 4,
                                    border: '1px solid #2563eb',
                                    background: '#2563eb',
                                    color: '#fff',
                                    cursor: tallyUserNoteSaving ? 'wait' : 'pointer',
                                    opacity: tallyUserNoteSaving ? 0.75 : 1,
                                  }}
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void clearMyNote()}
                                  disabled={
                                    tallyUserNoteSaving ||
                                    (tallyUserNoteDraft.trim() === '' && !hasUserNote)
                                  }
                                  style={{
                                    fontSize: '0.75rem',
                                    fontWeight: 500,
                                    padding: '0.25rem 0.55rem',
                                    borderRadius: 4,
                                    border: '1px solid #e5e7eb',
                                    background: '#fff',
                                    color: '#374151',
                                    cursor: tallyUserNoteSaving ? 'wait' : 'pointer',
                                  }}
                                >
                                  Clear
                                </button>
                              </div>
                              {tallyUserNoteError ? (
                                <p
                                  style={{
                                    color: '#b91c1c',
                                    fontSize: '0.75rem',
                                    margin: '6px 0 0',
                                  }}
                                >
                                  {tallyUserNoteError}
                                </p>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ) : null}
                      <tr>
                        <td
                          colSpan={3}
                          style={{
                            padding: '0.25rem 1rem 0.45rem 0.6rem',
                            verticalAlign: 'top',
                            fontSize: '0.8125rem',
                            textAlign: 'right',
                          }}
                        >
                          {(() => {
                            const jobEntries = tallyUniqueJobSplitEntries(row.job_splits)
                            const rowFlexEnd: CSSProperties = {
                              display: 'flex',
                              flexWrap: 'wrap',
                              alignItems: 'center',
                              justifyContent: 'flex-end',
                              gap: '0.35rem',
                            }
                            const assignJobsCompactBtn = (
                              <button
                                type="button"
                                onClick={() => setTallyAllocModalRow(row)}
                                style={{
                                  fontSize: '0.75rem',
                                  fontWeight: 500,
                                  lineHeight: 1.25,
                                  padding: '0.15rem 0.45rem',
                                  minHeight: 0,
                                  borderRadius: 4,
                                  border: '1px solid #93c5fd',
                                  background: '#eff6ff',
                                  color: '#1d4ed8',
                                  cursor: 'pointer',
                                }}
                              >
                                Assign jobs
                              </button>
                            )
                            const markPayrollBtn = isDevTally ? (
                              <button
                                type="button"
                                onClick={() => setPendingPayrollTx(row)}
                                title="Mark as payroll — resolves this transaction without allocating it to any job"
                                style={{
                                  fontSize: '0.75rem',
                                  fontWeight: 500,
                                  lineHeight: 1.25,
                                  padding: '0.15rem 0.45rem',
                                  minHeight: 0,
                                  borderRadius: 4,
                                  border: '1px solid #d1d5db',
                                  background: '#fff',
                                  color: '#6b7280',
                                  cursor: 'pointer',
                                }}
                              >
                                Mark payroll
                              </button>
                            ) : null
                            if (isDevTally && row.is_payroll) {
                              return (
                                <div style={tallyJobsSubRowBannerStyle(true)}>
                                  <div style={rowFlexEnd}>
                                    <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#7c3aed' }}>Payroll ✓</span>
                                    <span aria-hidden="true" style={{ color: '#c4b5fd' }}>{' | '}</span>
                                    <button
                                      type="button"
                                      onClick={() => void setTallyPayrollFlag(row.mercury_transaction_id, false)}
                                      style={{
                                        fontSize: '0.75rem',
                                        fontWeight: 500,
                                        padding: '0.15rem 0.45rem',
                                        borderRadius: 4,
                                        border: '1px solid #d1d5db',
                                        background: '#fff',
                                        color: '#6b7280',
                                        cursor: 'pointer',
                                      }}
                                    >
                                      Unmark
                                    </button>
                                  </div>
                                </div>
                              )
                            }
                            if (jobEntries.length > 0) {
                              return (
                                <div style={tallyJobsSubRowBannerStyle(true)}>
                                  <div style={rowFlexEnd}>
                                    {jobEntries.map((j, i) => (
                                      <Fragment key={j.jobId}>
                                        {i > 0 ? (
                                          <span aria-hidden="true" style={{ color: '#6ee7b7' }}>
                                            ;{' '}
                                          </span>
                                        ) : null}
                                        <button
                                          type="button"
                                          onClick={() => setTallyJobDrilldown({ jobId: j.jobId, label: j.label })}
                                          aria-label={`View transactions for ${j.label}`}
                                          style={{
                                            fontSize: '0.8125rem',
                                            fontWeight: 500,
                                            color: '#1d4ed8',
                                            background: 'none',
                                            border: 'none',
                                            padding: 0,
                                            cursor: 'pointer',
                                            textDecoration: 'underline',
                                            textUnderlineOffset: 2,
                                            fontFamily: 'inherit',
                                            textAlign: 'inherit',
                                          }}
                                        >
                                          {j.label}
                                        </button>
                                      </Fragment>
                                    ))}
                                    <span aria-hidden="true" style={{ color: '#047857' }}>
                                      {' | '}
                                    </span>
                                    {assignJobsCompactBtn}
                                  </div>
                                </div>
                              )
                            }
                            if (row.jobs_summary?.trim()) {
                              return (
                                <div style={tallyJobsSubRowBannerStyle(true)}>
                                  <div style={rowFlexEnd}>
                                    <span style={{ color: '#111827' }}>{row.jobs_summary.trim()}</span>
                                    <span aria-hidden="true" style={{ color: '#047857' }}>
                                      {' | '}
                                    </span>
                                    {assignJobsCompactBtn}
                                  </div>
                                </div>
                              )
                            }
                            if (row.invoices_summary?.trim()) {
                              return (
                                <div style={tallyJobsSubRowBannerStyle(true)}>
                                  <div style={rowFlexEnd}>
                                    <span style={{ color: '#111827' }}>
                                      Invoice: {row.invoices_summary.trim()}
                                    </span>
                                    <span aria-hidden="true" style={{ color: '#047857' }}>
                                      {' | '}
                                    </span>
                                    {assignJobsCompactBtn}
                                  </div>
                                </div>
                              )
                            }
                            return (
                              <div style={tallyJobsSubRowBannerStyle(false)}>
                                <div style={{ ...rowFlexEnd, width: '100%' }}>
                                  <span style={{ fontSize: '0.75rem', color: '#92400e' }}>No jobs assigned yet</span>
                                  <span aria-hidden="true" style={{ color: '#92400e' }}>
                                    {' | '}
                                  </span>
                                  {assignJobsCompactBtn}
                                  {markPayrollBtn}
                                </div>
                              </div>
                            )
                          })()}
                        </td>
                      </tr>
                    </Fragment>
                    )
                  })}
                </tbody>
              </table>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {activeTab === 'materials-estimate' && (
        <>
      {error && (
        <p style={{ color: '#b91c1c', marginBottom: '1rem', fontSize: '0.875rem' }}>{error}</p>
      )}

      {saved && (
        <div style={{ marginBottom: '1rem' }}>
          <p style={{ color: '#059669', fontSize: '0.875rem', fontWeight: 500, margin: 0 }}>
            Parts saved.
            {poCreateError ? (
              <span style={{ color: '#b91c1c', display: 'block', marginTop: '0.25rem' }}>
                Purchase order could not be created: {poCreateError}. You can create one manually in Materials.
              </span>
            ) : lastSaveHadPartEntries ? (
              ' Purchase order created.'
            ) : null}
          </p>
          <p style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: '0.25rem', marginBottom: 0 }}>
            You can tally another job or go back to Dashboard.
          </p>
        </div>
      )}

      {/* Step 1: Select job */}
      <div style={{ marginBottom: '1.5rem' }}>
        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '1rem' }}>
          Job / HCP
        </label>
        {jobsLoading ? (
          <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>Loading jobs…</p>
        ) : jobs.length === 0 ? (
          <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>
            No jobs assigned. Ask your supervisor to add you as a team member on a job.
          </p>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setJobPickerOpen(true)}
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                fontSize: '1rem',
                minHeight: TOUCH_MIN,
                border: '1px solid #d1d5db',
                borderRadius: 8,
                background: '#fff',
                textAlign: 'left',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.5rem',
              }}
            >
              <span>
                {selectedJob
                  ? `${selectedJob.hcp_number || '—'} · ${selectedJob.job_name || '—'}`
                  : 'Choose job…'}
              </span>
              <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>▼</span>
            </button>
            {jobPickerOpen && (
              <div
                style={{
                  position: 'fixed',
                  inset: 0,
                  zIndex: 100,
                  background: 'rgba(0,0,0,0.4)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'stretch',
                  justifyContent: 'flex-end',
                }}
                onClick={() => setJobPickerOpen(false)}
              >
                <div
                  style={{
                    background: '#fff',
                    borderTopLeftRadius: 16,
                    borderTopRightRadius: 16,
                    maxHeight: '70vh',
                    overflow: 'auto',
                    padding: '1rem',
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600 }}>Choose job</h2>
                    <button type="button" onClick={() => setJobPickerOpen(false)} style={{ padding: '0.5rem', background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#6b7280' }}>×</button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {(showMyJobsOnly && myJobIds ? jobs.filter((j) => myJobIds.has(j.id)) : jobs).map((j) => (
                      <button
                        key={j.id}
                        type="button"
                        onClick={() => {
                          setSelectedJobId(j.id)
                          setJobPickerOpen(false)
                        }}
                        style={{
                          padding: '1rem',
                          minHeight: TOUCH_MIN,
                          fontSize: '1rem',
                          lineHeight: 1.4,
                          textAlign: 'left',
                          border: '1px solid #e5e7eb',
                          borderRadius: 8,
                          background: selectedJobId === j.id ? '#eff6ff' : '#fff',
                          cursor: 'pointer',
                          color: '#111827',
                        }}
                      >
                        <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{j.hcp_number || '—'} · {j.job_name || '—'}</div>
                        {j.job_address && <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>{j.job_address}</div>}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {!isSubcontractorLikeRole(role as UserRole) && (
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem', fontWeight: 400, fontSize: '0.875rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={showMyJobsOnly}
                  onChange={(e) => setShowMyJobsOnly(e.target.checked)}
                />
                Show my jobs only
              </label>
            )}
          </>
        )}
      </div>

      {selectedJob && (
        <>
          {/* Step 2: Fixture name */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '1rem' }}>
              Fixture or tie-in
            </label>
            <input
              type="text"
              value={fixtureName}
              onChange={(e) => setFixtureName(e.target.value)}
              placeholder="e.g. Kitchen sink, Water heater"
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                fontSize: '1rem',
                minHeight: TOUCH_MIN,
                boxSizing: 'border-box',
                border: '1px solid #d1d5db',
                borderRadius: 8,
              }}
            />
            <p style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.25rem' }}>
              Fill in parts or{' '}
              <button
                type="button"
                onClick={sendFixtureToOffice}
                disabled={!fixtureName.trim()}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  color: '#2563eb',
                  textDecoration: 'underline',
                  cursor: fixtureName.trim() ? 'pointer' : 'not-allowed',
                  fontSize: 'inherit',
                }}
              >
                send
              </button>
              {' '}this item to the office for them to price.
            </p>
          </div>

          {/* Step 3: Search part (hidden when part selected; re-shown after Add or Cancel) */}
          {!selectedPart && (
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '1rem' }}>
                Search part
              </label>
              <input
                type="text"
                value={partSearch}
                onChange={(e) => setPartSearch(e.target.value)}
                placeholder="Part name or manufacturer"
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  fontSize: '1rem',
                  minHeight: TOUCH_MIN,
                  boxSizing: 'border-box',
                  border: '1px solid #d1d5db',
                  borderRadius: 8,
                }}
              />
              {partSearching && <p style={{ marginTop: '0.25rem', fontSize: '0.875rem', color: '#6b7280' }}>Searching…</p>}
              {partResults.length > 0 && (
                <ul style={{ listStyle: 'none', padding: 0, margin: '0.5rem 0 0 0', border: '1px solid #e5e7eb', borderRadius: 8, maxHeight: 200, overflow: 'auto' }}>
                  {partResults.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedPart(p)}
                        style={{
                          display: 'block',
                          width: '100%',
                          padding: '0.75rem 1rem',
                          textAlign: 'left',
                          border: 'none',
                          borderBottom: '1px solid #e5e7eb',
                          background: '#fff',
                          cursor: 'pointer',
                          fontSize: '1rem',
                          minHeight: TOUCH_MIN,
                        }}
                      >
                        {p.name}
                        {p.manufacturer && (
                          <span style={{ color: '#6b7280', fontSize: '0.875rem', marginLeft: '0.5rem' }}>
                            {' · '}{p.manufacturer}
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Step 4: Quantity + Add */}
          {selectedPart && (
            <div style={{ marginBottom: '1.5rem', padding: '1rem', border: '1px solid #e5e7eb', borderRadius: 8, background: '#f9fafb' }}>
              <p style={{ margin: '0 0 0.5rem 0', fontWeight: 500 }}>
                {selectedPart.name}
                {selectedPart.manufacturer && (
                  <span style={{ color: '#6b7280', marginLeft: '0.5rem' }}>{' · '}{selectedPart.manufacturer}</span>
                )}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {quantity > 1 && (
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      style={{
                        width: TOUCH_MIN,
                        height: TOUCH_MIN,
                        padding: 0,
                        fontSize: '1.25rem',
                        border: '1px solid #d1d5db',
                        borderRadius: 8,
                        background: '#fff',
                        cursor: 'pointer',
                      }}
                    >
                      −
                    </button>
                  )}
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, Math.round(parseFloat(e.target.value) || 1)))}
                    style={{
                      width: '5rem',
                      padding: '0.5rem',
                      fontSize: '1rem',
                      textAlign: 'center',
                      border: '1px solid #d1d5db',
                      borderRadius: 8,
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => q + 1)}
                    style={{
                      width: TOUCH_MIN,
                      height: TOUCH_MIN,
                      padding: 0,
                      fontSize: '1.25rem',
                      border: '1px solid #d1d5db',
                      borderRadius: 8,
                      background: '#fff',
                      cursor: 'pointer',
                    }}
                  >
                    +
                  </button>
                </div>
                <button
                  type="button"
                  onClick={addEntry}
                  disabled={!fixtureName.trim()}
                  style={{
                    padding: '0.75rem 1.25rem',
                    fontSize: '1rem',
                    fontWeight: 600,
                    background: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: 8,
                    cursor: fixtureName.trim() ? 'pointer' : 'not-allowed',
                    minHeight: TOUCH_MIN,
                  }}
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPart(null)}
                  style={{
                    padding: '0.75rem 1rem',
                    fontSize: '0.875rem',
                    background: '#f3f4f6',
                    color: '#374151',
                    border: '1px solid #d1d5db',
                    borderRadius: 8,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Entries list */}
          {entries.length > 0 && (
            <div style={{ marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1rem', margin: '0 0 0.5rem 0', fontWeight: 600 }}>Parts to save</h2>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {entries.map((e) => (
                  <li
                    key={e.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.75rem 1rem',
                      marginBottom: '0.5rem',
                      border: e.isFixtureSent ? '1px solid #86efac' : '1px solid #e5e7eb',
                      borderRadius: 8,
                      background: e.isFixtureSent ? '#dcfce7' : '#fff',
                    }}
                  >
                    <div>
                      <span style={{ fontWeight: 500 }}>{e.fixtureName}</span>
                      {e.isFixtureSent ? (
                        <div style={{ fontSize: '0.875rem', color: '#15803d', marginTop: '0.25rem' }}>
                          Sent to office for pricing
                        </div>
                      ) : (
                        <>
                          <span style={{ color: '#6b7280', marginLeft: '0.5rem' }}>{' · '}{e.partName}</span>
                          {e.manufacturer && (
                            <span style={{ color: '#9ca3af', fontSize: '0.875rem', marginLeft: '0.25rem' }}>
                              ({e.manufacturer})
                            </span>
                          )}
                          <div style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.25rem' }}>
                            Qty: {e.quantity}
                          </div>
                        </>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {!e.isFixtureSent && e.quantity > 1 && (
                          <button
                            type="button"
                            onClick={() => adjustEntryQuantity(e.id, -1)}
                            style={{
                              width: TOUCH_MIN,
                              height: TOUCH_MIN,
                              padding: 0,
                              fontSize: '1rem',
                              border: '1px solid #d1d5db',
                              borderRadius: 8,
                              background: '#fff',
                              cursor: 'pointer',
                            }}
                            title="Decrease by 1"
                          >
                            ↓
                          </button>
                        )}
                        {!e.isFixtureSent && (
                          <button
                            type="button"
                            onClick={() => adjustEntryQuantity(e.id, 1)}
                            style={{
                              width: TOUCH_MIN,
                              height: TOUCH_MIN,
                              padding: 0,
                              fontSize: '1rem',
                              border: '1px solid #d1d5db',
                              borderRadius: 8,
                              background: '#fff',
                              cursor: 'pointer',
                            }}
                            title="Increase by 1"
                          >
                            ↑
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => removeEntry(e.id)}
                          style={{
                            padding: '0.5rem',
                            minWidth: TOUCH_MIN,
                            minHeight: TOUCH_MIN,
                            fontSize: '0.875rem',
                            background: '#fee2e2',
                            color: '#991b1b',
                            border: 'none',
                            borderRadius: 8,
                            cursor: 'pointer',
                          }}
                        >
                          Remove
                        </button>
                      </div>
                      <span style={{ fontSize: '0.8125rem', color: '#6b7280' }}>{e.fixtureName}</span>
                    </div>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                style={{
                  width: '100%',
                  padding: '1rem 1.5rem',
                  marginTop: '0.75rem',
                  fontSize: '1.125rem',
                  fontWeight: 600,
                  background: '#059669',
                  color: 'white',
                  border: 'none',
                  borderRadius: 8,
                  cursor: saving ? 'not-allowed' : 'pointer',
                  minHeight: TOUCH_MIN,
                }}
              >
                {saving ? 'Sending…' : 'Send to Office'}
              </button>
            </div>
          )}
        </>
      )}
        </>
      )}

      <TallyJobTransactionsModal
        open={tallyJobDrilldown !== null}
        onClose={() => setTallyJobDrilldown(null)}
        jobId={tallyJobDrilldown?.jobId ?? null}
        jobLabel={tallyJobDrilldown?.label ?? ''}
        rows={tallyTxRowsGlobalFiltered}
      />

      <TallyClockWindowAllocateModal
        open={tallyClockAllocateRow !== null}
        onClose={() => setTallyClockAllocateRow(null)}
        userId={authUser?.id ?? null}
        transactionId={tallyClockAllocateRow?.mercury_transaction_id ?? null}
        postedAtIso={tallyClockAllocateRow?.posted_at ?? null}
        transactionAmount={
          tallyClockAllocateRow != null ? Number(tallyClockAllocateRow.amount) : 0
        }
        onSaved={() => {
          setTallyClockAllocateRow(null)
          void loadTallyTransactions()
        }}
      />

      <MercuryTransactionAllocationsModal
        open={tallyAllocModalRow !== null}
        onClose={() => setTallyAllocModalRow(null)}
        transaction={tallyAllocModalRow ? mercuryTxRowFromTallyRpc(tallyAllocModalRow) : null}
        initialAllocations={tallyAllocModalRow ? parseTallyJobSplitsJson(tallyAllocModalRow.job_splits) : []}
        initialPersonId={null}
        initialUserId={null}
        jobLabelById={tallyJobLabelById}
        nicknameByDebitCard={tallyNicknameByDebitCard}
        nicknameByAccount={tallyNicknameByAccount}
        usersOptions={[]}
        tallySelfService
        recentPersonPicksStorageKey={null}
        onSaved={() => {
          setTallyAllocModalRow(null)
          void loadTallyTransactions()
        }}
      />
      {isDevTally ? (
        <TallyPayrollRulesModal
          open={payrollRulesModalOpen}
          onClose={() => {
            setPayrollRulesModalOpen(false)
            setPayrollRulesSeed(null)
          }}
          autoApply={payrollAutoApply}
          onToggleAutoApply={(next) => {
            setPayrollAutoApply(next)
            try {
              localStorage.setItem('jobs-tally-payroll-autoapply', String(next))
            } catch {
              // session-only if unavailable
            }
          }}
          onApplyNow={() => applyPayrollRules()}
          sampleTransactions={tallyTxRows}
          initialForm={payrollRulesSeed}
          onRuleSaved={() => void applyPayrollRules()}
        />
      ) : null}
      {isDevTally ? (
        <TallyMarkPayrollConfirmModal
          open={pendingPayrollTx !== null}
          busy={payrollMarkBusy}
          counterpartyName={pendingPayrollTx?.counterparty_name ?? null}
          bankDescription={pendingPayrollTx ? mercuryBankDescriptionFromRaw(pendingPayrollTx.raw) : null}
          amountLabel={pendingPayrollTx ? formatTallyCurrency(Number(pendingPayrollTx.amount)) : ''}
          postedLabel={(() => {
            const posted = pendingPayrollTx ? formatTallyPostedParts(pendingPayrollTx.posted_at) : null
            return posted ? `${posted.date} · ${posted.weekday}` : null
          })()}
          onCancel={() => setPendingPayrollTx(null)}
          onConfirm={() => {
            const tx = pendingPayrollTx
            if (!tx || payrollMarkBusy) return
            setPayrollMarkBusy(true)
            // setTallyPayrollFlag never throws — it catches and toasts internally.
            void setTallyPayrollFlag(tx.mercury_transaction_id, true).finally(() => {
              setPayrollMarkBusy(false)
              setPendingPayrollTx(null)
            })
          }}
          onCreateRule={() => {
            const tx = pendingPayrollTx
            if (!tx) return
            setPayrollRulesSeed(buildPayrollRuleSeedFromTransaction(tx))
            setPendingPayrollTx(null)
            setPayrollRulesModalOpen(true)
          }}
        />
      ) : null}
    </div>
  )
}
