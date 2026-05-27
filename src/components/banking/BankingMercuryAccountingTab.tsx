import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Database, Json } from '../../types/database'
import { supabase } from '../../lib/supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { useToastContext } from '../../contexts/ToastContext'
import { mercuryBankDescriptionFromRaw } from '../../lib/mercuryBankDescriptionFromRaw'
import {
  buildMercuryTxSearchHaystackWithJobPerson,
  mercuryTxMatchesSearchQuery,
  type BankingMercurySearchNicknames,
} from '../../lib/bankingMercurySearch'
import type { MercuryJobSplit } from '../MercuryTransactionAllocationsModal'
import { ensureDragSortDefaultLabels, isInternalTransfersLabel } from '../../lib/dragSortDefaultLabels'
import {
  clearAccountingLedgerFiltersStorage,
  readAccountingLedgerFiltersRaw,
  readAccountingLedgerSort,
  writeAccountingLedgerFiltersRaw,
  writeAccountingLedgerSort,
} from '../../lib/bankingDragSortStorage'
import {
  compareMercuryLedgerRows,
  DEFAULT_MERCURY_LEDGER_SORT,
  nextMercuryLedgerSortState,
  type MercuryLedgerSortState,
} from '../../lib/bankingMercuryLedgerTableSort'
import {
  activeBankingAccountingLedgerFilterCount,
  defaultBankingAccountingLedgerFilters,
  filterRowsByAccountingLedgerFilters,
  parseBankingAccountingLedgerFiltersJson,
  serializeBankingAccountingLedgerFiltersForStorage,
  withLedgerFilterKindsNormalizedIfAllSelected,
  type BankingAccountingLedgerFiltersV1,
} from '../../lib/bankingAccountingLedgerFilters'
import {
  counterpartyFrequenciesAboveMin,
  counterpartyFrequencyCountMap,
  counterpartyNameFrequencyKey,
} from '../../lib/bankingMercuryCounterpartyFrequency'
import {
  accountingRuleLabelDisplayText,
  accountingRuleRowMatchesSearch,
  sortAccountingRulesForTable,
} from '../../lib/accountingRulesTableSearch'
import { mercuryTxDragSortBankNoteRowVisible } from './MercuryTxNotesDisclosure'
import {
  type AccountingLabelRuleCriteriaV1,
  accountingRuleEffectiveClauseCount,
  defaultAccountingLabelRuleCriteriaV1,
  matchAccountingLabelRuleCriteria,
  parseAccountingLabelRuleCriteria,
} from '../../lib/accountingLabelRuleMatch'
import { buildAccountingRuleOverlapReport } from '../../lib/accountingRuleOverlap'
import {
  buildAccountingRulesToInsert,
  type ApplyRulesToInsertRow,
} from '../../lib/applyAccountingRulesPreflight'
import {
  buildAutoApplySignature,
  shouldAutoApplyAccountingRules,
} from '../../lib/accountingApplyRulesAutoTrigger'
import {
  buildApproveByDefaultSignature,
  shouldAutoApproveAccountingSuggestions,
} from '../../lib/accountingApproveByDefaultAutoTrigger'
import { BankingMercuryAccountingOverlapsModal } from './BankingMercuryAccountingOverlapsModal'
import { BankingMercuryAccountingApplyRulesConfirmModal } from './BankingMercuryAccountingApplyRulesConfirmModal'
import { BankingMercuryAccountingRulesModal } from './BankingMercuryAccountingRulesModal'
import { AccountingApprovalCard } from './AccountingApprovalCard'
import {
  BankingMercuryDragSortLedgerNotesEditorRow,
  BankingMercuryDragSortLedgerNotesPreviewRow,
  BankingMercuryDragSortLedgerRow,
  BankingMercuryDragSortLedgerThead,
  dragSortJobPrimaryLine,
  dragSortPersonSubline,
  formatBankingDate,
  formatUsd,
  mercuryTxCombinedNoteInlineText,
  mercuryTxPipeLineAriaLabel,
} from './bankingMercuryDragSortLedger'
import { MERCURY_TRANSACTIONS_BANKING_LIST_COLUMNS } from '../../lib/fetchMercuryTransactionRaws'
import {
  AccountingRuleFormModal,
  emptyRuleForm,
  suggestedRuleNameFromCounterparty,
  type AccountingRuleFormState,
  type AccountingRuleSaveDraft,
} from './AccountingRuleFormModal'
import { AccountingLabelQuickAssignModal } from './AccountingLabelQuickAssignModal'
import { BankingMercuryAccountingLedgerFilterModal } from './BankingMercuryAccountingLedgerFilterModal'
import { MercuryCounterpartyFrequencyModal } from './MercuryCounterpartyFrequencyModal'

type MercuryTxRow = Database['public']['Tables']['mercury_transactions']['Row']
type DragLabelRow = Database['public']['Tables']['mercury_drag_sort_labels']['Row']
type RuleRow = Database['public']['Tables']['mercury_accounting_label_rules']['Row']
type SuggestionRow = Database['public']['Tables']['mercury_accounting_label_suggestions']['Row']

export type BankingMercuryAccountingMercurySearchEnrich = {
  allocationsByTxId: Map<string, MercuryJobSplit[]>
  jobLabelById: Record<string, string>
  personIdByTxId: Map<string, string | null>
  userIdByTxId: Map<string, string | null>
  personNameById: Record<string, string>
  userNameById: Record<string, string>
}

export type BankingMercuryAccountingTabProps = {
  userId: string
  filteredTransactions: MercuryTxRow[]
  loading: boolean
  loadError: string | null
  mercurySearchNicknameCtx: BankingMercurySearchNicknames
  mercurySearchEnrich: BankingMercuryAccountingMercurySearchEnrich
  allocationsByTxId: Map<string, MercuryJobSplit[]>
  personIdByTxId: Map<string, string | null>
  userIdByTxId: Map<string, string | null>
  personNameById: Record<string, string>
  userNameById: Record<string, string>
  jobLabelById: Record<string, string>
  nicknameByDebitCard: Record<string, string>
  onEditAllocations?: (r: MercuryTxRow) => void
  orgNotesByTxId: Map<string, string>
  onOrgNoteUpdated: (txId: string, body: string) => void
  /**
   * **Hide labeled transactions** toggle. Lifted to `Banking.tsx` so the
   * parent's tab-aware `loadRowsForActiveView` can swap to the unlabeled-only
   * RPC when this is on (the default for the Accounting tab).
   */
  hideLabeledTransactions: boolean
  /** Toolbar checkbox handler; parent persists per-user. */
  onHideLabeledTransactionsChange: (v: boolean) => void
  /**
   * **Apply rules by default** toggle (RECENT_FEATURES v2.580). When on,
   * the auto-apply effect runs `computeApplyRulesPreflight` →
   * `executeApplyRules` after every successful transaction load, bypassing
   * the 200-match confirm modal but preserving the 500-per-click cap.
   * Lifted to `Banking.tsx` for per-user persistence.
   */
  applyRulesByDefault: boolean
  onApplyRulesByDefaultChange: (v: boolean) => void
  /**
   * Monotonic counter the parent bumps after `handleSync` and
   * `handleBackfill`. The child watches it in a ref-reset effect that
   * nulls `lastAutoAppliedSignatureRef`, so a fresh Mercury sync re-fires
   * one auto-apply pass even when the unlabeled id set didn't change
   * (e.g. a sync that only updated counterparties).
   */
  autoApplyResetTick: number
  /**
   * **Approve by default** toggle (RECENT_FEATURES v2.581). When on, the
   * Approvals section auto-runs `handleApproveAll` whenever a new pending
   * suggestion appears. Internal Transfers conflicts (job-split rows) are
   * still skipped by `handleApproveAll` itself, so those persist in the
   * pending list and surface for manual review. Lifted to `Banking.tsx`
   * for per-user persistence.
   */
  approveByDefault: boolean
  onApproveByDefaultChange: (v: boolean) => void
  /**
   * Called after a successful mutation that adds or removes a row in
   * `mercury_transaction_drag_sort_assignments` (manual label apply / clear,
   * approve, approve all). Lets the parent re-fire `loadRowsForActiveView`
   * so the unlabeled-only list shrinks (or grows) in place. Reject and
   * Apply-rules don't touch the assignments table directly, so they do not
   * call this.
   */
  onAfterAssignmentChange?: () => void
}

type PendingApproval = {
  suggestionId: string
  txId: string
  tx: MercuryTxRow | null
  ruleId: string
  ruleName: string
  suggestedLabelId: string
  suggestedLabelName: string
}

function criteriaToJson(c: AccountingLabelRuleCriteriaV1): Json {
  return c as unknown as Json
}

function ruleRowToForm(rule: RuleRow, fallbackLabelId: string): AccountingRuleFormState {
  const parsed = parseAccountingLabelRuleCriteria(rule.criteria) ?? defaultAccountingLabelRuleCriteriaV1()
  const base = emptyRuleForm()
  base.name = rule.name
  base.enabled = rule.enabled
  base.labelId = rule.label_id || fallbackLabelId
  if (parsed.amount?.min !== undefined) base.amountMin = String(parsed.amount.min)
  if (parsed.amount?.max !== undefined) base.amountMax = String(parsed.amount.max)
  if (parsed.counterparty) {
    base.counterpartyOp = parsed.counterparty.op
    base.counterpartyValue = parsed.counterparty.value
  }
  if (parsed.bankDescription) {
    base.bankOp = parsed.bankDescription.op
    base.bankValue = parsed.bankDescription.value
  }
  return base
}

