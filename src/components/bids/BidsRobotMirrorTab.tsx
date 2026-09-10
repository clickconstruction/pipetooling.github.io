import { useEffect, useMemo, useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import type { BidWithBuilder } from '../../types/bidWithBuilder'
import {
  buildRobotMirror,
  mirrorAuditChip,
  mirrorRunReviewable,
  mirrorStatusLabel,
  MIRROR_SECTION_LABELS,
  MIRROR_SECTION_ORDER,
  type MirrorAudit,
  type MirrorDraftTotal,
  type MirrorSection,
  type RobotMirrorRow,
  type RobotMirrorRun,
} from '../../lib/bids/robotMirror'
import { buildAxisCards, normalizeBidNumber, type RunScoreRow } from '../../lib/bids/confidenceBoard'
import { computeAuditDraftTotal } from '../../lib/bids/bidAudits'
import { fetchAllRowsChunkedIn } from '../../lib/supabasePaging'
import type { ShadowRunRow } from '../../lib/bids/shadowStory'
import { ROBOT_ICON_PATH, ROBOT_STATE_COLOR } from './RobotGlyph'

// twin_run_scores / bid_audits predate the generated types (BidsAuditsTab pattern).
const db = supabase as unknown as SupabaseClient

type BidsRobotMirrorTabProps = {
  /** The human board's bids (the People scope) — every row here is one of ours. */
  bids: BidWithBuilder[]
  /** The robots' ZZ shells (the Robots scope) — read for pairing and doors, never listed. */
  robotBids: BidWithBuilder[]
  /** The page's audit gate — the workable pending count for the strip. */
  auditPending: number
  loading: boolean
  /** A row to ring (deep links from the status sheet / comparison modal). Matches the human bid OR its shell. */
  highlightBidId: string | null
  onEditBid: (bid: BidWithBuilder) => void
  /** Robot vs ours counts + pricing — the comparison modal (scored rows only). */
  onCompare: (source: BidWithBuilder, twin: BidWithBuilder) => void
  /** Open the robot's shell on the Counts tab (its rows live there). */
  onOpenShell: (twin: BidWithBuilder) => void
  /** Land on that audit's card in the Audits lens. */
  onOpenAudit: (auditId: string) => void
  /** A scored or audited run whose audit still waits (sent bids only): open the envelope now. */
  onReviewNow: (source: BidWithBuilder, run: RobotMirrorRun) => void
  /** Reports the mirrored-bid count for the lens label. */
  onRowCount?: (n: number) => void
}

const money = (v: number | null) => (v == null ? '—' : `$${Math.round(v).toLocaleString()}`)
const fmtDelta = (d: number) => `${d > 0 ? '+' : '−'}${Math.abs(d).toFixed(1)}%`

function RunGlyph({ run }: { run: RobotMirrorRun }) {
  const outline = run.status === 'queued'
  const color = run.status === 'scored' ? ROBOT_STATE_COLOR.scored : run.status === 'void' ? 'var(--text-faint)' : ROBOT_STATE_COLOR.robot
  const badge = run.status === 'sealed' ? '🔒' : run.status === 'scored' ? '✓' : run.status === 'audited' ? '$' : run.status === 'void' ? '✕' : null
  return (
    <span aria-hidden style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', color, lineHeight: 0, opacity: run.status === 'void' ? 0.6 : 1 }}>
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={18} height={18} fill={outline ? 'none' : 'currentColor'} stroke={outline ? 'currentColor' : 'none'} strokeWidth={outline ? 34 : 0}>
        <path d={ROBOT_ICON_PATH} />
      </svg>
      {run.status === 'working' ? <span className="robot-glyph-pulse" style={{ position: 'absolute', right: -2, top: 0, width: 7, height: 7, borderRadius: '50%', background: color, boxShadow: '0 0 0 2px var(--surface)' }} /> : null}
      {badge ? (
        <span style={{ position: 'absolute', right: -3, bottom: -3, fontSize: badge === '🔒' ? '0.5rem' : '0.5625rem', fontWeight: 800, lineHeight: 1, padding: '1px 3px', borderRadius: 3, color: 'white', background: run.status === 'void' ? 'var(--text-faint)' : color, fontFamily: 'ui-monospace, monospace', boxShadow: '0 0 0 1.5px var(--surface)' }}>
          {badge}
        </span>
      ) : null}
    </span>
  )
}

const CHIP_TONES: Record<NonNullable<ReturnType<typeof mirrorAuditChip>>['tone'], { bg: string; fg: string }> = {
  audit: { bg: 'var(--bg-amber-tint)', fg: 'var(--text-amber-800)' },
  done: { bg: 'var(--bg-green-tint)', fg: 'var(--text-green-800)' },
  practice: { bg: 'var(--bg-muted)', fg: 'var(--text-muted)' },
  void: { bg: 'var(--bg-red-100)', fg: 'var(--text-red-600)' },
  seal: { bg: 'var(--bg-violet-100, var(--bg-muted))', fg: 'var(--text-violet-700, var(--text-700))' },
}

const th: React.CSSProperties = { textAlign: 'left', fontSize: '0.66rem', letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)', padding: '0.35rem 0.6rem', borderBottom: '1px solid var(--border)', fontWeight: 600, whiteSpace: 'nowrap' }
const td: React.CSSProperties = { padding: '0.45rem 0.6rem', borderBottom: '1px solid var(--border)', verticalAlign: 'top', fontSize: '0.84rem', fontVariantNumeric: 'tabular-nums' }
const mono: React.CSSProperties = { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }
const linkBtn: React.CSSProperties = { background: 'none', border: 'none', padding: 0, color: 'var(--text-link)', cursor: 'pointer', font: 'inherit', fontSize: '0.78rem', textDecoration: 'underline' }

/**
 * The Robot Board as a mirror (v2.3222): our bids, in the human board's sections,
 * with a robot column — status before we send, the robot's number and the delta
 * after. The shells never list; every robot number here comes from a SCORED run
 * (list_shadow_runs NULLs the money until then), so this lens cannot anchor a
 * number that is still being written.
 */
export function BidsRobotMirrorTab({ bids, robotBids, auditPending, loading, highlightBidId, onEditBid, onCompare, onOpenShell, onOpenAudit, onReviewNow, onRowCount }: BidsRobotMirrorTabProps) {
  const [shadowRuns, setShadowRuns] = useState<ShadowRunRow[] | null>(null)
  const [scores, setScores] = useState<RunScoreRow[] | null>(null)
  const [audits, setAudits] = useState<MirrorAudit[]>([])
  const [standardIds, setStandardIds] = useState<ReadonlySet<string> | undefined>(undefined)
  // Audited-but-unscored shells (the first backtest slate predates score_backtest): price the
  // draft the way the Audits lens does, once per shell, so the row carries a number instead of
  // "working". Only shells whose human bid is sent ever get read (seal).
  const [draftTotals, setDraftTotals] = useState<Map<string, MirrorDraftTotal>>(() => new Map())
  const draftRequestedRef = useRef<Set<string>>(new Set())
  const [open, setOpen] = useState<Record<MirrorSection, boolean>>({ unsent: true, pending: true, won: true, startedOrComplete: true, lost: false })
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set())

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const [runRes, scoreRes, auditRes, stdRes] = await Promise.all([
        db.rpc('list_shadow_runs'),
        db.from('twin_run_scores').select('*').order('scored_at', { ascending: false }),
        db.from('bid_audits').select('id, bid_id, status, requested_at').order('requested_at', { ascending: false }).limit(300),
        db.from('users').select('id').eq('calibration_standard', true),
      ])
      if (cancelled) return
      // Missing tables / RLS-closed reads (a client ahead of a migration) read as "no runs", never a broken lens.
      setShadowRuns((runRes.data ?? []) as ShadowRunRow[])
      setScores((scoreRes.data ?? []) as RunScoreRow[])
      setAudits((auditRes.data ?? []) as MirrorAudit[])
      if (!stdRes.error) setStandardIds(new Set(((stdRes.data ?? []) as Array<{ id: string }>).map((u) => u.id)))
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (shadowRuns === null || scores === null) return
    const covered = new Set<string>()
    for (const r of shadowRuns) { const n = normalizeBidNumber(r.shadow_bid_number); if (n) covered.add(n) }
    for (const s of scores) { const n = normalizeBidNumber(s.twin_bid_number); if (n) covered.add(n) }
    const audited = new Set(audits.map((a) => a.bid_id))
    const sentHumanIds = new Set(bids.filter((b) => !!b.bid_date_sent).map((b) => b.id))
    const targets = robotBids.filter((b) => {
      const n = normalizeBidNumber(b.bid_number)
      return audited.has(b.id) && !(n && covered.has(n)) && !!b.twin_source_bid_id && sentHumanIds.has(b.twin_source_bid_id) && !draftRequestedRef.current.has(b.id)
    })
    if (!targets.length) return
    for (const t of targets) draftRequestedRef.current.add(t.id)
    let cancelled = false
    void (async () => {
      try {
        const ids = targets.map((t) => t.id)
        const [rows, assigns] = await Promise.all([
          fetchAllRowsChunkedIn<{ id: string; count: number; bid_version_id: string | null; bid_id: string }, string>(
            ids,
            (chunk, from, to) => db.from('bids_count_rows').select('id, count, bid_version_id, bid_id').in('bid_id', chunk).order('id').range(from, to),
            'load mirror draft rows',
          ),
          fetchAllRowsChunkedIn<{ bid_id: string; count_row_id: string; price_book_entry_id: string | null; unit_price_override: number | null }, string>(
            ids,
            (chunk, from, to) => db.from('bid_pricing_assignments').select('bid_id, count_row_id, price_book_entry_id, unit_price_override').in('bid_id', chunk).order('count_row_id').range(from, to),
            'load mirror draft pricing',
          ),
        ])
        const entryIds = [...new Set((assigns ?? []).map((a) => a.price_book_entry_id).filter((x): x is string => !!x))]
        const entries = entryIds.length ? (((await db.from('price_book_entries').select('id, total_price').in('id', entryIds)).data ?? []) as Array<{ id: string; total_price: number | null }>) : []
        const priceById = Object.fromEntries(entries.map((e) => [e.id, e.total_price ?? 0]))
        if (cancelled) return
        setDraftTotals((prev) => {
          const next = new Map(prev)
          for (const t of targets) {
            next.set(t.id, computeAuditDraftTotal((rows ?? []).filter((r) => r.bid_id === t.id), t.selected_bid_version_id ?? null, (assigns ?? []).filter((a) => a.bid_id === t.id), priceById))
          }
          return next
        })
      } catch {
        /* a draft total is optional context — the row keeps reading "working" */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [bids, robotBids, audits, shadowRuns, scores])

  const mirror = useMemo(
    () =>
      buildRobotMirror({
        humanBids: bids,
        shells: robotBids.map((b) => ({ id: b.id, bid_number: b.bid_number, project_name: b.project_name, twin_source_bid_id: b.twin_source_bid_id ?? null })),
        shadowRuns: shadowRuns ?? [],
        scores: scores ?? [],
        audits,
        standardTeacherIds: standardIds,
        draftTotals,
      }),
    [bids, robotBids, shadowRuns, scores, audits, standardIds, draftTotals],
  )
  useEffect(() => {
    onRowCount?.(mirror.rowCount)
  }, [mirror.rowCount, onRowCount])

  const gate = useMemo(() => {
    const cards = buildAxisCards(scores ?? [], shadowRuns ?? [], { standardTeacherIds: standardIds })
    return { met: cards.filter((c) => c.chip.tone === 'met').length, total: cards.length }
  }, [scores, shadowRuns, standardIds])
  const oldestAuditDays = useMemo(() => {
    const pending = audits.filter((a) => a.status === 'pending').map((a) => Date.parse(a.requested_at)).filter(Number.isFinite)
    if (!pending.length) return null
    return Math.max(0, Math.floor((Date.now() - Math.min(...pending)) / 86400000))
  }, [audits])

  const shellById = useMemo(() => new Map(robotBids.map((b) => [b.id, b])), [robotBids])
  // A deep link names the human bid or its shell — ring the human row either way.
  const ringedHumanId = useMemo(() => {
    if (!highlightBidId) return null
    if (bids.some((b) => b.id === highlightBidId)) return highlightBidId
    return shellById.get(highlightBidId)?.twin_source_bid_id ?? null
  }, [highlightBidId, bids, shellById])
  useEffect(() => {
    if (!ringedHumanId) return
    for (const key of MIRROR_SECTION_ORDER) {
      if (mirror.sections[key].some((r) => r.bid.id === ringedHumanId)) setOpen((p) => (p[key] ? p : { ...p, [key]: true }))
    }
    const el = document.getElementById(`robot-mirror-row-${ringedHumanId}`)
    el?.scrollIntoView({ block: 'center' })
  }, [ringedHumanId, mirror])

  const ready = shadowRuns !== null && scores !== null && !loading

  const renderRun = (row: RobotMirrorRow<BidWithBuilder>, run: RobotMirrorRun, lead: boolean) => {
    const status = mirrorStatusLabel(run)
    const chip = mirrorAuditChip(run)
    const shell = run.shellBidId ? shellById.get(run.shellBidId) : undefined
    const scored = run.status === 'scored' || run.status === 'audited'
    const inBand = run.deltaPct != null && Math.abs(run.deltaPct) <= 8
    return (
      <>
        <td style={td}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
            {lead ? <RunGlyph run={run} /> : <span style={{ width: 18, display: 'inline-block' }} />}
            {scored ? (
              <span style={{ ...mono, fontWeight: 600 }}>{money(run.robotTotal)}</span>
            ) : (
              <span style={{ fontWeight: 500 }}>{status.text}</span>
            )}
          </span>
          <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', paddingLeft: lead ? 'calc(18px + 0.45rem)' : 'calc(18px + 0.45rem)' }}>
            {run.label}
            {status.sub ? ` · ${status.sub}` : ''}
            {row.note && lead ? ` · ${row.note}` : ''}
            {run.teacherName && scored ? ` · vs ${run.teacherName}` : ''}
          </span>
        </td>
        <td style={{ ...td, ...mono }}>{scored ? money(run.ourValue) : <span style={{ color: 'var(--text-faint)' }}>—</span>}</td>
        <td style={{ ...td, ...mono, fontWeight: 600, color: run.deltaPct == null ? 'var(--text-faint)' : inBand ? 'var(--text-green-700)' : 'var(--text-red-700)' }}>
          {run.deltaPct == null ? '—' : fmtDelta(run.deltaPct)}
        </td>
        <td style={{ ...td, whiteSpace: 'nowrap' }}>
          <span style={{ display: 'inline-flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {chip ? (
              <span style={{ borderRadius: 4, padding: '1px 6px', fontSize: '0.66rem', fontWeight: 600, background: CHIP_TONES[chip.tone].bg, color: CHIP_TONES[chip.tone].fg }}>{chip.text}</span>
            ) : null}
            {mirrorRunReviewable(run) && row.bid.bid_date_sent ? (
              <button type="button" onClick={() => onReviewNow(row.bid, run)} style={{ ...linkBtn, fontWeight: 600 }}>Review now</button>
            ) : null}
            {run.audit?.status === 'pending' && scored ? (
              <button type="button" onClick={() => onOpenAudit(run.audit!.id)} style={linkBtn}>Open audit</button>
            ) : null}
            {scored && shell ? (
              <button type="button" onClick={() => onCompare(row.bid, shell)} style={linkBtn}>Compare</button>
            ) : null}
            {shell && (scored || row.bid.bid_date_sent) ? (
              <button type="button" onClick={() => onOpenShell(shell)} style={linkBtn}>Robot bid b{shell.bid_number ?? '?'}</button>
            ) : null}
          </span>
        </td>
      </>
    )
  }

  return (
    <div>
      {/* The program in four numbers — the strip the Scoreboard's pills used to carry. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.5rem', marginBottom: '0.9rem' }}>
        {[
          { n: String(mirror.rowCount), label: 'our bids with a robot run', warn: false, title: 'Human bids with at least one shadow or backtest run' },
          { n: `${Math.max(0, mirror.liveEligible - mirror.uncoveredLive)} / ${mirror.liveEligible}`, label: 'live plumbing bids shadowed', warn: mirror.uncoveredLive > 0, title: 'Unsent plumbing bids with plans on file that a robot has (or could) shadow — every uncovered one is a free future reference' },
          { n: String(auditPending), label: oldestAuditDays != null && auditPending > 0 ? `audits waiting · oldest ${oldestAuditDays} d` : 'audits waiting', warn: auditPending > 0, title: 'Robot audits a person still owes a verdict' },
          { n: `${gate.met} / ${gate.total}`, label: 'axes past Gate B', warn: false, title: 'Project-type lanes with five consecutive runs within ±8%' },
        ].map((s) => (
          <div key={s.label} title={s.title} style={{ border: `1px solid ${s.warn ? 'var(--text-amber-800)' : 'var(--border)'}`, borderRadius: 8, background: s.warn ? 'var(--bg-amber-tint)' : 'var(--bg-subtle)', padding: '0.45rem 0.8rem' }}>
            <b style={{ display: 'block', fontSize: '1.05rem', color: s.warn ? 'var(--text-amber-800)' : 'var(--text-strong)', ...mono }}>{s.n}</b>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{s.label}</span>
          </div>
        ))}
      </div>

      {!ready ? (
        <p role="status" style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading the robots' runs…</p>
      ) : mirror.rowCount === 0 ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No robot has run on any of these bids yet. Shadows open on their own within the hour of a plumbing bid getting readable plans.</p>
      ) : (
        MIRROR_SECTION_ORDER.map((key) => {
          const rows = mirror.sections[key]
          const isOpen = open[key]
          return (
            <div key={key} style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', marginBottom: '0.6rem', overflow: 'hidden' }}>
              <button
                type="button"
                onClick={() => setOpen((p) => ({ ...p, [key]: !p[key] }))}
                aria-expanded={isOpen}
                style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', width: '100%', padding: '0.5rem 0.75rem', background: 'var(--bg-subtle)', border: 'none', borderBottom: isOpen ? '1px solid var(--border)' : 'none', cursor: 'pointer', textAlign: 'left', font: 'inherit', color: 'inherit', fontWeight: 700, fontSize: '0.875rem' }}
              >
                <span aria-hidden>{isOpen ? '▼' : '▶'}</span>
                {MIRROR_SECTION_LABELS[key]}
                <span style={{ fontWeight: 500, color: 'var(--text-muted)' }}>({rows.length})</span>
                {key === 'unsent' && mirror.uncoveredLive > 0 ? (
                  <span style={{ marginLeft: 'auto', fontWeight: 500, fontSize: '0.74rem', color: 'var(--text-amber-800)' }}>
                    {mirror.uncoveredLive} more live bid{mirror.uncoveredLive === 1 ? '' : 's'} {mirror.uncoveredLive === 1 ? 'has' : 'have'} no robot yet
                  </span>
                ) : null}
              </button>
              {isOpen ? (
                rows.length === 0 ? (
                  <div style={{ padding: '0.5rem 0.75rem', color: 'var(--text-muted)', fontSize: '0.82rem', fontStyle: 'italic' }}>No robot runs in this group</div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                      <thead>
                        <tr>
                          <th style={th}>Bid #</th>
                          <th style={th}>Project · GC</th>
                          <th style={th}>Robot</th>
                          <th style={th}>Ours</th>
                          <th style={th}>Δ</th>
                          <th style={th}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row) => {
                          const ringed = row.bid.id === ringedHumanId
                          const showEarlier = expanded.has(row.bid.id)
                          const gc = row.bid.bids_gc_builders?.name ?? row.bid.customers?.name ?? null
                          const est = (Array.isArray(row.bid.estimator) ? row.bid.estimator[0] : row.bid.estimator)?.name ?? null
                          const sentLabel = row.bid.bid_date_sent ? `sent ${row.bid.bid_date_sent.slice(5, 10).replace('-', '/')}` : null
                          return (
                            <tr key={row.bid.id} id={`robot-mirror-row-${row.bid.id}`} style={ringed ? { outline: '2px solid #3b82f6', outlineOffset: -2 } : undefined}>
                              <td style={{ ...td, whiteSpace: 'nowrap' }}>
                                <button type="button" onClick={() => onEditBid(row.bid)} title="Open the bid" style={{ ...linkBtn, fontSize: '0.84rem', fontWeight: 700, textDecoration: 'none' }}>
                                  b{row.bid.bid_number ?? '?'}
                                </button>
                              </td>
                              <td style={{ ...td, minWidth: 160 }}>
                                <span style={{ fontWeight: 600 }}>{row.bid.project_name ?? 'Untitled'}</span>
                                <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                  {[gc, est, sentLabel].filter(Boolean).join(' · ') || '—'}
                                </span>
                                {row.earlier.length > 0 ? (
                                  <button type="button" onClick={() => setExpanded((p) => { const n = new Set(p); if (n.has(row.bid.id)) n.delete(row.bid.id); else n.add(row.bid.id); return n })} style={{ ...linkBtn, fontSize: '0.7rem', marginTop: 2 }}>
                                    {showEarlier ? 'hide earlier runs' : `${row.earlier.length} earlier run${row.earlier.length === 1 ? '' : 's'}${row.earlier[0]?.deltaPct != null ? ` · ${row.earlier[0].label} ${fmtDelta(row.earlier[0].deltaPct)}` : ''}`}
                                  </button>
                                ) : null}
                              </td>
                              {renderRun(row, row.latest, true)}
                            </tr>
                          )
                        }).flatMap((tr, i) => {
                          const row = rows[i]
                          if (!row || !expanded.has(row.bid.id)) return [tr]
                          return [
                            tr,
                            ...row.earlier.map((run, j) => (
                              <tr key={`${row.bid.id}-earlier-${j}`} style={{ background: 'var(--bg-subtle)' }}>
                                <td style={td}></td>
                                <td style={{ ...td, fontSize: '0.72rem', color: 'var(--text-muted)' }}>earlier run</td>
                                {renderRun(row, run, false)}
                              </tr>
                            )),
                          ]
                        })}
                      </tbody>
                    </table>
                  </div>
                )
              ) : null}
            </div>
          )
        })
      )}

      {ready && mirror.orphanShells.length > 0 ? (
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.75rem' }}>
          {mirror.orphanShells.length} robot shell{mirror.orphanShells.length === 1 ? '' : 's'} with no bid of ours to mirror —{' '}
          {mirror.orphanShells.map((s, i) => (
            <span key={s.id}>
              {i > 0 ? ', ' : ''}
              <button type="button" onClick={() => { const shell = shellById.get(s.id); if (shell) onOpenShell(shell) }} style={linkBtn}>b{s.bid_number ?? '?'}</button>
            </span>
          ))}
          {' '}— pair or archive.
        </p>
      ) : null}
    </div>
  )
}
