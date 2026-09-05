import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useToastContext } from '../../contexts/ToastContext'
import { bankingPersonKindTag, buildBankingAttributionOptions } from '../../lib/bankingAttributionOptions'
import { BankingMercuryTxDetailModal, type TxDetailChange } from './BankingMercuryTxDetailModal'
import { supabase } from '../../lib/supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { fetchAllRows } from '../../lib/supabasePaging'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { fetchAllAttributions, fetchAllJobAllocations } from '../../lib/fetchMercuryRelationsByTxIds'
import {
  formatSankeyUsd,
  layoutSankey,
  type SankeyInput,
  type SankeyTone,
} from '../../lib/banking/mercurySankeyLayout'
import { useSearchParams } from 'react-router-dom'
import {
  FAMILY_TONES,
  buildCardsJobsSankey,
  buildLabelFocusSankey,
  buildMoneyFlowSankey,
  buildTransferSankey,
  filterVisualsTxsByWindow,
  pairInternalTransfers,
  parseVisualsFocusParam,
  parseVisualsPeriodParam,
  serializeVisualsFocus,
  serializeVisualsSelection,
  visualsFamilyForLabel,
  visualsFocusTxs,
  visualsSelectionWindow,
  visualsYearsPresent,
  visualsZoomWindow,
  type VisualsFocus,
  type VisualsPeriod,
  type VisualsSelection,
  type VisualsTxRow,
} from '../../lib/banking/mercuryVisualsFlows'

/**
 * Banking → Mercury → Visuals (v2.1712): three Sankey views of where money
 * flows. Self-contained in the Reconciliation mold — zero props, own fetches
 * (the parent dispatcher skips the master 15k list while this tab is active).
 */

type VisualsView = 'flow' | 'accounts' | 'cards'

const VIEW_OPTIONS: { key: VisualsView; label: string }[] = [
  { key: 'flow', label: 'Where the money goes' },
  { key: 'accounts', label: 'Between accounts' },
  { key: 'cards', label: 'Cards → jobs' },
]
const PERIOD_OPTIONS: { key: VisualsPeriod; label: string }[] = [
  { key: 'month', label: 'This month' },
  { key: 'quarter', label: 'Quarter' },
  { key: 'ytd', label: 'YTD' },
  { key: 'all', label: 'All time' },
]

const VISUALS_TX_LIMIT = 15000
/** Saturated chart hues stay literal (like status colors); neutrals are theme tokens. */
const TONE_FILLS: Record<SankeyTone, string> = {
  series1: '#2a78d6',
  series2: '#eb6834',
  series3: '#1baf7a',
  series4: '#d99000',
  series5: '#e87ba4',
  series6: '#4a3aa7',
  neutral: 'var(--text-slate-400)',
  ink: 'var(--text-slate-600)',
  warn: '#f59e0b',
}

/** A tx row plus the display fields the drill-down list and focus mode use (v2.1713/v2.1717). */
type VisualsTxDetail = VisualsTxRow & {
  counterpartyName: string | null
  externalMemo: string | null
  bankDescription: string | null
}

export type VisualsLabelRow = {
  id: string
  name: string
  schedule_c_line: string | null
  default_key: string | null
}

type VisualsData = {
  txs: VisualsTxDetail[]
  txById: Map<string, VisualsTxDetail>
  labels: VisualsLabelRow[]
  labelIdByTxId: Map<string, string>
  labelNameByTxId: Map<string, string>
  personLabelByTxId: Map<string, string | null>
  personIdByTxId: Map<string, string | null>
  userIdByTxId: Map<string, string | null>
  allocationsByTxId: Map<string, { jobId: string; amount: number }[]>
  jobLabelById: Record<string, string>
  accountNameById: Record<string, string>
  nicknameByDebitCard: Record<string, string>
  usersOptions: { value: string; label: string }[]
  /** Combined people + users list for the Person picker (u:/p: prefixed values). */
  attributionOptions: ReturnType<typeof buildBankingAttributionOptions>
  truncated: boolean
}

/** The `mercury_transactions` select shape below — `fetchVisualsData` derives `VisualsTxRow` from it. */
type VisualsTxRaw = {
  id: string
  amount: number
  kind: string
  posted_at: string | null
  mercury_account_id: string
  duplicate_of_transaction_id: string | null
  counterparty_name: string | null
  external_memo: string | null
  bank_description: string | null
}

