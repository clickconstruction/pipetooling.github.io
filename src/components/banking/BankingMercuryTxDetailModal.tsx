import { useCallback, useEffect, useMemo, useState } from 'react'
import { useToastContext } from '../../contexts/ToastContext'
import { supabase } from '../../lib/supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { APP_CALENDAR_TZ } from '../../utils/dateUtils'
import { formatMercuryKind } from '../../lib/mercuryKindLabels'
import { isInternalTransfersLabel } from '../../lib/dragSortDefaultLabels'
import { formatMercuryDebitCardIdCompact, mercuryDebitCardIdFromRaw } from '../../lib/mercuryRawDebitCard'
import { SearchableSelect, type SearchableSelectOption } from '../SearchableSelect'
import {
  MercuryTransactionAllocationsModal,
  type MercuryJobSplit,
} from '../MercuryTransactionAllocationsModal'
import { formatSankeyUsd } from '../../lib/banking/mercurySankeyLayout'
import type { Database } from '../../types/database'
import type { VisualsLabelRow } from './BankingMercuryVisualsTab'

type MercuryTxRow = Database['public']['Tables']['mercury_transactions']['Row']

/**
 * Two-pane transaction detail modal for the Visuals drill-down (v2.1715):
 * left = Mercury's record, read-only (with the raw JSON and a link to the
 * Mercury dashboard); right = the qualities the rest of the app computes
 * from — accounting label, person & job splits, note. Fetches its own full
 * row + relations on open (the drill-down list deliberately loads narrow
 * columns), so callers only hand it a tx id and the tab's lookup maps.
 *
 * Stacks above the drill-down list (z 1100 vs 1080) and below the shared
 * splits modal (z 1150), so "Edit splits" opens on top of everything.
 */

const DETAIL_Z = 1100

export type TxDetailChange = { kind: 'label'; labelId: string | null; labelName: string | null } | { kind: 'relations' }

type TxRelations = {
  allocations: MercuryJobSplit[]
  personId: string | null
  userId: string | null
}

async function fetchTxDetail(txId: string): Promise<{ row: MercuryTxRow; relations: TxRelations }> {
  const [rowData, allocData, attrData] = await Promise.all([
    withSupabaseRetry(
      async () => supabase.from('mercury_transactions').select('*').eq('id', txId).limit(1),
      'tx detail row',
    ),
    withSupabaseRetry(
      async () =>
        supabase.from('mercury_transaction_job_allocations').select('job_id, amount, note').eq('mercury_transaction_id', txId),
      'tx detail allocations',
    ),
    withSupabaseRetry(
      async () =>
        supabase.from('mercury_transaction_attributions').select('person_id, user_id').eq('mercury_transaction_id', txId).limit(1),
      'tx detail attribution',
    ),
  ])
  const row = ((rowData ?? []) as MercuryTxRow[])[0]
  if (!row) throw new Error('Transaction not found')
  const allocations = ((allocData ?? []) as { job_id: string; amount: number; note: string | null }[]).map((a) => {
    const split: MercuryJobSplit = { job_id: a.job_id, amount: Number(a.amount) }
    if (a.note != null && a.note !== '') split.note = a.note
    return split
  })
  const attr = ((attrData ?? []) as { person_id: string | null; user_id: string | null }[])[0]
  return { row, relations: { allocations, personId: attr?.person_id ?? null, userId: attr?.user_id ?? null } }
}

