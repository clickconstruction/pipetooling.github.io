import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
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
import { ensureDragSortDefaultLabels } from '../../lib/dragSortDefaultLabels'
import {
  clearAccountingLedgerFiltersStorage,
  readAccountingHideLabeledTransactions,
  readAccountingLedgerFiltersRaw,
  readAccountingRulesSectionExpanded,
  writeAccountingHideLabeledTransactions,
  writeAccountingLedgerFiltersRaw,
  writeAccountingRulesSectionExpanded,
} from '../../lib/bankingDragSortStorage'
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
const ACCOUNTING_RULES_SECTION_BODY_ID = 'accounting-rules-section-body'

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
}: BankingMercuryAccountingTabProps) {
  const { showToast } = useToastContext()
  const [accountingSearchText, setAccountingSearchText] = useState('')
  const [hideLabeledTransactions, setHideLabeledTransactions] = useState(() => readAccountingHideLabeledTransactions(userId))
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
  const [notesExpandedTxId, setNotesExpandedTxId] = useState<string | null>(null)

  const [ledgerFiltersApplied, setLedgerFiltersApplied] = useState<BankingAccountingLedgerFiltersV1>(() =>
    defaultBankingAccountingLedgerFilters(),
  )
  const [ledgerFilterModalOpen, setLedgerFilterModalOpen] = useState(false)
  const [counterpartyFrequencyModalOpen, setCounterpartyFrequencyModalOpen] = useState(false)
  const [ledgerFilterDraft, setLedgerFilterDraft] = useState<BankingAccountingLedgerFiltersV1>(() =>
    defaultBankingAccountingLedgerFilters(),
  )

  const [ruleModalOpen, setRuleModalOpen] = useState(false)
  const [ruleModalMountKey, setRuleModalMountKey] = useState(0)
  const [ruleModalInitial, setRuleModalInitial] = useState<AccountingRuleFormState>(() => emptyRuleForm())
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null)
  const [testModalOpen, setTestModalOpen] = useState(false)
  const [testRows, setTestRows] = useState<MercuryTxRow[]>([])
  const [testTotal, setTestTotal] = useState(0)
  const [rulesSectionExpanded, setRulesSectionExpanded] = useState(() => readAccountingRulesSectionExpanded(userId))
  const [rulesTableSearchText, setRulesTableSearchText] = useState('')
  const [rulesTableSort, setRulesTableSort] = useState<{
    column: 'none' | 'name' | 'label'
    direction: 'asc' | 'desc'
  }>({ column: 'none', direction: 'asc' })

  useEffect(() => {
    setHideLabeledTransactions(readAccountingHideLabeledTransactions(userId))
  }, [userId])

  useEffect(() => {
    setRulesSectionExpanded(readAccountingRulesSectionExpanded(userId))
  }, [userId])

  useEffect(() => {
    setLedgerFiltersApplied(parseBankingAccountingLedgerFiltersJson(readAccountingLedgerFiltersRaw(userId)))
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
  }, [filteredTransactions, showToast])

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
        withSupabaseRetry(async () => {
          return supabase.from('mercury_accounting_label_rules').select('id,name').in('id', ruleIds)
        }, 'accounting pending rule names'),
        withSupabaseRetry(async () => {
          return supabase.from('mercury_drag_sort_labels').select('id,name').in('id', labelIds)
        }, 'accounting pending label names'),
      ])
      const ruleNameById = new Map((rulesQ ?? []).map((r) => [r.id, r.name] as const))
      const labelNameById = new Map((labelsQ ?? []).map((r) => [r.id, r.name] as const))
      const txMap = new Map(filteredTransactions.map((t) => [t.id, t] as const))
      const missing = [...new Set(list.map((s) => s.mercury_transaction_id))].filter((id) => !txMap.has(id))
      if (missing.length > 0) {
        const fetched = await withSupabaseRetry(async () => {
          return supabase
            .from('mercury_transactions')
            .select(MERCURY_TRANSACTIONS_BANKING_LIST_COLUMNS)
            .in('id', missing)
        }, 'accounting pending fetch txs')
        for (const t of (fetched ?? []) as MercuryTxRow[]) txMap.set(t.id, t)
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
    return afterLedgerFilters.filter((tx) => !assignmentLabelByTxId.has(tx.id))
  }, [hideLabeledTransactions, afterLedgerFilters, assignmentLabelByTxId])

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
      } catch (e) {
        setAssignmentLabelByTxId(assignmentLabelByTxId)
        showToast(e instanceof Error ? e.message : 'Could not remove label', 'error')
      }
    },
    [assignmentLabelByTxId, removeAssignment, showToast],
  )

  const handleApprove = useCallback(
    async (p: PendingApproval, chosenLabelId: string) => {
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
      } catch (e) {
        setAssignmentLabelByTxId(prevMap)
        showToast(e instanceof Error ? e.message : 'Approve failed', 'error')
      }
    },
    [assignmentLabelByTxId, loadRulesAndUsage, showToast, upsertDragAssignment, userId],
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
    const snapshot = [...pendingApprovals]
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
      setPendingApprovals([])
      setRuleUsageApproved((u) => {
        const out = { ...u }
        for (const p of snapshot) {
          out[p.ruleId] = (out[p.ruleId] ?? 0) + 1
        }
        return out
      })
      showToast(snapshot.length === 1 ? 'Approved 1 suggestion.' : `Approved ${snapshot.length} suggestions.`, 'success')
      void loadRulesAndUsage()
      void loadPending()
    } catch (e) {
      setAssignmentLabelByTxId(prevAssignments)
      showToast(e instanceof Error ? e.message : 'Approve all failed', 'error')
      void loadPending()
      void loadAssignmentsForList()
    } finally {
      setApproveAllBusy(false)
    }
  }, [
    assignmentLabelByTxId,
    loadAssignmentsForList,
    loadPending,
    loadRulesAndUsage,
    pendingApprovals,
    pendingLoading,
    showToast,
  ])

  const openLedgerFilterModal = useCallback(() => {
    setLedgerFilterDraft({ ...ledgerFiltersApplied })
    setLedgerFilterModalOpen(true)
  }, [ledgerFiltersApplied])

  const applyLedgerFilterModal = useCallback(() => {
    const normalized = withLedgerFilterKindsNormalizedIfAllSelected(ledgerFilterDraft, accountingKindOptions)
    setLedgerFiltersApplied(normalized)
    const raw = serializeBankingAccountingLedgerFiltersForStorage(normalized)
    if (raw == null) clearAccountingLedgerFiltersStorage(userId)
    else writeAccountingLedgerFiltersRaw(userId, raw)
    setLedgerFilterModalOpen(false)
  }, [ledgerFilterDraft, userId, accountingKindOptions])

  const cancelLedgerFilterModal = useCallback(() => {
    setLedgerFilterModalOpen(false)
  }, [])

  const clearLedgerFiltersAndClose = useCallback(() => {
    const d = defaultBankingAccountingLedgerFilters()
    setLedgerFiltersApplied(d)
    clearAccountingLedgerFiltersStorage(userId)
    setLedgerFilterModalOpen(false)
  }, [userId])

  const applyRulesWithSnapshot = useCallback(
    async (ruleRows: RuleRow[]) => {
      if (ruleRows.length === 0) {
        showToast('No rules defined.', 'info')
        return
      }
      setApplyRulesBusy(true)
      try {
        const enabled = ruleRows
          .filter((r) => r.enabled)
          .sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id))
        if (enabled.length === 0) {
          showToast('No enabled rules.', 'info')
          return
        }
        const pendingTx = new Set(
          (
            (await withSupabaseRetry(async () => {
              return supabase.from('mercury_accounting_label_suggestions').select('mercury_transaction_id').eq('status', 'pending')
            }, 'accounting apply pending ids')) ?? []
          ).map((r: { mercury_transaction_id: string }) => r.mercury_transaction_id),
        )
        const assigned = new Set(assignmentLabelByTxId.keys())
        const criteriaParsed = new Map<string, AccountingLabelRuleCriteriaV1 | null>()
        for (const r of enabled) {
          criteriaParsed.set(r.id, parseAccountingLabelRuleCriteria(r.criteria))
        }
        const toInsert: { mercury_transaction_id: string; rule_id: string; suggested_label_id: string }[] = []
        // Apply rules scans Banking-filtered rows only (not Accounting search / ledger modal filters / hide labeled).
        for (const tx of filteredTransactions) {
          if (assigned.has(tx.id) || pendingTx.has(tx.id)) continue
          let matchedRule: RuleRow | null = null
          for (const rule of enabled) {
            const crit = criteriaParsed.get(rule.id)
            if (crit == null || accountingRuleEffectiveClauseCount(crit) === 0) continue
            if (matchAccountingLabelRuleCriteria(tx, crit)) {
              matchedRule = rule
              break
            }
          }
          if (!matchedRule) continue
          toInsert.push({
            mercury_transaction_id: tx.id,
            rule_id: matchedRule.id,
            suggested_label_id: matchedRule.label_id,
          })
          pendingTx.add(tx.id)
        }
        if (toInsert.length === 0) {
          showToast('No new suggestions (all matched txs already labeled or pending).', 'success')
          return
        }
        const INSERT_CHUNK = 2000
        let created = 0
        for (let i = 0; i < toInsert.length; i += INSERT_CHUNK) {
          const slice = toInsert.slice(i, i + INSERT_CHUNK)
          const insertedBatch = await withSupabaseRetry(async () => {
            return supabase.rpc('bulk_insert_accounting_label_suggestions', { p_rows: slice })
          }, 'accounting bulk insert suggestions')
          created += insertedBatch ?? 0
        }
        showToast(
          created === 0
            ? 'No new suggestions (all matched txs already labeled or pending).'
            : `Created ${created} pending suggestion(s).`,
          'success',
        )
        void loadPending()
      } catch (e) {
        showToast(e instanceof Error ? e.message : 'Apply rules failed', 'error')
      } finally {
        setApplyRulesBusy(false)
      }
    },
    [assignmentLabelByTxId, filteredTransactions, showToast, loadPending],
  )

  const applyRules = useCallback(async () => {
    await applyRulesWithSnapshot(rules)
  }, [applyRulesWithSnapshot, rules])

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

  const openEditRuleModal = (rule: RuleRow) => {
    setRuleModalInitial(ruleRowToForm(rule, labels[0]?.id ?? rule.label_id))
    setEditingRuleId(rule.id)
    setRuleModalMountKey((k) => k + 1)
    setRuleModalOpen(true)
  }

  const runTestFromCriteria = useCallback(
    (c: AccountingLabelRuleCriteriaV1) => {
      const matched: MercuryTxRow[] = []
      // Rule test preview uses Banking-filtered rows only (not Accounting search / ledger modal filters).
      for (const tx of filteredTransactions) {
        if (matchAccountingLabelRuleCriteria(tx, c)) matched.push(tx)
      }
      setTestTotal(matched.length)
      setTestRows(matched.slice(0, TEST_PREVIEW_LIMIT))
      setTestModalOpen(true)
    },
    [filteredTransactions],
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

  const deleteRule = useCallback(
    async (rule: RuleRow) => {
      if (!window.confirm(`Delete rule "${rule.name}"? Pending suggestions for this rule will be removed.`)) return
      try {
        await withSupabaseRetry(async () => {
          return supabase.from('mercury_accounting_label_rules').delete().eq('id', rule.id)
        }, 'accounting delete rule')
        showToast('Rule deleted.', 'success')
        void loadRulesAndUsage()
        void loadPending()
      } catch (e) {
        showToast(e instanceof Error ? e.message : 'Delete failed', 'error')
      }
    },
    [loadPending, loadRulesAndUsage, showToast],
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
            {approveAllBusy ? 'Approving…' : 'Approve all'}
          </button>
        </div>
        <p style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', color: '#64748b' }}>
          Transactions matched by rules await confirmation. Choose a label if different from the suggestion, then Approve.
        </p>
        {pendingLoading ? (
          <div style={{ color: '#64748b' }}>Loading…</div>
        ) : pendingApprovals.length === 0 ? (
          <div style={{ color: '#64748b' }}>No pending suggestions.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {pendingApprovals.map((p) => (
              <div
                key={p.suggestionId}
                style={{
                  border: '1px solid #e5e7eb',
                  borderRadius: 8,
                  padding: '0.75rem 1rem',
                  background: '#fff',
                }}
              >
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
                  <div style={{ flex: '1 1 12rem', minWidth: 0 }}>
                    <div style={{ fontWeight: 600 }}>
                      {p.tx
                        ? `${formatUsd(Number(p.tx.amount))} · ${p.tx.counterparty_name ?? '—'}`
                        : `Transaction ${p.txId.slice(0, 8)}… (not in current list)`}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: 4 }}>
                      Rule: {p.ruleName} · Suggested: {p.suggestedLabelName}
                    </div>
                    {p.tx ? (
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 2 }}>
                        Posted {formatBankingDate(p.tx.posted_at)} · Bank: {mercuryBankDescriptionFromRaw(p.tx.raw) ?? '—'}
                      </div>
                    ) : null}
                  </div>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.8rem' }}>
                    <span>Accounting Label</span>
                    <select
                      value={p.suggestedLabelId}
                      disabled={approveAllBusy}
                      onChange={(e) => {
                        const next = e.target.value
                        setPendingApprovals((rows) =>
                          rows.map((r) =>
                            r.suggestionId === p.suggestionId ? { ...r, suggestedLabelId: next, suggestedLabelName: labelById.get(next)?.name ?? next } : r,
                          ),
                        )
                      }}
                      style={{ minWidth: 200, padding: '0.35rem 0.5rem' }}
                    >
                      {labels.map((L) => (
                        <option key={L.id} value={L.id}>
                          {L.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    disabled={approveAllBusy}
                    onClick={() => void handleApprove(p, p.suggestedLabelId)}
                    style={{
                      padding: '0.45rem 0.9rem',
                      fontWeight: 600,
                      background: approveAllBusy ? '#94a3b8' : '#059669',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 6,
                      cursor: approveAllBusy ? 'not-allowed' : 'pointer',
                    }}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    disabled={approveAllBusy}
                    onClick={() => void handleReject(p)}
                    style={{
                      padding: '0.45rem 0.9rem',
                      fontWeight: 600,
                      background: '#fff',
                      color: '#b91c1c',
                      border: '1px solid #fecaca',
                      borderRadius: 6,
                      cursor: approveAllBusy ? 'not-allowed' : 'pointer',
                    }}
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
            marginBottom: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                type="button"
                aria-expanded={rulesSectionExpanded}
                aria-controls={ACCOUNTING_RULES_SECTION_BODY_ID}
                aria-label={rulesSectionExpanded ? 'Collapse rules list' : 'Expand rules list'}
                title={rulesSectionExpanded ? 'Collapse rules list' : 'Expand rules list'}
                onClick={() => {
                  const next = !rulesSectionExpanded
                  setRulesSectionExpanded(next)
                  writeAccountingRulesSectionExpanded(userId, next)
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 28,
                  height: 28,
                  padding: 0,
                  border: '1px solid #e5e7eb',
                  borderRadius: 6,
                  background: '#fff',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  lineHeight: 1,
                  color: '#334155',
                }}
              >
                <span aria-hidden>{rulesSectionExpanded ? '▼' : '▶'}</span>
              </button>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>Rules</h2>
            </div>
            <button
              type="button"
              onClick={openNewRuleModal}
              disabled={labelsLoading || labels.length === 0}
              style={{
                padding: '0.4rem 0.85rem',
                fontWeight: 600,
                background: labelsLoading || labels.length === 0 ? '#e5e7eb' : '#2563eb',
                color: labelsLoading || labels.length === 0 ? '#64748b' : '#fff',
                border: 'none',
                borderRadius: 6,
                cursor: labelsLoading || labels.length === 0 ? 'not-allowed' : 'pointer',
              }}
            >
              New rule
            </button>
          </div>
          <button
            type="button"
            onClick={() => void applyRules()}
            disabled={applyRulesBusy || rulesLoading}
            style={{
              padding: '0.4rem 0.85rem',
              fontWeight: 600,
              background: applyRulesBusy || rulesLoading ? '#e5e7eb' : '#f1f5f9',
              color: applyRulesBusy || rulesLoading ? '#64748b' : '#0f172a',
              border: applyRulesBusy || rulesLoading ? '1px solid #e5e7eb' : '1px solid #e2e8f0',
              borderRadius: 6,
              cursor: applyRulesBusy || rulesLoading ? 'not-allowed' : 'pointer',
            }}
          >
            {applyRulesBusy ? 'Applying…' : 'Apply rules to transactions'}
          </button>
        </div>
        {rulesSectionExpanded ? (
          <div id={ACCOUNTING_RULES_SECTION_BODY_ID}>
            {rulesLoading ? (
              <div style={{ color: '#64748b' }}>Loading rules…</div>
            ) : rules.length === 0 ? (
              <div style={{ color: '#64748b' }}>No rules yet.</div>
            ) : (
              <>
                <label
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                    fontSize: '0.85rem',
                    marginBottom: '0.75rem',
                    width: '100%',
                    boxSizing: 'border-box',
                  }}
                >
                  <input
                    type="search"
                    aria-label="Search rules"
                    placeholder="Search rules…"
                    value={rulesTableSearchText}
                    onChange={(e) => setRulesTableSearchText(e.target.value)}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '0.45rem 0.65rem',
                      borderRadius: 6,
                      border: '1px solid #e5e7eb',
                    }}
                  />
                </label>
                {rulesFilteredForTable.length === 0 && rulesSearchNorm !== '' ? (
                  <div style={{ color: '#64748b' }}>No rules match this search.</div>
                ) : (
                  <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 8 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                      <thead>
                        <tr style={{ background: '#f9fafb' }}>
                          <th
                            scope="col"
                            aria-sort={
                              rulesTableSort.column === 'name'
                                ? rulesTableSort.direction === 'asc'
                                  ? 'ascending'
                                  : 'descending'
                                : 'none'
                            }
                            style={{ textAlign: 'left', padding: 0, borderBottom: '1px solid #e5e7eb' }}
                          >
                            <button
                              type="button"
                              onClick={() => onRulesSortHeaderClick('name')}
                              aria-label="Sort by name"
                              style={{
                                width: '100%',
                                boxSizing: 'border-box',
                                textAlign: 'left',
                                padding: '0.5rem 0.75rem',
                                border: 'none',
                                background: 'transparent',
                                cursor: 'pointer',
                                font: 'inherit',
                                color: 'inherit',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                              }}
                            >
                              Name
                              {rulesTableSort.column === 'name'
                                ? rulesTableSort.direction === 'asc'
                                  ? '\u00a0▲'
                                  : '\u00a0▼'
                                : null}
                            </button>
                          </th>
                          <th
                            scope="col"
                            aria-sort={
                              rulesTableSort.column === 'label'
                                ? rulesTableSort.direction === 'asc'
                                  ? 'ascending'
                                  : 'descending'
                                : 'none'
                            }
                            style={{ textAlign: 'left', padding: 0, borderBottom: '1px solid #e5e7eb' }}
                          >
                            <button
                              type="button"
                              onClick={() => onRulesSortHeaderClick('label')}
                              aria-label="Sort by label"
                              style={{
                                width: '100%',
                                boxSizing: 'border-box',
                                textAlign: 'left',
                                padding: '0.5rem 0.75rem',
                                border: 'none',
                                background: 'transparent',
                                cursor: 'pointer',
                                font: 'inherit',
                                color: 'inherit',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                              }}
                            >
                              Label
                              {rulesTableSort.column === 'label'
                                ? rulesTableSort.direction === 'asc'
                                  ? '\u00a0▲'
                                  : '\u00a0▼'
                                : null}
                            </button>
                          </th>
                          <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem', borderBottom: '1px solid #e5e7eb' }}>
                            Enabled
                          </th>
                          <th style={{ textAlign: 'right', padding: '0.5rem 0.75rem', borderBottom: '1px solid #e5e7eb' }}>
                            Approved uses
                          </th>
                          <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem', borderBottom: '1px solid #e5e7eb' }} />
                        </tr>
                      </thead>
                      <tbody>
                        {rulesSortedForTable.map((r) => {
                          const lbl = labelById.get(r.label_id)
                          return (
                            <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '0.5rem 0.75rem' }}>{r.name}</td>
                              <td style={{ padding: '0.5rem 0.75rem' }}>{lbl?.name ?? r.label_id.slice(0, 8)}</td>
                              <td style={{ padding: '0.5rem 0.75rem' }}>{r.enabled ? 'Yes' : 'No'}</td>
                              <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>
                                {ruleUsageApproved[r.id] ?? 0}
                              </td>
                              <td style={{ padding: '0.5rem 0.75rem' }}>
                                <button
                                  type="button"
                                  onClick={() => openEditRuleModal(r)}
                                  style={{
                                    marginRight: 8,
                                    padding: '2px 8px',
                                    fontSize: '0.8rem',
                                    border: 'none',
                                    background: 'transparent',
                                    color: '#2563eb',
                                    cursor: 'pointer',
                                    textDecoration: 'underline',
                                  }}
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void deleteRule(r)}
                                  style={{
                                    padding: '2px 8px',
                                    fontSize: '0.8rem',
                                    border: 'none',
                                    background: 'transparent',
                                    color: '#b91c1c',
                                    cursor: 'pointer',
                                    textDecoration: 'underline',
                                  }}
                                >
                                  Delete
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        ) : null}
      </section>

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
              onChange={(e) => {
                const v = e.target.checked
                setHideLabeledTransactions(v)
                writeAccountingHideLabeledTransactions(userId, v)
              }}
            />
            Hide labeled transactions
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
                onCounterpartyHeaderClick={() => setCounterpartyFrequencyModalOpen(true)}
              />
              <tbody>
                {displayTransactions.map((r) => {
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
            <strong>More filters</strong>, and <strong>Hide labeled transactions</strong> when that option is on).
          </>
        }
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
              {testRows.map((tx) => (
                <li key={tx.id} style={{ marginBottom: 6 }}>
                  {formatUsd(Number(tx.amount))} · {tx.counterparty_name ?? '—'} · {formatBankingDate(tx.posted_at)}
                </li>
              ))}
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
    </>
  )
}
