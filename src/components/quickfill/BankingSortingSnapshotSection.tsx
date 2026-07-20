import { useCallback, useEffect, useMemo, useState, type CSSProperties, type MouseEvent } from 'react'
import { Link } from 'react-router-dom'
import { useToastContext } from '../../contexts/ToastContext'
import { loadBankingSortingConfig } from '../../lib/bankingSortingConfig'
import {
  countSortingUnmatched,
  filterMercuryRowsForSorting,
  filterMercuryRowsIncompleteForSorting,
} from '../../lib/bankingSortingCounts'
import { formatCurrency } from '../../lib/format'
import { formatMercuryDebitCardIdCompact, mercuryDebitCardIdFromRaw } from '../../lib/mercuryRawDebitCard'
import { shortUuidPrefix } from '../../lib/shortUuidPrefix'
import { supabase } from '../../lib/supabase'
import {
  MercuryTransactionAllocationsModal,
  type MercuryAllocSavedDetail,
  type MercuryJobSplit,
} from '../MercuryTransactionAllocationsModal'
import type { SearchableSelectOption } from '../SearchableSelect'
import type { Database } from '../../types/database'
import { useAuth } from '../../hooks/useAuth'
import { useReportQuickfillSectionMetric } from '../../contexts/QuickfillSectionMetricsContext'
import { fetchAttributionsByMercuryTxIds, fetchJobAllocationsByMercuryTxIds } from '../../lib/fetchMercuryRelationsByTxIds'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { isAssistantLike } from '../../lib/subcontractorLikeRole'

type MercuryTxRow = Database['public']['Tables']['mercury_transactions']['Row']

const PAGE_SIZE = 5

const bankingAllocLinkButtonStyle: CSSProperties = {
  fontSize: '0.75rem',
  fontWeight: 600,
  padding: '4px 10px',
  borderRadius: 8,
  border: '1px solid #ca8a04',
  background: '#fde047',
  color: '#422006',
  cursor: 'pointer',
  fontFamily: 'inherit',
  flexShrink: 0,
}