async function fetchVisualsData(): Promise<VisualsData> {
  const [txRows, labelRows, assignmentRows, nicknameRows, debitNicknameRows, usersOptionRows, peopleOptionRows, allocRows, attrRows] =
    await Promise.all([
      // Paged up to the REAL ceiling (Phase 4 #3(c)): a bare `.limit(15000)` is cut to
      // PostgREST's 1,000-row max_rows with no error, so every Visuals total covered the
      // newest ~1,000 of ~13k transactions and the "most recent 15,000" chip could never fire.
      fetchAllRows<VisualsTxRaw>(
        async (from, to) => ({
          data: (await withSupabaseRetry(
            async () =>
              supabase
                .from('mercury_transactions')
                // bank_description pulls ONE string out of the raw JSON server-side —
                // the raw column itself stays unfetched (it's large).
                .select('id, amount, kind, posted_at, mercury_account_id, duplicate_of_transaction_id, counterparty_name, external_memo, bank_description:raw->>bankDescription')
                .order('posted_at', { ascending: false })
                .order('id', { ascending: false })
                .range(from, to),
            'visuals mercury_transactions',
          )) as unknown as VisualsTxRaw[] | null,
          error: null,
        }),
        'visuals mercury_transactions',
        undefined,
        { maxRows: VISUALS_TX_LIMIT },
      ),
      withSupabaseRetry(
        async () =>
          supabase.from('mercury_drag_sort_labels').select('id, name, schedule_c_line, default_key').order('sort_order'),
        'visuals labels',
      ),
      // Same cap on the label assignments (the un-ranged `.limit(100000)` returned 1,000 of
      // 2,000+ rows, so most labeled transactions rendered as unlabeled here).
      fetchAllRows<{ mercury_transaction_id: string; label_id: string }>(
        async (from, to) => ({
          data: (await withSupabaseRetry(
            async () =>
              supabase
                .from('mercury_transaction_drag_sort_assignments')
                .select('mercury_transaction_id, label_id')
                .order('mercury_transaction_id')
                .range(from, to),
            'visuals label assignments',
          )) as { mercury_transaction_id: string; label_id: string }[] | null,
          error: null,
        }),
        'visuals label assignments',
      ),
      withSupabaseRetry(
        async () => supabase.from('mercury_account_nicknames').select('mercury_account_id, nickname'),
        'visuals account nicknames',
      ),
      withSupabaseRetry(
        async () => supabase.from('mercury_debit_card_nicknames').select('mercury_debit_card_id, nickname'),
        'visuals debit card nicknames',
      ),
      withSupabaseRetry(async () => supabase.rpc('list_users_for_banking_attribution'), 'visuals users options'),
      withSupabaseRetry(
        async () => supabase.rpc('list_people_with_kind_for_banking_attribution'),
        'visuals people options',
      ),
      fetchAllJobAllocations('visuals'),
      fetchAllAttributions('visuals'),
    ])

  const txs: VisualsTxDetail[] = ((txRows ?? []) as {
    id: string
    amount: number
    kind: string
    posted_at: string | null
    mercury_account_id: string
    duplicate_of_transaction_id: string | null
    counterparty_name: string | null
    external_memo: string | null
    bank_description: string | null
  }[]).map((r) => ({
    id: r.id,
    amount: Number(r.amount),
    kind: r.kind,
    postedYmd: r.posted_at ? calendarYmdInAppTzFromIso(r.posted_at) : '',
    accountId: r.mercury_account_id,
    isDuplicate: r.duplicate_of_transaction_id != null,
    counterpartyName: r.counterparty_name,
    externalMemo: r.external_memo,
    bankDescription: r.bank_description,
  }))

  const labels = (labelRows ?? []) as VisualsLabelRow[]
  const labelNameById = new Map<string, string>()
  for (const l of labels) labelNameById.set(l.id, l.name)
  const labelNameByTxId = new Map<string, string>()
  const labelIdByTxId = new Map<string, string>()
  for (const a of (assignmentRows ?? []) as { mercury_transaction_id: string; label_id: string }[]) {
    const name = labelNameById.get(a.label_id)
    if (name) {
      labelNameByTxId.set(a.mercury_transaction_id, name)
      labelIdByTxId.set(a.mercury_transaction_id, a.label_id)
    }
  }

  const accountNameById: Record<string, string> = {}
  for (const n of (nicknameRows ?? []) as { mercury_account_id: string; nickname: string }[]) {
    accountNameById[n.mercury_account_id] = n.nickname
  }
  const nicknameByDebitCard: Record<string, string> = {}
  for (const n of (debitNicknameRows ?? []) as { mercury_debit_card_id: string; nickname: string }[]) {
    nicknameByDebitCard[String(n.mercury_debit_card_id).toLowerCase()] = n.nickname
  }
  const usersOptions = ((usersOptionRows ?? []) as { id: string; name: string }[]).map((u) => ({
    value: u.id,
    label: u.name,
  }))
  const attributionOptions = buildBankingAttributionOptions(
    usersOptions,
    ((peopleOptionRows ?? []) as { id: string; name: string; kind: string | null; archived?: boolean }[]),
  )

  const allocationsByTxId = new Map<string, { jobId: string; amount: number }[]>()
  for (const row of allocRows) {
    const list = allocationsByTxId.get(row.mercury_transaction_id) ?? []
    list.push({ jobId: row.job_id, amount: Number(row.amount) })
    allocationsByTxId.set(row.mercury_transaction_id, list)
  }

  const personIds = new Set<string>()
  const userIds = new Set<string>()
  for (const row of attrRows) {
    if (row.person_id) personIds.add(row.person_id)
    if (row.user_id) userIds.add(row.user_id)
  }
  const [peopleRows, userRows] = await Promise.all([
    personIds.size > 0
      ? withSupabaseRetry(async () => supabase.from('people').select('id, name').in('id', [...personIds]), 'visuals people names')
      : Promise.resolve([]),
    userIds.size > 0
      ? withSupabaseRetry(async () => supabase.from('users').select('id, name').in('id', [...userIds]), 'visuals user names')
      : Promise.resolve([]),
  ])
  const personNameById = new Map<string, string>()
  for (const p of (peopleRows ?? []) as { id: string; name: string }[]) personNameById.set(p.id, p.name)
  const userNameById = new Map<string, string>()
  for (const u of (userRows ?? []) as { id: string; name: string | null }[]) {
    if (u.name) userNameById.set(u.id, u.name)
  }
  const personLabelByTxId = new Map<string, string | null>()
  const personIdByTxId = new Map<string, string | null>()
  const userIdByTxId = new Map<string, string | null>()
  for (const row of attrRows) {
    const name =
      (row.person_id ? personNameById.get(row.person_id) : undefined) ??
      (row.user_id ? userNameById.get(row.user_id) : undefined) ??
      null
    personLabelByTxId.set(row.mercury_transaction_id, name)
    personIdByTxId.set(row.mercury_transaction_id, row.person_id)
    userIdByTxId.set(row.mercury_transaction_id, row.user_id)
  }

  const jobIds = [...new Set(allocRows.map((r) => r.job_id))]
  const jobLabelById: Record<string, string> = {}
  if (jobIds.length > 0) {
    const jobRows = await withSupabaseRetry(
      async () => supabase.from('jobs_ledger').select('id, hcp_number, job_name').in('id', jobIds),
      'visuals job labels',
    )
    for (const j of (jobRows ?? []) as { id: string; hcp_number: string | null; job_name: string | null }[]) {
      const label = `${j.hcp_number ?? ''} · ${j.job_name ?? ''}`.replace(/^ · | · $/g, '').trim()
      jobLabelById[j.id] = label || j.id
    }
  }

  return {
    txs,
    txById: new Map(txs.map((t) => [t.id, t])),
    labels,
    labelIdByTxId,
    labelNameByTxId,
    personLabelByTxId,
    personIdByTxId,
    userIdByTxId,
    allocationsByTxId,
    jobLabelById,
    accountNameById,
    nicknameByDebitCard,
    usersOptions,
    attributionOptions,
    truncated: txs.length >= VISUALS_TX_LIMIT,
  }
}

