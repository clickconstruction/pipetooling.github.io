/**
 * The job window's Costs tab, for devs (v2.6115): every cost row on this job in one list, by
 * stream — bank allocations with card, category and note; supply-house invoice allocations with
 * their share; clock sessions by person with hours and standing; Other job charges (listed, never
 * movable: the batch RPC has no op for them) — totals per stream, a tick per row and per group,
 * and **Move N rows…**, which opens the Move cost window (`CostMoveModal`) on the ticked rows.
 * Under the list, the batches that touched this job, each with its ops and a Revert.
 *
 * The owner's words for the tool (2026-10-30): see all of the costs for a job and send the cost on
 * one job to another in an easy way — click on something and a window appears. The streams, the
 * holds and the totals are `lib/costBatches/costMoveRows.ts`; the reads run as the signed-in dev.
 */
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useOptionalAuth } from '../../hooks/useAuth'
import { useMercuryLedgerNicknames } from '../../hooks/useMercuryLedgerNicknames'
import { formatErrorMessage } from '../../utils/errorHandling'
import { countedLabel } from '../../lib/batchWords'
import { COST_MOVE_SOURCES, COST_MOVE_SOURCE_NOUNS, costMoveCardsPresent, costMoveKeysByCard, costMoveKeysByDateRange, costMoveKeysBySource, costMoveRowKey, costMoveTotals, costMoveTotalsWords, type CostMoveRow } from '../../lib/costBatches/costMoveRows'
import { fetchCostMoveRows, type CostMoveJobRow } from '../../lib/costBatches/costMoveReads'
import { formatMercuryDebitCardIdCompact } from '../../lib/mercuryRawDebitCard'
import { CostMoveModal, type CostMoveApplied } from '../costBatches/CostMoveModal'
import { CostMoveRowsTables } from '../costBatches/CostMoveRowsTables'
import { CostBatchListPanel } from '../costBatches/CostBatchListPanel'

