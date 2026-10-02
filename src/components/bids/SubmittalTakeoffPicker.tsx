import { Fragment, useMemo, useState, type CSSProperties } from 'react'
import { GROUP_LABELS, splitExplanation, type CandidateGroup, type ProductPiece, type TakeoffCandidate } from '../../lib/submittals/takeoffCandidates'
import { PICK_LABELS, allPiecesOf, pickChangeWords, pickCounts, pickOf, piecePicksLine, piecePicksOf, planIsEmpty, planRowsAdded, planSummary, planTakeoffPicks, withPiecePicks, type FixturePick, type PiecePick, type TakeoffPlan } from '../../lib/submittals/takeoffPicks'
import { SplitRuleModal } from './SplitRuleModal'

type Props = {
  /** 'build' makes Rev 1 from the picks; 'add' changes the draft: rows come on, move to order only or back, or come off. */
  mode: 'build' | 'add'
  revLabel: string
  /** Each fixture with how it sits on the draft now (`onAs`). */
  candidates: ReadonlyArray<TakeoffCandidate>
  /** By count row: "Ordered 09/23" when the procurement log holds an order for its row; that fixture cannot be left out. */
  bought?: ReadonlyMap<string, string>
  /** By count row, then by a part's takeoff key: "Ordered 09/23" when the log holds an order for that part of a row on the draft. */
  boughtParts?: ReadonlyMap<string, ReadonlyMap<string, string>>
  busy?: boolean
  /** What the picks change (the parts picked are in the plan) and every split switched here (v2.4118). */
  onConfirm: (plan: TakeoffPlan, splits: ReadonlyMap<string, boolean>) => void
  onClose: () => void
}

const GROUP_HINT: Record<CandidateGroup, string> = {
  fixtures: 'pick Order only for what the GC does not need to approve',
  no_part: 'a fixture that comes on has its product blank, to type with Edit',
  pipe_allowance: 'nobody submits pipe; pick one if a GC asks',
}
const ORDER: CandidateGroup[] = ['fixtures', 'no_part', 'pipe_allowance']
const PICKS: FixturePick[] = ['gc', 'order', 'out']

const inp: CSSProperties = { margin: 0 }
const quiet: CSSProperties = { fontSize: '0.78rem', color: 'var(--text-muted)' }
const btn: CSSProperties = { padding: '0.4rem 0.8rem', background: 'var(--surface)', color: 'var(--text-strong)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer', font: 'inherit', fontSize: '0.8125rem', fontWeight: 500 }
const btnPrimary: CSSProperties = { ...btn, background: '#2563eb', borderColor: '#2563eb', color: 'white', fontWeight: 600 }
const countChip: CSSProperties = { padding: '0.12rem 0.6rem', borderRadius: 999, fontSize: '0.78rem', fontWeight: 600 }

/** The lit look of each of the three; unlit they share one quiet look. */
const PICK_ON: Record<FixturePick, CSSProperties> = {
  gc: { background: '#2563eb', color: 'white' },
  order: { background: 'var(--bg-amber-tint)', color: 'var(--text-amber-700)' },
  out: { background: 'var(--bg-muted)', color: 'var(--text-strong)' },
}

/** One fixture's three buttons. Left out is held when the log already holds an order for the fixture. */
function PickButtons({ name, value, lockedOut, disabled, onPick, small = false }: { name: string; value: FixturePick; lockedOut: string; disabled: boolean; onPick: (p: FixturePick) => void; /** a part's buttons, under its fixture's */ small?: boolean }) {
  return (
    <span role="group" aria-label={name} style={{ display: 'inline-flex', border: '1px solid var(--border-strong)', borderRadius: small ? 5 : 6, overflow: 'hidden', flexShrink: 0 }} data-testid={small ? 'takeoff-piece-pick' : 'takeoff-pick'}>
      {PICKS.map((p, i) => {
        const on = value === p
        const held = p === 'out' && lockedOut !== '' && !on
        return (
          <button
            key={p}
            type="button"
            aria-pressed={on}
            disabled={disabled || held}
            title={held ? `${lockedOut}. It cannot be left out.` : undefined}
            onClick={() => onPick(p)}
            style={{ border: 'none', borderLeft: i === 0 ? 'none' : '1px solid var(--border-strong)', padding: small ? '0.22rem 0.5rem' : '0.4rem 0.6rem', font: 'inherit', fontSize: small ? '0.74rem' : '0.78rem', fontWeight: on ? 700 : 500, cursor: held ? 'not-allowed' : 'pointer', textDecoration: held ? 'line-through' : undefined, ...(on ? (small && p === 'gc' ? { background: 'var(--bg-blue-tint)', color: 'var(--text-blue-700)' } : PICK_ON[p]) : { background: 'var(--surface)', color: held ? 'var(--text-faint)' : 'var(--text-muted)' }) }}
            data-pick={p}
          >
            {PICK_LABELS[p]}
          </button>
        )
      })}
    </span>
  )
}