function segButtonStyle(active: boolean): React.CSSProperties {
  return {
    padding: '0.35rem 0.8rem',
    fontSize: '0.82rem',
    fontWeight: active ? 700 : 500,
    background: active ? '#2563eb' : 'var(--surface)',
    color: active ? '#fff' : 'var(--text-slate-600)',
    border: '1px solid var(--border-strong)',
    cursor: 'pointer',
  }
}

/** Standalone rounded chip for the zoom rows (v2.1716). */
function zoomChipStyle(active: boolean, disabled: boolean): React.CSSProperties {
  return {
    padding: '0.32rem 0.7rem',
    fontSize: '0.8rem',
    fontWeight: active ? 700 : 500,
    background: active ? '#2563eb' : 'var(--surface)',
    color: active ? '#fff' : disabled ? 'var(--text-faint)' : 'var(--text-slate-600)',
    border: `1px solid ${active ? '#2563eb' : 'var(--border-strong)'}`,
    borderRadius: 8,
    cursor: disabled ? 'not-allowed' : 'pointer',
  }
}

function SegRow<T extends string>(props: {
  ariaLabel: string
  options: { key: T; label: string }[]
  /** null = nothing in this row is selected (e.g. a zoom is active instead). */
  value: T | null
  onChange: (v: T) => void
}) {
  return (
    <div role="group" aria-label={props.ariaLabel} style={{ display: 'inline-flex', borderRadius: 8, overflow: 'hidden' }}>
      {props.options.map((o) => (
        <button
          key={o.key}
          type="button"
          aria-pressed={props.value === o.key}
          onClick={() => props.onChange(o.key)}
          style={segButtonStyle(props.value === o.key)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export type SankeyRibbonClick = { title: string; txIds: string[] }

function SankeySvg({
  input,
  height,
  padRight,
  onRibbonClick,
  onNodeClick,
}: {
  input: SankeyInput
  height: number
  padRight?: number
  onRibbonClick?: (click: SankeyRibbonClick) => void
  /** Called for nodes the flow builder marked focusable (drill a layer deeper). */
  onNodeClick?: (nodeId: string, label: string) => void
}) {
  const layout = useMemo(
    () => layoutSankey(input, { width: 960, height, padLeft: 170, padRight: padRight ?? 230 }),
    [input, height, padRight],
  )
  if (!layout) {
    return <p style={{ color: 'var(--text-slate-500)', fontSize: '0.9rem' }}>Nothing to draw for this period.</p>
  }
  return (
    <div style={{ overflowX: 'auto' }}>
      <svg
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        style={{ display: 'block', width: '100%', minWidth: 860, height: 'auto' }}
        role="img"
      >
        {layout.links.map((l, i) => {
          const clickable = onRibbonClick != null && l.txIds.length > 0
          const title = `${l.sourceLabel} → ${l.targetLabel}`
          return (
            <path
              key={i}
              d={l.path}
              fill={TONE_FILLS[l.tone]}
              opacity={0.32}
              role={clickable ? 'button' : undefined}
              aria-label={clickable ? `${title}: see transactions` : undefined}
              style={clickable ? { cursor: 'pointer' } : undefined}
              onClick={clickable ? () => onRibbonClick({ title, txIds: l.txIds }) : undefined}
            >
              <title>{`${title}: ${formatSankeyUsd(l.value)}${clickable ? ' — click for transactions' : ''}`}</title>
            </path>
          )
        })}
        {layout.nodes.map((n) => {
          const h = Math.max(n.h, 2)
          const tx = n.labelSide === 'left' ? n.x - 8 : n.x + 18
          const anchor = n.labelSide === 'left' ? 'end' : 'start'
          const cy = n.y + h / 2
          const twoLine = h > 30
          const nodeClickable = onNodeClick != null && n.focusable === true
          return (
            <g key={n.id}>
              <rect
                x={n.x - (nodeClickable ? 2 : 0)}
                y={n.y}
                width={nodeClickable ? 14 : 10}
                height={h}
                rx={2}
                fill={TONE_FILLS[n.tone]}
                role={nodeClickable ? 'button' : undefined}
                aria-label={nodeClickable ? `Focus on ${n.label}` : undefined}
                style={nodeClickable ? { cursor: 'zoom-in' } : undefined}
                onClick={nodeClickable ? () => onNodeClick(n.id, n.label) : undefined}
              >
                <title>{`${n.label}: ${formatSankeyUsd(n.value)}${nodeClickable ? ' — click the bar to zoom into its payees' : ''}`}</title>
              </rect>
              {twoLine ? (
                <>
                  <text x={tx} y={cy - 3} textAnchor={anchor} fontSize={12} fontWeight={600} fill="var(--text-strong)">
                    {n.label}
                  </text>
                  <text x={tx} y={cy + 12} textAnchor={anchor} fontSize={11} fill="var(--text-slate-500)" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {formatSankeyUsd(n.value)}
                    {n.sublabel ? ` · ${n.sublabel}` : ''}
                  </text>
                </>
              ) : (
                <text x={tx} y={cy + 4} textAnchor={anchor} fontSize={11.5} fill="var(--text-strong)">
                  <tspan fontWeight={600}>{n.label}</tspan>{' '}
                  <tspan fill="var(--text-slate-500)" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {formatSankeyUsd(n.value)}
                  </tspan>
                </text>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

/** Rows shown at once in the drill-down list; the header always shows the full count/total. */
const DRILLDOWN_ROW_CAP = 400

function VisualsDrilldownModal({
  title,
  txs,
  accountLabel,
  onClose,
  onRowClick,
}: {
  title: string
  txs: VisualsTxDetail[]
  accountLabel: (id: string) => string
  onClose: () => void
  onRowClick: (txId: string) => void
}) {
  const sorted = useMemo(() => [...txs].sort((a, b) => b.postedYmd.localeCompare(a.postedYmd)), [txs])
  const total = useMemo(() => sorted.reduce((s, t) => s + Math.abs(t.amount), 0), [sorted])
  const shown = sorted.slice(0, DRILLDOWN_ROW_CAP)
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Transactions: ${title}`}
      onClick={onClose}
      // z 1080: below the tx detail modal (1100) and the shared splits modal (1150).
      style={{ position: 'fixed', inset: 0, zIndex: 1080, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)', width: 'min(720px, 100%)', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.8rem 1rem', borderBottom: '1px solid var(--border)' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{title}</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-slate-500)' }}>
              {sorted.length.toLocaleString()} transaction{sorted.length === 1 ? '' : 's'} · {formatSankeyUsd(total)}
              {sorted.length > shown.length ? ` · showing the ${DRILLDOWN_ROW_CAP} most recent` : ''}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close transactions"
            style={{ marginLeft: 'auto', padding: '0.3rem 0.7rem', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-slate-600)', cursor: 'pointer', fontSize: '0.82rem' }}
          >
            Close
          </button>
        </div>
        <div style={{ overflowY: 'auto', padding: '0.4rem 1rem 0.8rem' }}>
          {shown.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onRowClick(t.id)}
              aria-label={`Open transaction: ${t.counterpartyName ?? t.id}`}
              style={{ display: 'flex', width: '100%', boxSizing: 'border-box', gap: '0.7rem', alignItems: 'baseline', fontSize: '0.82rem', padding: '0.28rem 0.2rem', border: 'none', borderBottom: '1px solid var(--border)', background: 'none', color: 'inherit', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              <span style={{ minWidth: '5.6rem', color: 'var(--text-slate-500)', fontVariantNumeric: 'tabular-nums' }}>{t.postedYmd || '—'}</span>
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.counterpartyName ?? '—'}</span>
              <span style={{ color: 'var(--text-slate-500)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{accountLabel(t.accountId)}</span>
              <span style={{ minWidth: '6rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                {`${t.amount < 0 ? '−' : '+'}${formatSankeyUsd(t.amount)}`}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export function BankingMercuryVisualsTab() {
  const { user } = useAuth()
  const { showToast } = useToastContext()
  const [searchParams, setSearchParams] = useSearchParams()
  const [view, setView] = useState<VisualsView>('flow')
  const [selection, setSelection] = useState<VisualsSelection>(
    () => parseVisualsPeriodParam(searchParams.get('period')) ?? { kind: 'preset', preset: 'ytd' },
  )
  const [focus, setFocus] = useState<VisualsFocus | null>(() => parseVisualsFocusParam(searchParams.get('focus')))
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [data, setData] = useState<VisualsData | null>(null)
  const [drilldown, setDrilldown] = useState<SankeyRibbonClick | null>(null)
  const [detailTxId, setDetailTxId] = useState<string | null>(null)

  // silent: swap data in place without the loading state, so open modals
  // (drill-down list, tx detail) survive a background refresh after an edit.
  const load = useCallback(
    async (options?: { silent?: boolean }) => {
      if (options?.silent !== true) setLoading(true)
      setLoadError(null)
      try {
        setData(await fetchVisualsData())
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to load money flows'
        if (options?.silent !== true) setLoadError(msg)
        showToast(msg, 'error')
      } finally {
        if (options?.silent !== true) setLoading(false)
      }
    },
    [showToast],
  )

  useEffect(() => {
    void load()
  }, [load])

  // A drill-down list belongs to the layout it was clicked in.
  useEffect(() => {
    setDrilldown(null)
    setDetailTxId(null)
  }, [view, selection])

  // Shareable zoom + focus: ?period=2025q2&focus=label:Contract Labor
  // (defaults keep the URL clean).
  useEffect(() => {
    const periodTarget = serializeVisualsSelection(selection) === 'ytd' ? null : serializeVisualsSelection(selection)
    const focusTarget = focus ? serializeVisualsFocus(focus) : null
    if (searchParams.get('period') === periodTarget && searchParams.get('focus') === focusTarget) return
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev)
        if (periodTarget === null) p.delete('period')
        else p.set('period', periodTarget)
        if (focusTarget === null) p.delete('focus')
        else p.set('focus', focusTarget)
        return p
      },
      { replace: true },
    )
  }, [selection, focus, searchParams, setSearchParams])

  // Focus belongs to the money-flow view; leaving it zooms back out.
  useEffect(() => {
    if (view !== 'flow') setFocus(null)
  }, [view])

  // Esc zooms out of focus — but never underneath an open modal.
  useEffect(() => {
    if (!focus) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && drilldown == null && detailTxId == null) setFocus(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [focus, drilldown, detailTxId])

  /** An edit in the detail modal updates the caches the Sankeys compute from. */
  const handleTxDetailChange = useCallback(
    (txId: string, change: TxDetailChange) => {
      if (change.kind === 'label') {
        setData((prev) => {
          if (!prev) return prev
          const labelNameByTxId = new Map(prev.labelNameByTxId)
          const labelIdByTxId = new Map(prev.labelIdByTxId)
          if (change.labelId && change.labelName) {
            labelNameByTxId.set(txId, change.labelName)
            labelIdByTxId.set(txId, change.labelId)
          } else {
            labelNameByTxId.delete(txId)
            labelIdByTxId.delete(txId)
          }
          return { ...prev, labelNameByTxId, labelIdByTxId }
        })
        return
      }
      // Splits/attribution changed: refresh everything quietly (job labels and
      // person names may have new entries the local caches can't produce).
      void load({ silent: true })
    },
    [load],
  )

  const todayYmd = useMemo(() => calendarYmdInAppTzFromIso(new Date().toISOString()), [])
  const periodTxs = useMemo(
    () => (data ? filterVisualsTxsByWindow(data.txs, visualsSelectionWindow(selection, todayYmd)) : []),
    [data, selection, todayYmd],
  )
  const yearsPresent = useMemo(() => (data ? visualsYearsPresent(data.txs) : []), [data])
  const activeZoom = selection.kind === 'zoom' ? selection.zoom : null
  const zoomCaption = activeZoom ? visualsZoomWindow(activeZoom) : null

  const accountLabel = useCallback(
    (id: string): string => data?.accountNameById[id] ?? `Account ${id.slice(0, 8)}…`,
    [data],
  )

  const flow = useMemo(
    () =>
      data && view === 'flow' && focus == null
        ? buildMoneyFlowSankey({ txs: periodTxs, labelNameByTxId: data.labelNameByTxId })
        : null,
    [data, view, focus, periodTxs],
  )

  const focusResult = useMemo(() => {
    if (!data || view !== 'flow' || focus == null) return null
    const txs = visualsFocusTxs(periodTxs, data.labelNameByTxId, focus)
    const family = focus.type === 'family' ? focus.name : visualsFamilyForLabel(focus.name)
    return buildLabelFocusSankey({ title: focus.name, tone: FAMILY_TONES[family] ?? 'neutral', txs })
  }, [data, view, focus, periodTxs])

  /** "Add …" from the detail modal's Person picker (v2.1727): mints a roster sub. */
  const createPersonFromPicker = useCallback(
    async (name: string) => {
      const trimmed = name.trim()
      if (trimmed === '' || !user?.id) return null
      try {
        const rows = await withSupabaseRetry(
          async () => supabase.from('people').insert({ master_user_id: user.id, kind: 'sub', name: trimmed }).select('id, name').limit(1),
          'visuals create person from picker',
        )
        const row = ((rows ?? []) as { id: string; name: string }[])[0]
        if (!row) return null
        showToast(`Added ${row.name} to People (sub).`, 'success')
        return { value: `p:${row.id}`, label: `${row.name} · ${bankingPersonKindTag('sub')}` }
      } catch (e) {
        showToast(e instanceof Error ? e.message : 'Could not add person', 'error')
        return null
      }
    },
    [user?.id, showToast],
  )

  const handleNodeFocus = useCallback((nodeId: string) => {
    if (nodeId.startsWith('fam:')) setFocus({ type: 'family', name: nodeId.slice(4) })
    else if (nodeId.startsWith('label:')) setFocus({ type: 'label', name: nodeId.slice(6) })
  }, [])
  const transfers = useMemo(
    () =>
      data && view === 'accounts'
        ? buildTransferSankey({
            txs: periodTxs,
            pairing: pairInternalTransfers(periodTxs),
            accountLabelById: accountLabel,
            accountIsNamed: (id) => data.accountNameById[id] != null,
          })
        : null,
    [data, view, periodTxs, accountLabel],
  )
  const cards = useMemo(
    () =>
      data && view === 'cards'
        ? buildCardsJobsSankey({
            txs: periodTxs,
            personLabelByTxId: data.personLabelByTxId,
            allocationsByTxId: data.allocationsByTxId,
            jobLabelById: (id) => data.jobLabelById[id] ?? 'Unknown job',
          })
        : null,
    [data, view, periodTxs],
  )

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>Visuals</h2>
        <SegRow ariaLabel="Visuals view" options={VIEW_OPTIONS} value={view} onChange={setView} />
        <SegRow
          ariaLabel="Visuals period"
          options={PERIOD_OPTIONS}
          value={selection.kind === 'preset' ? selection.preset : null}
          onChange={(preset: VisualsPeriod) => setSelection({ kind: 'preset', preset })}
        />
        {yearsPresent.length > 0 ? (
          <span role="group" aria-label="Zoom to year" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-slate-500)', fontWeight: 600 }}>
              Zoom
            </span>
            {yearsPresent.map((year) => {
              const active = activeZoom?.year === year
              return (
                <button
                  key={year}
                  type="button"
                  aria-pressed={active}
                  onClick={() =>
                    setSelection(active ? { kind: 'preset', preset: 'ytd' } : { kind: 'zoom', zoom: { year, quarter: null } })
                  }
                  style={zoomChipStyle(active, false)}
                >
                  {year}
                </button>
              )
            })}
          </span>
        ) : null}
      </div>
      {activeZoom ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.35rem', marginBottom: '0.5rem' }} role="group" aria-label="Zoom to quarter">
          <button
            type="button"
            aria-pressed={activeZoom.quarter == null}
            onClick={() => setSelection({ kind: 'zoom', zoom: { year: activeZoom.year, quarter: null } })}
            style={zoomChipStyle(activeZoom.quarter == null, false)}
          >
            Full year
          </button>
          {([1, 2, 3, 4] as const).map((q) => {
            const future = visualsZoomWindow({ year: activeZoom.year, quarter: q }).startYmd > todayYmd
            const active = activeZoom.quarter === q
            return (
              <button
                key={q}
                type="button"
                aria-pressed={active}
                disabled={future}
                onClick={() => setSelection({ kind: 'zoom', zoom: { year: activeZoom.year, quarter: q } })}
                style={zoomChipStyle(active, future)}
              >
                {`Q${q}`}
              </button>
            )
          })}
          {zoomCaption ? (
            <span style={{ fontSize: '0.8rem', color: 'var(--text-slate-500)', marginLeft: '0.4rem' }}>
              <strong style={{ color: 'var(--text-strong)' }}>{zoomCaption.label}</strong>
              {` · ${zoomCaption.rangeLabel}`}
            </span>
          ) : null}
        </div>
      ) : null}

      <p style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: 'var(--text-slate-500)' }}>
        {view === 'flow'
          ? 'Every labeled dollar as a river: money in on the left, flowing out through expense families to your accounting labels. Duplicates and internal transfers are excluded, matching the books.'
          : view === 'accounts'
            ? 'The whole route: deposits on the far left, into accounts, between accounts, and out the far right as spending. Gray bands are money crossing the period boundary (from balances / kept).'
            : 'Card spend by person, flowing to the jobs it was split to. The amber band is spend not yet on any job — the same purchases the Dashboard asks you to sort.'}{' '}
        Click any ribbon to see the transactions behind it.
      </p>

      {loading ? <div style={{ color: 'var(--text-slate-500)' }}>Loading money flows…</div> : null}
      {loadError && !loading ? (
        <div style={{ color: 'var(--text-red-600)', fontSize: '0.9rem' }}>
          {loadError}{' '}
          <button type="button" onClick={() => void load()} style={{ marginLeft: 8, padding: '0.2rem 0.6rem', cursor: 'pointer' }}>
            Retry
          </button>
        </div>
      ) : null}

      {!loading && !loadError && data ? (
        <>
          {view === 'flow' && focus && focusResult ? (
            <>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.7rem', flexWrap: 'wrap', margin: '0.2rem 0 0.4rem' }}>
                <button
                  type="button"
                  onClick={() => setFocus(null)}
                  style={{ padding: '0.3rem 0.7rem', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--bg-blue-tint)', color: 'var(--text-link)', fontWeight: 600, fontSize: '0.78rem', cursor: 'pointer' }}
                >
                  ‹ All flows
                </button>
                <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{focus.name}</span>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-slate-500)' }}>
                  {formatSankeyUsd(focusResult.total)} · {focusResult.txCount.toLocaleString()} transaction
                  {focusResult.txCount === 1 ? '' : 's'} · {focusResult.payeeCount.toLocaleString()} payee
                  {focusResult.payeeCount === 1 ? '' : 's'}
                </span>
              </div>
              <SankeySvg input={focusResult.input} height={460} padRight={260} onRibbonClick={setDrilldown} />
              <p style={{ margin: '0.5rem 0 0', fontSize: '0.8rem', color: 'var(--text-slate-500)' }}>
                Payee ribbons click through to their transactions · Esc or ‹ All flows zooms back out
                {focusResult.memoSplitCount > 0
                  ? ` · ${focusResult.memoSplitCount.toLocaleString()} Cash App payment${focusResult.memoSplitCount === 1 ? '' : 's'} shown by the person named in the bank memo`
                  : ''}
              </p>
            </>
          ) : null}
          {view === 'flow' && !focus && flow ? (
            <>
              <SankeySvg input={flow.input} height={560} onRibbonClick={setDrilldown} onNodeClick={handleNodeFocus} />
              <p style={{ margin: '0.5rem 0 0', fontSize: '0.8rem', color: 'var(--text-slate-500)' }}>
                In {formatSankeyUsd(flow.totalIn)} · out {formatSankeyUsd(flow.totalOut)}
                {flow.kept > 0 ? ` · kept ${formatSankeyUsd(flow.kept)}` : ''}
                {flow.fromReserves > 0 ? ` · drawn from reserves ${formatSankeyUsd(flow.fromReserves)}` : ''}
                {flow.unlabeledOut > 0 ? ` · unlabeled spend ${formatSankeyUsd(flow.unlabeledOut)} (label it in Drag Sort)` : ''}
                {' · click a family or label bar to zoom into its payees'}
              </p>
            </>
          ) : null}
          {view === 'accounts' && transfers ? (
            <>
              <SankeySvg input={transfers.input} height={560} padRight={210} onRibbonClick={setDrilldown} />
              <p style={{ margin: '0.5rem 0 0', fontSize: '0.8rem', color: 'var(--text-slate-500)' }}>
                In {formatSankeyUsd(transfers.externalInTotal)} · between accounts {formatSankeyUsd(transfers.pairedTotal)} · out{' '}
                {formatSankeyUsd(transfers.externalOutTotal)}
                {transfers.unpairedTotal > 0
                  ? ` · ${formatSankeyUsd(transfers.unpairedTotal)} in transfer legs with no matching opposite leg in the period`
                  : ''}
              </p>
            </>
          ) : null}
          {view === 'cards' && cards ? (
            <>
              <SankeySvg input={cards.input} height={460} padRight={260} onRibbonClick={setDrilldown} />
              <p style={{ margin: '0.5rem 0 0', fontSize: '0.8rem', color: 'var(--text-slate-500)' }}>
                {formatSankeyUsd(cards.spendTotal)} of card spend across {cards.txCount.toLocaleString()} purchases
                {cards.noJobTotal > 0 ? ` · ${formatSankeyUsd(cards.noJobTotal)} not on any job yet` : ' · everything is on a job'}
              </p>
            </>
          ) : null}
          {data.truncated ? (
            <p style={{ margin: '0.5rem 0 0', fontSize: '0.75rem', color: 'var(--text-amber-800)' }}>
              Showing the most recent {VISUALS_TX_LIMIT.toLocaleString()} transactions — older history is not in these totals.
            </p>
          ) : null}
          {drilldown ? (
            <VisualsDrilldownModal
              title={drilldown.title}
              txs={drilldown.txIds.map((id) => data.txById.get(id)).filter((t): t is VisualsTxDetail => t != null)}
              accountLabel={accountLabel}
              onClose={() => setDrilldown(null)}
              onRowClick={setDetailTxId}
            />
          ) : null}
          {detailTxId ? (
            <BankingMercuryTxDetailModal
              txId={detailTxId}
              labels={data.labels}
              jobLabelById={data.jobLabelById}
              accountLabel={accountLabel}
              nicknameByAccount={data.accountNameById}
              nicknameByDebitCard={data.nicknameByDebitCard}
              usersOptions={data.usersOptions}
              attributionOptions={data.attributionOptions}
              onCreatePerson={createPersonFromPicker}
              operatorUserId={user?.id ?? null}
              personLabel={data.personLabelByTxId.get(detailTxId) ?? null}
              onClose={() => setDetailTxId(null)}
              onChanged={(change) => handleTxDetailChange(detailTxId, change)}
            />
          ) : null}
        </>
      ) : null}
    </div>
  )
}
