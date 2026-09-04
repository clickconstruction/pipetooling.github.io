import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { isAssistantLike } from '../lib/subcontractorLikeRole'
import { useMercuryOrgNotesByTxId } from '../hooks/useMercuryOrgNotesByTxId'
import { useToastContext } from '../contexts/ToastContext'
import { withSupabaseRetry } from '../utils/errorHandling'
import type { Database } from '../types/database'
import { BankingStripeInvoicesPanel } from '../components/BankingStripeInvoicesPanel'
import { BankingStripeWebhookEventsPanel } from '../components/BankingStripeWebhookEventsPanel'
import { BankingAccountNicknamesModal } from '../components/BankingAccountNicknamesModal'
import { BankingDebitCardsModal } from '../components/banking/BankingDebitCardsModal'
import { loadDebitCardDirectory, type DebitCardRole } from '../lib/banking/debitCards'
import { BankingDebitCardRecentTxModal } from '../components/BankingDebitCardRecentTxModal'
import { BankingSortingConfigModal } from '../components/BankingSortingConfigModal'
import { BankingMercuryDragSortTab } from '../components/banking/BankingMercuryDragSortTab'
import { BankingMercuryAccountingTab } from '../components/banking/BankingMercuryAccountingTab'
import { BankingMercuryUserReviewTab } from '../components/banking/BankingMercuryUserReviewTab'
import { BankingMercuryCategoryReviewTab } from '../components/banking/BankingMercuryCategoryReviewTab'
import { BankingMercuryReconciliationTab } from '../components/banking/BankingMercuryReconciliationTab'
import { BankingMercuryVisualsTab } from '../components/banking/BankingMercuryVisualsTab'
import { MercuryBackfillModal } from '../components/banking/MercuryBackfillModal'
import { MercuryImportCsvModal, type ImportCsvSubmitPayload, type ImportCsvResult } from '../components/banking/MercuryImportCsvModal'
import { ManualAccountsModal } from '../components/banking/ManualAccountsModal'
import { BankingMercuryTable, formatCurrency, type SortKey } from '../components/banking/BankingMercuryTable'
import { BankingNicknamesMenu } from '../components/banking/BankingNicknamesMenu'
import { BankingLedgerAdvancedMenu } from '../components/banking/BankingLedgerAdvancedMenu'
import { formatMercuryKind } from '../lib/mercuryKindLabels'
import { mercuryDebitCardIdFromRaw } from '../lib/mercuryRawDebitCard'
import {
  defaultBankingSortingConfig,
  loadBankingSortingConfig,
  saveBankingSortingConfig,
  type BankingSortingConfigV1,
} from '../lib/bankingSortingConfig'
import { countSortingUnmatched, filterMercuryRowsForSorting } from '../lib/bankingSortingCounts'
import { shortUuidPrefix } from '../lib/shortUuidPrefix'
import { fetchAllAttributions, fetchAllJobAllocations } from '../lib/fetchMercuryRelationsByTxIds'
import { pageTabStyle } from '../lib/pageTabStyle'
import {
  MercuryTransactionAllocationsModal,
  type MercuryAllocSavedDetail,
  type MercuryJobSplit,
} from '../components/MercuryTransactionAllocationsModal'
import type { SearchableSelectOption } from '../components/SearchableSelect'
import {
  buildBankingAttributionOptions,
  type BankingAttributionPersonRow,
} from '../lib/bankingAttributionOptions'
import {
  buildMercuryTxSearchHaystackWithJobPerson,
  mercuryTxMatchesSearchQuery,
} from '../lib/bankingMercurySearch'
import {
  applyMercuryRawPatch,
  fetchMercuryTransactionRawById,
  fetchMercuryTransactionRawsByIds,
  mercuryRowNeedsRawHydration,
  MERCURY_TRANSACTIONS_BANKING_LIST_COLUMNS,
} from '../lib/fetchMercuryTransactionRaws'
import {
  readAccountingApplyRulesByDefault,
  readAccountingApproveByDefault,
  readAccountingHideLabeledTransactions,
  writeAccountingApplyRulesByDefault,
  writeAccountingApproveByDefault,
  writeAccountingHideLabeledTransactions,
} from '../lib/bankingDragSortStorage'
import { fetchAccountingPrefs, saveBankingPref } from '../lib/bankingUserPrefs'

type MercuryTxRow = Database['public']['Tables']['mercury_transactions']['Row']
/** Stable empty list for org-note fetch ids when not on Mercury Banking (avoid spurious refetches). */
const NO_MERCURY_TX_IDS_FOR_BANKING_NOTES: readonly string[] = []
const DEBIT_CARD_RECENT_TX_CAP = 50
/** Cap for the in-memory Banking → Mercury list. Sized to comfortably fit a 1-year backfill (~10k tx) plus headroom. */
const MERCURY_TRANSACTIONS_BANKING_LIST_LIMIT = 15000
/** Page size for the Accounting tab's keyset-paginated "show labeled" (Hide labeled = off) view. */
const ACCOUNTING_LABELED_PAGE_SIZE = 500

type BankingProduct = 'mercury' | 'stripe'
type MercuryBankingTab = 'ledger' | 'sorting' | 'drag_sort' | 'accounting' | 'user_review' | 'category_review' | 'reconciliation' | 'visuals'
type StripeBankingTab = 'invoices' | 'data'

type BankingView = {
  product: BankingProduct
  mercuryTab: MercuryBankingTab
  stripeTab: StripeBankingTab
}

type BankingPageRole =
  | 'dev'
  | 'master_technician'
  | 'assistant'
  | 'estimator'
  | 'primary'
  | 'superintendent'
  | 'subcontractor'
  | 'helpers'
  | null

function parseBankingView(params: URLSearchParams, role: BankingPageRole): BankingView {
  if (isAssistantLike(role) || role === 'master_technician') {
    const tabRaw = params.get('tab')
    const mercuryTab: MercuryBankingTab =
      tabRaw === 'drag_sort'
        ? 'drag_sort'
        : tabRaw === 'accounting'
          ? 'accounting'
          : tabRaw === 'user_review'
            ? 'user_review'
            : tabRaw === 'category_review'
              ? 'category_review'
              : tabRaw === 'reconciliation'
                ? 'reconciliation'
                : tabRaw === 'visuals'
                  ? 'visuals'
                  : tabRaw === 'sorting'
                    ? 'sorting'
                    : 'accounting'
    return { product: 'mercury', mercuryTab, stripeTab: 'invoices' }
  }
  if (role !== 'dev') {
    return { product: 'mercury', mercuryTab: 'ledger', stripeTab: 'invoices' }
  }

  const productRaw = params.get('product')
  const tabRaw = params.get('tab')

  if (productRaw === 'stripe') {
    return {
      product: 'stripe',
      mercuryTab: 'ledger',
      stripeTab: tabRaw === 'data' ? 'data' : 'invoices',
    }
  }

  let mercuryTab: MercuryBankingTab = 'accounting'
  if (tabRaw === 'sorting') mercuryTab = 'sorting'
  else if (tabRaw === 'drag_sort') mercuryTab = 'drag_sort'
  else if (tabRaw === 'accounting') mercuryTab = 'accounting'
  else if (tabRaw === 'user_review') mercuryTab = 'user_review'
  else if (tabRaw === 'category_review') mercuryTab = 'category_review'
  else if (tabRaw === 'reconciliation') mercuryTab = 'reconciliation'
  else if (tabRaw === 'visuals') mercuryTab = 'visuals'
  else if (tabRaw === 'ledger') mercuryTab = 'ledger'
  else if (tabRaw === 'invoices' || tabRaw === 'data') mercuryTab = 'ledger'

  return { product: 'mercury', mercuryTab, stripeTab: 'invoices' }
}

function sortMercuryRowsStable(list: MercuryTxRow[], sort: { key: SortKey; dir: 'asc' | 'desc' }): MercuryTxRow[] {
  const dirMul = sort.dir === 'asc' ? 1 : -1
  const byPosted = (a: MercuryTxRow, b: MercuryTxRow) => {
    const ta = a.posted_at ? new Date(a.posted_at).getTime() : NaN
    const tb = b.posted_at ? new Date(b.posted_at).getTime() : NaN
    const aOk = !Number.isNaN(ta)
    const bOk = !Number.isNaN(tb)
    if (!aOk && !bOk) return 0
    if (!aOk) return 1
    if (!bOk) return -1
    return (ta - tb) * dirMul
  }
  const byAccount = (a: MercuryTxRow, b: MercuryTxRow) =>
    a.mercury_account_id.localeCompare(b.mercury_account_id) * dirMul
  const byMercuryId = (a: MercuryTxRow, b: MercuryTxRow) => (a.mercury_id ?? '').localeCompare(b.mercury_id ?? '') * dirMul

  return [...list].sort((a, b) => {
    let c = 0
    if (sort.key === 'posted_at') c = byPosted(a, b)
    else if (sort.key === 'mercury_account_id') c = byAccount(a, b)
    else c = byMercuryId(a, b)
    if (c !== 0) return c
    return a.id.localeCompare(b.id)
  })
}