const TEST_PREVIEW_LIMIT = 40

/**
 * Hard ceiling on how many pending suggestions one **Apply rules to transactions**
 * click can create. Above this we slice — even if the user confirmed the preflight
 * — so the Approvals UI never paints the full match set when it's huge. Forces the
 * natural review-then-iterate cadence the page is built around.
 */
const APPLY_RULES_PER_CLICK_CAP = 500

/**
 * Threshold above which **Apply rules** prompts the user via
 * `BankingMercuryAccountingApplyRulesConfirmModal` instead of inserting silently.
 * Inserts under this threshold (the common case) are unchanged.
 */
const APPLY_RULES_CONFIRM_THRESHOLD = 200

/**
 * Initial visible window of approval cards in the Approvals section. The list
 * uses **Show 50 more** + **Show all** controls to extend the window — keeps
 * first-paint of large queues bounded without dropping any data.
 */
const APPROVALS_PAGE_SIZE = 50

type ApplyRulesPreflight = {
  toInsert: ApplyRulesToInsertRow[]
  totalMatches: number
}

/**
 * Hard cap on `.in('id', ids)` batch size for `loadPending` lookups. With a few
 * thousand pending suggestions, the unchunked URL exceeds Cloudflare/HTTP/2's
 * header limits and the connection is reset (`ERR_HTTP2_PROTOCOL_ERROR` /
 * `ERR_CONNECTION_RESET`), which then takes down every other in-flight Supabase
 * stream sharing that TCP connection. Same fix pattern as
 * `MERCURY_TRANSACTION_ID_IN_CHUNK_SIZE` in `fetchMercuryRelationsByTxIds.ts`.
 */
const ACCOUNTING_PENDING_ID_IN_CHUNK_SIZE = 200

async function fetchAccountingPendingRuleNames(ruleIds: string[]): Promise<Array<{ id: string; name: string }>> {
  const out: Array<{ id: string; name: string }> = []
  for (let i = 0; i < ruleIds.length; i += ACCOUNTING_PENDING_ID_IN_CHUNK_SIZE) {
    const chunk = ruleIds.slice(i, i + ACCOUNTING_PENDING_ID_IN_CHUNK_SIZE)
    if (chunk.length === 0) continue
    const rows = await withSupabaseRetry(async () => {
      return supabase.from('mercury_accounting_label_rules').select('id,name').in('id', chunk)
    }, 'accounting pending rule names')
    out.push(...((rows ?? []) as Array<{ id: string; name: string }>))
  }
  return out
}

async function fetchAccountingPendingLabelNames(labelIds: string[]): Promise<Array<{ id: string; name: string }>> {
  const out: Array<{ id: string; name: string }> = []
  for (let i = 0; i < labelIds.length; i += ACCOUNTING_PENDING_ID_IN_CHUNK_SIZE) {
    const chunk = labelIds.slice(i, i + ACCOUNTING_PENDING_ID_IN_CHUNK_SIZE)
    if (chunk.length === 0) continue
    const rows = await withSupabaseRetry(async () => {
      return supabase.from('mercury_drag_sort_labels').select('id,name').in('id', chunk)
    }, 'accounting pending label names')
    out.push(...((rows ?? []) as Array<{ id: string; name: string }>))
  }
  return out
}

async function fetchAccountingPendingTxsByIds(txIds: string[]): Promise<MercuryTxRow[]> {
  const out: MercuryTxRow[] = []
  for (let i = 0; i < txIds.length; i += ACCOUNTING_PENDING_ID_IN_CHUNK_SIZE) {
    const chunk = txIds.slice(i, i + ACCOUNTING_PENDING_ID_IN_CHUNK_SIZE)
    if (chunk.length === 0) continue
    const rows = await withSupabaseRetry(async () => {
      return supabase
        .from('mercury_transactions')
        .select(MERCURY_TRANSACTIONS_BANKING_LIST_COLUMNS)
        .in('id', chunk)
    }, 'accounting pending fetch txs')
    out.push(...((rows ?? []) as MercuryTxRow[]))
  }
  return out
}