const wrap: CSSProperties = { display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }
const h3: CSSProperties = { margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-strong)' }
const quiet: CSSProperties = { margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }
const field: CSSProperties = { padding: '0.35rem 0.5rem', fontSize: '0.8125rem', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-base)', font: 'inherit' }
const labelStyle: CSSProperties = { fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '0.25rem' }
const button: CSSProperties = { padding: '0.3rem 0.75rem', fontSize: '0.8125rem', borderRadius: 6, cursor: 'pointer', border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', font: 'inherit', fontWeight: 600 }
const primaryButton: CSSProperties = { ...button, background: '#2563eb', color: 'var(--text-on-bright-solid)', border: '1px solid transparent' }
/** The move row stays in view while the dev scrolls a long list (several hundred rows on a catch-all job). */
const moveBar: CSSProperties = { position: 'sticky', bottom: 0, display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', padding: '0.6rem 0.75rem', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', boxShadow: '0 -2px 8px rgba(0,0,0,0.06)', zIndex: 1 }

export type JobWindowCostMovePanelProps = {
  /** The job whose rows are listed, as the ledger row the window loaded. */
  job: CostMoveJobRow
  /** While the Move cost window is open, Escape belongs to it: the job window holds its own. */
  onOverlayOpenChange?: (open: boolean) => void
}

export function JobWindowCostMovePanel({ job, onOverlayOpenChange }: JobWindowCostMovePanelProps) {
  const auth = useOptionalAuth()
  const isDev = auth?.role === 'dev'
  const { nicknameByDebitCard } = useMercuryLedgerNicknames()

  const [rawRows, setRawRows] = useState<CostMoveRow[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloads, setReloads] = useState(0)

  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set())
  const [cardPick, setCardPick] = useState('')
  const [fromYmd, setFromYmd] = useState('')
  const [toYmd, setToYmd] = useState('')

  const [moving, setMoving] = useState(false)
  const [applied, setApplied] = useState<CostMoveApplied | null>(null)
  const [batchesRefresh, setBatchesRefresh] = useState(0)

  // The rows, read as the dev on first sight of the tab and again after a batch or on Read again.
  useEffect(() => {
    if (!isDev) return
    let cancelled = false
    setLoading(true)
    void fetchCostMoveRows(job.id, {})
      .then((rows) => {
        if (cancelled) return
        setRawRows(rows)
        setLoadError(null)
      })
      .catch((e: unknown) => {
        if (!cancelled) setLoadError(formatErrorMessage(e, 'Could not load the job’s cost rows'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [isDev, job.id, reloads])

  // Card nicknames are read beside the rows and may land after them: resolve them at render.
  const rows = useMemo<CostMoveRow[]>(
    () => (rawRows ?? []).map((r) => (r.source === 'bank' && r.cardId ? { ...r, cardNickname: nicknameByDebitCard[r.cardId] ?? null } : r)),
    [rawRows, nicknameByDebitCard],
  )
  const selectedRows = useMemo(() => rows.filter((r) => selected.has(costMoveRowKey(r))), [rows, selected])
  const selectedTotals = useMemo(() => costMoveTotals(selectedRows), [selectedRows])
  const cards = useMemo(() => costMoveCardsPresent(rows), [rows])

  const toggle = useCallback((key: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])
  const setMany = useCallback((keys: readonly string[], on: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev)
      for (const k of keys) if (on) next.add(k)
      else next.delete(k)
      return next
    })
  }, [])

  const cardKeys = useMemo(() => (cardPick === '' ? [] : costMoveKeysByCard(rows, cardPick === '__none__' ? null : cardPick)), [rows, cardPick])
  const rangeKeys = useMemo(() => (fromYmd || toYmd ? costMoveKeysByDateRange(rows, fromYmd, toYmd) : []), [rows, fromYmd, toYmd])

  const openMove = useCallback(() => {
    setApplied(null)
    setMoving(true)
    onOverlayOpenChange?.(true)
  }, [onOverlayOpenChange])
  const closeMove = useCallback(() => {
    setMoving(false)
    onOverlayOpenChange?.(false)
  }, [onOverlayOpenChange])
  const onApplied = useCallback((done: CostMoveApplied) => {
    // The rows left the job: read what is left, start the ticks over, and the batch list shows the new batch with its Revert.
    setApplied(done)
    setSelected(new Set())
    setReloads((n) => n + 1)
    setBatchesRefresh((n) => n + 1)
  }, [])

  if (!isDev) return null

  return (
    <section aria-labelledby="job-cost-move" style={wrap}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', flexWrap: 'wrap' }}>
        <h3 id="job-cost-move" style={h3}>
          Every cost row on this job
        </h3>
        <span style={quiet}>Devs. Tick rows and move them to another job as one recorded, reversible cost batch. Contract: docs/COST_BATCHES.md.</span>
        <button type="button" style={{ ...button, marginLeft: 'auto' }} onClick={() => setReloads((n) => n + 1)} disabled={loading}>
          {loading ? 'Reading…' : 'Read the rows again'}
        </button>
      </div>
      {loadError ? <p style={{ ...quiet, color: 'var(--text-red-700)' }}>{loadError}</p> : null}
      {rawRows ? <p style={quiet}>On the job: {costMoveTotalsWords(costMoveTotals(rows))}</p> : loading ? <p style={quiet}>Reading the job’s cost rows…</p> : null}

      {rawRows ? (
        <>
          <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={labelStyle}>
              <span>By stream</span>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                {COST_MOVE_SOURCES.filter((s) => s !== 'other').map((s) => {
                  const keys = costMoveKeysBySource(rows, s)
                  const allOn = keys.length > 0 && keys.every((k) => selected.has(k))
                  return (
                    <button key={s} type="button" style={{ ...button, opacity: keys.length === 0 ? 0.5 : 1 }} disabled={keys.length === 0} onClick={() => setMany(keys, !allOn)}>
                      {countedLabel(allOn ? 'Untick' : 'Tick', keys.length, COST_MOVE_SOURCE_NOUNS[s])}
                    </button>
                  )
                })}
              </div>
            </div>
            <label style={labelStyle}>
              <span>By card</span>
              <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                <select value={cardPick} onChange={(e) => setCardPick(e.target.value)} style={field} aria-label="Card">
                  <option value="">Pick a card…</option>
                  {cards.map((c) => (
                    <option key={c.cardId ?? '__none__'} value={c.cardId ?? '__none__'}>
                      {c.cardId ? (c.nickname ?? formatMercuryDebitCardIdCompact(c.cardId)) : 'No card (ACH, wire, check)'} · {c.rows} {c.rows === 1 ? 'row' : 'rows'}
                    </option>
                  ))}
                </select>
                <button type="button" style={{ ...button, opacity: cardKeys.length === 0 ? 0.5 : 1 }} disabled={cardKeys.length === 0} onClick={() => setMany(cardKeys, true)}>
                  {countedLabel('Tick', cardKeys.length, 'row')}
                </button>
              </div>
            </label>
            <div style={labelStyle}>
              <span>By date</span>
              <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <input type="date" value={fromYmd} onChange={(e) => setFromYmd(e.target.value)} style={field} aria-label="From date" />
                <span style={quiet}>to</span>
                <input type="date" value={toYmd} onChange={(e) => setToYmd(e.target.value)} style={field} aria-label="To date" />
                <button type="button" style={{ ...button, opacity: rangeKeys.length === 0 ? 0.5 : 1 }} disabled={rangeKeys.length === 0} onClick={() => setMany(rangeKeys, true)}>
                  {countedLabel('Tick', rangeKeys.length, 'row')}
                </button>
              </div>
            </div>
          </div>

          <CostMoveRowsTables rows={rows} selected={selected} onToggle={toggle} onSetMany={setMany} />

          <div style={moveBar}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-strong)', fontWeight: 600 }}>Ticked: {costMoveTotalsWords(selectedTotals)}</span>
            <button type="button" style={{ ...button, opacity: selected.size === 0 ? 0.5 : 1 }} disabled={selected.size === 0} onClick={() => setSelected(new Set())}>
              {countedLabel('Untick', selected.size, 'row')}
            </button>
            <button type="button" style={{ ...primaryButton, marginLeft: 'auto', opacity: selected.size === 0 ? 0.5 : 1 }} disabled={selected.size === 0} onClick={openMove}>
              {countedLabel('Move', selectedTotals.all.rows, 'ticked row')}…
            </button>
          </div>
        </>
      ) : null}

      {applied ? (
        <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-green-700)', fontWeight: 600 }}>
          Applied “{applied.label}” as batch <code>{applied.batchId}</code> — in the list below with its Revert.
        </p>
      ) : null}

      <CostBatchListPanel jobId={job.id} showEveryBatch={false} refreshKey={batchesRefresh} highlightBatchId={applied?.batchId ?? null} />

      {moving ? <CostMoveModal sourceJob={job} rows={selectedRows} onRequestClose={closeMove} onApplied={onApplied} /> : null}
    </section>
  )
}
