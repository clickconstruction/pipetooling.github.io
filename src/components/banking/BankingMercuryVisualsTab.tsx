import { useCallback, useEffect, useMemo, useState } from 'react'
import { useToastContext } from '../../contexts/ToastContext'
import { supabase } from '../../lib/supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { fetchAllAttributions, fetchAllJobAllocations } from '../../lib/fetchMercuryRelationsByTxIds'
import {
  formatSankeyUsd,
  layoutSankey,
  type SankeyInput,
  type SankeyTone,
} from '../../lib/banking/mercurySankeyLayout'
import {
  buildCardsJobsSankey,
  buildMoneyFlowSankey,
  buildTransferSankey,
  filterVisualsTxs,
  pairInternalTransfers,
  type VisualsPeriod,
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

/** A tx row plus the display fields the drill-down list shows (v2.1713). */
type VisualsTxDetail = VisualsTxRow & { counterpartyName: string | null }

type VisualsData = {
  txs: VisualsTxDetail[]
  txById: Map<string, VisualsTxDetail>
  labelNameByTxId: Map<string, string>
  personLabelByTxId: Map<string, string | null>
  allocationsByTxId: Map<string, { jobId: string; amount: number }[]>
  jobLabelById: Record<string, string>
  accountNameById: Record<string, string>
  truncated: boolean
}

async function fetchVisualsData(): Promise<VisualsData> {
  const [txRows, labelRows, assignmentRows, nicknameRows, allocRows, attrRows] = await Promise.all([
    withSupabaseRetry(
      async () =>
        supabase
          .from('mercury_transactions')
          .select('id, amount, kind, posted_at, mercury_account_id, duplicate_of_transaction_id, counterparty_name')
          .order('posted_at', { ascending: false })
          .limit(VISUALS_TX_LIMIT),
      'visuals mercury_transactions',
    ),
    withSupabaseRetry(async () => supabase.from('mercury_drag_sort_labels').select('id, name'), 'visuals labels'),
    withSupabaseRetry(
      async () =>
        supabase.from('mercury_transaction_drag_sort_assignments').select('mercury_transaction_id, label_id').limit(100000),
      'visuals label assignments',
    ),
    withSupabaseRetry(
      async () => supabase.from('mercury_account_nicknames').select('mercury_account_id, nickname'),
      'visuals account nicknames',
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
  }[]).map((r) => ({
    id: r.id,
    amount: Number(r.amount),
    kind: r.kind,
    postedYmd: r.posted_at ? calendarYmdInAppTzFromIso(r.posted_at) : '',
    accountId: r.mercury_account_id,
    isDuplicate: r.duplicate_of_transaction_id != null,
    counterpartyName: r.counterparty_name,
  }))

  const labelNameById = new Map<string, string>()
  for (const l of (labelRows ?? []) as { id: string; name: string }[]) labelNameById.set(l.id, l.name)
  const labelNameByTxId = new Map<string, string>()
  for (const a of (assignmentRows ?? []) as { mercury_transaction_id: string; label_id: string }[]) {
    const name = labelNameById.get(a.label_id)
    if (name) labelNameByTxId.set(a.mercury_transaction_id, name)
  }

  const accountNameById: Record<string, string> = {}
  for (const n of (nicknameRows ?? []) as { mercury_account_id: string; nickname: string }[]) {
    accountNameById[n.mercury_account_id] = n.nickname
  }

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
  for (const row of attrRows) {
    const name =
      (row.person_id ? personNameById.get(row.person_id) : undefined) ??
      (row.user_id ? userNameById.get(row.user_id) : undefined) ??
      null
    personLabelByTxId.set(row.mercury_transaction_id, name)
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
    labelNameByTxId,
    personLabelByTxId,
    allocationsByTxId,
    jobLabelById,
    accountNameById,
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

function SegRow<T extends string>(props: {
  ariaLabel: string
  options: { key: T; label: string }[]
  value: T
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
}: {
  input: SankeyInput
  height: number
  padRight?: number
  onRibbonClick?: (click: SankeyRibbonClick) => void
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
          return (
            <g key={n.id}>
              <rect x={n.x} y={n.y} width={10} height={h} rx={2} fill={TONE_FILLS[n.tone]}>
                <title>{`${n.label}: ${formatSankeyUsd(n.value)}`}</title>
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
}: {
  title: string
  txs: VisualsTxDetail[]
  accountLabel: (id: string) => string
  onClose: () => void
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
      style={{ position: 'fixed', inset: 0, zIndex: 1200, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
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
            <div key={t.id} style={{ display: 'flex', gap: '0.7rem', alignItems: 'baseline', fontSize: '0.82rem', padding: '0.28rem 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ minWidth: '5.6rem', color: 'var(--text-slate-500)', fontVariantNumeric: 'tabular-nums' }}>{t.postedYmd || '—'}</span>
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.counterpartyName ?? '—'}</span>
              <span style={{ color: 'var(--text-slate-500)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{accountLabel(t.accountId)}</span>
              <span style={{ minWidth: '6rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                {`${t.amount < 0 ? '−' : '+'}${formatSankeyUsd(t.amount)}`}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function BankingMercuryVisualsTab() {
  const { showToast } = useToastContext()
  const [view, setView] = useState<VisualsView>('flow')
  const [period, setPeriod] = useState<VisualsPeriod>('ytd')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [data, setData] = useState<VisualsData | null>(null)
  const [drilldown, setDrilldown] = useState<SankeyRibbonClick | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      setData(await fetchVisualsData())
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load money flows'
      setLoadError(msg)
      showToast(msg, 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    void load()
  }, [load])

  // A drill-down list belongs to the layout it was clicked in.
  useEffect(() => {
    setDrilldown(null)
  }, [view, period])

  const todayYmd = useMemo(() => calendarYmdInAppTzFromIso(new Date().toISOString()), [])
  const periodTxs = useMemo(
    () => (data ? filterVisualsTxs(data.txs, period, todayYmd) : []),
    [data, period, todayYmd],
  )

  const accountLabel = useCallback(
    (id: string): string => data?.accountNameById[id] ?? `Account ${id.slice(0, 8)}…`,
    [data],
  )

  const flow = useMemo(
    () => (data && view === 'flow' ? buildMoneyFlowSankey({ txs: periodTxs, labelNameByTxId: data.labelNameByTxId }) : null),
    [data, view, periodTxs],
  )
  const transfers = useMemo(
    () =>
      data && view === 'accounts'
        ? buildTransferSankey({ pairing: pairInternalTransfers(periodTxs), accountLabelById: accountLabel })
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
        <SegRow ariaLabel="Visuals period" options={PERIOD_OPTIONS} value={period} onChange={setPeriod} />
      </div>

      <p style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: 'var(--text-slate-500)' }}>
        {view === 'flow'
          ? 'Every labeled dollar as a river: money in on the left, flowing out through expense families to your accounting labels. Duplicates and internal transfers are excluded, matching the books.'
          : view === 'accounts'
            ? 'Internal transfers between your Mercury accounts: which account feeds which. Ribbon width is dollars moved in the period.'
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
          {view === 'flow' && flow ? (
            <>
              <SankeySvg input={flow.input} height={560} onRibbonClick={setDrilldown} />
              <p style={{ margin: '0.5rem 0 0', fontSize: '0.8rem', color: 'var(--text-slate-500)' }}>
                In {formatSankeyUsd(flow.totalIn)} · out {formatSankeyUsd(flow.totalOut)}
                {flow.kept > 0 ? ` · kept ${formatSankeyUsd(flow.kept)}` : ''}
                {flow.fromReserves > 0 ? ` · drawn from reserves ${formatSankeyUsd(flow.fromReserves)}` : ''}
                {flow.unlabeledOut > 0 ? ` · unlabeled spend ${formatSankeyUsd(flow.unlabeledOut)} (label it in Drag Sort)` : ''}
              </p>
            </>
          ) : null}
          {view === 'accounts' && transfers ? (
            <>
              <SankeySvg input={transfers.input} height={460} padRight={200} onRibbonClick={setDrilldown} />
              <p style={{ margin: '0.5rem 0 0', fontSize: '0.8rem', color: 'var(--text-slate-500)' }}>
                {formatSankeyUsd(transfers.pairedTotal)} moved between accounts
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
            />
          ) : null}
        </>
      ) : null}
    </div>
  )
}