/** A piece's chip text: the part number and a word or two, not the whole catalog line; how many on a fixture when more than one. */
function chipText(p: ProductPiece): string {
  const t = p.label.replace(/\s+/g, ' ').trim()
  const short = t.length > 34 ? `${t.slice(0, 33).trimEnd()}…` : t
  return p.quantity !== 1 && p.quantity > 0 ? `${short} × ${Number.isInteger(p.quantity) ? p.quantity : Math.round(p.quantity * 100) / 100}` : short
}

/** The pieces in runs by where they came from: each assembly's parts together under its name, the loose lines under none. */
function pieceRuns(pieces: ReadonlyArray<ProductPiece>): Array<{ assembly: string | null; pieces: ProductPiece[] }> {
  const runs: Array<{ assembly: string | null; pieces: ProductPiece[] }> = []
  for (const p of pieces) {
    const last = runs[runs.length - 1]
    if (last && last.assembly === p.assembly) last.pieces.push(p)
    else runs.push({ assembly: p.assembly, pieces: [p] })
  }
  return runs
}

/**
 * Choose from the takeoff (v2.4107; three picks 2026-10-02): the takeoff's fixtures in three
 * groups, each one the GC sees, order only, or left out. A fixture already on the draft shows how
 * it sits there and can be moved; nothing is written until the button is pressed. Fixtures and
 * equipment start as the GC's, pipe and allowances left out; the picks are remembered on the bid.
 * The parent writes the rows and the picks.
 */