/** Allocations + attributions + job/person label maps for a fixed list of mercury tx ids (chunked fetches inside). */
async function fetchMercuryRelationsState(
  ids: string[],
  operationPrefix: string,
): Promise<{
  allocMap: Map<string, MercuryJobSplit[]>
  personMap: Map<string, string | null>
  userMap: Map<string, string | null>
  jobLabelById: Record<string, string>
  personNameById: Record<string, string>
}> {
  const [allocRows, attrRows] = await Promise.all([
    fetchJobAllocationsByMercuryTxIds(ids, operationPrefix),
    fetchAttributionsByMercuryTxIds(ids, operationPrefix),
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

  const personMap = new Map<string, string | null>()
  const userMap = new Map<string, string | null>()
  for (const row of attrRows) {
    personMap.set(row.mercury_transaction_id, row.person_id)
    userMap.set(row.mercury_transaction_id, row.user_id)
  }
  for (const id of ids) {
    if (!personMap.has(id)) personMap.set(id, null)
    if (!userMap.has(id)) userMap.set(id, null)
  }

  const jobIds = [...new Set(allocRows.map((r) => r.job_id))]
  const jobLabelById: Record<string, string> = {}
  if (jobIds.length > 0) {
    const jobRowsData = await withSupabaseRetry(
      async () => supabase.from('jobs_ledger').select('id, hcp_number, job_name').in('id', jobIds),
      `${operationPrefix} jobs_ledger labels`,
    )
    for (const j of jobRowsData ?? []) {
      const row = j as { id: string; hcp_number?: string | null; job_name?: string | null }
      const label = `${row.hcp_number ?? ''} · ${row.job_name ?? ''}`.trim()
      jobLabelById[row.id] = label || row.id
    }
  }

  const personIds = new Set<string>()
  for (const row of attrRows) {
    if (row.person_id) personIds.add(row.person_id)
  }
  const personNameById: Record<string, string> = {}
  if (personIds.size > 0) {
    const peopleRowsData = await withSupabaseRetry(
      async () => supabase.from('people').select('id, name').in('id', [...personIds]),
      `${operationPrefix} people names`,
    )
    for (const p of peopleRowsData ?? []) {
      const row = p as { id: string; name: string }
      personNameById[row.id] = row.name
    }
  }

  return { allocMap, personMap, userMap, jobLabelById, personNameById }
}

/** Account + debit card nickname maps for display; never throws (non-fatal for snapshot). */
async function fetchMercuryNicknameMaps(operationPrefix: string): Promise<{
  nicknameByAccount: Record<string, string>
  nicknameByDebitCard: Record<string, string>
}> {
  const empty: {
    nicknameByAccount: Record<string, string>
    nicknameByDebitCard: Record<string, string>
  } = { nicknameByAccount: {}, nicknameByDebitCard: {} }
  try {
    const [accRaw, debRaw] = await Promise.all([
      withSupabaseRetry(
        async () => supabase.from('mercury_account_nicknames').select('mercury_account_id, nickname'),
        `${operationPrefix} mercury_account_nicknames`,
      ),
      withSupabaseRetry(
        async () => supabase.from('mercury_debit_card_nicknames').select('mercury_debit_card_id, nickname'),
        `${operationPrefix} mercury_debit_card_nicknames`,
      ),
    ])
    const nicknameByAccount: Record<string, string> = {}
    const nicknameByDebitCard: Record<string, string> = {}
    const accList =
      (accRaw ?? []) as Pick<
        Database['public']['Tables']['mercury_account_nicknames']['Row'],
        'mercury_account_id' | 'nickname'
      >[]
    for (const row of accList) nicknameByAccount[row.mercury_account_id] = row.nickname
    const debList =
      (debRaw ?? []) as Pick<
        Database['public']['Tables']['mercury_debit_card_nicknames']['Row'],
        'mercury_debit_card_id' | 'nickname'
      >[]
    for (const row of debList) {
      nicknameByDebitCard[String(row.mercury_debit_card_id).toLowerCase()] = row.nickname
    }
    return { nicknameByAccount, nicknameByDebitCard }
  } catch {
    return empty
  }
}

function formatPostedDate(iso: string | null): string {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}

export function BankingSortingSnapshotSection() {
  const { user: authUser, role } = useAuth()
  const { showToast } = useToastContext()
  const [mercuryRows, setMercuryRows] = useState<MercuryTxRow[]>([])
  const [personIdByTxId, setPersonIdByTxId] = useState<Map<string, string | null>>(() => new Map())
  const [userIdByTxId, setUserIdByTxId] = useState<Map<string, string | null>>(() => new Map())
  const [allocationsByTxId, setAllocationsByTxId] = useState<Map<string, MercuryJobSplit[]>>(() => new Map())
  const [jobLabelById, setJobLabelById] = useState<Record<string, string>>({})
  const [personNameById, setPersonNameById] = useState<Record<string, string>>({})
  const [usersSelectOptions, setUsersSelectOptions] = useState<SearchableSelectOption[]>([])
  const [allocModalTx, setAllocModalTx] = useState<MercuryTxRow | null>(null)
  const [nicknameByAccount, setNicknameByAccount] = useState<Record<string, string>>({})
  const [nicknameByDebitCard, setNicknameByDebitCard] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(0)

  const canAccessBanking = role === 'dev' || role === 'master_technician' || isAssistantLike(role)

  const loadMercurySnapshot = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!canAccessBanking || !authUser?.id) return
      const silent = options?.silent === true
      if (!silent) {
        setLoading(true)
        setError(null)
      }
      try {
        const data = await withSupabaseRetry(
          async () =>
            supabase
              .from('mercury_transactions')
              .select('*')
              .order('posted_at', { ascending: false, nullsFirst: false })
              .limit(5000),
          'quickfill mercury_transactions snapshot',
        )
        const rows = (data as MercuryTxRow[]) ?? []

        if (rows.length === 0) {
          setMercuryRows([])
          setPersonIdByTxId(new Map())
          setUserIdByTxId(new Map())
          setAllocationsByTxId(new Map())
          setJobLabelById({})
          setPersonNameById({})
          setNicknameByAccount({})
          setNicknameByDebitCard({})
          return
        }

        const ids = rows.map((r) => r.id)
        const [rel, { nicknameByAccount: accountNick, nicknameByDebitCard: debitNick }] = await Promise.all([
          fetchMercuryRelationsState(ids, 'quickfill'),
          fetchMercuryNicknameMaps('quickfill'),
        ])

        setMercuryRows(rows)
        setAllocationsByTxId(rel.allocMap)
        setPersonIdByTxId(rel.personMap)
        setUserIdByTxId(rel.userMap)
        setJobLabelById(rel.jobLabelById)
        setPersonNameById(rel.personNameById)
        setNicknameByAccount(accountNick)
        setNicknameByDebitCard(debitNick)
      } catch (e) {
        if (silent) {
          showToast(e instanceof Error ? e.message : 'Banking snapshot refresh failed.', 'error')
        } else {
          setError(e instanceof Error ? e.message : 'Failed to load banking snapshot')
        }
      } finally {
        if (!silent) setLoading(false)
      }
    },
    [authUser?.id, canAccessBanking, showToast],
  )

  const reloadMercuryRelations = useCallback(async () => {
    const ids = mercuryRows.map((r) => r.id)
    if (ids.length === 0) return
    try {
      const rel = await fetchMercuryRelationsState(ids, 'quickfill-reload')
      setAllocationsByTxId(rel.allocMap)
      setPersonIdByTxId(rel.personMap)
      setUserIdByTxId(rel.userMap)
      setJobLabelById(rel.jobLabelById)
      setPersonNameById(rel.personNameById)
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not refresh person/job links.', 'error')
    }
  }, [mercuryRows, showToast])

  const applyOptimisticAllocSave = useCallback((detail: MercuryAllocSavedDetail) => {
    const tid = detail.mercuryTransactionId
    setPersonIdByTxId((prev) => {
      const next = new Map(prev)
      next.set(tid, detail.personId)
      return next
    })
    setUserIdByTxId((prev) => {
      const next = new Map(prev)
      next.set(tid, detail.userId)
      return next
    })
    setAllocationsByTxId((prev) => {
      const next = new Map(prev)
      next.set(tid, detail.allocations)
      return next
    })
  }, [])

  useEffect(() => {
    if (!canAccessBanking || !authUser?.id) {
      setMercuryRows([])
      setPersonIdByTxId(new Map())
      setUserIdByTxId(new Map())
      setAllocationsByTxId(new Map())
      setJobLabelById({})
      setPersonNameById({})
      setUsersSelectOptions([])
      setAllocModalTx(null)
      setNicknameByAccount({})
      setNicknameByDebitCard({})
      setLoading(false)
      setError(null)
      return
    }
    void loadMercurySnapshot()
  }, [authUser?.id, canAccessBanking, loadMercurySnapshot])

  useEffect(() => {
    if (!canAccessBanking) return
    let cancelled = false
    void (async () => {
      try {
        const data = await withSupabaseRetry(
          () => supabase.rpc('list_users_for_banking_attribution'),
          'quickfill list users banking attribution',
        )
        if (cancelled) return
        const rowsU = (data ?? []) as { id: string; name: string }[]
        setUsersSelectOptions(rowsU.map((p) => ({ value: p.id, label: p.name })))
      } catch (e) {
        if (!cancelled) {
          setUsersSelectOptions([])
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

  const sortingConfig = useMemo(() => loadBankingSortingConfig(authUser?.id), [authUser?.id])
  const filtered = useMemo(() => filterMercuryRowsForSorting(mercuryRows, sortingConfig), [mercuryRows, sortingConfig])
  const visible = useMemo(
    () => filterMercuryRowsIncompleteForSorting(filtered, personIdByTxId, userIdByTxId, allocationsByTxId),
    [filtered, personIdByTxId, userIdByTxId, allocationsByTxId],
  )
  const counts = useMemo(
    () => countSortingUnmatched(visible, personIdByTxId, userIdByTxId, allocationsByTxId),
    [visible, personIdByTxId, userIdByTxId, allocationsByTxId],
  )

  useEffect(() => {
    setPage(0)
  }, [visible.length])

  const pageStart = page * PAGE_SIZE
  const previewRows = useMemo(
    () => visible.slice(pageStart, pageStart + PAGE_SIZE),
    [visible, pageStart],
  )
  const filteredLen = filtered.length
  const visibleLen = visible.length
  const canPrev = pageStart > 0
  const canNext = pageStart + PAGE_SIZE < visibleLen
  const showPager = visibleLen > PAGE_SIZE
  const rangeFrom = visibleLen === 0 ? 0 : pageStart + 1
  const rangeTo = visibleLen === 0 ? 0 : Math.min(pageStart + PAGE_SIZE, visibleLen)

  useReportQuickfillSectionMetric(
    'banking-sorting',
    !canAccessBanking || !authUser?.id ? null : loading || error ? null : visibleLen,
    !!(canAccessBanking && authUser?.id && loading),
  )

  if (!canAccessBanking) return null

  return (
    <section
      style={{
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: '1rem 1.25rem',
        background: 'var(--bg-page)',
      }}
    >
      {loading && <p style={{ margin: 0, textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</p>}
      {error && !loading && <p style={{ color: 'var(--text-red-700)', marginBottom: '1rem', textAlign: 'center' }}>{error}</p>}
      {!loading && !error && (
        <>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'center',
              gap: '0.75rem 1.25rem',
              marginBottom: '1rem',
              fontSize: '0.875rem',
              color: 'var(--text-muted)',
            }}
          >
            <span
              title="Rows in this list with no person or user linked (Person column shows Unassigned)."
              style={{ whiteSpace: 'nowrap' }}
            >
              Without person:{' '}
              <strong style={{ color: 'var(--text-slate-900)', fontWeight: 600 }}>{counts.withoutPerson}</strong>
            </span>
            <span
              title="Rows in this list with no job allocations (Jobs column shows Not split)."
              style={{ whiteSpace: 'nowrap' }}
            >
              Not split to jobs:{' '}
              <strong style={{ color: 'var(--text-slate-900)', fontWeight: 600 }}>{counts.withoutJobSplit}</strong>
            </span>
            <span
              title="All Mercury transactions matching your Banking sorting filters (including rows already fully attributed)."
              style={{ whiteSpace: 'nowrap' }}
            >
              Total available:{' '}
              <strong style={{ color: 'var(--text-slate-900)', fontWeight: 600 }}>{filteredLen}</strong>
            </span>
          </div>
          {visibleLen > 0 && (
            <>
              <p
                style={{
                  margin: '0 0 0.5rem',
                  fontSize: '0.875rem',
                  color: 'var(--text-700)',
                  textAlign: 'center',
                  fontWeight: 500,
                }}
              >
                Showing {rangeFrom}–{rangeTo} of {visibleLen}
              </p>
              <div style={{ overflowX: 'auto', marginBottom: '0.75rem' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <th style={{ padding: '0.5rem 0.4rem', textAlign: 'left' }}>Posted</th>
                      <th style={{ padding: '0.5rem 0.4rem', textAlign: 'right' }}>Amount</th>
                      <th style={{ padding: '0.5rem 0.4rem', textAlign: 'left' }}>Debit card</th>
                      <th style={{ padding: '0.5rem 0.4rem', textAlign: 'left' }}>Account</th>
                      <th style={{ padding: '0.5rem 0.4rem', textAlign: 'left' }}>Counterparty</th>
                      <th style={{ padding: '0.5rem 0.4rem', textAlign: 'left' }}>Person</th>
                      <th style={{ padding: '0.5rem 0.4rem', textAlign: 'left' }}>Jobs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((r) => {
                      const debitCardId = mercuryDebitCardIdFromRaw(r.raw)
                      const uid = userIdByTxId.get(r.id) ?? null
                      const pid = personIdByTxId.get(r.id) ?? null
                      const hasPerson = uid != null || pid != null
                      const hasJobSplit = (allocationsByTxId.get(r.id) ?? []).length > 0
                      const openAllocModal = (ev: MouseEvent<HTMLButtonElement>) => {
                        ev.stopPropagation()
                        setAllocModalTx(r)
                      }
                      return (
                        <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '0.5rem 0.4rem', whiteSpace: 'nowrap' }}>{formatPostedDate(r.posted_at)}</td>
                          <td style={{ padding: '0.5rem 0.4rem', textAlign: 'right' }}>${formatCurrency(Number(r.amount))}</td>
                          <td
                            style={{
                              padding: '0.5rem 0.4rem',
                              fontSize: '0.8125rem',
                              maxWidth: 120,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {debitCardId
                              ? nicknameByDebitCard[debitCardId] ?? formatMercuryDebitCardIdCompact(debitCardId)
                              : '—'}
                          </td>
                          <td
                            style={{
                              padding: '0.5rem 0.4rem',
                              fontSize: '0.8125rem',
                              maxWidth: 120,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {nicknameByAccount[r.mercury_account_id] ?? shortUuidPrefix(r.mercury_account_id)}
                          </td>
                          <td style={{ padding: '0.5rem 0.4rem', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {r.counterparty_name ?? '—'}
                          </td>
                          <td
                            style={{
                              padding: '0.5rem 0.4rem',
                              verticalAlign: 'middle',
                              color: hasPerson ? 'var(--text-green-800)' : undefined,
                            }}
                          >
                            {hasPerson ? (
                              'Assigned'
                            ) : (
                              <button
                                type="button"
                                style={bankingAllocLinkButtonStyle}
                                onClick={openAllocModal}
                                aria-label="Link to person and jobs for this transaction"
                              >
                                Link…
                              </button>
                            )}
                          </td>
                          <td
                            style={{
                              padding: '0.5rem 0.4rem',
                              verticalAlign: 'middle',
                              color: hasJobSplit ? 'var(--text-green-800)' : undefined,
                            }}
                          >
                            {hasJobSplit ? (
                              'Split'
                            ) : (
                              <button
                                type="button"
                                style={bankingAllocLinkButtonStyle}
                                onClick={openAllocModal}
                                aria-label="Link to person and jobs for this transaction"
                              >
                                Link…
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {showPager && (
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: '0.75rem',
                    marginBottom: '1rem',
                  }}
                >
                  <button
                    type="button"
                    disabled={!canPrev}
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    style={{
                      padding: '0.35rem 0.75rem',
                      borderRadius: 4,
                      border: '1px solid var(--border-strong)',
                      background: canPrev ? 'var(--surface)' : 'var(--bg-muted)',
                      cursor: canPrev ? 'pointer' : 'not-allowed',
                      fontSize: '0.8125rem',
                    }}
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={!canNext}
                    onClick={() => setPage((p) => p + 1)}
                    style={{
                      padding: '0.35rem 0.75rem',
                      borderRadius: 4,
                      border: '1px solid var(--border-strong)',
                      background: canNext ? 'var(--surface)' : 'var(--bg-muted)',
                      cursor: canNext ? 'pointer' : 'not-allowed',
                      fontSize: '0.8125rem',
                    }}
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
          {visibleLen === 0 && filteredLen > 0 ? (
            <p
              style={{
                margin: '0 0 1rem',
                textAlign: 'center',
                fontSize: '0.875rem',
                color: 'var(--text-muted)',
              }}
            >
              No incomplete transactions in your sorting list.
            </p>
          ) : null}
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <Link
              to="/banking?tab=sorting"
              style={{
                padding: '0.5rem 1rem',
                background: '#2563eb',
                color: 'white',
                textDecoration: 'none',
                borderRadius: 4,
                fontSize: '0.875rem',
                fontWeight: 500,
              }}
            >
              Open Banking User Sort
            </Link>
          </div>
        </>
      )}

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
        jobLabelById={jobLabelById}
        usersOptions={usersSelectOptions}
        nicknameByDebitCard={nicknameByDebitCard}
        nicknameByAccount={nicknameByAccount}
        recentPersonPicksStorageKey={authUser?.id ?? null}
        onSaved={(d) => {
          applyOptimisticAllocSave(d)
          void reloadMercuryRelations()
        }}
      />
    </section>
  )
}