export default function Banking() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { showToast } = useToastContext()
  const [myRole, setMyRole] = useState<'dev' | 'master_technician' | 'assistant' | 'estimator' | 'primary' | 'superintendent' | 'subcontractor' | 'helpers' | null>(
    null,
  )
  const [rows, setRows] = useState<MercuryTxRow[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [accountFilter, setAccountFilter] = useState<string>('')
  const [kindFilter, setKindFilter] = useState<string>('')
  const [bankingSearchText, setBankingSearchText] = useState<string>('')
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null)
  const [nicknameByAccount, setNicknameByAccount] = useState<Record<string, string>>({})
  const [nicknameDrafts, setNicknameDrafts] = useState<Record<string, string>>({})
  const [savingNicknameId, setSavingNicknameId] = useState<string | null>(null)
  const [nicknamesModalOpen, setNicknamesModalOpen] = useState(false)
  const [nicknameByDebitCard, setNicknameByDebitCard] = useState<Record<string, string>>({})
  const [savingDebitCardNicknameId, setSavingDebitCardNicknameId] = useState<string | null>(null)
  const [debitCardNicknamesModalOpen, setDebitCardNicknamesModalOpen] = useState(false)
  /** Debit cards (v2.2750): person's card vs company card, keyed by lower-cased card id. */
  const [roleByDebitCard, setRoleByDebitCard] = useState<Record<string, DebitCardRole>>({})
  /** Card to open the Debit cards modal on (`?cards=<id>` door from Wheels). */
  const [highlightDebitCardId, setHighlightDebitCardId] = useState<string | null>(null)
  const [nicknamesMenuOpen, setNicknamesMenuOpen] = useState(false)
  const [ledgerAdvancedMenuOpen, setLedgerAdvancedMenuOpen] = useState(false)
  const [backfillModalOpen, setBackfillModalOpen] = useState(false)
  const [importCsvModalOpen, setImportCsvModalOpen] = useState(false)
  const [manualAccountsModalOpen, setManualAccountsModalOpen] = useState(false)
  const [recentTxDebitCardId, setRecentTxDebitCardId] = useState<string | null>(null)
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'posted_at', dir: 'desc' })
  const [sortingConfig, setSortingConfig] = useState<BankingSortingConfigV1>(defaultBankingSortingConfig)
  const [sortingConfigModalOpen, setSortingConfigModalOpen] = useState(false)
  const [sortingSort, setSortingSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'posted_at', dir: 'desc' })
  const [allocationsByTxId, setAllocationsByTxId] = useState<Map<string, MercuryJobSplit[]>>(() => new Map())
  const [personIdByTxId, setPersonIdByTxId] = useState<Map<string, string | null>>(() => new Map())
  const [userIdByTxId, setUserIdByTxId] = useState<Map<string, string | null>>(() => new Map())
  const [personNameById, setPersonNameById] = useState<Record<string, string>>({})
  const [userNameById, setUserNameById] = useState<Record<string, string>>({})
  const [jobLabelByIdBanking, setJobLabelByIdBanking] = useState<Record<string, string>>({})
  const [usersSelectOptions, setUsersSelectOptions] = useState<SearchableSelectOption[]>([])
  const [peopleAttribRows, setPeopleAttribRows] = useState<BankingAttributionPersonRow[]>([])
  const [allocModalTx, setAllocModalTx] = useState<MercuryTxRow | null>(null)
  // Lifted from `BankingMercuryAccountingTab` so `loadRowsForActiveView` can
  // pick the unlabeled-only RPC vs the master 15k fetch based on the current
  // tab + the toggle. Defaults to **on** (the storage helper's null-userId
  // default) until the user-bound `useEffect` below hydrates the per-user pref.
  const [hideLabeledTransactions, setHideLabeledTransactions] = useState(true)
  // Gates the initial data-load effect so the first fetch uses the *hydrated*
  // per-user `hideLabeledTransactions` value rather than the default `true`.
  // `user` is null at mount and resolves async (so a `useState` lazy read of
  // the per-user localStorage key is impossible); deferring the first fetch
  // until this flips true makes the dispatcher pick the right loader once,
  // eliminating the default-vs-stored flash / double fetch.
  const [accountingPrefsHydrated, setAccountingPrefsHydrated] = useState(false)
  // Keyset cursor + paging flags for the Accounting "show labeled" (Hide off)
  // view, which infinite-scrolls `list_mercury_transactions_keyset` in
  // ACCOUNTING_LABELED_PAGE_SIZE pages instead of pulling the 15k master list.
  // `labeledCursor` is the (posted_at, id) of the last loaded row.
  const [labeledCursor, setLabeledCursor] = useState<{ postedAt: string | null; id: string } | null>(null)
  const [labeledHasMore, setLabeledHasMore] = useState(false)
  const [labeledLoadingMore, setLabeledLoadingMore] = useState(false)
  // Synchronous guard so a burst of scroll events can't fire overlapping
  // next-page requests (mirrors the Materials parts-book infinite scroll).
  const labeledLoadingMoreRef = useRef(false)
  // How many labeled rows are currently loaded (page 1 + any scrolled pages).
  // A silent realtime refresh reloads to this same depth instead of collapsing
  // back to page 1, so a background sync doesn't yank the user to the top.
  const labeledLoadedCountRef = useRef(0)
  // Monotonic token for the primary list loaders. Each fresh load bumps it;
  // an in-flight load whose token is no longer current (because the user
  // switched tabs, toggled Hide labeled, or a realtime refresh superseded it)
  // discards its response instead of clobbering the active view's data.
  const listLoadSeqRef = useRef(0)
  // True when the master 15k fetch (Ledger/Sorting) returned a full page,
  // meaning older transactions exist beyond what's shown.
  const [rowsTruncated, setRowsTruncated] = useState(false)
  // Per-user "Apply rules by default" toggle (RECENT_FEATURES v2.580).
  // Lifted to this component so we can bump `autoApplyResetTick` from
  // `handleSync` / `handleBackfill` and so the storage hydration mirrors
  // `hideLabeledTransactions`. Defaults **off** (opt-in for safety).
  const [applyRulesByDefault, setApplyRulesByDefault] = useState(false)
  // Monotonic counter the child reads in a ref-reset effect so that every
  // Refresh from Mercury / Backfill clears `lastAutoAppliedSignatureRef` and
  // re-fires one auto-apply pass even on identical id sets (e.g. a sync
  // that only updated counterparties).
  const [autoApplyResetTick, setAutoApplyResetTick] = useState(0)
  // Per-user "Approve by default" toggle (RECENT_FEATURES v2.581).
  // When on, auto-runs `handleApproveAll` whenever a new pending suggestion
  // appears. Defaults **off** (opt-in — committing assignments without
  // per-row review is the bigger trust step).
  const [approveByDefault, setApproveByDefault] = useState(false)

  const isDevBanking = myRole === 'dev'
  const canAccessBanking = myRole === 'dev' || isAssistantLike(myRole) || myRole === 'master_technician'

  const bankingView = useMemo(() => parseBankingView(searchParams, myRole), [searchParams, myRole])

  const setMercurySubTab = useCallback(
    (tab: MercuryBankingTab) => {
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev)
          p.set('product', 'mercury')
          p.set('tab', tab)
          return p
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  const setStripeSubTab = useCallback(
    (tab: StripeBankingTab) => {
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev)
          p.set('product', 'stripe')
          p.set('tab', tab)
          return p
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  const setBankingProduct = useCallback(
    (product: BankingProduct) => {
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev)
          if (product === 'mercury') {
            p.set('product', 'mercury')
            const t = prev.get('tab')
            if (t === 'sorting' || t === 'ledger' || t === 'drag_sort' || t === 'accounting' || t === 'user_review' || t === 'category_review' || t === 'reconciliation' || t === 'visuals') p.set('tab', t)
            else p.set('tab', 'ledger')
          } else {
            p.set('product', 'stripe')
            const t = prev.get('tab')
            if (t === 'data' || t === 'invoices') p.set('tab', t)
            else p.set('tab', 'invoices')
          }
          return p
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  useEffect(() => {
    setNicknamesMenuOpen(false)
    setLedgerAdvancedMenuOpen(false)
  }, [bankingView.product, bankingView.mercuryTab, bankingView.stripeTab])

  useEffect(() => {
    if (bankingView.product !== 'mercury' || bankingView.mercuryTab !== 'sorting') {
      setSortingConfigModalOpen(false)
    }
  }, [bankingView.product, bankingView.mercuryTab])

  useEffect(() => {
    if (!user?.id || !myRole) return
    if (myRole === 'dev') {
      setSortingConfig(loadBankingSortingConfig(user.id))
      return
    }
    if (isAssistantLike(myRole) || myRole === 'master_technician') {
      setSortingConfig(defaultBankingSortingConfig())
    }
  }, [user?.id, myRole])

  useEffect(() => {
    if (!user?.id) return
    supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()
      .then(({ data }) => setMyRole((data?.role as typeof myRole) ?? null))
  }, [user?.id])

  useEffect(() => {
    setAccountingPrefsHydrated(false)
    if (!user?.id) return
    setHideLabeledTransactions(readAccountingHideLabeledTransactions(user.id))
    setAccountingPrefsHydrated(true)
  }, [user?.id])

  // Each toggle change writes the instant localStorage cache AND the per-user
  // `banking_user_prefs` row so the setting follows the user across devices.
  const syncPrefAcrossDevices = useCallback(
    (column: 'accounting_hide_labeled' | 'accounting_apply_rules_by_default' | 'accounting_approve_by_default', v: boolean) => {
      if (!user?.id) return
      void saveBankingPref(user.id, column, v).catch(() =>
        showToast('Saved here, but could not sync this preference across devices.', 'error'),
      )
    },
    [user?.id, showToast],
  )

  const onHideLabeledTransactionsChange = useCallback(
    (v: boolean) => {
      setHideLabeledTransactions(v)
      if (user?.id) writeAccountingHideLabeledTransactions(user.id, v)
      syncPrefAcrossDevices('accounting_hide_labeled', v)
    },
    [user?.id, syncPrefAcrossDevices],
  )

  useEffect(() => {
    if (!user?.id) return
    setApplyRulesByDefault(readAccountingApplyRulesByDefault(user.id))
  }, [user?.id])

  const onApplyRulesByDefaultChange = useCallback(
    (v: boolean) => {
      setApplyRulesByDefault(v)
      if (user?.id) writeAccountingApplyRulesByDefault(user.id, v)
      syncPrefAcrossDevices('accounting_apply_rules_by_default', v)
    },
    [user?.id, syncPrefAcrossDevices],
  )

  useEffect(() => {
    if (!user?.id) return
    setApproveByDefault(readAccountingApproveByDefault(user.id))
  }, [user?.id])

  const onApproveByDefaultChange = useCallback(
    (v: boolean) => {
      setApproveByDefault(v)
      if (user?.id) writeAccountingApproveByDefault(user.id, v)
      syncPrefAcrossDevices('accounting_approve_by_default', v)
    },
    [user?.id, syncPrefAcrossDevices],
  )

  // Source of truth: after the instant localStorage hydration above, load the
  // per-user prefs row and apply any value set on another device (mirroring it
  // back into localStorage so this device is instant-correct next time).
  useEffect(() => {
    if (!user?.id) return
    const uid = user.id
    let cancelled = false
    void (async () => {
      try {
        const row = await fetchAccountingPrefs(uid)
        if (cancelled || !row) return
        if (row.accounting_hide_labeled != null) {
          setHideLabeledTransactions(row.accounting_hide_labeled)
          writeAccountingHideLabeledTransactions(uid, row.accounting_hide_labeled)
        }
        if (row.accounting_apply_rules_by_default != null) {
          setApplyRulesByDefault(row.accounting_apply_rules_by_default)
          writeAccountingApplyRulesByDefault(uid, row.accounting_apply_rules_by_default)
        }
        if (row.accounting_approve_by_default != null) {
          setApproveByDefault(row.accounting_approve_by_default)
          writeAccountingApproveByDefault(uid, row.accounting_approve_by_default)
        }
      } catch {
        /* prefs sync is best-effort; the localStorage values already applied */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user?.id])

  useEffect(() => {
    if (myRole && myRole !== 'dev' && !isAssistantLike(myRole) && myRole !== 'master_technician') {
      navigate('/dashboard', { replace: true })
    }
  }, [myRole, navigate])

  useEffect(() => {
    if (myRole !== 'master_technician' && !isAssistantLike(myRole)) return
    const product = searchParams.get('product')
    const tab = searchParams.get('tab')
    if (
      (tab === 'sorting' ||
        tab === 'drag_sort' ||
        tab === 'accounting' ||
        tab === 'user_review' ||
        tab === 'category_review' ||
        tab === 'reconciliation' ||
        tab === 'visuals') &&
      product !== 'stripe' &&
      (product === null || product === 'mercury')
    ) {
      if (product === null) {
        setSearchParams(
          (prev) => {
            const p = new URLSearchParams(prev)
            p.set('product', 'mercury')
            p.set(
              'tab',
              tab === 'drag_sort'
                ? 'drag_sort'
                : tab === 'accounting'
                  ? 'accounting'
                  : tab === 'user_review'
                    ? 'user_review'
                    : tab === 'category_review'
                      ? 'category_review'
                      : tab === 'reconciliation'
                        ? 'reconciliation'
                        : tab === 'visuals'
                          ? 'visuals'
                          : 'sorting',
            )
            return p
          },
          { replace: true },
        )
      }
      return
    }
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev)
        p.set('product', 'mercury')
        p.set('tab', 'accounting')
        return p
      },
      { replace: true },
    )
  }, [myRole, searchParams, setSearchParams])

  const loadAllRows = useCallback(async (options?: { silent?: boolean }) => {
    if (myRole !== 'dev' && !isAssistantLike(myRole) && myRole !== 'master_technician') return
    const silent = options?.silent === true
    const seq = ++listLoadSeqRef.current
    if (!silent) {
      setError(null)
      setLoading(true)
    }
    try {
      const data = await withSupabaseRetry(async () => {
        return supabase
          .from('mercury_transactions')
          .select(MERCURY_TRANSACTIONS_BANKING_LIST_COLUMNS)
          .order('posted_at', { ascending: false, nullsFirst: false })
          .limit(MERCURY_TRANSACTIONS_BANKING_LIST_LIMIT)
      }, 'load mercury_transactions')
      if (listLoadSeqRef.current !== seq) return
      const list = (data as MercuryTxRow[]) ?? []
      setRows(list)
      setRowsTruncated(list.length >= MERCURY_TRANSACTIONS_BANKING_LIST_LIMIT)
    } catch (e) {
      if (listLoadSeqRef.current !== seq) return
      if (silent) {
        showToast(e instanceof Error ? e.message : 'Failed to refresh Mercury transactions.', 'error')
      } else {
        setError(e instanceof Error ? e.message : 'Failed to load transactions')
        setRows([])
        setRowsTruncated(false)
      }
    } finally {
      if (!silent && listLoadSeqRef.current === seq) setLoading(false)
    }
  }, [myRole, showToast])

  // Server-side anti-join: returns only `mercury_transactions` rows that have
  // no matching `mercury_transaction_drag_sort_assignments`. Used when the
  // Accounting tab is active with **Hide labeled transactions** on (the
  // 90% case), instead of pulling 15k rows and discarding ~88% client-side.
  // RPC has no cap; PostgREST's project-level row cap still applies as the
  // ultimate ceiling, same as before.
  const loadUnlabeledRows = useCallback(async (options?: { silent?: boolean }) => {
    if (myRole !== 'dev' && !isAssistantLike(myRole) && myRole !== 'master_technician') return
    const silent = options?.silent === true
    const seq = ++listLoadSeqRef.current
    if (!silent) {
      setError(null)
      setLoading(true)
    }
    try {
      // Explicit cap (instead of leaning on PostgREST's project row ceiling) so
      // we can detect truncation and surface it rather than silently dropping
      // the oldest unlabeled rows.
      const data = await withSupabaseRetry(async () => {
        return supabase.rpc('list_unlabeled_mercury_transactions', { p_limit: MERCURY_TRANSACTIONS_BANKING_LIST_LIMIT })
      }, 'load mercury_transactions unlabeled')
      if (listLoadSeqRef.current !== seq) return
      const list = (data as MercuryTxRow[]) ?? []
      setRows(list)
      setRowsTruncated(list.length >= MERCURY_TRANSACTIONS_BANKING_LIST_LIMIT)
    } catch (e) {
      if (listLoadSeqRef.current !== seq) return
      if (silent) {
        showToast(e instanceof Error ? e.message : 'Failed to refresh Mercury transactions.', 'error')
      } else {
        setError(e instanceof Error ? e.message : 'Failed to load transactions')
        setRows([])
        setRowsTruncated(false)
      }
    } finally {
      if (!silent && listLoadSeqRef.current === seq) setLoading(false)
    }
  }, [myRole, showToast])

  // First page of the Accounting "show labeled" (Hide off) view: replaces the
  // list with the newest ACCOUNTING_LABELED_PAGE_SIZE rows and arms the cursor
  // so `loadLabeledNextPage` can keyset-scroll older rows.
  const loadLabeledFirstPage = useCallback(async (options?: { silent?: boolean }) => {
    if (myRole !== 'dev' && !isAssistantLike(myRole) && myRole !== 'master_technician') return
    const silent = options?.silent === true
    const seq = ++listLoadSeqRef.current
    labeledLoadingMoreRef.current = false
    setLabeledLoadingMore(false)
    // On a silent (realtime) refresh, reload to the depth the user has already
    // scrolled to so they keep their place; a user-initiated load resets to one
    // page. The keyset RPC reads newest-first, so requesting N rows from the top
    // reproduces the current window (plus any new top-of-list inserts).
    const limit = silent ? Math.max(ACCOUNTING_LABELED_PAGE_SIZE, labeledLoadedCountRef.current) : ACCOUNTING_LABELED_PAGE_SIZE
    if (!silent) {
      setError(null)
      setLoading(true)
    }
    try {
      const data = await withSupabaseRetry(async () => {
        return supabase.rpc('list_mercury_transactions_keyset', {
          p_after_posted_at: undefined,
          p_after_id: undefined,
          p_limit: limit,
        })
      }, 'load mercury_transactions labeled page')
      if (listLoadSeqRef.current !== seq) return
      const page = (data as MercuryTxRow[]) ?? []
      setRows(page)
      labeledLoadedCountRef.current = page.length
      const last = page[page.length - 1]
      setLabeledCursor(last ? { postedAt: last.posted_at, id: last.id } : null)
      setLabeledHasMore(page.length === limit)
    } catch (e) {
      if (listLoadSeqRef.current !== seq) return
      if (silent) {
        showToast(e instanceof Error ? e.message : 'Failed to refresh Mercury transactions.', 'error')
      } else {
        setError(e instanceof Error ? e.message : 'Failed to load transactions')
        setRows([])
        labeledLoadedCountRef.current = 0
        setLabeledCursor(null)
        setLabeledHasMore(false)
      }
    } finally {
      if (!silent && listLoadSeqRef.current === seq) setLoading(false)
    }
  }, [myRole, showToast])

  // Next keyset page for the "show labeled" view: appends older rows (id-deduped)
  // and advances the cursor. No-op unless a cursor is armed and more remain.
  const loadLabeledNextPage = useCallback(async () => {
    if (myRole !== 'dev' && !isAssistantLike(myRole) && myRole !== 'master_technician') return
    if (labeledLoadingMoreRef.current || !labeledHasMore || !labeledCursor) return
    // Snapshot the active-load token. If a first-page / realtime refresh fires
    // while this page is in flight, it bumps the token and we drop this
    // response rather than appending onto a freshly reset list (which would
    // duplicate or misorder rows).
    const seq = listLoadSeqRef.current
    labeledLoadingMoreRef.current = true
    setLabeledLoadingMore(true)
    try {
      const data = await withSupabaseRetry(async () => {
        return supabase.rpc('list_mercury_transactions_keyset', {
          p_after_posted_at: labeledCursor.postedAt ?? undefined,
          p_after_id: labeledCursor.id,
          p_limit: ACCOUNTING_LABELED_PAGE_SIZE,
        })
      }, 'load mercury_transactions labeled next page')
      if (listLoadSeqRef.current !== seq) return
      const page = (data as MercuryTxRow[]) ?? []
      const last = page[page.length - 1]
      if (last) {
        setRows((prev) => {
          const seen = new Set(prev.map((r) => r.id))
          const next = [...prev, ...page.filter((r) => !seen.has(r.id))]
          labeledLoadedCountRef.current = next.length
          return next
        })
        setLabeledCursor({ postedAt: last.posted_at, id: last.id })
      }
      setLabeledHasMore(page.length === ACCOUNTING_LABELED_PAGE_SIZE)
    } catch (e) {
      if (listLoadSeqRef.current !== seq) return
      showToast(e instanceof Error ? e.message : 'Failed to load more transactions.', 'error')
    } finally {
      if (listLoadSeqRef.current === seq) {
        labeledLoadingMoreRef.current = false
        setLabeledLoadingMore(false)
      }
    }
  }, [myRole, labeledHasMore, labeledCursor, showToast])

  // Tab-aware dispatcher. Accounting + Hide labeled = unlabeled-only RPC;
  // Accounting + show labeled = keyset-paginated first page; User Review
  // self-sources via its own `user_review_rows` RPC (skip the master fetch);
  // every other tab (Drag Sort, Category Review, Sorting, Ledger) keeps the
  // existing master 15k fetch.
  const isAccountingLabeledView =
    bankingView.product === 'mercury' &&
    bankingView.mercuryTab === 'accounting' &&
    !hideLabeledTransactions
  const loadRowsForActiveView = useCallback(
    async (options?: { silent?: boolean }) => {
      if (bankingView.product === 'mercury' && bankingView.mercuryTab === 'accounting') {
        return hideLabeledTransactions ? loadUnlabeledRows(options) : loadLabeledFirstPage(options)
      }
      // The User Review tab loads its own windowed, pre-joined rows from the
      // `user_review_rows` RPC and ignores the parent master list, so don't pull
      // the ~15k `mercury_transactions` fetch when it's the active tab.
      if (bankingView.product === 'mercury' && bankingView.mercuryTab === 'user_review') {
        if (options?.silent !== true) setLoading(false)
        return
      }
      // The Visuals tab is self-contained (Reconciliation mold) — own fetches.
      if (bankingView.product === 'mercury' && bankingView.mercuryTab === 'visuals') {
        if (options?.silent !== true) setLoading(false)
        return
      }
      return loadAllRows(options)
    },
    [bankingView.product, bankingView.mercuryTab, hideLabeledTransactions, loadAllRows, loadUnlabeledRows, loadLabeledFirstPage],
  )

  const loadNicknames = useCallback(async () => {
    if (myRole !== 'dev' && !isAssistantLike(myRole) && myRole !== 'master_technician') return
    try {
      const data = await withSupabaseRetry(async () => {
        return supabase.from('mercury_account_nicknames').select('mercury_account_id, nickname')
      }, 'load mercury_account_nicknames')
      const list = (data ?? []) as Pick<Database['public']['Tables']['mercury_account_nicknames']['Row'], 'mercury_account_id' | 'nickname'>[]
      const next: Record<string, string> = {}
      for (const r of list) next[r.mercury_account_id] = r.nickname
      setNicknameByAccount(next)
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to load account nicknames', 'error')
    }
  }, [myRole, showToast])

  const loadDebitCardNicknames = useCallback(async () => {
    if (myRole !== 'dev' && !isAssistantLike(myRole) && myRole !== 'master_technician') return
    try {
      const dir = await loadDebitCardDirectory()
      setNicknameByDebitCard(dir.nicknameByCard)
      setRoleByDebitCard(dir.roleByCard)
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to load debit card nicknames', 'error')
    }
  }, [myRole, showToast])

  const openAllocModalForMercuryRow = useCallback(
    async (r: MercuryTxRow) => {
      if (!mercuryRowNeedsRawHydration(r)) {
        setAllocModalTx(r)
        return
      }
      try {
        const raw = await fetchMercuryTransactionRawById(r.id, 'banking alloc modal mercury raw')
        const merged: MercuryTxRow = { ...r, raw: raw ?? null }
        setRows((prev) => prev.map((x) => (x.id === r.id ? merged : x)))
        setAllocModalTx(merged)
      } catch (e) {
        showToast(e instanceof Error ? e.message : 'Could not load transaction details', 'error')
        setAllocModalTx(r)
      }
    },
    [showToast],
  )

  // Re-fires when the active tab or **Hide labeled transactions** toggle
  // changes (via `loadRowsForActiveView`'s dep set), so toggling off the
  // Accounting hide-labeled checkbox naturally pulls in the master 15k
  // fetch, and re-toggling on shrinks the list back to the unlabeled-only
  // RPC. First mount fires once because the dispatcher identity is stable
  // across that initial paint.
  useEffect(() => {
    if (myRole !== 'dev' && !isAssistantLike(myRole) && myRole !== 'master_technician') return
    // Wait until the per-user Accounting prefs are hydrated so the dispatcher
    // picks the right loader on the first fetch (no default-vs-stored flash).
    if (!accountingPrefsHydrated) return
    void Promise.all([loadRowsForActiveView(), loadNicknames(), loadDebitCardNicknames()])
  }, [myRole, accountingPrefsHydrated, loadRowsForActiveView, loadNicknames, loadDebitCardNicknames])

  useEffect(() => {
    if (!canAccessBanking) return
    if (bankingView.product !== 'mercury' || (bankingView.mercuryTab !== 'drag_sort' && bankingView.mercuryTab !== 'accounting')) return
    if (rows.length === 0) return
    const needs = rows.filter((r) => mercuryRowNeedsRawHydration(r)).map((r) => r.id)
    if (needs.length === 0) return
    let cancelled = false
    void (async () => {
      try {
        const patch = await fetchMercuryTransactionRawsByIds(needs, 'banking drag_sort hydrate mercury raw')
        if (cancelled) return
        setRows((prev) => applyMercuryRawPatch(prev, patch))
      } catch (e) {
        if (!cancelled) {
          showToast(e instanceof Error ? e.message : 'Could not load card details for Drag Sort', 'error')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [bankingView.product, bankingView.mercuryTab, rows, canAccessBanking, showToast])

  useEffect(() => {
    if (recentTxDebitCardId === null || rows.length === 0) return
    const needs = rows.filter((r) => mercuryRowNeedsRawHydration(r)).map((r) => r.id)
    if (needs.length === 0) return
    let cancelled = false
    void (async () => {
      try {
        const patch = await fetchMercuryTransactionRawsByIds(needs, 'banking debit card recent tx hydrate raw')
        if (cancelled) return
        setRows((prev) => applyMercuryRawPatch(prev, patch))
      } catch (e) {
        if (!cancelled) {
          showToast(e instanceof Error ? e.message : 'Could not load transactions for this card', 'error')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [recentTxDebitCardId, rows, showToast])

  useEffect(() => {
    if (!expandedRowId || rows.length === 0) return
    const row = rows.find((r) => r.id === expandedRowId)
    if (!row || !mercuryRowNeedsRawHydration(row)) return
    let cancelled = false
    void (async () => {
      try {
        const raw = await fetchMercuryTransactionRawById(expandedRowId, 'banking expanded row mercury raw')
        if (cancelled) return
        setRows((prev) =>
          prev.map((r) => (r.id === expandedRowId ? { ...r, raw: raw ?? null } : r)),
        )
      } catch (e) {
        if (!cancelled) {
          showToast(e instanceof Error ? e.message : 'Could not load raw transaction details', 'error')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [expandedRowId, rows, showToast])

  const loadMercuryAllocations = useCallback(async () => {
    if (!canAccessBanking || rows.length === 0) {
      setAllocationsByTxId(new Map())
      setPersonIdByTxId(new Map())
      setUserIdByTxId(new Map())
      setPersonNameById({})
      setUserNameById({})
      setJobLabelByIdBanking({})
      return
    }
    const ids = rows.map((r) => r.id)
    try {
      // The relation tables (allocations ~1k, attributions ~5k) are small and we've loaded
      // every transaction, so one unfiltered select each (in parallel) beats chunking ~10k
      // ids into 200-id batches (~110 sequential round-trips → 2). Extra rows for txs beyond
      // the loaded set are harmless: lookups are keyed by loaded tx id.
      const [allocRows, attrRows] = await Promise.all([
        fetchAllJobAllocations('load'),
        fetchAllAttributions('load'),
      ])

      const allocMap = new Map<string, MercuryJobSplit[]>()
      for (const row of allocRows) {
        const tid = row.mercury_transaction_id
        const list = allocMap.get(tid) ?? []
        const split: MercuryJobSplit = { job_id: row.job_id, amount: Number(row.amount) }
        if (row.note != null && row.note !== '') split.note = row.note
        list.push(split)
        allocMap.set(tid, list)
      }
      setAllocationsByTxId(allocMap)

      const personMap = new Map<string, string | null>()
      const userMap = new Map<string, string | null>()
      const personIds = new Set<string>()
      const userIds = new Set<string>()
      for (const row of attrRows) {
        personMap.set(row.mercury_transaction_id, row.person_id)
        userMap.set(row.mercury_transaction_id, row.user_id)
        if (row.person_id) personIds.add(row.person_id)
        if (row.user_id) userIds.add(row.user_id)
      }
      for (const id of ids) {
        if (!personMap.has(id)) personMap.set(id, null)
        if (!userMap.has(id)) userMap.set(id, null)
      }
      setPersonIdByTxId(personMap)
      setUserIdByTxId(userMap)

      const jobIds = [...new Set(allocRows.map((r) => r.job_id))]
      const jobLabels: Record<string, string> = {}
      if (jobIds.length > 0) {
        const jobRowsData = await withSupabaseRetry(
          async () =>
            supabase.from('jobs_ledger').select('id, hcp_number, job_name').in('id', jobIds),
          'banking allocation job labels',
        )
        for (const j of jobRowsData ?? []) {
          const row = j as { id: string; hcp_number?: string | null; job_name?: string | null }
          const label = `${row.hcp_number ?? ''} · ${row.job_name ?? ''}`.trim()
          jobLabels[row.id] = label || row.id
        }
      }
      setJobLabelByIdBanking(jobLabels)

      const names: Record<string, string> = {}
      if (personIds.size > 0) {
        const peopleRowsData = await withSupabaseRetry(
          async () => supabase.from('people').select('id, name').in('id', [...personIds]),
          'banking allocation people names',
        )
        for (const p of peopleRowsData ?? []) {
          const row = p as { id: string; name: string }
          names[row.id] = row.name
        }
      }
      setPersonNameById(names)

      const userNames: Record<string, string> = {}
      if (userIds.size > 0) {
        const userRowsData = await withSupabaseRetry(
          async () => supabase.from('users').select('id, name').in('id', [...userIds]),
          'banking allocation user names',
        )
        for (const u of userRowsData ?? []) {
          const row = u as { id: string; name: string }
          userNames[row.id] = row.name
        }
      }
      setUserNameById(userNames)
    } catch {
      setAllocationsByTxId(new Map())
      setPersonIdByTxId(new Map())
      setUserIdByTxId(new Map())
    }
  }, [canAccessBanking, rows])

  useEffect(() => {
    void loadMercuryAllocations()
  }, [loadMercuryAllocations])

  useEffect(() => {
    if (!canAccessBanking) return
    let cancelled = false
    void (async () => {
      try {
        const [usersData, peopleData] = await Promise.all([
          withSupabaseRetry(
            () => supabase.rpc('list_users_for_banking_attribution'),
            'list users banking attribution',
          ),
          withSupabaseRetry(
            () => supabase.rpc('list_people_with_kind_for_banking_attribution'),
            'list people banking attribution',
          ),
        ])
        if (cancelled) return
        const userRows = (usersData ?? []) as { id: string; name: string }[]
        setUsersSelectOptions(userRows.map((p) => ({ value: p.id, label: p.name })))
        setPeopleAttribRows((peopleData ?? []) as BankingAttributionPersonRow[])
      } catch (e) {
        if (!cancelled) {
          setUsersSelectOptions([])
          setPeopleAttribRows([])
          showToast(
            e instanceof Error ? e.message : 'Could not load users for Banking (apply latest migrations if this persists).',
            'error',
          )
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [canAccessBanking, showToast])

  // Combined attribution options for the User Review pickers: users + roster people (tagged
  // by kind, e.g. "· Sub"), with type-prefixed values (u:/p:). Allocations + card-link modals
  // keep using the user-only `usersSelectOptions`.
  const attributionOptions = useMemo(
    () => buildBankingAttributionOptions(usersSelectOptions, peopleAttribRows),
    [usersSelectOptions, peopleAttribRows],
  )

  const setSortForColumn = useCallback((key: SortKey) => {
    setSort((s) =>
      s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'posted_at' ? 'desc' : 'asc' },
    )
  }, [])

  const accountOptions = useMemo(() => {
    const set = new Set<string>()
    for (const r of rows) set.add(r.mercury_account_id)
    return Array.from(set).sort()
  }, [rows])

  const searchQueryNorm = useMemo(() => bankingSearchText.trim(), [bankingSearchText])

  const nicknameCtx = useMemo(
    () => ({ nicknameByAccount, nicknameByDebitCard }),
    [nicknameByAccount, nicknameByDebitCard],
  )

  const bankingMercurySearchJobPersonEnrich = useMemo(
    () => ({
      allocationsByTxId,
      jobLabelById: jobLabelByIdBanking,
      personIdByTxId,
      userIdByTxId,
      personNameById,
      userNameById,
    }),
    [
      allocationsByTxId,
      jobLabelByIdBanking,
      personIdByTxId,
      userIdByTxId,
      personNameById,
      userNameById,
    ],
  )

  const filteredSorted = useMemo(() => {
    const list = rows.filter((r) => {
      if (accountFilter && r.mercury_account_id !== accountFilter) return false
      if (kindFilter && r.kind !== kindFilter) return false
      if (searchQueryNorm !== '') {
        const haystack = buildMercuryTxSearchHaystackWithJobPerson(r, nicknameCtx, bankingMercurySearchJobPersonEnrich)
        if (!mercuryTxMatchesSearchQuery(haystack, searchQueryNorm)) return false
      }
      return true
    })
    return sortMercuryRowsStable(list, sort)
  }, [
    rows,
    accountFilter,
    kindFilter,
    sort,
    searchQueryNorm,
    nicknameCtx,
    bankingMercurySearchJobPersonEnrich,
  ])

  const nicknameManageIds = useMemo(() => {
    const ids = new Set<string>([...accountOptions, ...Object.keys(nicknameByAccount)])
    return Array.from(ids).sort()
  }, [accountOptions, nicknameByAccount])

  const debitCardIdsFromRows = useMemo(() => {
    const set = new Set<string>()
    for (const r of rows) {
      const id = mercuryDebitCardIdFromRaw(r.raw)
      if (id) set.add(id)
    }
    return Array.from(set).sort()
  }, [rows])

  // Door from Wheels (v2.2750): `?cards=<id>` opens the Debit cards modal on that card, `?cards=1` just opens it.
  useEffect(() => {
    const cards = searchParams.get('cards')
    if (!cards || !canAccessBanking) return
    setHighlightDebitCardId(cards === '1' ? null : cards.toLowerCase())
    setDebitCardNicknamesModalOpen(true)
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete('cards')
        return next
      },
      { replace: true },
    )
  }, [searchParams, setSearchParams, canAccessBanking])

  const debitCardManageIds = useMemo(() => {
    const ids = new Set<string>([...debitCardIdsFromRows, ...Object.keys(nicknameByDebitCard)])
    return Array.from(ids).sort()
  }, [debitCardIdsFromRows, nicknameByDebitCard])

  const kindOptions = useMemo(() => {
    const set = new Set<string>()
    for (const r of rows) set.add(r.kind)
    return Array.from(set).sort()
  }, [rows])

  const sortingFiltered = useMemo(() => filterMercuryRowsForSorting(rows, sortingConfig), [rows, sortingConfig])

  const sortingAfterSearch = useMemo(() => {
    if (searchQueryNorm === '') return sortingFiltered
    return sortingFiltered.filter((r) => {
      const haystack = buildMercuryTxSearchHaystackWithJobPerson(r, nicknameCtx, bankingMercurySearchJobPersonEnrich)
      return mercuryTxMatchesSearchQuery(haystack, searchQueryNorm)
    })
  }, [sortingFiltered, searchQueryNorm, nicknameCtx, bankingMercurySearchJobPersonEnrich])

  const sortingFilteredSorted = useMemo(
    () => sortMercuryRowsStable(sortingAfterSearch, sortingSort),
    [sortingAfterSearch, sortingSort],
  )

  const bankingOrgNoteFetchIds = useMemo(() => {
    if (bankingView.product !== 'mercury') return NO_MERCURY_TX_IDS_FOR_BANKING_NOTES
    if (bankingView.mercuryTab === 'sorting') return sortingFilteredSorted.map((r) => r.id)
    if (bankingView.mercuryTab === 'ledger' || bankingView.mercuryTab === 'drag_sort' || bankingView.mercuryTab === 'accounting')
      return filteredSorted.map((r) => r.id)
    return NO_MERCURY_TX_IDS_FOR_BANKING_NOTES
  }, [bankingView.product, bankingView.mercuryTab, filteredSorted, sortingFilteredSorted])

  const { orgNotesByTxId, updateOrgNoteLocal } = useMercuryOrgNotesByTxId(bankingOrgNoteFetchIds)

  const onOrgNoteUpdated = useCallback(
    (txId: string, body: string) => {
      updateOrgNoteLocal(txId, body)
    },
    [updateOrgNoteLocal],
  )

  // Rows that count toward the books: exclude transactions marked as duplicates.
  // The Ledger still *shows* excluded rows (struck-through) for audit, but they
  // don't feed totals or the other working tabs.
  const booksFilteredSorted = useMemo(
    () => filteredSorted.filter((r) => !r.duplicate_of_transaction_id),
    [filteredSorted],
  )
  const booksSortingFilteredSorted = useMemo(
    () => sortingFilteredSorted.filter((r) => !r.duplicate_of_transaction_id),
    [sortingFilteredSorted],
  )

  const totalAmount = useMemo(() => booksFilteredSorted.reduce((s, r) => s + Number(r.amount), 0), [booksFilteredSorted])
  const sortingTotalAmount = useMemo(
    () => booksSortingFilteredSorted.reduce((s, r) => s + Number(r.amount), 0),
    [booksSortingFilteredSorted],
  )

  const sortingUnmatchedCounts = useMemo(
    () => countSortingUnmatched(sortingAfterSearch, personIdByTxId, userIdByTxId, allocationsByTxId),
    [sortingAfterSearch, personIdByTxId, userIdByTxId, allocationsByTxId],
  )

  const setSortingSortForColumn = useCallback((key: SortKey) => {
    setSortingSort((s) =>
      s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'posted_at' ? 'desc' : 'asc' },
    )
  }, [])

  const handleSortingConfigSave = useCallback(
    (cfg: BankingSortingConfigV1) => {
      if (myRole !== 'dev' || !user?.id) return
      saveBankingSortingConfig(user.id, cfg)
      setSortingConfig(cfg)
    },
    [user?.id, myRole],
  )

  useEffect(() => {
    if (bankingView.product !== 'mercury') {
      if (expandedRowId !== null) setExpandedRowId(null)
      return
    }
    const visible = bankingView.mercuryTab === 'sorting' ? sortingFilteredSorted : filteredSorted
    if (expandedRowId && !visible.some((r) => r.id === expandedRowId)) {
      setExpandedRowId(null)
    }
  }, [bankingView.product, bankingView.mercuryTab, filteredSorted, sortingFilteredSorted, expandedRowId])

  async function handleSync() {
    setSyncing(true)
    setError(null)
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('sync-mercury-transactions', {
        body: { lookback_days: 90 },
      })
      if (fnErr) {
        setError(fnErr.message)
        return
      }
      const body = data as { error?: string; upserted?: number } | null
      if (body && typeof body.error === 'string') {
        setError(body.error)
        return
      }
      await loadRowsForActiveView()
      void Promise.all([loadNicknames(), loadDebitCardNicknames()])
      // New rows landed (or counterparties / amounts were updated). Bump the
      // tick so the Accounting tab's auto-apply ref resets and runs once
      // even if the unlabeled id set didn't change.
      setAutoApplyResetTick((t) => t + 1)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  async function handleBackfill(range: { start: string; end: string }) {
    setSyncing(true)
    setError(null)
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('sync-mercury-transactions', {
        body: { start: range.start, end: range.end },
      })
      if (fnErr) throw new Error(fnErr.message)
      const body = data as { error?: string; upserted?: number; start?: string; end?: string } | null
      if (body && typeof body.error === 'string') throw new Error(body.error)
      const upserted = typeof body?.upserted === 'number' ? body.upserted : 0
      const startLabel = body?.start ?? range.start
      const endLabel = body?.end ?? range.end
      showToast(
        `Synced ${upserted.toLocaleString()} transactions from Mercury (${startLabel} → ${endLabel}).`,
        'success',
      )
      await Promise.all([loadRowsForActiveView(), loadNicknames(), loadDebitCardNicknames()])
      setAutoApplyResetTick((t) => t + 1)
      setBackfillModalOpen(false)
      return { upserted, start: startLabel, end: endLabel }
    } finally {
      setSyncing(false)
    }
  }

  async function handleImportCsv(payload: ImportCsvSubmitPayload): Promise<ImportCsvResult> {
    const { data, error: fnErr } = await supabase.functions.invoke('import-manual-transactions', {
      body: payload,
    })
    if (fnErr) throw new Error(fnErr.message)
    const body = data as
      | { error?: string; ok?: boolean; accountId?: string; accountName?: string; inserted?: number; skipped?: number }
      | null
    if (body && typeof body.error === 'string') throw new Error(body.error)
    const inserted = typeof body?.inserted === 'number' ? body.inserted : 0
    const skipped = typeof body?.skipped === 'number' ? body.skipped : 0
    showToast(
      `Imported ${inserted.toLocaleString()} transaction${inserted === 1 ? '' : 's'} into “${payload.accountName}”` +
        (skipped > 0 ? ` (${skipped} duplicate${skipped === 1 ? '' : 's'} skipped).` : '.'),
      'success',
    )
    // Surface the new account + rows in the Ledger.
    await Promise.all([loadRowsForActiveView(), loadNicknames(), loadDebitCardNicknames()])
    return {
      accountId: body?.accountId ?? '',
      accountName: body?.accountName ?? payload.accountName,
      inserted,
      skipped,
    }
  }

  async function persistNickname(mercuryAccountId: string) {
    const raw = (nicknameDrafts[mercuryAccountId] ?? nicknameByAccount[mercuryAccountId] ?? '').trim()
    if (raw.length > 120) {
      showToast('Nickname must be at most 120 characters.', 'error')
      return
    }
    setSavingNicknameId(mercuryAccountId)
    try {
      if (!raw) {
        await withSupabaseRetry(async () => {
          return supabase.from('mercury_account_nicknames').delete().eq('mercury_account_id', mercuryAccountId)
        }, 'delete mercury_account_nickname')
      } else {
        await withSupabaseRetry(async () => {
          return supabase.from('mercury_account_nicknames').upsert(
            { mercury_account_id: mercuryAccountId, nickname: raw },
            { onConflict: 'mercury_account_id' },
          )
        }, 'save mercury_account_nickname')
      }
      setNicknameDrafts((d) => {
        const next = { ...d }
        delete next[mercuryAccountId]
        return next
      })
      await loadNicknames()
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not save nickname', 'error')
    } finally {
      setSavingNicknameId(null)
    }
  }

  async function clearNicknameRow(mercuryAccountId: string) {
    if (!nicknameByAccount[mercuryAccountId]) return
    setSavingNicknameId(mercuryAccountId)
    try {
      await withSupabaseRetry(async () => {
        return supabase.from('mercury_account_nicknames').delete().eq('mercury_account_id', mercuryAccountId)
      }, 'delete mercury_account_nickname')
      setNicknameDrafts((d) => {
        const next = { ...d }
        delete next[mercuryAccountId]
        return next
      })
      await loadNicknames()
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not clear nickname', 'error')
    } finally {
      setSavingNicknameId(null)
    }
  }

  async function persistDebitCardNickname(mercuryDebitCardId: string, nicknameField: string): Promise<boolean> {
    const raw = nicknameField.trim()
    if (raw.length > 120) {
      showToast('Nickname must be at most 120 characters.', 'error')
      return false
    }
    setSavingDebitCardNicknameId(mercuryDebitCardId)
    try {
      if (!raw) {
        await withSupabaseRetry(async () => {
          return supabase.from('mercury_debit_card_nicknames').delete().eq('mercury_debit_card_id', mercuryDebitCardId.toLowerCase())
        }, 'delete mercury_debit_card_nickname')
      } else {
        await withSupabaseRetry(async () => {
          return supabase.from('mercury_debit_card_nicknames').upsert(
            { mercury_debit_card_id: mercuryDebitCardId.toLowerCase(), nickname: raw },
            { onConflict: 'mercury_debit_card_id' },
          )
        }, 'save mercury_debit_card_nickname')
      }
      await loadDebitCardNicknames()
      return true
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not save debit card nickname', 'error')
      return false
    } finally {
      setSavingDebitCardNicknameId(null)
    }
  }

  async function clearDebitCardNicknameRow(mercuryDebitCardId: string): Promise<boolean> {
    if (!nicknameByDebitCard[mercuryDebitCardId]) return false
    setSavingDebitCardNicknameId(mercuryDebitCardId)
    try {
      await withSupabaseRetry(async () => {
        return supabase.from('mercury_debit_card_nicknames').delete().eq('mercury_debit_card_id', mercuryDebitCardId.toLowerCase())
      }, 'delete mercury_debit_card_nickname')
      await loadDebitCardNicknames()
      return true
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not clear debit card nickname', 'error')
      return false
    } finally {
      setSavingDebitCardNicknameId(null)
    }
  }

  if (myRole === null) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading…</div>
  }

  if (!canAccessBanking) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading…</div>
  }

  return (
    <div style={{ padding: '0 2rem 2rem', maxWidth: 1200 }}>
      <div
        style={{
          marginBottom: '1.5rem',
          borderBottom: '1px solid var(--border)',
          paddingBottom: '1rem',
        }}
      >
        {isDevBanking ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              marginBottom: '0.5rem',
            }}
          >
            <div style={{ flex: 1, minWidth: 0, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <div
                role="tablist"
                aria-label="Banking data source"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0,
                  width: 'max-content',
                }}
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={bankingView.product === 'mercury'}
                  id="banking-product-mercury"
                  onClick={() => setBankingProduct('mercury')}
                  style={pageTabStyle(bankingView.product === 'mercury')}
                >
                  Mercury
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={bankingView.product === 'stripe'}
                  id="banking-product-stripe"
                  onClick={() => setBankingProduct('stripe')}
                  style={pageTabStyle(bankingView.product === 'stripe')}
                >
                  Stripe
                </button>
              </div>
            </div>
            <h1
              style={{
                flexShrink: 0,
                margin: 0,
                marginLeft: '0.5rem',
                fontSize: '1.5rem',
                fontWeight: 700,
                color: 'var(--text-strong)',
              }}
            >
              Banking
            </h1>
          </div>
        ) : null}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}
              role="presentation"
            >
              <div
                role="tablist"
                aria-label="Banking sections"
                style={{ display: 'flex', alignItems: 'center', gap: 0, width: 'max-content' }}
              >
                {bankingView.product === 'mercury' ? (
                  <>
                    {isDevBanking ? (
                      <button
                        type="button"
                        role="tab"
                        aria-selected={bankingView.mercuryTab === 'ledger'}
                        id="banking-tab-ledger"
                        onClick={() => setMercurySubTab('ledger')}
                        style={pageTabStyle(bankingView.mercuryTab === 'ledger')}
                      >
                        Ledger
                      </button>
                    ) : null}
                    <button
                      type="button"
                      role="tab"
                      aria-selected={bankingView.mercuryTab === 'sorting'}
                      id="banking-tab-sorting"
                      onClick={() => setMercurySubTab('sorting')}
                      style={pageTabStyle(bankingView.mercuryTab === 'sorting')}
                    >
                      User Sort
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={bankingView.mercuryTab === 'drag_sort'}
                      id="banking-tab-drag-sort"
                      onClick={() => setMercurySubTab('drag_sort')}
                      style={pageTabStyle(bankingView.mercuryTab === 'drag_sort')}
                    >
                      Drag Sort
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={bankingView.mercuryTab === 'accounting'}
                      id="banking-tab-accounting"
                      onClick={() => setMercurySubTab('accounting')}
                      style={pageTabStyle(bankingView.mercuryTab === 'accounting')}
                    >
                      Accounting
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={bankingView.mercuryTab === 'user_review'}
                      id="banking-tab-user-review"
                      onClick={() => setMercurySubTab('user_review')}
                      style={pageTabStyle(bankingView.mercuryTab === 'user_review')}
                    >
                      Card Review
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={bankingView.mercuryTab === 'category_review'}
                      id="banking-tab-category-review"
                      onClick={() => setMercurySubTab('category_review')}
                      style={pageTabStyle(bankingView.mercuryTab === 'category_review')}
                    >
                      Category Review
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={bankingView.mercuryTab === 'reconciliation'}
                      id="banking-tab-reconciliation"
                      onClick={() => setMercurySubTab('reconciliation')}
                      style={pageTabStyle(bankingView.mercuryTab === 'reconciliation')}
                    >
                      Reconciliation
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={bankingView.mercuryTab === 'visuals'}
                      id="banking-tab-visuals"
                      onClick={() => setMercurySubTab('visuals')}
                      style={pageTabStyle(bankingView.mercuryTab === 'visuals')}
                    >
                      Visuals
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={bankingView.stripeTab === 'invoices'}
                      id="banking-tab-stripe-invoices"
                      onClick={() => setStripeSubTab('invoices')}
                      style={pageTabStyle(bankingView.stripeTab === 'invoices')}
                    >
                      Invoices
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={bankingView.stripeTab === 'data'}
                      id="banking-tab-stripe-data"
                      onClick={() => setStripeSubTab('data')}
                      style={pageTabStyle(bankingView.stripeTab === 'data')}
                    >
                      Data
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
          {!isDevBanking ? (
            <h1
              style={{
                flexShrink: 0,
                margin: 0,
                marginLeft: '0.5rem',
                fontSize: '1.5rem',
                fontWeight: 700,
                color: 'var(--text-strong)',
              }}
            >
              Banking
            </h1>
          ) : null}
          {bankingView.product === 'mercury' && bankingView.mercuryTab === 'sorting' && (isDevBanking || canAccessBanking) ? (
            <div
              role="region"
              aria-label="Banking User Sort tools"
              style={{
                alignSelf: 'flex-end',
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: '0.65rem',
                maxWidth: 'min(calc(100vw - 2rem), 28rem)',
                padding: '0.5rem 0.65rem',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.08), 0 2px 4px -2px rgba(0,0,0,0.06)',
              }}
            >
              {isDevBanking ? (
                <button
                  type="button"
                  onClick={() => setSortingConfigModalOpen(true)}
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: 4,
                    border: '1px solid #1d4ed8',
                    background: 'var(--bg-blue-tint)',
                    color: 'var(--text-blue-700)',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '0.875rem',
                    flexShrink: 0,
                  }}
                >
                  Configuration
                </button>
              ) : null}
              {canAccessBanking ? (
                <>
                  <BankingNicknamesMenu
                    menuOpen={nicknamesMenuOpen}
                    onMenuOpenChange={setNicknamesMenuOpen}
                    showAccount={isDevBanking}
                    showDebit
                    onOpenAccount={() => setNicknamesModalOpen(true)}
                    onOpenDebit={() => setDebitCardNicknamesModalOpen(true)}
                  />
                </>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {bankingView.product === 'mercury' && bankingView.mercuryTab === 'sorting' && (
        <div role="tabpanel" id="banking-panel-mercury-sorting" aria-labelledby="banking-tab-sorting">
          {!isDevBanking ? (
            <p
              style={{
                margin: '0 0 0.85rem',
                color: 'var(--text-600)',
                maxWidth: 720,
                fontSize: '0.9375rem',
              }}
            >
              Read-only slice of Mercury transactions for sorting work (default date range and filters). Ask a developer if this list
              should use different kinds, accounts, or dates.
            </p>
          ) : null}
          <div style={{ marginBottom: '1rem', minWidth: 0 }}>
            <div
              style={{
                display: 'flex',
                flexDirection: 'row',
                flexWrap: 'wrap',
                alignItems: 'flex-end',
                gap: '1rem',
                width: '100%',
                minWidth: 0,
              }}
            >
              <label
                style={{
                  display: 'block',
                  flex: '1 1 8rem',
                  minWidth: 0,
                }}
              >
                <input
                  type="search"
                  value={bankingSearchText}
                  onChange={(e) => setBankingSearchText(e.target.value)}
                  autoComplete="off"
                  placeholder="Counterparty, memo, id, job, person…"
                  aria-label="Search transactions"
                  style={{ width: '100%', minWidth: 0, padding: '6px 8px', border: '1px solid var(--border-strong)', borderRadius: 4, boxSizing: 'border-box' }}
                />
              </label>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: '1rem',
                  flexShrink: 0,
                }}
              >
                {isDevBanking ? (
                  <button
                    type="button"
                    onClick={() => void handleSync()}
                    disabled={syncing}
                    style={{
                      padding: '0.5rem 1rem',
                      borderRadius: 4,
                      border: '1px solid #1d4ed8',
                      background: '#2563eb',
                      color: 'white',
                      cursor: syncing ? 'wait' : 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    {syncing ? 'Syncing from Mercury…' : 'Refresh from Mercury'}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => void Promise.all([loadRowsForActiveView(), loadNicknames(), loadDebitCardNicknames()])}
                  disabled={loading}
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: 4,
                    border: '1px solid var(--border-strong)',
                    background: 'var(--surface)',
                    cursor: loading ? 'wait' : 'pointer',
                    flexShrink: 0,
                  }}
                >
                  Reload table
                </button>
              </div>
            </div>
          </div>

          {error && (
            <div
              style={{
                marginBottom: '1rem',
                padding: '0.75rem 1rem',
                background: 'var(--bg-red-tint)',
                border: '1px solid #fecaca',
                borderRadius: 4,
                color: 'var(--text-red-800)',
              }}
            >
              {error}
            </div>
          )}

          <div style={{ display: 'flex', flexWrap: 'wrap', marginBottom: '1rem', alignItems: 'center', gap: '0.75rem 1.25rem' }}>
            <div
              style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem 1.25rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}
            >
              <span
                title="Rows in this list with no person or user linked (Person column shows Unassigned)."
                style={{ whiteSpace: 'nowrap' }}
              >
                Without person:{' '}
                <strong style={{ color: 'var(--text-slate-900)', fontWeight: 600 }}>{sortingUnmatchedCounts.withoutPerson}</strong>
              </span>
              <span
                title="Rows in this list with no job allocations (Jobs column shows Not split)."
                style={{ whiteSpace: 'nowrap' }}
              >
                Not split to jobs:{' '}
                <strong style={{ color: 'var(--text-slate-900)', fontWeight: 600 }}>{sortingUnmatchedCounts.withoutJobSplit}</strong>
              </span>
            </div>
            <div style={{ marginLeft: 'auto', fontWeight: 600 }}>
              Visible total: {formatCurrency(sortingTotalAmount)} ({booksSortingFilteredSorted.length} of {rows.length} loaded)
              {rowsTruncated ? (
                <span
                  title={`Only the newest ${MERCURY_TRANSACTIONS_BANKING_LIST_LIMIT.toLocaleString()} transactions are loaded. Older transactions are not shown here.`}
                  style={{ marginLeft: '0.5rem', fontWeight: 600, color: 'var(--text-amber-700)' }}
                >
                  ⚠ capped at {MERCURY_TRANSACTIONS_BANKING_LIST_LIMIT.toLocaleString()}
                </span>
              ) : null}
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '2rem' }}>Loading…</div>
          ) : (
            <BankingMercuryTable
              displayRows={booksSortingFilteredSorted}
              sort={sortingSort}
              onSortColumn={setSortingSortForColumn}
              expandedRowId={expandedRowId}
              setExpandedRowId={setExpandedRowId}
              nicknameByAccount={nicknameByAccount}
              nicknameByDebitCard={nicknameByDebitCard}
              emptyMessage={
                rows.length > 0 && searchQueryNorm !== ''
                  ? 'No transactions match your search.'
                  : isDevBanking
                    ? 'No rows match your sorting configuration. Adjust Configuration or sync from Mercury.'
                    : 'No rows match the default sorting slice. A developer can change filters on Banking Ledger (Configuration).'
              }
              showAllocations={canAccessBanking}
              allocationsByTxId={allocationsByTxId}
              personIdByTxId={personIdByTxId}
              userIdByTxId={userIdByTxId}
              personNameById={personNameById}
              userNameById={userNameById}
              onEditAllocations={(r) => void openAllocModalForMercuryRow(r)}
              allocationsAfterCounterparty
              hideKindColumn
              debitAndAccountAfterAmount
              counterpartyNoteCombined
              orgNotesByTxId={orgNotesByTxId}
              onOrgNoteUpdated={onOrgNoteUpdated}
            />
          )}
        </div>
      )}

      {bankingView.product === 'mercury' && bankingView.mercuryTab === 'drag_sort' && canAccessBanking && user?.id ? (
        <div role="tabpanel" id="banking-panel-mercury-drag-sort" aria-labelledby="banking-tab-drag-sort">
          <BankingMercuryDragSortTab
            userId={user.id}
            filteredTransactions={booksFilteredSorted}
            loading={loading}
            accountFilter={accountFilter}
            setAccountFilter={setAccountFilter}
            kindFilter={kindFilter}
            setKindFilter={setKindFilter}
            bankingSearchText={bankingSearchText}
            setBankingSearchText={setBankingSearchText}
            accountOptions={accountOptions}
            kindOptions={kindOptions}
            nicknameByAccount={nicknameByAccount}
            nicknameByDebitCard={nicknameByDebitCard}
            loadError={error}
            allocationsByTxId={allocationsByTxId}
            personIdByTxId={personIdByTxId}
            userIdByTxId={userIdByTxId}
            personNameById={personNameById}
            userNameById={userNameById}
            jobLabelById={jobLabelByIdBanking}
            onEditAllocations={(r) => void openAllocModalForMercuryRow(r)}
            orgNotesByTxId={orgNotesByTxId}
            onOrgNoteUpdated={onOrgNoteUpdated}
          />
        </div>
      ) : null}

      {bankingView.product === 'mercury' && bankingView.mercuryTab === 'accounting' && canAccessBanking && user?.id ? (
        <div role="tabpanel" id="banking-panel-mercury-accounting" aria-labelledby="banking-tab-accounting">
          <BankingMercuryAccountingTab
            userId={user.id}
            attributionOptions={attributionOptions}
            filteredTransactions={booksFilteredSorted}
            loading={loading}
            loadError={error}
            mercurySearchNicknameCtx={nicknameCtx}
            mercurySearchEnrich={bankingMercurySearchJobPersonEnrich}
            allocationsByTxId={allocationsByTxId}
            personIdByTxId={personIdByTxId}
            userIdByTxId={userIdByTxId}
            personNameById={personNameById}
            userNameById={userNameById}
            jobLabelById={jobLabelByIdBanking}
            nicknameByDebitCard={nicknameByDebitCard}
            onEditAllocations={(r) => void openAllocModalForMercuryRow(r)}
            orgNotesByTxId={orgNotesByTxId}
            onOrgNoteUpdated={onOrgNoteUpdated}
            hideLabeledTransactions={hideLabeledTransactions}
            onHideLabeledTransactionsChange={onHideLabeledTransactionsChange}
            applyRulesByDefault={applyRulesByDefault}
            onApplyRulesByDefaultChange={onApplyRulesByDefaultChange}
            autoApplyResetTick={autoApplyResetTick}
            approveByDefault={approveByDefault}
            onApproveByDefaultChange={onApproveByDefaultChange}
            onAfterAssignmentChange={() => void loadRowsForActiveView({ silent: true })}
            onAttributionChange={(txId, patch) => {
              setPersonIdByTxId((prev) => new Map(prev).set(txId, patch.personId))
              setUserIdByTxId((prev) => new Map(prev).set(txId, patch.userId))
              if (patch.personId && patch.displayName) {
                setPersonNameById((prev) => ({ ...prev, [patch.personId as string]: patch.displayName as string }))
              }
              if (patch.userId && patch.displayName) {
                setUserNameById((prev) => ({ ...prev, [patch.userId as string]: patch.displayName as string }))
              }
            }}
            labeledHasMore={isAccountingLabeledView && labeledHasMore}
            labeledLoadingMore={labeledLoadingMore}
            onLoadMoreLabeled={() => void loadLabeledNextPage()}
          />
        </div>
      ) : null}

      {bankingView.product === 'mercury' && bankingView.mercuryTab === 'user_review' && canAccessBanking ? (
        <div role="tabpanel" id="banking-panel-mercury-user-review" aria-labelledby="banking-tab-user-review">
          <BankingMercuryUserReviewTab
            mercurySearchNicknameCtx={nicknameCtx}
            attributionOptions={attributionOptions}
            recentPersonPicksStorageKey={user?.id ?? null}
            onAttributionChanged={() => {
              void loadMercuryAllocations()
            }}
          />
        </div>
      ) : null}

      {bankingView.product === 'mercury' && bankingView.mercuryTab === 'category_review' && canAccessBanking ? (
        <div role="tabpanel" id="banking-panel-mercury-category-review" aria-labelledby="banking-tab-category-review">
          <BankingMercuryCategoryReviewTab
            filteredTransactions={booksFilteredSorted}
            loading={loading}
            loadError={error}
            mercurySearchNicknameCtx={nicknameCtx}
            userIdByTxId={userIdByTxId}
            personIdByTxId={personIdByTxId}
            userNameById={userNameById}
            personNameById={personNameById}
            attributionOptions={attributionOptions}
            recentPersonPicksStorageKey={user?.id ?? null}
            onAttributionChanged={() => {
              void loadMercuryAllocations()
            }}
          />
        </div>
      ) : null}

      {bankingView.product === 'mercury' && bankingView.mercuryTab === 'reconciliation' && canAccessBanking ? (
        <div role="tabpanel" id="banking-panel-mercury-reconciliation" aria-labelledby="banking-tab-reconciliation">
          <BankingMercuryReconciliationTab />
        </div>
      ) : null}

      {bankingView.product === 'mercury' && bankingView.mercuryTab === 'visuals' && canAccessBanking ? (
        <div role="tabpanel" id="banking-panel-mercury-visuals" aria-labelledby="banking-tab-visuals">
          <BankingMercuryVisualsTab />
        </div>
      ) : null}

      {bankingView.product === 'mercury' && bankingView.mercuryTab === 'ledger' && isDevBanking && (
        <div role="tabpanel" id="banking-panel-mercury-ledger" aria-labelledby="banking-tab-ledger">
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
              marginBottom: '1.5rem',
            }}
          >
            <div
              style={{
                marginLeft: 'auto',
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: '1rem',
                flexShrink: 0,
              }}
            >
              {canAccessBanking ? (
                <BankingNicknamesMenu
                  menuOpen={nicknamesMenuOpen}
                  onMenuOpenChange={setNicknamesMenuOpen}
                  showAccount={isDevBanking}
                  showDebit
                  onOpenAccount={() => setNicknamesModalOpen(true)}
                  onOpenDebit={() => setDebitCardNicknamesModalOpen(true)}
                />
              ) : null}
              <BankingLedgerAdvancedMenu
                menuOpen={ledgerAdvancedMenuOpen}
                onMenuOpenChange={setLedgerAdvancedMenuOpen}
                syncing={syncing}
                loading={loading}
                onRefreshFromMercury={() => void handleSync()}
                onReloadTable={() => void Promise.all([loadRowsForActiveView(), loadNicknames(), loadDebitCardNicknames()])}
                onBackfillFromMercury={isDevBanking ? () => setBackfillModalOpen(true) : undefined}
                onImportCsv={
                  myRole === 'dev' || myRole === 'master_technician'
                    ? () => setImportCsvModalOpen(true)
                    : undefined
                }
                onManageManualAccounts={
                  myRole === 'dev' || myRole === 'master_technician'
                    ? () => setManualAccountsModalOpen(true)
                    : undefined
                }
              />
            </div>
          </div>

          {error && (
            <div
              style={{
                marginBottom: '1rem',
                padding: '0.75rem 1rem',
                background: 'var(--bg-red-tint)',
                border: '1px solid #fecaca',
                borderRadius: 4,
                color: 'var(--text-red-800)',
              }}
            >
              {error}
            </div>
          )}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.65rem', marginBottom: '1rem', alignItems: 'center' }}>
            <select
              value={accountFilter}
              onChange={(e) => setAccountFilter(e.target.value)}
              aria-label="Filter by account ID"
              style={{
                minWidth: 144,
                maxWidth: 220,
                padding: '3px 6px',
                fontSize: '0.8125rem',
                color: 'var(--text-slate-500)',
                backgroundColor: 'var(--bg-subtle)',
                border: '1px solid var(--border)',
                borderRadius: 4,
              }}
            >
              <option value="">Filter by Account ID</option>
              {accountOptions.map((id) => (
                <option key={id} value={id}>
                  {nicknameByAccount[id] ? `${nicknameByAccount[id]} (${shortUuidPrefix(id)})` : id}
                </option>
              ))}
            </select>
            <select
              value={kindFilter}
              onChange={(e) => setKindFilter(e.target.value)}
              aria-label="Filter by kind"
              style={{
                minWidth: 108,
                maxWidth: 168,
                padding: '3px 6px',
                fontSize: '0.8125rem',
                color: 'var(--text-slate-500)',
                backgroundColor: 'var(--bg-subtle)',
                border: '1px solid var(--border)',
                borderRadius: 4,
              }}
            >
              <option value="">Filter by kind</option>
              {kindOptions.map((k) => (
                <option key={k} value={k}>
                  {formatMercuryKind(k)}
                </option>
              ))}
            </select>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Search transactions</span>
              <input
                type="search"
                value={bankingSearchText}
                onChange={(e) => setBankingSearchText(e.target.value)}
                autoComplete="off"
                placeholder="Counterparty, memo, id, job, person…"
                aria-label="Search transactions"
                style={{ minWidth: 280, padding: '6px 8px', border: '1px solid var(--border-strong)', borderRadius: 4 }}
              />
            </label>
            <div style={{ marginLeft: 'auto', fontWeight: 600 }}>
              Filtered total: {formatCurrency(totalAmount)} ({filteredSorted.length} of {rows.length} loaded)
              {rowsTruncated ? (
                <span
                  title={`Only the newest ${MERCURY_TRANSACTIONS_BANKING_LIST_LIMIT.toLocaleString()} transactions are loaded. Older transactions are not shown here.`}
                  style={{ marginLeft: '0.5rem', fontWeight: 600, color: 'var(--text-amber-700)' }}
                >
                  ⚠ capped at {MERCURY_TRANSACTIONS_BANKING_LIST_LIMIT.toLocaleString()}
                </span>
              ) : null}
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '2rem' }}>Loading…</div>
          ) : (
            <BankingMercuryTable
              displayRows={filteredSorted}
              sort={sort}
              onSortColumn={setSortForColumn}
              expandedRowId={expandedRowId}
              setExpandedRowId={setExpandedRowId}
              nicknameByAccount={nicknameByAccount}
              nicknameByDebitCard={nicknameByDebitCard}
              emptyMessage={
                rows.length > 0 && searchQueryNorm !== ''
                  ? 'No transactions match your search.'
                  : 'No rows yet. Run Refresh from Mercury.'
              }
              showAllocations={canAccessBanking}
              allocationsByTxId={allocationsByTxId}
              personIdByTxId={personIdByTxId}
              userIdByTxId={userIdByTxId}
              personNameById={personNameById}
              userNameById={userNameById}
              onEditAllocations={(r) => void openAllocModalForMercuryRow(r)}
              orgNotesByTxId={orgNotesByTxId}
              onOrgNoteUpdated={onOrgNoteUpdated}
            />
          )}
        </div>
      )}

      {bankingView.product === 'stripe' && isDevBanking && bankingView.stripeTab === 'invoices' && (
        <div role="tabpanel" id="banking-panel-stripe-invoices" aria-labelledby="banking-tab-stripe-invoices">
          <BankingStripeInvoicesPanel />
        </div>
      )}

      {bankingView.product === 'stripe' && isDevBanking && bankingView.stripeTab === 'data' && (
        <div role="tabpanel" id="banking-panel-stripe-data" aria-labelledby="banking-tab-stripe-data">
          <BankingStripeWebhookEventsPanel />
        </div>
      )}

      {isDevBanking ? (
        <BankingAccountNicknamesModal
          open={nicknamesModalOpen}
          onClose={() => setNicknamesModalOpen(false)}
          accountIds={nicknameManageIds}
          nicknameByAccount={nicknameByAccount}
          nicknameDrafts={nicknameDrafts}
          setNicknameDrafts={setNicknameDrafts}
          savingNicknameId={savingNicknameId}
          onSave={(id) => void persistNickname(id)}
          onClear={(id) => void clearNicknameRow(id)}
        />
      ) : null}

      {canAccessBanking && (
        <BankingDebitCardsModal
          open={debitCardNicknamesModalOpen}
          onClose={() => {
            setRecentTxDebitCardId(null)
            setHighlightDebitCardId(null)
            setDebitCardNicknamesModalOpen(false)
          }}
          debitCardIds={debitCardManageIds}
          nicknameByDebitCard={nicknameByDebitCard}
          roleByDebitCard={roleByDebitCard}
          savingNicknameId={savingDebitCardNicknameId}
          onSaveNickname={(id, nickname) => persistDebitCardNickname(id, nickname)}
          onClearNickname={(id) => clearDebitCardNicknameRow(id)}
          onDirectoryChanged={loadDebitCardNicknames}
          usersOptions={usersSelectOptions}
          authUserId={user?.id ?? null}
          onLinksChanged={() => {
            void loadMercuryAllocations()
          }}
          onOpenRecentTransactions={(id) => setRecentTxDebitCardId(id)}
          recentPreviewOpen={recentTxDebitCardId !== null}
          highlightCardId={highlightDebitCardId}
        />
      )}

      <BankingDebitCardRecentTxModal
        open={recentTxDebitCardId !== null}
        onClose={() => setRecentTxDebitCardId(null)}
        debitCardId={recentTxDebitCardId}
        rows={rows}
        cap={DEBIT_CARD_RECENT_TX_CAP}
      />

      {isDevBanking ? (
        <MercuryBackfillModal
          open={backfillModalOpen}
          onClose={() => setBackfillModalOpen(false)}
          onSubmit={handleBackfill}
        />
      ) : null}

      {(myRole === 'dev' || myRole === 'master_technician') && (
        <MercuryImportCsvModal
          open={importCsvModalOpen}
          onClose={() => setImportCsvModalOpen(false)}
          onSubmit={handleImportCsv}
        />
      )}

      {(myRole === 'dev' || myRole === 'master_technician') && (
        <ManualAccountsModal
          open={manualAccountsModalOpen}
          onClose={() => setManualAccountsModalOpen(false)}
          onChanged={() => void Promise.all([loadRowsForActiveView(), loadNicknames(), loadDebitCardNicknames()])}
        />
      )}

      {canAccessBanking && (
        <MercuryTransactionAllocationsModal
          open={allocModalTx !== null}
          onClose={() => setAllocModalTx(null)}
          transaction={allocModalTx}
          initialAllocations={allocModalTx ? allocationsByTxId.get(allocModalTx.id) ?? [] : []}
          initialPersonId={allocModalTx ? personIdByTxId.get(allocModalTx.id) ?? null : null}
          initialUserId={allocModalTx ? userIdByTxId.get(allocModalTx.id) ?? null : null}
          legacyPersonDisplayName={
            allocModalTx
              ? (() => {
                  const pid = personIdByTxId.get(allocModalTx.id) ?? null
                  const uid = userIdByTxId.get(allocModalTx.id) ?? null
                  return pid && !uid ? personNameById[pid] ?? null : null
                })()
              : null
          }
          jobLabelById={jobLabelByIdBanking}
          usersOptions={usersSelectOptions}
          nicknameByDebitCard={nicknameByDebitCard}
          nicknameByAccount={nicknameByAccount}
          recentPersonPicksStorageKey={user?.id ?? null}
          onSaved={(_detail: MercuryAllocSavedDetail) => {
            void loadMercuryAllocations()
          }}
        />
      )}

      {isDevBanking && (
        <BankingSortingConfigModal
          open={sortingConfigModalOpen}
          onClose={() => setSortingConfigModalOpen(false)}
          initialConfig={sortingConfig}
          kindChoices={kindOptions}
          accountChoices={accountOptions}
          nicknameByAccount={nicknameByAccount}
          debitCardChoices={debitCardManageIds}
          nicknameByDebitCard={nicknameByDebitCard}
          onSave={handleSortingConfigSave}
        />
      )}

    </div>
  )
}