export function BankingMercuryAccountingTab({
  userId,
  filteredTransactions,
  loading,
  loadError,
  mercurySearchNicknameCtx,
  mercurySearchEnrich,
  allocationsByTxId,
  personIdByTxId,
  userIdByTxId,
  userNameById,
  personNameById,
  jobLabelById,
  nicknameByDebitCard,
  onEditAllocations,
  orgNotesByTxId,
  onOrgNoteUpdated,
  hideLabeledTransactions,
  onHideLabeledTransactionsChange,
  applyRulesByDefault,
  onApplyRulesByDefaultChange,
  autoApplyResetTick,
  approveByDefault,
  onApproveByDefaultChange,
  onAfterAssignmentChange,
}: BankingMercuryAccountingTabProps) {
  const { showToast } = useToastContext()
  const [accountingSearchText, setAccountingSearchText] = useState('')
  // When the parent has already narrowed `filteredTransactions` to the
  // unlabeled set (Hide labeled = on, Accounting tab), the per-row
  // assignment-marking sweep would re-confirm that none of them have a
  // matching `mercury_transaction_drag_sort_assignments` row — pure waste.
  // Mirrors the same condition `Banking.tsx` uses to pick the loader.
  const inputIsUnlabeledOnly = hideLabeledTransactions
  const [labels, setLabels] = useState<DragLabelRow[]>([])
  const [labelsLoading, setLabelsLoading] = useState(true)
  const [labelAssignmentCountById, setLabelAssignmentCountById] = useState<Record<string, number>>({})
  const [assignmentLabelByTxId, setAssignmentLabelByTxId] = useState<Map<string, string>>(() => new Map())
  const [assignmentsLoading, setAssignmentsLoading] = useState(false)
  const [rules, setRules] = useState<RuleRow[]>([])
  const [rulesLoading, setRulesLoading] = useState(true)
  const [ruleUsageApproved, setRuleUsageApproved] = useState<Record<string, number>>({})
  const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>([])
  const [pendingLoading, setPendingLoading] = useState(false)
  const [applyRulesBusy, setApplyRulesBusy] = useState(false)
  const [approveAllBusy, setApproveAllBusy] = useState(false)
  const [applyRulesConfirm, setApplyRulesConfirm] = useState<ApplyRulesPreflight | null>(null)
  const [approvalsVisibleCount, setApprovalsVisibleCount] = useState(APPROVALS_PAGE_SIZE)
  // Mirror of `pendingApprovals` so memoized AccountingApprovalCard callbacks
  // can resolve the current row by suggestionId without depending on the array
  // (which would break memo equality every state change).
  const pendingApprovalsRef = useRef<PendingApproval[]>([])
  const [notesExpandedTxId, setNotesExpandedTxId] = useState<string | null>(null)
  const [quickAssignTxId, setQuickAssignTxId] = useState<string | null>(null)
  const [quickAssignBusy, setQuickAssignBusy] = useState(false)

  const [ledgerFiltersApplied, setLedgerFiltersApplied] = useState<BankingAccountingLedgerFiltersV1>(() =>
    defaultBankingAccountingLedgerFilters(),
  )
  const [ledgerFilterModalOpen, setLedgerFilterModalOpen] = useState(false)
  const [counterpartyFrequencyModalOpen, setCounterpartyFrequencyModalOpen] = useState(false)
  const [ledgerFilterDraft, setLedgerFilterDraft] = useState<BankingAccountingLedgerFiltersV1>(() =>
    defaultBankingAccountingLedgerFilters(),
  )
  const [ledgerSort, setLedgerSort] = useState<MercuryLedgerSortState>(() => DEFAULT_MERCURY_LEDGER_SORT)

  const [ruleModalOpen, setRuleModalOpen] = useState(false)
  const [ruleModalMountKey, setRuleModalMountKey] = useState(0)
  const [ruleModalInitial, setRuleModalInitial] = useState<AccountingRuleFormState>(() => emptyRuleForm())
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null)
  const [testModalOpen, setTestModalOpen] = useState(false)
  const [testRows, setTestRows] = useState<MercuryTxRow[]>([])
  const [testTotal, setTestTotal] = useState(0)
  const [testOtherMatchingRulesByTxId, setTestOtherMatchingRulesByTxId] = useState<Map<string, string[]>>(
    () => new Map(),
  )
  const [overlapsModalOpen, setOverlapsModalOpen] = useState(false)
  // When the user clicks a rule inside the Audit overlaps modal, we hide the
  // audit and open Edit Rule on top. The Edit Rule modal's z-index (1200)
  // sits below the audit modal's (1250) and can't be raised because the Test
  // results modal it spawns lives at 1250 too — so a stacked layout would
  // hide Edit Rule behind audit. A `useEffect` watching `ruleModalOpen` flips
  // audit back on once any close path (Cancel / Save / Save and apply /
  // backdrop) runs.
  const auditPendingReopenAfterRuleModalRef = useRef(false)
  const ruleModalOpenPrevRef = useRef(false)
  const [rulesModalOpen, setRulesModalOpen] = useState(false)
  const [rulesTableSearchText, setRulesTableSearchText] = useState('')
  const [rulesTableSort, setRulesTableSort] = useState<{
    column: 'none' | 'name' | 'label'
    direction: 'asc' | 'desc'
  }>({ column: 'none', direction: 'asc' })

  useEffect(() => {
    pendingApprovalsRef.current = pendingApprovals
  }, [pendingApprovals])

  // Reset the visible window when a fresh load brings rows from 0 -> N (e.g.
  // a new Apply rules run). Subsequent in-place edits (e.g. label change,
  // approve, reject) preserve the user's expanded window.
  const prevPendingLenRef = useRef(0)
  useEffect(() => {
    if (prevPendingLenRef.current === 0 && pendingApprovals.length > 0) {
      setApprovalsVisibleCount(APPROVALS_PAGE_SIZE)
    }
    prevPendingLenRef.current = pendingApprovals.length
  }, [pendingApprovals.length])

  useEffect(() => {
    setLedgerFiltersApplied(parseBankingAccountingLedgerFiltersJson(readAccountingLedgerFiltersRaw(userId)))
  }, [userId])

  useEffect(() => {
    setLedgerSort(readAccountingLedgerSort(userId))
  }, [userId])

  const accountingSearchNorm = useMemo(() => accountingSearchText.trim(), [accountingSearchText])

  const accountingKindOptions = useMemo(() => {
    const set = new Set<string>()
    for (const r of filteredTransactions) set.add(r.kind)
    return Array.from(set).sort()
  }, [filteredTransactions])

  const ledgerFilterCtx = useMemo(
    () => ({ allocationsByTxId, personIdByTxId, userIdByTxId }),
    [allocationsByTxId, personIdByTxId, userIdByTxId],
  )

  const ledgerFiltersActiveCount = useMemo(
    () => activeBankingAccountingLedgerFilterCount(ledgerFiltersApplied),
    [ledgerFiltersApplied],
  )

  const afterAccountingSearch = useMemo(() => {
    if (accountingSearchNorm === '') return filteredTransactions
    return filteredTransactions.filter((r) => {
      const haystack = buildMercuryTxSearchHaystackWithJobPerson(
        r,
        mercurySearchNicknameCtx,
        mercurySearchEnrich,
      )
      return mercuryTxMatchesSearchQuery(haystack, accountingSearchNorm)
    })
  }, [filteredTransactions, accountingSearchNorm, mercurySearchNicknameCtx, mercurySearchEnrich])

  const afterLedgerFilters = useMemo(
    () => filterRowsByAccountingLedgerFilters(afterAccountingSearch, ledgerFiltersApplied, ledgerFilterCtx),
    [afterAccountingSearch, ledgerFiltersApplied, ledgerFilterCtx],
  )

  const loadLabels = useCallback(async () => {
    setLabelsLoading(true)
    try {
      await ensureDragSortDefaultLabels()
      const data = await withSupabaseRetry(async () => {
        return supabase.from('mercury_drag_sort_labels').select('*').order('sort_order').order('id')
      }, 'accounting load labels')
      const labelRows = (data as DragLabelRow[]) ?? []
      setLabels(labelRows)

      try {
        const countRows = await withSupabaseRetry(async () => {
          return supabase.rpc('list_mercury_drag_sort_label_assignment_counts')
        }, 'accounting label assignment counts')
        const next: Record<string, number> = {}
        for (const row of countRows ?? []) {
          const id = row.label_id
          if (id) next[id] = Number(row.assignment_count) || 0
        }
        setLabelAssignmentCountById(next)
      } catch (countErr) {
        showToast(
          countErr instanceof Error ? countErr.message : 'Could not load label usage counts',
          'error',
        )
        setLabelAssignmentCountById({})
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not load labels', 'error')
      setLabels([])
      setLabelAssignmentCountById({})
    } finally {
      setLabelsLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    void loadLabels()
  }, [loadLabels])

  const loadAssignmentsForList = useCallback(async () => {
    // When the parent already pre-narrowed the input to the unlabeled set,
    // skip the assignment-marking sweep entirely — by definition every row
    // is unlabeled and `assignmentLabelByTxId` should be empty.
    if (inputIsUnlabeledOnly) {
      setAssignmentLabelByTxId(new Map())
      return
    }
    const idSet = new Set(filteredTransactions.map((r) => r.id))
    if (idSet.size === 0) {
      setAssignmentLabelByTxId(new Map())
      return
    }
    setAssignmentsLoading(true)
    try {
      const ids = [...idSet]
      const batchSize = 400
      const map = new Map<string, string>()
      for (let i = 0; i < ids.length; i += batchSize) {
        const slice = ids.slice(i, i + batchSize)
        const rows = await withSupabaseRetry(async () => {
          return supabase
            .from('mercury_transaction_drag_sort_assignments')
            .select('mercury_transaction_id, label_id')
            .in('mercury_transaction_id', slice)
        }, 'accounting load drag assignments')
        for (const row of (rows ?? []) as { mercury_transaction_id: string; label_id: string }[]) {
          if (idSet.has(row.mercury_transaction_id)) {
            map.set(row.mercury_transaction_id, row.label_id)
          }
        }
      }
      setAssignmentLabelByTxId(map)
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not load assignments', 'error')
      setAssignmentLabelByTxId(new Map())
    } finally {
      setAssignmentsLoading(false)
    }
  }, [filteredTransactions, inputIsUnlabeledOnly, showToast])

  useEffect(() => {
    void loadAssignmentsForList()
  }, [loadAssignmentsForList])

  const loadRulesAndUsage = useCallback(async (): Promise<RuleRow[] | null> => {
    setRulesLoading(true)
    try {
      const [rulesData, usageData] = await Promise.all([
        withSupabaseRetry(async () => {
          return supabase.from('mercury_accounting_label_rules').select('*').order('sort_order').order('id')
        }, 'accounting load rules'),
        withSupabaseRetry(async () => {
          return supabase.from('mercury_accounting_label_suggestions').select('rule_id').eq('status', 'approved')
        }, 'accounting rule usage'),
      ])
      const list = (rulesData as RuleRow[]) ?? []
      setRules(list)
      const usage: Record<string, number> = {}
      for (const r of (usageData ?? []) as { rule_id: string }[]) {
        usage[r.rule_id] = (usage[r.rule_id] ?? 0) + 1
      }
      setRuleUsageApproved(usage)
      return list
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not load rules', 'error')
      setRules([])
      setRuleUsageApproved({})
      return null
    } finally {
      setRulesLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    void loadRulesAndUsage()
  }, [loadRulesAndUsage])

  const loadPending = useCallback(async () => {
    setPendingLoading(true)
    try {
      const list = (await withSupabaseRetry(async () => {
        return supabase.from('mercury_accounting_label_suggestions').select('*').eq('status', 'pending')
      }, 'accounting load pending')) as SuggestionRow[] | null
      if (list == null || list.length === 0) {
        setPendingApprovals([])
        return
      }
      const ruleIds = [...new Set(list.map((s) => s.rule_id))]
      const labelIds = [...new Set(list.map((s) => s.suggested_label_id))]
      const [rulesQ, labelsQ] = await Promise.all([
        fetchAccountingPendingRuleNames(ruleIds),
        fetchAccountingPendingLabelNames(labelIds),
      ])
      const ruleNameById = new Map(rulesQ.map((r) => [r.id, r.name] as const))
      const labelNameById = new Map(labelsQ.map((r) => [r.id, r.name] as const))
      const txMap = new Map(filteredTransactions.map((t) => [t.id, t] as const))
      const missing = [...new Set(list.map((s) => s.mercury_transaction_id))].filter((id) => !txMap.has(id))
      if (missing.length > 0) {
        const fetched = await fetchAccountingPendingTxsByIds(missing)
        for (const t of fetched) txMap.set(t.id, t)
      }
      setPendingApprovals(
        list.map((s) => ({
          suggestionId: s.id,
          txId: s.mercury_transaction_id,
          tx: txMap.get(s.mercury_transaction_id) ?? null,
          ruleId: s.rule_id,
          ruleName: ruleNameById.get(s.rule_id) ?? '—',
          suggestedLabelId: s.suggested_label_id,
          suggestedLabelName: labelNameById.get(s.suggested_label_id) ?? '—',
        })),
      )
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not load approvals', 'error')
      setPendingApprovals([])
    } finally {
      setPendingLoading(false)
    }
  }, [filteredTransactions, showToast])

  useEffect(() => {
    void loadPending()
  }, [loadPending])

  const labelById = useMemo(() => {
    const m = new Map<string, DragLabelRow>()
    for (const L of labels) m.set(L.id, L)
    return m
  }, [labels])

  const ruleById = useMemo(() => {
    const m = new Map<string, RuleRow>()
    for (const r of rules) m.set(r.id, r)
    return m
  }, [rules])

  const overlapReport = useMemo(() => {
    if (!overlapsModalOpen) return null
    const ruleInputs = rules.map((r) => ({
      id: r.id,
      name: r.name,
      label_id: r.label_id,
      sort_order: r.sort_order,
      enabled: r.enabled,
      criteria: parseAccountingLabelRuleCriteria(r.criteria),
    }))
    return buildAccountingRuleOverlapReport(ruleInputs, filteredTransactions, {
      assignmentLabelByTxId,
    })
  }, [overlapsModalOpen, rules, filteredTransactions, assignmentLabelByTxId])

  const overlapTxByIdMap = useMemo(() => {
    if (!overlapsModalOpen) return new Map<string, MercuryTxRow>()
    const m = new Map<string, MercuryTxRow>()
    for (const tx of filteredTransactions) m.set(tx.id, tx)
    return m
  }, [overlapsModalOpen, filteredTransactions])

  const rulesSearchNorm = useMemo(() => rulesTableSearchText.trim().toLowerCase(), [rulesTableSearchText])

  const rulesFilteredForTable = useMemo(() => {
    if (rulesSearchNorm === '') return rules
    return rules.filter((r) => {
      const labelText = accountingRuleLabelDisplayText(r.label_id, labelById.get(r.label_id)?.name)
      return accountingRuleRowMatchesSearch(r.name, labelText, rulesSearchNorm)
    })
  }, [rules, labelById, rulesSearchNorm])

  const rulesSortedForTable = useMemo(() => {
    if (rulesTableSort.column === 'none') return rulesFilteredForTable
    return sortAccountingRulesForTable(
      rulesFilteredForTable,
      rulesTableSort.column,
      rulesTableSort.direction,
      (r) => accountingRuleLabelDisplayText(r.label_id, labelById.get(r.label_id)?.name),
    )
  }, [rulesFilteredForTable, rulesTableSort.column, rulesTableSort.direction, labelById])

  const onRulesSortHeaderClick = useCallback((col: 'name' | 'label') => {
    setRulesTableSort((prev) => {
      if (prev.column === col) {
        return { column: col, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
      }
      return { column: col, direction: 'asc' }
    })
  }, [])

  const displayTransactions = useMemo(() => {
    if (!hideLabeledTransactions) return afterLedgerFilters
    // Parent already filtered server-side; skip the redundant client filter.
    if (inputIsUnlabeledOnly) return afterLedgerFilters
    return afterLedgerFilters.filter((tx) => !assignmentLabelByTxId.has(tx.id))
  }, [hideLabeledTransactions, afterLedgerFilters, assignmentLabelByTxId, inputIsUnlabeledOnly])

  const sortedDisplayTransactions = useMemo(() => {
    const copy = [...displayTransactions]
    copy.sort((a, b) => compareMercuryLedgerRows(a, b, ledgerSort.key, ledgerSort.dir))
    return copy
  }, [displayTransactions, ledgerSort])

  const counterpartyFrequencyByKey = useMemo(
    () => counterpartyFrequencyCountMap(displayTransactions),
    [displayTransactions],
  )

  const counterpartyFrequencyRows = useMemo(
    () => counterpartyFrequenciesAboveMin(displayTransactions),
    [displayTransactions],
  )

  const upsertDragAssignment = useCallback(async (txId: string, labelId: string) => {
    await withSupabaseRetry(async () => {
      return supabase
        .from('mercury_transaction_drag_sort_assignments')
        .upsert({ mercury_transaction_id: txId, label_id: labelId }, { onConflict: 'mercury_transaction_id' })
    }, 'accounting upsert assignment')
  }, [])

  const removeAssignment = useCallback(async (txId: string) => {
    await withSupabaseRetry(async () => {
      return supabase.from('mercury_transaction_drag_sort_assignments').delete().eq('mercury_transaction_id', txId)
    }, 'accounting delete assignment')
  }, [])

  const clearRowDragSortLabel = useCallback(
    async (txId: string) => {
      const snap = new Map(assignmentLabelByTxId)
      snap.delete(txId)
      setAssignmentLabelByTxId(snap)
      try {
        await removeAssignment(txId)
        onAfterAssignmentChange?.()
      } catch (e) {
        setAssignmentLabelByTxId(assignmentLabelByTxId)
        showToast(e instanceof Error ? e.message : 'Could not remove label', 'error')
      }
    },
    [assignmentLabelByTxId, onAfterAssignmentChange, removeAssignment, showToast],
  )

  const closeQuickAssign = useCallback(() => {
    if (quickAssignBusy) return
    setQuickAssignTxId(null)
  }, [quickAssignBusy])

  const handleQuickAssignLabel = useCallback(
    async (labelId: string) => {
      const txId = quickAssignTxId
      if (!txId || quickAssignBusy) return
      // Internal Transfers and job splits are mutually exclusive.
      if (isInternalTransfersLabel(labels.find((L) => L.id === labelId))) {
        const splits = allocationsByTxId.get(txId) ?? []
        if (splits.length > 0) {
          showToast(
            'Internal Transfers cannot be applied to a transaction with job splits. Clear the splits first.',
            'error',
          )
          return
        }
      }
      const prevMap = new Map(assignmentLabelByTxId)
      const next = new Map(prevMap)
      next.set(txId, labelId)
      setAssignmentLabelByTxId(next)
      setQuickAssignBusy(true)
      try {
        await upsertDragAssignment(txId, labelId)
        showToast('Accounting label applied.', 'success')
        setQuickAssignTxId(null)
        onAfterAssignmentChange?.()
      } catch (e) {
        setAssignmentLabelByTxId(prevMap)
        showToast(e instanceof Error ? e.message : 'Could not assign label', 'error')
      } finally {
        setQuickAssignBusy(false)
      }
    },
    [
      allocationsByTxId,
      assignmentLabelByTxId,
      labels,
      onAfterAssignmentChange,
      quickAssignBusy,
      quickAssignTxId,
      showToast,
      upsertDragAssignment,
    ],
  )

  const quickAssignTransactionSummary = useMemo(() => {
    if (!quickAssignTxId) return undefined
    const tx =
      sortedDisplayTransactions.find((t) => t.id === quickAssignTxId) ??
      displayTransactions.find((t) => t.id === quickAssignTxId) ??
      filteredTransactions.find((t) => t.id === quickAssignTxId)
    if (!tx) return undefined
    return `${formatUsd(Number(tx.amount))} · ${tx.counterparty_name ?? '—'}`
  }, [quickAssignTxId, sortedDisplayTransactions, displayTransactions, filteredTransactions])

  const handleApprove = useCallback(
    async (p: PendingApproval, chosenLabelId: string) => {
      // Internal Transfers and job splits are mutually exclusive — block
      // approving a suggestion that would label a tx with existing splits
      // as Internal Transfers.
      if (isInternalTransfersLabel(labels.find((L) => L.id === chosenLabelId))) {
        const splits = allocationsByTxId.get(p.txId) ?? []
        if (splits.length > 0) {
          showToast(
            'Internal Transfers cannot be applied to a transaction with job splits. Clear the splits first.',
            'error',
          )
          return
        }
      }
      const prevMap = new Map(assignmentLabelByTxId)
      try {
        await upsertDragAssignment(p.txId, chosenLabelId)
        await withSupabaseRetry(async () => {
          return supabase
            .from('mercury_accounting_label_suggestions')
            .update({
              status: 'approved',
              final_label_id: chosenLabelId,
              resolved_at: new Date().toISOString(),
              resolved_by: userId,
            })
            .eq('id', p.suggestionId)
        }, 'accounting approve suggestion')
        const next = new Map(prevMap)
        next.set(p.txId, chosenLabelId)
        setAssignmentLabelByTxId(next)
        setPendingApprovals((rows) => rows.filter((r) => r.suggestionId !== p.suggestionId))
        setRuleUsageApproved((u) => ({ ...u, [p.ruleId]: (u[p.ruleId] ?? 0) + 1 }))
        showToast('Accounting label applied.', 'success')
        void loadRulesAndUsage()
        onAfterAssignmentChange?.()
      } catch (e) {
        setAssignmentLabelByTxId(prevMap)
        showToast(e instanceof Error ? e.message : 'Approve failed', 'error')
      }
    },
    [
      allocationsByTxId,
      assignmentLabelByTxId,
      labels,
      loadRulesAndUsage,
      onAfterAssignmentChange,
      showToast,
      upsertDragAssignment,
      userId,
    ],
  )

  const handleReject = useCallback(
    async (p: PendingApproval) => {
      try {
        await withSupabaseRetry(async () => {
          return supabase.from('mercury_accounting_label_suggestions').delete().eq('id', p.suggestionId)
        }, 'accounting reject suggestion')
        setPendingApprovals((rows) => rows.filter((r) => r.suggestionId !== p.suggestionId))
        showToast('Suggestion dismissed.', 'success')
      } catch (e) {
        showToast(e instanceof Error ? e.message : 'Reject failed', 'error')
      }
    },
    [showToast],
  )

  const handleApproveAll = useCallback(async () => {
    if (pendingLoading || pendingApprovals.length === 0) return
    // Skip pending suggestions that would label a tx with existing job
    // splits as Internal Transfers — those rows must be hand-cleaned first.
    const skipped: PendingApproval[] = []
    const snapshot: PendingApproval[] = []
    for (const p of pendingApprovals) {
      if (
        isInternalTransfersLabel(labels.find((L) => L.id === p.suggestedLabelId)) &&
        (allocationsByTxId.get(p.txId) ?? []).length > 0
      ) {
        skipped.push(p)
        continue
      }
      snapshot.push(p)
    }
    if (snapshot.length === 0) {
      showToast(
        'All pending suggestions would label a transaction with job splits as Internal Transfers. Clear the splits first.',
        'error',
      )
      return
    }
    const prevAssignments = new Map(assignmentLabelByTxId)
    setApproveAllBusy(true)
    const APPROVE_CHUNK = 500
    try {
      for (let i = 0; i < snapshot.length; i += APPROVE_CHUNK) {
        const chunk = snapshot.slice(i, i + APPROVE_CHUNK)
        const pItems = chunk.map((p) => ({
          suggestion_id: p.suggestionId,
          mercury_transaction_id: p.txId,
          label_id: p.suggestedLabelId,
        }))
        await withSupabaseRetry(async () => {
          return supabase.rpc('bulk_approve_accounting_label_suggestions', { p_items: pItems })
        }, 'accounting bulk approve')
      }
      const next = new Map(prevAssignments)
      for (const p of snapshot) {
        next.set(p.txId, p.suggestedLabelId)
      }
      setAssignmentLabelByTxId(next)
      setPendingApprovals((rows) => rows.filter((r) => skipped.some((s) => s.suggestionId === r.suggestionId)))
      setRuleUsageApproved((u) => {
        const out = { ...u }
        for (const p of snapshot) {
          out[p.ruleId] = (out[p.ruleId] ?? 0) + 1
        }
        return out
      })
      const approvedMsg =
        snapshot.length === 1 ? 'Approved 1 suggestion.' : `Approved ${snapshot.length} suggestions.`
      const skippedMsg =
        skipped.length === 0
          ? ''
          : skipped.length === 1
            ? ' Skipped 1 Internal Transfers suggestion with job splits.'
            : ` Skipped ${skipped.length} Internal Transfers suggestions with job splits.`
      showToast(`${approvedMsg}${skippedMsg}`, skipped.length > 0 ? 'info' : 'success')
      void loadRulesAndUsage()
      void loadPending()
      onAfterAssignmentChange?.()
    } catch (e) {
      setAssignmentLabelByTxId(prevAssignments)
      showToast(e instanceof Error ? e.message : 'Approve all failed', 'error')
      void loadPending()
      void loadAssignmentsForList()
    } finally {
      setApproveAllBusy(false)
    }
  }, [
    allocationsByTxId,
    assignmentLabelByTxId,
    labels,
    loadAssignmentsForList,
    loadPending,
    loadRulesAndUsage,
    onAfterAssignmentChange,
    pendingApprovals,
    pendingLoading,
    showToast,
  ])

  // Stable callbacks for AccountingApprovalCard. These look up the current
  // PendingApproval row by id from `pendingApprovalsRef` (not via state) so
  // their identity is stable across re-renders — combined with React.memo,
  // changing one card's label / approving / rejecting only re-renders the
  // affected card.
  const handleApproveCard = useCallback(
    (suggestionId: string, _txId: string, labelId: string) => {
      const row = pendingApprovalsRef.current.find((r) => r.suggestionId === suggestionId)
      if (!row) return
      void handleApprove(row, labelId)
    },
    [handleApprove],
  )

  const handleRejectCard = useCallback(
    (suggestionId: string) => {
      const row = pendingApprovalsRef.current.find((r) => r.suggestionId === suggestionId)
      if (!row) return
      void handleReject(row)
    },
    [handleReject],
  )

  const handleLabelChangeCard = useCallback(
    (suggestionId: string, nextLabelId: string) => {
      setPendingApprovals((rows) =>
        rows.map((r) =>
          r.suggestionId === suggestionId
            ? {
                ...r,
                suggestedLabelId: nextLabelId,
                suggestedLabelName: labelById.get(nextLabelId)?.name ?? nextLabelId,
              }
            : r,
        ),
      )
    },
    [labelById],
  )

  const openLedgerFilterModal = useCallback(() => {
    setLedgerFilterDraft({ ...ledgerFiltersApplied })
    setLedgerFilterModalOpen(true)
  }, [ledgerFiltersApplied])

  const applyLedgerFilterModal = useCallback(
    (finalDraft: BankingAccountingLedgerFiltersV1) => {
      const normalized = withLedgerFilterKindsNormalizedIfAllSelected(finalDraft, accountingKindOptions)
      setLedgerFiltersApplied(normalized)
      const raw = serializeBankingAccountingLedgerFiltersForStorage(normalized)
      if (raw == null) clearAccountingLedgerFiltersStorage(userId)
      else writeAccountingLedgerFiltersRaw(userId, raw)
      setLedgerFilterModalOpen(false)
    },
    [userId, accountingKindOptions],
  )

  const cancelLedgerFilterModal = useCallback(() => {
    setLedgerFilterModalOpen(false)
  }, [])

  const clearLedgerFiltersAndClose = useCallback(() => {
    const d = defaultBankingAccountingLedgerFilters()
    setLedgerFiltersApplied(d)
    clearAccountingLedgerFiltersStorage(userId)
    setLedgerFilterModalOpen(false)
  }, [userId])

  /**
   * Read-only preflight: walks rule snapshot + filtered transactions and
   * returns the *uncapped* `(tx, rule, label)` rows the engine would insert.
   * Returns `null` when there is nothing to do (no rules, no enabled rules,
   * no matches) — caller should toast and bail.
   *
   * Surfaces a server hop for the current pending-suggestion id set so the
   * preflight matches what the executor will see.
   */
  const computeApplyRulesPreflight = useCallback(
    async (ruleRows: RuleRow[]): Promise<ApplyRulesPreflight | null> => {
      if (ruleRows.length === 0) {
        showToast('No rules defined.', 'info')
        return null
      }
      const enabled = ruleRows.filter((r) => r.enabled)
      if (enabled.length === 0) {
        showToast('No enabled rules.', 'info')
        return null
      }
      const pendingTxRows = (await withSupabaseRetry(async () => {
        return supabase.from('mercury_accounting_label_suggestions').select('mercury_transaction_id').eq('status', 'pending')
      }, 'accounting apply pending ids')) as { mercury_transaction_id: string }[] | null
      const pendingTxIds = new Set((pendingTxRows ?? []).map((r) => r.mercury_transaction_id))
      const assignedTxIds = new Set(assignmentLabelByTxId.keys())

      const rulesForPreflight = enabled.map((r) => ({
        id: r.id,
        label_id: r.label_id,
        sort_order: r.sort_order,
        enabled: r.enabled,
        criteria: parseAccountingLabelRuleCriteria(r.criteria),
      }))

      // Apply rules scans Banking-filtered rows only (not Accounting search / ledger modal filters / hide labeled).
      const toInsert = buildAccountingRulesToInsert({
        rules: rulesForPreflight,
        filteredTransactions,
        assignedTxIds,
        pendingTxIds,
      })

      if (toInsert.length === 0) {
        showToast('No new suggestions (all matched txs already labeled or pending).', 'success')
        return null
      }
      return { toInsert, totalMatches: toInsert.length }
    },
    [assignmentLabelByTxId, filteredTransactions, showToast],
  )

  /**
   * Side-effecting executor: takes a preflight, slices to
   * `APPLY_RULES_PER_CLICK_CAP`, chunks the insert, toasts the result, and
   * reloads the pending list. Owns the `applyRulesBusy` flag.
   */
  const executeApplyRules = useCallback(
    async (preflight: ApplyRulesPreflight) => {
      setApplyRulesBusy(true)
      try {
        const capped = preflight.toInsert.slice(0, APPLY_RULES_PER_CLICK_CAP)
        const droppedByCap = Math.max(0, preflight.toInsert.length - capped.length)
        const INSERT_CHUNK = 2000
        let created = 0
        for (let i = 0; i < capped.length; i += INSERT_CHUNK) {
          const slice = capped.slice(i, i + INSERT_CHUNK)
          const insertedBatch = await withSupabaseRetry(async () => {
            return supabase.rpc('bulk_insert_accounting_label_suggestions', { p_rows: slice })
          }, 'accounting bulk insert suggestions')
          created += insertedBatch ?? 0
        }
        if (created === 0) {
          showToast('No new suggestions (all matched txs already labeled or pending).', 'success')
        } else {
          const base =
            created === 1
              ? 'Created 1 pending suggestion.'
              : `Created ${created.toLocaleString()} pending suggestions.`
          const tail =
            droppedByCap > 0
              ? ` ${droppedByCap.toLocaleString()} more match — apply again after reviewing.`
              : ''
          showToast(`${base}${tail}`, droppedByCap > 0 ? 'info' : 'success')
        }
        void loadPending()
      } catch (e) {
        showToast(e instanceof Error ? e.message : 'Apply rules failed', 'error')
      } finally {
        setApplyRulesBusy(false)
      }
    },
    [loadPending, showToast],
  )

  const applyRulesWithSnapshot = useCallback(
    async (ruleRows: RuleRow[]) => {
      const preflight = await computeApplyRulesPreflight(ruleRows)
      if (preflight == null) return
      // Above the confirm threshold, hand off to the modal — execute fires
      // from its onConfirm.
      if (preflight.totalMatches > APPLY_RULES_CONFIRM_THRESHOLD) {
        setApplyRulesConfirm(preflight)
        return
      }
      await executeApplyRules(preflight)
    },
    [computeApplyRulesPreflight, executeApplyRules],
  )

  const applyRules = useCallback(async () => {
    await applyRulesWithSnapshot(rules)
  }, [applyRulesWithSnapshot, rules])

  /**
   * Auto-apply path (RECENT_FEATURES v2.580). Deliberately bypasses
   * `applyRulesWithSnapshot` (which gates on `APPLY_RULES_CONFIRM_THRESHOLD`
   * and pops the modal) and goes straight to `executeApplyRules`. The 500
   * per-pass cap inside `executeApplyRules` still applies, and its existing
   * "Created N. M more match — apply again after reviewing." toast is the
   * cue users see when a single pass didn't cover everything.
   */
  const runAutoApply = useCallback(async () => {
    const preflight = await computeApplyRulesPreflight(rules)
    if (preflight == null) return
    await executeApplyRules(preflight)
  }, [computeApplyRulesPreflight, executeApplyRules, rules])

  // Tracks the last `(tx-id-set, enabled-rule-id-set)` snapshot we ran
  // auto-apply on. Stops the effect from re-firing when `loadPending`
  // round-trips with no behavior change. Reset by `autoApplyResetTick` so
  // a fresh Mercury sync still triggers one pass even on identical id sets.
  const lastAutoAppliedSignatureRef = useRef<string | null>(null)

  useEffect(() => {
    lastAutoAppliedSignatureRef.current = null
  }, [autoApplyResetTick])

  useEffect(() => {
    const sig = buildAutoApplySignature(filteredTransactions, rules)
    const allow = shouldAutoApplyAccountingRules({
      enabled: applyRulesByDefault,
      loading,
      rulesLoading,
      assignmentsLoading,
      applyRulesBusy,
      rulesCount: rules.length,
      currentSignature: sig,
      lastSignature: lastAutoAppliedSignatureRef.current,
    })
    if (!allow) return
    lastAutoAppliedSignatureRef.current = sig
    void runAutoApply()
  }, [
    applyRulesByDefault,
    filteredTransactions,
    rules,
    loading,
    rulesLoading,
    assignmentsLoading,
    applyRulesBusy,
    runAutoApply,
  ])

  // Pre-filter pending approvals to the rows `handleApproveAll` would
  // actually take — i.e. drop Internal Transfers suggestions for txs with
  // existing job splits (those need manual cleanup first). Feeding the
  // **filtered** list into the signature builder means a residue of
  // pure-conflict rows (post-approve all) produces a stable empty
  // signature so the auto-approve effect quiets cleanly without firing
  // `handleApproveAll`'s "All pending suggestions are conflicts" toast on
  // every re-render.
  const autoApprovablePending = useMemo(
    () =>
      pendingApprovals.filter((p) => {
        const isInternalTransfers = isInternalTransfersLabel(
          labels.find((L) => L.id === p.suggestedLabelId),
        )
        if (!isInternalTransfers) return true
        return (allocationsByTxId.get(p.txId) ?? []).length === 0
      }),
    [pendingApprovals, labels, allocationsByTxId],
  )

  // Tracks the last `pendingSuggestionId-set` we ran auto-approve on. The
  // signature naturally shrinks as suggestions get approved (server flips
  // them to `'approved'`, `loadPending` filters them out), so once a load
  // settles into a stable set the effect quiets.
  const lastAutoApprovedSignatureRef = useRef<string | null>(null)

  useEffect(() => {
    const sig = buildApproveByDefaultSignature(autoApprovablePending)
    const allow = shouldAutoApproveAccountingSuggestions({
      enabled: approveByDefault,
      pendingLoading,
      approveAllBusy,
      pendingCount: autoApprovablePending.length,
      currentSignature: sig,
      lastSignature: lastAutoApprovedSignatureRef.current,
    })
    if (!allow) return
    lastAutoApprovedSignatureRef.current = sig
    void handleApproveAll()
  }, [
    approveByDefault,
    autoApprovablePending,
    pendingLoading,
    approveAllBusy,
    handleApproveAll,
  ])

  const cancelApplyRulesConfirm = useCallback(() => {
    setApplyRulesConfirm(null)
  }, [])

  const confirmApplyRulesAfterModal = useCallback(async () => {
    const preflight = applyRulesConfirm
    if (preflight == null) return
    setApplyRulesConfirm(null)
    await executeApplyRules(preflight)
  }, [applyRulesConfirm, executeApplyRules])

  const openNewRuleModal = () => {
    setRuleModalInitial(emptyRuleForm())
    setEditingRuleId(null)
    setRuleModalMountKey((k) => k + 1)
    setRuleModalOpen(true)
  }

  const openNewRuleFromCounterparty = useCallback(
    (counterparty: string) => {
      const t = counterparty.trim()
      if (t === '') return
      setRuleModalInitial({
        ...emptyRuleForm(),
        name: suggestedRuleNameFromCounterparty(counterparty),
        counterpartyValue: t,
        counterpartyOp: 'contains',
      })
      setEditingRuleId(null)
      setRuleModalMountKey((k) => k + 1)
      setRuleModalOpen(true)
    },
    [],
  )

  const openEditRuleModal = useCallback(
    (rule: RuleRow) => {
      setRuleModalInitial(ruleRowToForm(rule, labels[0]?.id ?? rule.label_id))
      setEditingRuleId(rule.id)
      setRuleModalMountKey((k) => k + 1)
      setRuleModalOpen(true)
    },
    [labels],
  )

  const openEditRuleById = useCallback(
    (ruleId: string) => {
      const rule = ruleById.get(ruleId)
      if (!rule) {
        showToast('Could not open that rule. Try reloading the page.', 'error')
        return
      }
      openEditRuleModal(rule)
    },
    [openEditRuleModal, ruleById, showToast],
  )

  const openEditRuleByIdFromOverlaps = useCallback(
    (ruleId: string) => {
      auditPendingReopenAfterRuleModalRef.current = true
      setOverlapsModalOpen(false)
      openEditRuleById(ruleId)
    },
    [openEditRuleById],
  )

  useEffect(() => {
    const wasOpen = ruleModalOpenPrevRef.current
    ruleModalOpenPrevRef.current = ruleModalOpen
    if (wasOpen && !ruleModalOpen && auditPendingReopenAfterRuleModalRef.current) {
      auditPendingReopenAfterRuleModalRef.current = false
      setOverlapsModalOpen(true)
    }
  }, [ruleModalOpen])

  const runTestFromCriteria = useCallback(
    (c: AccountingLabelRuleCriteriaV1) => {
      const matched: MercuryTxRow[] = []
      // Rule test preview uses Banking-filtered rows only (not Accounting search / ledger modal filters).
      for (const tx of filteredTransactions) {
        if (matchAccountingLabelRuleCriteria(tx, c)) matched.push(tx)
      }
      const visible = matched.slice(0, TEST_PREVIEW_LIMIT)

      // Compute, per visible matched tx, which OTHER enabled rules (excluding the
      // rule currently being edited) also match. Surfaces silent overlap to the
      // rule author without changing how Apply tie-breaks.
      const otherMatchesByTxId = new Map<string, string[]>()
      const otherRulesParsed = rules
        .filter((r) => r.enabled && (editingRuleId == null || r.id !== editingRuleId))
        .map((r) => ({ rule: r, criteria: parseAccountingLabelRuleCriteria(r.criteria) }))
        .filter((x) => x.criteria != null && accountingRuleEffectiveClauseCount(x.criteria) > 0)
        .sort((a, b) => a.rule.sort_order - b.rule.sort_order || a.rule.id.localeCompare(b.rule.id))
      for (const tx of visible) {
        const ids: string[] = []
        for (const { rule, criteria } of otherRulesParsed) {
          if (criteria == null) continue
          if (matchAccountingLabelRuleCriteria(tx, criteria)) ids.push(rule.id)
        }
        if (ids.length > 0) otherMatchesByTxId.set(tx.id, ids)
      }

      setTestTotal(matched.length)
      setTestRows(visible)
      setTestOtherMatchingRulesByTxId(otherMatchesByTxId)
      setTestModalOpen(true)
    },
    [filteredTransactions, rules, editingRuleId],
  )

  const saveRuleDraft = useCallback(
    async (draft: AccountingRuleSaveDraft) => {
      try {
        if (editingRuleId) {
          await withSupabaseRetry(async () => {
            return supabase
              .from('mercury_accounting_label_rules')
              .update({
                name: draft.name,
                enabled: draft.enabled,
                label_id: draft.labelId,
                criteria: criteriaToJson(draft.criteria),
              })
              .eq('id', editingRuleId)
          }, 'accounting update rule')
          showToast('Rule updated.', 'success')
        } else {
          const nextOrder = rules.length === 0 ? 0 : Math.max(...rules.map((r) => r.sort_order)) + 1
          await withSupabaseRetry(async () => {
            return supabase.from('mercury_accounting_label_rules').insert({
              name: draft.name,
              enabled: draft.enabled,
              label_id: draft.labelId,
              sort_order: nextOrder,
              criteria: criteriaToJson(draft.criteria),
              created_by: userId,
            })
          }, 'accounting insert rule')
          showToast('Rule saved.', 'success')
        }
        setRuleModalOpen(false)
        void loadRulesAndUsage()
      } catch (e) {
        showToast(e instanceof Error ? e.message : 'Could not save rule', 'error')
      }
    },
    [editingRuleId, loadRulesAndUsage, rules, showToast, userId],
  )

  const saveRuleDraftAndApply = useCallback(
    async (draft: AccountingRuleSaveDraft) => {
      try {
        if (editingRuleId) {
          await withSupabaseRetry(async () => {
            return supabase
              .from('mercury_accounting_label_rules')
              .update({
                name: draft.name,
                enabled: draft.enabled,
                label_id: draft.labelId,
                criteria: criteriaToJson(draft.criteria),
              })
              .eq('id', editingRuleId)
          }, 'accounting update rule')
          showToast('Rule updated.', 'success')
        } else {
          const nextOrder = rules.length === 0 ? 0 : Math.max(...rules.map((r) => r.sort_order)) + 1
          await withSupabaseRetry(async () => {
            return supabase.from('mercury_accounting_label_rules').insert({
              name: draft.name,
              enabled: draft.enabled,
              label_id: draft.labelId,
              sort_order: nextOrder,
              criteria: criteriaToJson(draft.criteria),
              created_by: userId,
            })
          }, 'accounting insert rule')
          showToast('Rule saved.', 'success')
        }
        const fresh = await loadRulesAndUsage()
        if (fresh != null) {
          await applyRulesWithSnapshot(fresh)
        }
        setRuleModalOpen(false)
      } catch (e) {
        showToast(e instanceof Error ? e.message : 'Could not save rule', 'error')
      }
    },
    [applyRulesWithSnapshot, editingRuleId, loadRulesAndUsage, rules, showToast, userId],
  )

  const closeRuleModal = useCallback(() => setRuleModalOpen(false), [])

  const deleteRuleCore = useCallback(
    async (rule: RuleRow) => {
      try {
        await withSupabaseRetry(async () => {
          return supabase.from('mercury_accounting_label_rules').delete().eq('id', rule.id)
        }, 'accounting delete rule')
        showToast('Rule deleted.', 'success')
        void loadRulesAndUsage()
        void loadPending()
      } catch (e) {
        showToast(e instanceof Error ? e.message : 'Delete failed', 'error')
        throw e
      }
    },
    [loadPending, loadRulesAndUsage, showToast],
  )

  const deleteRule = useCallback(
    async (rule: RuleRow) => {
      if (!window.confirm(`Delete rule "${rule.name}"? Pending suggestions for this rule will be removed.`)) return
      try {
        await deleteRuleCore(rule)
      } catch {
        // toast already shown
      }
    },
    [deleteRuleCore],
  )

  const ledgerShowDrag = false

  return (
    <>
      {loadError ? (
        <div
          style={{
            marginBottom: '1rem',
            padding: '0.75rem 1rem',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: 4,
            color: '#991b1b',
          }}
        >
          {loadError}
        </div>
      ) : null}

      <section style={{ marginBottom: '2rem' }}>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.5rem 1rem',
            marginBottom: '0.75rem',
          }}
        >
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>Approvals</h2>
          <button
            type="button"
            title="Approve every pending suggestion using each row’s Accounting Label choice"
            aria-label="Approve all pending suggestions"
            disabled={pendingLoading || pendingApprovals.length === 0 || approveAllBusy}
            onClick={() => void handleApproveAll()}
            style={{
              padding: '0.45rem 0.9rem',
              fontWeight: 600,
              background: approveAllBusy ? '#94a3b8' : '#059669',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              cursor: pendingLoading || pendingApprovals.length === 0 || approveAllBusy ? 'not-allowed' : 'pointer',
            }}
          >
            {approveAllBusy
              ? 'Approving…'
              : pendingApprovals.length > 0
                ? `Approve all (${pendingApprovals.length.toLocaleString()})`
                : 'Approve all'}
          </button>
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            marginBottom: '0.5rem',
          }}
        >
          <label
            style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', cursor: 'pointer' }}
            title="When on, runs Approve all automatically every time new pending suggestions appear. Internal Transfers conflicts (rows with job splits) are still skipped and stay pending for manual review."
          >
            <input
              type="checkbox"
              checked={approveByDefault}
              onChange={(e) => onApproveByDefaultChange(e.target.checked)}
            />
            Approve by default
          </label>
        </div>
        <p style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', color: '#64748b' }}>
          Transactions matched by rules await confirmation. Choose a label if different from the suggestion, then Approve.
        </p>
        {pendingLoading ? (
          <div style={{ color: '#64748b' }}>Loading…</div>
        ) : pendingApprovals.length === 0 ? (
          <div style={{ color: '#64748b' }}>No pending suggestions.</div>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {pendingApprovals.slice(0, approvalsVisibleCount).map((p) => (
                <AccountingApprovalCard
                  key={p.suggestionId}
                  approval={p}
                  labels={labels}
                  nicknameByDebitCard={nicknameByDebitCard}
                  approveAllBusy={approveAllBusy}
                  rulesLoading={rulesLoading}
                  onApprove={handleApproveCard}
                  onReject={handleRejectCard}
                  onLabelChange={handleLabelChangeCard}
                  onOpenEditRule={openEditRuleById}
                />
              ))}
            </div>
            {pendingApprovals.length > approvalsVisibleCount ? (
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.5rem',
                  marginTop: '0.75rem',
                  padding: '0.5rem 0.25rem',
                  fontSize: '0.875rem',
                  color: '#475569',
                }}
              >
                <span>
                  Showing {approvalsVisibleCount.toLocaleString()} of{' '}
                  {pendingApprovals.length.toLocaleString()}.
                </span>
                <span style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() =>
                      setApprovalsVisibleCount((n) =>
                        Math.min(pendingApprovals.length, n + APPROVALS_PAGE_SIZE),
                      )
                    }
                    style={{
                      padding: '0.4rem 0.85rem',
                      background: '#fff',
                      color: '#1f2937',
                      border: '1px solid #e5e7eb',
                      borderRadius: 6,
                      cursor: 'pointer',
                      fontWeight: 500,
                    }}
                  >
                    Show {APPROVALS_PAGE_SIZE} more
                  </button>
                  <button
                    type="button"
                    onClick={() => setApprovalsVisibleCount(pendingApprovals.length)}
                    style={{
                      padding: '0.4rem 0.85rem',
                      background: '#fff',
                      color: '#1f2937',
                      border: '1px solid #e5e7eb',
                      borderRadius: 6,
                      cursor: 'pointer',
                      fontWeight: 500,
                    }}
                  >
                    Show all ({pendingApprovals.length.toLocaleString()})
                  </button>
                </span>
              </div>
            ) : null}
          </>
        )}
      </section>

      <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'flex-start' }}>
        <button
          type="button"
          onClick={() => setRulesModalOpen(true)}
          disabled={rulesLoading}
          aria-label={`Open rules manager (${rules.length} rules)`}
          style={{
            padding: '0.5rem 1rem',
            fontWeight: 600,
            background: rulesLoading ? '#e5e7eb' : '#2563eb',
            color: rulesLoading ? '#64748b' : '#fff',
            border: 'none',
            borderRadius: 6,
            cursor: rulesLoading ? 'not-allowed' : 'pointer',
          }}
        >
          Rules ({rules.length})
        </button>
      </div>

      <section style={{ marginBottom: '1rem' }}>
        <h2
          style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 0.75rem' }}
          aria-label={`Sorting Ledger, ${displayTransactions.length} transactions`}
        >
          Sorting Ledger ({displayTransactions.length})
        </h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', marginBottom: '0.75rem' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.85rem', flex: '1 1 14rem' }}>
            <input
              type="search"
              aria-label="Search transactions"
              placeholder="Search transactions…"
              value={accountingSearchText}
              onChange={(e) => setAccountingSearchText(e.target.value)}
              style={{ padding: '0.45rem 0.65rem', borderRadius: 6, border: '1px solid #e5e7eb' }}
            />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.875rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={hideLabeledTransactions}
              onChange={(e) => onHideLabeledTransactionsChange(e.target.checked)}
            />
            Hide labeled transactions
          </label>
          <label
            style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.875rem', cursor: 'pointer' }}
            title="When on, runs Apply rules to transactions automatically after every load. Skips the confirm modal but still caps each pass at 500 new pending suggestions."
          >
            <input
              type="checkbox"
              checked={applyRulesByDefault}
              onChange={(e) => onApplyRulesByDefaultChange(e.target.checked)}
            />
            Apply rules by default
          </label>
          <button
            type="button"
            onClick={openLedgerFilterModal}
            style={{
              padding: '0.45rem 0.75rem',
              fontSize: '0.875rem',
              border: '1px solid #e5e7eb',
              borderRadius: 6,
              background: '#fff',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            More filters
            {ledgerFiltersActiveCount > 0 ? (
              <span
                style={{
                  minWidth: '1.25rem',
                  padding: '0 6px',
                  borderRadius: 999,
                  background: '#e0e7ff',
                  color: '#3730a3',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  lineHeight: '1.25rem',
                }}
              >
                {ledgerFiltersActiveCount}
              </span>
            ) : null}
          </button>
        </div>
        {loading || assignmentsLoading ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}>Loading…</div>
        ) : (
          <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <BankingMercuryDragSortLedgerThead
                showDragHandle={ledgerShowDrag}
                showRuleShortcutColumn
                sortState={ledgerSort}
                onSortColumn={(key) => {
                  setLedgerSort((cur) => {
                    const next = nextMercuryLedgerSortState(cur, key)
                    writeAccountingLedgerSort(userId, next)
                    return next
                  })
                }}
                onCounterpartyHeaderClick={() => setCounterpartyFrequencyModalOpen(true)}
              />
              <tbody>
                {sortedDisplayTransactions.map((r) => {
                  const assignId = assignmentLabelByTxId.get(r.id)
                  const assignedLabel = assignId ? labelById.get(assignId) : undefined
                  const assignName = assignedLabel?.name ?? '—'
                  const scheduleLineRaw = assignedLabel?.schedule_c_line?.trim()
                  const scheduleLineSuffix = scheduleLineRaw ? ` · Sch. C L ${scheduleLineRaw}` : ''
                  const labelDetailTitle = assignedLabel?.description?.trim()
                    ? `${assignName}${scheduleLineSuffix}\n${assignedLabel.description.trim()}`
                    : `${assignName}${scheduleLineSuffix}`.trim() || undefined
                  const allocs = allocationsByTxId.get(r.id) ?? []
                  const jobLine = dragSortJobPrimaryLine(allocs, jobLabelById)
                  const personLine = dragSortPersonSubline(
                    r.id,
                    personIdByTxId,
                    userIdByTxId,
                    personNameById,
                    userNameById,
                  )
                  const editorOpen = notesExpandedTxId === r.id
                  const orgNoteBody = orgNotesByTxId.get(r.id) ?? ''
                  const bankDescriptionText = mercuryBankDescriptionFromRaw(r.raw)
                  const bankDescriptionTrimForPipe =
                    typeof bankDescriptionText === 'string' ? bankDescriptionText.trim() : ''
                  const dragSortCombinedNoteAria = mercuryTxCombinedNoteInlineText(r, orgNoteBody)
                  const dragSortPipeAriaLabel =
                    mercuryTxPipeLineAriaLabel(bankDescriptionTrimForPipe, dragSortCombinedNoteAria) || 'Bank and note preview'
                  const showDragSortBankNoteBand = mercuryTxDragSortBankNoteRowVisible(r, orgNoteBody, bankDescriptionText)
                  const notesStripeBelow = showDragSortBankNoteBand || editorOpen
                  const cpCount =
                    counterpartyFrequencyByKey.get(counterpartyNameFrequencyKey(r.counterparty_name)) ?? 0
                  return (
                    <Fragment key={r.id}>
                      <BankingMercuryDragSortLedgerRow
                        row={r}
                        jobLineText={jobLine.text}
                        jobLineMuted={jobLine.muted}
                        jobLineTitle={jobLine.detailTitle}
                        jobLineIsNotSplit={allocs.length === 0}
                        personLineText={personLine.text}
                        personUnassigned={personLine.unassigned}
                        assignId={assignId}
                        assignName={assignName}
                        labelDetailTitle={labelDetailTitle}
                        nicknameByDebitCard={nicknameByDebitCard}
                        onRemoveLabel={clearRowDragSortLabel}
                        onEditAllocations={onEditAllocations}
                        notesOpen={editorOpen}
                        onNotesToggle={() => setNotesExpandedTxId((cur) => (cur === r.id ? null : r.id))}
                        suppressBottomDivider={notesStripeBelow}
                        showDragHandle={ledgerShowDrag}
                        showRuleShortcutColumn
                        counterpartyOccurrenceCount={cpCount}
                        ruleShortcutDisabled={
                          labelsLoading || labels.length === 0 || !(r.counterparty_name ?? '').trim()
                        }
                        onRuleShortcut={() => openNewRuleFromCounterparty(r.counterparty_name ?? '')}
                        showQuickAssignLabel
                        quickAssignDisabled={labelsLoading || labels.length === 0}
                        onQuickAssignLabel={() => setQuickAssignTxId(r.id)}
                      />
                      {showDragSortBankNoteBand && !editorOpen ? (
                        <BankingMercuryDragSortLedgerNotesPreviewRow
                          row={r}
                          orgNoteBody={orgNoteBody}
                          bankDescriptionText={bankDescriptionText}
                          dragSortPipeAriaLabel={dragSortPipeAriaLabel}
                          showDragHandle={ledgerShowDrag}
                          showRuleShortcutColumn
                        />
                      ) : null}
                      {editorOpen ? (
                        <BankingMercuryDragSortLedgerNotesEditorRow
                          row={r}
                          orgNoteBody={orgNoteBody}
                          onOrgNoteUpdated={onOrgNoteUpdated}
                          onSaveSuccess={() => setNotesExpandedTxId(null)}
                          onCloseRequest={() => setNotesExpandedTxId(null)}
                          bankDescriptionText={bankDescriptionText}
                          showDragHandle={ledgerShowDrag}
                          showRuleShortcutColumn
                        />
                      ) : null}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
            {filteredTransactions.length === 0 ? (
              <div style={{ padding: '1.5rem', color: '#6b7280' }}>No transactions match the current Banking filters.</div>
            ) : afterAccountingSearch.length === 0 ? (
              <div style={{ padding: '1.5rem', color: '#6b7280' }}>No transactions match this search.</div>
            ) : afterLedgerFilters.length === 0 ? (
              <div style={{ padding: '1.5rem', color: '#6b7280' }}>
                No transactions match <strong>More filters</strong>. Open <strong>More filters</strong> to adjust or{' '}
                <button
                  type="button"
                  onClick={clearLedgerFiltersAndClose}
                  style={{
                    padding: 0,
                    border: 'none',
                    background: 'none',
                    color: '#2563eb',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    font: 'inherit',
                  }}
                >
                  clear all ledger filters
                </button>
                .
              </div>
            ) : hideLabeledTransactions && displayTransactions.length === 0 ? (
              <div style={{ padding: '1.5rem', color: '#6b7280' }}>
                All matching transactions have an Accounting Label. Turn off <strong>Hide labeled transactions</strong> to see them.
              </div>
            ) : null}
          </div>
        )}
      </section>

      {ledgerFilterModalOpen ? (
        <BankingMercuryAccountingLedgerFilterModal
          open={ledgerFilterModalOpen}
          draft={ledgerFilterDraft}
          kindOptions={accountingKindOptions}
          onDraftChange={setLedgerFilterDraft}
          onApply={applyLedgerFilterModal}
          onCancel={cancelLedgerFilterModal}
          onClearAll={clearLedgerFiltersAndClose}
        />
      ) : null}

      <MercuryCounterpartyFrequencyModal
        open={counterpartyFrequencyModalOpen}
        onClose={() => setCounterpartyFrequencyModalOpen(false)}
        rows={counterpartyFrequencyRows}
        scopeDescription={
          <>
            Counterparties with more than two transactions in the current table (after <strong>Search</strong>,{' '}
            <strong>More filters</strong>, and <strong>Hide labeled transactions</strong> when that option is on). Click
            a row to load that name into <strong>Search</strong>.
          </>
        }
        onRowClick={(row) => {
          setAccountingSearchText(row.label)
          setCounterpartyFrequencyModalOpen(false)
        }}
      />

      <AccountingLabelQuickAssignModal
        open={quickAssignTxId !== null}
        txId={quickAssignTxId}
        transactionSummary={quickAssignTransactionSummary}
        labels={labels}
        labelAssignmentCountById={labelAssignmentCountById}
        busy={quickAssignBusy}
        onAssign={(labelId) => void handleQuickAssignLabel(labelId)}
        onClose={closeQuickAssign}
      />

      {ruleModalOpen ? (
        <AccountingRuleFormModal
          key={ruleModalMountKey}
          editingRuleId={editingRuleId}
          initialForm={ruleModalInitial}
          labels={labels}
          labelsLoading={labelsLoading}
          labelAssignmentCountById={labelAssignmentCountById}
          onClose={closeRuleModal}
          onRunTest={runTestFromCriteria}
          onSave={saveRuleDraft}
          onSaveAndApply={saveRuleDraftAndApply}
          applyRulesBusy={applyRulesBusy}
          onDelete={
            editingRuleId
              ? async () => {
                  const rule = ruleById.get(editingRuleId)
                  if (!rule) {
                    showToast('Could not find that rule. Try reloading the page.', 'error')
                    return
                  }
                  await deleteRuleCore(rule)
                  setRuleModalOpen(false)
                }
              : undefined
          }
        />
      ) : null}

      {testModalOpen ? (
        <div
          role="presentation"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1250,
            padding: '1rem',
            boxSizing: 'border-box',
          }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setTestModalOpen(false)
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              background: 'white',
              borderRadius: 8,
              maxWidth: 640,
              width: '100%',
              padding: '1.25rem',
              maxHeight: '85vh',
              overflowY: 'auto',
              border: '1px solid #e5e7eb',
            }}
          >
            <h3 style={{ margin: '0 0 0.75rem' }}>Test results</h3>
            <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: '#64748b' }}>
              {testTotal} transaction(s) match on the current Banking-loaded list (showing first {testRows.length}).
            </p>
            <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.875rem' }}>
              {testRows.map((tx) => {
                const otherIds = testOtherMatchingRulesByTxId.get(tx.id) ?? []
                return (
                  <li key={tx.id} style={{ marginBottom: 6 }}>
                    {formatUsd(Number(tx.amount))} · {tx.counterparty_name ?? '—'} · {formatBankingDate(tx.posted_at)}
                    {otherIds.length > 0 ? (
                      <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: 2 }}>
                        Also matched by:{' '}
                        {otherIds.map((id) => ruleById.get(id)?.name ?? id.slice(0, 8)).join(', ')}
                      </div>
                    ) : null}
                  </li>
                )
              })}
            </ul>
            <button
              type="button"
              onClick={() => setTestModalOpen(false)}
              style={{ marginTop: '1rem', padding: '0.4rem 0.85rem' }}
            >
              Close
            </button>
          </div>
        </div>
      ) : null}

      <BankingMercuryAccountingOverlapsModal
        open={overlapsModalOpen}
        onClose={() => {
          auditPendingReopenAfterRuleModalRef.current = false
          setOverlapsModalOpen(false)
        }}
        report={overlapReport}
        labelById={labelById}
        ruleById={ruleById}
        txById={overlapTxByIdMap}
        onEditRule={openEditRuleByIdFromOverlaps}
      />

      <BankingMercuryAccountingApplyRulesConfirmModal
        open={applyRulesConfirm != null}
        totalMatches={applyRulesConfirm?.totalMatches ?? 0}
        capPerClick={APPLY_RULES_PER_CLICK_CAP}
        busy={applyRulesBusy}
        onCancel={cancelApplyRulesConfirm}
        onConfirm={() => void confirmApplyRulesAfterModal()}
      />

      <BankingMercuryAccountingRulesModal
        open={rulesModalOpen}
        onClose={() => setRulesModalOpen(false)}
        rulesLoading={rulesLoading}
        rules={rules}
        rulesFilteredForTable={rulesFilteredForTable}
        rulesSortedForTable={rulesSortedForTable}
        rulesSearchNorm={rulesSearchNorm}
        rulesTableSearchText={rulesTableSearchText}
        setRulesTableSearchText={setRulesTableSearchText}
        rulesTableSort={rulesTableSort}
        onRulesSortHeaderClick={onRulesSortHeaderClick}
        labelById={labelById}
        ruleUsageApproved={ruleUsageApproved}
        labelsLoading={labelsLoading}
        labelCount={labels.length}
        applyRulesBusy={applyRulesBusy}
        onNewRule={openNewRuleModal}
        onAuditOverlaps={() => setOverlapsModalOpen(true)}
        onApplyRules={() => void applyRules()}
        onEditRule={openEditRuleModal}
        onDeleteRule={(r) => void deleteRule(r)}
      />
    </>
  )
}