function formatPostedAt(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('en-US', {
    timeZone: APP_CALENDAR_TZ,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

const factLabelStyle: React.CSSProperties = {
  fontSize: '0.66rem',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: 'var(--text-slate-500)',
  marginTop: '0.55rem',
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt style={factLabelStyle}>{label}</dt>
      <dd style={{ margin: 0, fontSize: '0.82rem', wordBreak: 'break-word' }}>{children}</dd>
    </>
  )
}

const sectionTitleStyle: React.CSSProperties = {
  fontSize: '0.66rem',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: 'var(--text-slate-500)',
  marginBottom: '0.35rem',
}

export function BankingMercuryTxDetailModal({
  txId,
  labels,
  jobLabelById,
  accountLabel,
  nicknameByAccount,
  nicknameByDebitCard,
  usersOptions,
  operatorUserId,
  personLabel,
  onClose,
  onChanged,
}: {
  txId: string
  labels: VisualsLabelRow[]
  jobLabelById: Record<string, string>
  accountLabel: (id: string) => string
  nicknameByAccount: Record<string, string>
  nicknameByDebitCard: Record<string, string>
  usersOptions: { value: string; label: string }[]
  /** Logged-in operator's auth user id (enables recent-person chips in the splits modal). */
  operatorUserId: string | null
  /** Display name from the tab's attribution cache, for the splits summary. */
  personLabel: string | null
  onClose: () => void
  onChanged: (change: TxDetailChange) => void
}) {
  const { showToast } = useToastContext()
  const [row, setRow] = useState<MercuryTxRow | null>(null)
  const [relations, setRelations] = useState<TxRelations | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [labelSaving, setLabelSaving] = useState(false)
  const [labelSavedTick, setLabelSavedTick] = useState(false)
  const [noteDraft, setNoteDraft] = useState('')
  const [noteSaving, setNoteSaving] = useState(false)
  const [splitsOpen, setSplitsOpen] = useState(false)

  const load = useCallback(async () => {
    setLoadError(null)
    try {
      const d = await fetchTxDetail(txId)
      setRow(d.row)
      setRelations(d.relations)
      setNoteDraft(d.row.note ?? '')
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Failed to load transaction')
    }
  }, [txId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !splitsOpen) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, splitsOpen])

  const [labelId, setLabelId] = useState<string>('')
  const [labelHydrated, setLabelHydrated] = useState(false)
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const data = await withSupabaseRetry(
          async () =>
            supabase.from('mercury_transaction_drag_sort_assignments').select('label_id').eq('mercury_transaction_id', txId).limit(1),
          'tx detail assignment',
        )
        if (cancelled) return
        const first = ((data ?? []) as { label_id: string }[])[0]
        setLabelId(first?.label_id ?? '')
        setLabelHydrated(true)
      } catch {
        if (!cancelled) setLabelHydrated(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [txId])

  const labelOptions: SearchableSelectOption[] = useMemo(
    () =>
      labels.map((l) => ({
        value: l.id,
        label: l.schedule_c_line ? `${l.name} · ${l.schedule_c_line}` : l.name,
      })),
    [labels],
  )

  const handleLabelChange = useCallback(
    async (nextId: string) => {
      if (nextId === labelId) return
      const nextLabel = labels.find((l) => l.id === nextId)
      // Internal Transfers × job splits are mutually exclusive (same guard as
      // Drag Sort, Accounting quick-assign, and bulk approve).
      if (nextId && isInternalTransfersLabel(nextLabel) && (relations?.allocations.length ?? 0) > 0) {
        showToast('Internal Transfers cannot be applied to a transaction with job splits. Clear the splits first.', 'error')
        return
      }
      const prev = labelId
      setLabelId(nextId)
      setLabelSaving(true)
      try {
        if (nextId === '') {
          await withSupabaseRetry(
            async () => supabase.from('mercury_transaction_drag_sort_assignments').delete().eq('mercury_transaction_id', txId),
            'tx detail clear label',
          )
        } else {
          await withSupabaseRetry(
            async () =>
              supabase
                .from('mercury_transaction_drag_sort_assignments')
                .upsert({ mercury_transaction_id: txId, label_id: nextId }, { onConflict: 'mercury_transaction_id' }),
            'tx detail assign label',
          )
        }
        onChanged({ kind: 'label', labelId: nextId || null, labelName: nextLabel?.name ?? null })
        setLabelSavedTick(true)
        window.setTimeout(() => setLabelSavedTick(false), 2000)
      } catch (e) {
        setLabelId(prev)
        showToast(e instanceof Error ? e.message : 'Failed to save label', 'error')
      } finally {
        setLabelSaving(false)
      }
    },
    [labelId, labels, relations, txId, onChanged, showToast],
  )

  const noteDirty = row != null && noteDraft !== (row.note ?? '')
  const handleNoteSave = useCallback(async () => {
    if (!row) return
    setNoteSaving(true)
    try {
      await withSupabaseRetry(
        async () => supabase.from('mercury_transactions').update({ note: noteDraft || null }).eq('id', row.id),
        'tx detail save note',
      )
      setRow({ ...row, note: noteDraft || null })
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to save note', 'error')
    } finally {
      setNoteSaving(false)
    }
  }, [row, noteDraft, showToast])

  const debitCardId = row ? mercuryDebitCardIdFromRaw(row.raw) : null
  const splitsSummary = useMemo(() => {
    if (!relations) return '…'
    if (relations.allocations.length === 0) return null
    return relations.allocations
      .map((a) => `${jobLabelById[a.job_id] ?? 'Unknown job'} ${formatSankeyUsd(a.amount)}`)
      .join(' · ')
  }, [relations, jobLabelById])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Transaction detail"
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: DETAIL_Z, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', width: 'min(760px, 100%)', maxHeight: '86vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', padding: '0.9rem 1.25rem 0.7rem', borderBottom: '1px solid var(--border)' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{row?.counterparty_name ?? '…'}</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-slate-500)' }}>
              {row ? `${formatPostedAt(row.posted_at)} · ${formatMercuryKind(row.kind)}` : 'Loading…'}
            </div>
          </div>
          <div style={{ marginLeft: 'auto', textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
              {row ? `${row.amount < 0 ? '−' : '+'}${formatSankeyUsd(row.amount)}` : ''}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-slate-500)' }}>{row ? accountLabel(row.mercury_account_id) : ''}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close transaction detail"
            style={{ padding: '0.3rem 0.7rem', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-slate-600)', cursor: 'pointer', fontSize: '0.82rem', flexShrink: 0 }}
          >
            Close
          </button>
        </div>

        {loadError ? (
          <div style={{ padding: '1rem 1.25rem', color: 'var(--text-red-600)', fontSize: '0.9rem' }}>{loadError}</div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', overflowY: 'auto' }}>
            {/* Left — Mercury's record, read-only */}
            <div style={{ flex: '1 1 280px', minWidth: 260, background: 'var(--bg-slate-tint)', borderRight: '1px solid var(--border)', padding: '0.9rem 1.1rem 1.1rem' }}>
              <div style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-slate-500)' }}>
                MERCURY'S RECORD · READ-ONLY
              </div>
              <dl style={{ margin: 0 }}>
                <Fact label="Posted">{formatPostedAt(row?.posted_at ?? null)}</Fact>
                <Fact label="Status">{row?.status ?? '—'}</Fact>
                <Fact label="Kind">{row ? formatMercuryKind(row.kind) : '—'}</Fact>
                {debitCardId ? (
                  <Fact label="Card">
                    {nicknameByDebitCard[debitCardId.toLowerCase()] ?? formatMercuryDebitCardIdCompact(debitCardId)}
                  </Fact>
                ) : null}
                <Fact label="Counterparty">{row?.counterparty_name ?? '—'}</Fact>
                <Fact label="Bank memo">{row?.external_memo ?? '—'}</Fact>
                <Fact label="Source">{row?.source ?? '—'}</Fact>
              </dl>
              {row?.raw != null ? (
                <details style={{ marginTop: '0.8rem', fontSize: '0.75rem', color: 'var(--text-slate-500)' }}>
                  <summary style={{ cursor: 'pointer' }}>Raw JSON</summary>
                  <pre style={{ fontSize: '0.66rem', overflowX: 'auto', maxHeight: 220, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '0.5rem' }}>
                    {JSON.stringify(row.raw, null, 2)}
                  </pre>
                </details>
              ) : null}
              {row?.dashboard_link ? (
                <div style={{ marginTop: '0.7rem' }}>
                  <a href={row.dashboard_link} target="_blank" rel="noreferrer" style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-link)', textDecoration: 'none' }}>
                    Open in Mercury ↗
                  </a>
                </div>
              ) : null}
            </div>

            {/* Right — your books, editable */}
            <div style={{ flex: '1 1 340px', minWidth: 300 }}>
              <div style={{ padding: '0.8rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
                <div style={sectionTitleStyle}>Accounting label</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <div style={{ flex: 1 }}>
                    <SearchableSelect
                      value={labelId}
                      onChange={(v) => void handleLabelChange(v)}
                      options={labelOptions}
                      placeholder={labelHydrated ? 'No label — pick one' : 'Loading…'}
                      disabled={!labelHydrated || labelSaving}
                      emptyOption={{ value: '', label: 'No label' }}
                      listAriaLabel="Accounting labels"
                      portalZIndex={DETAIL_Z + 100}
                      triggerMinHeightPx={38}
                    />
                  </div>
                  {labelSavedTick ? (
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-green-800)', whiteSpace: 'nowrap' }}>saved ✓</span>
                  ) : null}
                </div>
              </div>

              <div style={{ padding: '0.8rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
                <div style={sectionTitleStyle}>Person & job splits</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <div style={{ flex: 1, minWidth: 0, fontSize: '0.84rem' }}>
                    <div>
                      {personLabel ?? <span style={{ color: 'var(--text-slate-500)' }}>No person</span>}
                      {' · '}
                      {splitsSummary === '…' ? (
                        '…'
                      ) : splitsSummary ? (
                        <span style={{ color: 'var(--text-slate-600)' }}>{splitsSummary}</span>
                      ) : (
                        <span style={{ fontSize: '0.7rem', fontWeight: 600, padding: '0.12rem 0.55rem', borderRadius: 999, background: 'var(--bg-amber-100)', color: 'var(--text-amber-800)' }}>
                          not split to a job
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-slate-500)', marginTop: 2 }}>
                      Splits feed job costs and the Cards → jobs view.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSplitsOpen(true)}
                    disabled={row == null || relations == null}
                    style={{ padding: '0.35rem 0.85rem', borderRadius: 6, border: 'none', background: '#2563eb', color: '#fff', fontWeight: 600, fontSize: '0.78rem', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}
                  >
                    Edit splits
                  </button>
                </div>
              </div>

              <div style={{ padding: '0.8rem 1.25rem' }}>
                <div style={sectionTitleStyle}>Note</div>
                <textarea
                  value={noteDraft}
                  onChange={(e) => setNoteDraft(e.target.value)}
                  placeholder="Add a note — shows on the Ledger and Drag Sort…"
                  rows={2}
                  style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', border: '1px solid var(--border-strong)', borderRadius: 8, padding: '0.45rem 0.7rem', fontSize: '0.82rem', fontFamily: 'inherit', background: 'var(--surface)', color: 'inherit' }}
                />
                {noteDirty ? (
                  <div style={{ marginTop: '0.4rem', textAlign: 'right' }}>
                    <button
                      type="button"
                      onClick={() => void handleNoteSave()}
                      disabled={noteSaving}
                      style={{ padding: '0.3rem 0.8rem', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-slate-600)', fontWeight: 600, fontSize: '0.76rem', cursor: 'pointer' }}
                    >
                      {noteSaving ? 'Saving…' : 'Save note'}
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        )}
      </div>

      {splitsOpen && row && relations ? (
        <div onClick={(e) => e.stopPropagation()}>
          <MercuryTransactionAllocationsModal
            open
            onClose={() => setSplitsOpen(false)}
            transaction={row}
            initialAllocations={relations.allocations}
            initialPersonId={relations.personId}
            initialUserId={relations.userId}
            legacyPersonDisplayName={personLabel}
            jobLabelById={jobLabelById}
            usersOptions={usersOptions}
            nicknameByAccount={nicknameByAccount}
            nicknameByDebitCard={nicknameByDebitCard}
            recentPersonPicksStorageKey={operatorUserId}
            onSaved={() => {
              setSplitsOpen(false)
              void load()
              onChanged({ kind: 'relations' })
            }}
          />
        </div>
      ) : null}
    </div>
  )
}