export function SubmittalTakeoffPicker({ mode, revLabel, candidates: given, bought, boughtParts, busy = false, onConfirm, onClose }: Props) {
  const candidates = given
  // 2026-10-02 · each part's pick, by count row then by the part's takeoff key; a fixture nobody opened holds none.
  const [piecePicks, setPiecePicks] = useState<Map<string, Map<string, PiecePick>>>(() => new Map())
  const [openParts, setOpenParts] = useState<Set<string>>(() => new Set())
  const setPiecePick = (c: TakeoffCandidate, key: string, p: PiecePick) => setPiecePicks((m) => new Map(m).set(c.countRowId, new Map(m.get(c.countRowId) ?? []).set(key, p)))
  const toggleParts = (id: string) => setOpenParts((cur) => { const next = new Set(cur); if (next.has(id)) next.delete(id); else next.add(id); return next })
  const [picks, setPicks] = useState<Map<string, FixturePick>>(() => new Map())
  // v2.4118 · the Split switch, per row whose name spells out more than one tag; starts from the stored split.
  const [splits, setSplits] = useState<Map<string, boolean>>(() => new Map(candidates.filter((c) => c.canSplit).map((c) => [c.countRowId, c.split])))
  const [ruleOpen, setRuleOpen] = useState(false)
  const plan = useMemo(() => planTakeoffPicks(candidates, picks, splits, piecePicks), [candidates, picks, splits, piecePicks])
  const counts = useMemo(() => pickCounts(candidates, picks), [candidates, picks])
  const rowsAdded = planRowsAdded(plan)
  const summary = planSummary(plan, revLabel)
  const isSplit = (c: TakeoffCandidate) => c.canSplit && (splits.get(c.countRowId) ?? c.split)
  const setSplit = (id: string, on: boolean) => setSplits((m) => new Map(m).set(id, on))
  const groups = useMemo(() => ORDER.map((g) => ({ g, items: candidates.filter((c) => c.group === g) })).filter((x) => x.items.length > 0), [candidates])
  const now = (c: TakeoffCandidate) => pickOf(c, picks)
  const setPick = (id: string, p: FixturePick) => setPicks((m) => new Map(m).set(id, p))
  const allWithProductToGc = () => setPicks((m) => {
    const next = new Map(m)
    for (const c of candidates) if (c.product && !c.onAs) next.set(c.countRowId, 'gc')
    return next
  })
  const nothing = mode === 'build' ? rowsAdded === 0 : planIsEmpty(plan)
  const confirm = () => onConfirm(plan, splits)

  return (
    <div role="presentation" onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 10060, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'calc(1rem + var(--app-top-chrome, 0px)) 1rem 1rem' }}>
      <div role="dialog" aria-modal="true" aria-label="Choose from the takeoff" onClick={(e) => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 8, maxWidth: 860, width: '100%', maxHeight: 'min(90vh, 100%)', display: 'flex', flexDirection: 'column', boxShadow: '0 10px 40px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '1rem 1.25rem 0.5rem', display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'flex-start' }}>
          <div style={{ flex: '1 1 auto', minWidth: 0 }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--text-strong)' }}>Choose from the takeoff</h3>
            <p style={{ ...quiet, margin: '0.2rem 0 0' }}>One row per fixture. Pick what happens to each one, or open its parts and pick for each part. Nothing changes until you press the button below. Your picks are remembered on the bid.</p>
            <p style={{ ...quiet, margin: '0.3rem 0 0', display: 'flex', gap: '0.25rem 0.9rem', flexWrap: 'wrap', color: 'var(--text-base)' }} data-testid="takeoff-legend">
              <span><b style={{ color: 'var(--text-blue-700)' }}>GC sees it</b> They approve it, then you order it.</span>
              <span><b style={{ color: 'var(--text-amber-700)' }}>Order only</b> You buy it. The GC never sees it.</span>
              <span><b style={{ color: 'var(--text-strong)' }}>Left out</b> Not on the submittal and not ordered.</span>
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ ...btn, padding: '0.2rem 0.55rem', flexShrink: 0 }}>×</button>
        </div>
        <div style={{ overflowY: 'auto', padding: '0 1.25rem', flex: 1 }}>
          {groups.map(({ g, items }) => {
            const gc = items.filter((c) => now(c) === 'gc').length
            const order = items.filter((c) => now(c) === 'order').length
            return (
              <div key={g} data-testid={`takeoff-group-${g}`} style={{ marginTop: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'baseline', borderBottom: '1px solid var(--border)', paddingBottom: 3, fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', fontWeight: 600 }}>
                  <span>{GROUP_LABELS[g]} · {gc} the GC sees{order > 0 ? ` · ${order} order only` : ''}{items.length - gc - order > 0 ? ` · ${items.length - gc - order} left out` : ''}</span>
                  <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>{GROUP_HINT[g]}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', fontSize: '0.8125rem' }}>
                  {items.map((c) => {
                    const pick = now(c)
                    const name = c.tagText || c.fixture
                    const coming = !c.onAs && pick !== 'out'
                    const change = pickChangeWords(c, pick, revLabel)
                    const held = c.onAs ? bought?.get(c.countRowId) ?? '' : ''
                    // The parts as picked: the product line and the counts read them; the list shows when the fixture is opened.
                    const all = allPiecesOf(c)
                    const pp = piecePicksOf(c, piecePicks.get(c.countRowId))
                    const shown = piecePicks.has(c.countRowId) ? withPiecePicks(c, pp) : c
                    const partsSetInEdit = !!c.onAs && c.onParts == null
                    const hasParts = c.group !== 'pipe_allowance' && !partsSetInEdit && (all.length > 1 || all.some((p) => p.assembly))
                    const open = hasParts && openParts.has(c.countRowId)
                    const ruled = pick !== 'gc'
                    return (
                      <Fragment key={c.countRowId}>
                        <div style={{ display: 'flex', gap: '0.4rem 0.75rem', flexWrap: 'wrap', alignItems: 'flex-start', padding: '0.4rem 0', borderBottom: '1px solid var(--bg-muted)' }} data-testid="takeoff-candidate" data-group={c.group} data-pick={pick}>
                          <span style={{ flex: '1 1 16rem', minWidth: 0, color: pick === 'out' ? 'var(--text-muted)' : 'var(--text-strong)' }}>
                            <b>{name}</b>
                            {c.tagText ? <span style={quiet}> · {c.fixture}</span> : null}
                            <span style={quiet}> × {c.count}</span>
                            {c.supplyHouseName ? <span style={quiet}> · {c.supplyHouseName}</span> : null}
                            <span style={{ ...quiet, display: 'block' }} data-testid="takeoff-product">{shown.product ?? (shown.pieces.length > 0 ? 'every part order only — the row comes in to type with Edit' : c.group === 'no_part' ? 'no part yet — cost it on Takeoffs, or type the product with Edit' : c.group === 'pipe_allowance' ? 'pipe or allowance' : '')}{c.onAs ? ` · on ${revLabel}` : ''}</span>
                            {hasParts ? (
                              <span style={{ ...quiet, display: 'flex', gap: '0.5rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
                                <button type="button" aria-expanded={open} onClick={() => toggleParts(c.countRowId)} style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', fontSize: '0.78rem', color: 'var(--text-link)', textDecoration: 'underline', cursor: 'pointer' }} data-testid="takeoff-parts-toggle">
                                  {open ? 'Hide parts' : `Show ${all.length} part${all.length === 1 ? '' : 's'}`}
                                </button>
                                <span data-testid="takeoff-part-count">{piecePicksLine(pp)}</span>
                              </span>
                            ) : partsSetInEdit && c.group !== 'pipe_allowance' ? (
                              <span style={{ ...quiet, display: 'block' }} data-testid="takeoff-parts-in-edit">Its parts are set with Edit on its row.</span>
                            ) : null}
                            {change ? <span style={{ ...quiet, display: 'block', color: 'var(--text-amber-700)' }} data-testid="takeoff-change">{change}</span> : null}
                            {held && pick !== 'out' ? <span style={{ ...quiet, display: 'block' }} data-testid="takeoff-bought">{held}. It cannot be left out.</span> : null}
                          </span>
                          <span style={{ display: 'inline-flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap', marginLeft: 'auto' }}>
                            {c.canSplit && coming ? (
                              <label style={{ ...quiet, display: 'inline-flex', alignItems: 'center', gap: '0.3rem', whiteSpace: 'nowrap', cursor: 'pointer', color: isSplit(c) ? 'var(--text-blue-700)' : 'var(--text-muted)', fontWeight: isSplit(c) ? 600 : 400 }} title={`This name spells out ${c.tags.length} tags. Off: one row, ${c.tags.join(', ')}. On: a row each.`}>
                                <input type="checkbox" role="switch" aria-label={`Split ${c.tags.join(', ')}`} checked={isSplit(c)} disabled={busy} onChange={(e) => setSplit(c.countRowId, e.target.checked)} style={inp} data-testid="takeoff-split" />
                                Split
                              </label>
                            ) : null}
                            <PickButtons name={name} value={pick} lockedOut={held} disabled={busy} onPick={(p) => setPick(c.countRowId, p)} />
                          </span>
                        </div>
                        {open ? (
                          <div style={{ margin: '0.3rem 0 0.4rem 0.4rem', paddingLeft: '0.7rem', borderLeft: '2px solid #2563eb', display: 'flex', flexDirection: 'column', gap: '0.3rem', opacity: ruled ? 0.55 : 1 }} data-testid="takeoff-pieces">
                            {pieceRuns(all).map((run, ri) => (
                              <Fragment key={`${run.assembly ?? 'loose'}-${ri}`}>
                                {run.assembly || all.some((p) => p.assembly) ? (
                                  <span style={{ ...quiet, fontSize: '0.7rem' }} data-testid="takeoff-piece-run">{run.assembly ? <>Inside <b style={{ fontWeight: 600, color: 'var(--text-base)' }}>{run.assembly}</b></> : 'On the takeoff'}</span>
                                ) : null}
                                {run.pieces.map((p) => {
                                  const heldPart = c.onAs ? boughtParts?.get(c.countRowId)?.get(p.key) ?? '' : ''
                                  return (
                                    <span key={p.key} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }} data-testid="takeoff-piece" data-trim={p.trim ? 'true' : undefined} data-pick={pp.get(p.key)}>
                                      <span style={{ flex: '1 1 14rem', minWidth: 0, fontSize: '0.78rem', color: pp.get(p.key) === 'out' ? 'var(--text-muted)' : 'var(--text-base)' }} title={`${p.label}${p.houseName ? ` · ${p.houseName}` : ''}`}>
                                        {chipText(p)}
                                        {heldPart ? <span style={{ ...quiet, display: 'block', fontSize: '0.72rem' }} data-testid="takeoff-piece-bought">{heldPart}. It cannot be left out.</span> : null}
                                      </span>
                                      <PickButtons small name={p.label} value={pp.get(p.key) ?? 'order'} lockedOut={heldPart} disabled={busy || ruled} onPick={(v) => setPiecePick(c, p.key, v)} />
                                    </span>
                                  )
                                })}
                              </Fragment>
                            ))}
                            {ruled ? <span style={{ ...quiet, color: 'var(--text-amber-700)' }} data-testid="takeoff-pieces-ruled">{pick === 'order' ? 'The whole fixture is order only. Your picks for each part come back when you set it to GC sees it.' : 'The whole fixture is left out. Your picks for each part come back when you set it to GC sees it.'}</span> : null}
                          </div>
                        ) : null}
                        {isSplit(c) && coming ? (
                          <div style={{ borderLeft: '2px solid #2563eb', paddingLeft: '0.7rem', margin: '0.2rem 0 0.25rem 0.2rem', display: 'grid', gap: '0.1rem', fontSize: '0.8rem' }} data-testid="takeoff-split-rows">
                            {c.tags.map((t) => <span key={t}><b>{t}</b><span style={quiet}> · {c.product ?? 'product to type'}{c.supplyHouseName ? ` · ${c.supplyHouseName}` : ''} · from {c.fixture}</span></span>)}
                          </div>
                        ) : null}
                      </Fragment>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
        <div style={{ padding: '0.6rem 1.25rem 1rem', borderTop: '1px solid var(--border-strong)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <span style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }} data-testid="takeoff-counts">
            <span style={{ ...countChip, background: 'var(--bg-blue-tint)', color: 'var(--text-blue-700)' }}>{counts.gc} the GC sees</span>
            <span style={{ ...countChip, background: 'var(--bg-amber-tint)', color: 'var(--text-amber-700)' }}>{counts.order} order only</span>
            <span style={{ ...countChip, background: 'var(--bg-muted)', color: 'var(--text-strong)' }}>{counts.out} left out</span>
          </span>
          <span style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ ...quiet, color: 'var(--text-strong)' }}><span data-testid="takeoff-bar">{summary || 'Nothing changes yet.'}</span> · <button type="button" onClick={() => setRuleOpen(true)} style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'var(--text-muted)', textDecoration: 'underline', cursor: 'pointer' }} data-testid="split-rule-link">when can a row split?</button></span>
            <span style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button type="button" onClick={allWithProductToGc} disabled={busy} style={btn}>GC sees all with a product</button>
              <button type="button" onClick={onClose} disabled={busy} style={btn}>Cancel</button>
              <button type="button" onClick={confirm} disabled={busy || nothing} style={{ ...btnPrimary, opacity: nothing ? 0.6 : 1 }} data-testid="takeoff-confirm">
                {mode === 'build' ? `Build ${revLabel} with ${rowsAdded} row${rowsAdded === 1 ? '' : 's'}` : `Update ${revLabel}`}
              </button>
            </span>
          </span>
        </div>
      </div>
      {ruleOpen ? <SplitRuleModal examples={splitExplanation(candidates)} onClose={() => setRuleOpen(false)} /> : null}
    </div>
  )
}
