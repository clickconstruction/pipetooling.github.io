import { Fragment, useMemo, useState, type CSSProperties } from 'react'
import { candidateBar, candidateCounts, GROUP_LABELS, splitExplanation, withProductKeys, type CandidateGroup, type ProductPiece, type TakeoffCandidate } from '../../lib/submittals/takeoffCandidates'
import { SplitRuleModal } from './SplitRuleModal'

type Props = {
  /** 'build' makes Rev 1 from the ticked rows; 'add' puts the ticked rows onto the draft. */
  mode: 'build' | 'add'
  revLabel: string
  candidates: ReadonlyArray<TakeoffCandidate>
  busy?: boolean
  /**
   * The ticked candidates (with `split` and the product as switched), every tick, every split switched
   * here (v2.4118), and the pieces switched here, by count row (v2.4292).
   */
  onConfirm: (ticked: ReadonlyArray<TakeoffCandidate>, ticks: ReadonlyMap<string, boolean>, splits: ReadonlyMap<string, boolean>, productKeys: ReadonlyMap<string, ReadonlyArray<string>>) => void
  onClose: () => void
}

const GROUP_HINT: Record<CandidateGroup, string> = {
  fixtures: 'untick what the GC does not need to approve',
  no_part: 'ticked rows come in with the product blank, to type with Edit',
  pipe_allowance: 'nobody submits pipe; tick one if a GC asks',
}
const ORDER: CandidateGroup[] = ['fixtures', 'no_part', 'pipe_allowance']

const inp: CSSProperties = { margin: 0 }
const quiet: CSSProperties = { fontSize: '0.78rem', color: 'var(--text-muted)' }
const btn: CSSProperties = { padding: '0.4rem 0.8rem', background: 'var(--surface)', color: 'var(--text-strong)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer', font: 'inherit', fontSize: '0.8125rem', fontWeight: 500 }
const btnPrimary: CSSProperties = { ...btn, background: '#2563eb', borderColor: '#2563eb', color: 'white', fontWeight: 600 }
const chipBase: CSSProperties = { font: 'inherit', fontSize: '0.74rem', lineHeight: 1.3, borderRadius: 999, padding: '0.06rem 0.5rem', cursor: 'pointer', maxWidth: '16rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }

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
 * Choose from the takeoff (v2.4107): the takeoff's fixtures in three groups with the
 * part under each as the product and the house it came from. Fixtures and equipment
 * start ticked, pipe and allowances unticked; the estimator prunes here, once, and the
 * ticks are remembered on the bid. The parent writes the rows and the ticks.
 */
export function SubmittalTakeoffPicker({ mode, revLabel, candidates: given, busy = false, onConfirm, onClose }: Props) {
  // v2.4292 · the pieces switched here, by count row; every count, bar and row below reads the product as switched.
  const [pieceKeys, setPieceKeys] = useState<Map<string, string[]>>(() => new Map())
  const candidates = useMemo(() => given.map((c) => (pieceKeys.has(c.countRowId) ? withProductKeys(c, pieceKeys.get(c.countRowId)!) : c)), [given, pieceKeys])
  const togglePiece = (c: TakeoffCandidate, key: string) => {
    const on = c.productKeys.includes(key)
    const next = c.pieces.map((p) => p.key).filter((k) => (k === key ? !on : c.productKeys.includes(k)))
    setPieceKeys((m) => new Map(m).set(c.countRowId, next))
  }
  const [ticks, setTicks] = useState<Map<string, boolean>>(() => new Map(candidates.map((c) => [c.countRowId, c.ticked && !c.alreadyOn])))
  // v2.4118 · the Split switch, per row whose name spells out more than one tag; starts from the stored split.
  const [splits, setSplits] = useState<Map<string, boolean>>(() => new Map(candidates.filter((c) => c.canSplit).map((c) => [c.countRowId, c.split])))
  const [ruleOpen, setRuleOpen] = useState(false)
  const counts = useMemo(() => candidateCounts(candidates, ticks, splits), [candidates, ticks, splits])
  const isSplit = (c: TakeoffCandidate) => c.canSplit && (splits.get(c.countRowId) ?? c.split)
  const setSplit = (id: string, on: boolean) => setSplits((m) => new Map(m).set(id, on))
  const groups = useMemo(() => ORDER.map((g) => ({ g, items: candidates.filter((c) => c.group === g) })).filter((x) => x.items.length > 0), [candidates])
  const isOn = (c: TakeoffCandidate) => !c.alreadyOn && (ticks.get(c.countRowId) ?? c.ticked)
  const set = (id: string, on: boolean) => setTicks((m) => new Map(m).set(id, on))
  const tickAllWithProduct = () => setTicks((m) => {
    const next = new Map(m)
    for (const c of candidates) if (c.product && !c.alreadyOn) next.set(c.countRowId, true)
    return next
  })
  const confirm = () => onConfirm(candidates.filter(isOn).map((c) => ({ ...c, split: isSplit(c) })), ticks, splits, pieceKeys)

  return (
    <div role="presentation" onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 10060, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div role="dialog" aria-modal="true" aria-label="Choose from the takeoff" onClick={(e) => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 8, maxWidth: 820, width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 10px 40px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '1rem 1.25rem 0.5rem', display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'flex-start' }}>
          <div style={{ flex: '1 1 auto', minWidth: 0 }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--text-strong)' }}>Choose from the takeoff</h3>
            <p style={{ ...quiet, margin: '0.2rem 0 0' }}>One row per fixture. Every part under it is bought. An assembly opens into the parts inside it. Stops, supplies, traps and flanges start as order only. They go on the procurement log but not on the GC’s submittal. Tap a part to switch it. Your choices are remembered on the bid.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ ...btn, padding: '0.2rem 0.55rem', flexShrink: 0 }}>×</button>
        </div>
        <div style={{ overflowY: 'auto', padding: '0 1.25rem', flex: 1 }}>
          {groups.map(({ g, items }) => {
            const on = items.filter(isOn).length
            return (
              <div key={g} data-testid={`takeoff-group-${g}`} style={{ marginTop: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'baseline', borderBottom: '1px solid var(--border)', paddingBottom: 3, fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', fontWeight: 600 }}>
                  <span>{GROUP_LABELS[g]} · {on} ticked{items.length !== on ? ` of ${items.length}` : ''}</span>
                  <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>{GROUP_HINT[g]}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto auto', gap: '0.35rem 0.6rem', alignItems: 'start', fontSize: '0.8125rem', padding: '0.3rem 0' }}>
                  {items.map((c) => (
                    <Fragment key={c.countRowId}>
                      <input type="checkbox" aria-label={`${c.tagText || c.fixture}`} checked={isOn(c)} disabled={busy || c.alreadyOn} onChange={(e) => set(c.countRowId, e.target.checked)} style={{ ...inp, marginTop: '0.2rem' }} data-testid="takeoff-candidate" data-group={c.group} />
                      <span style={{ minWidth: 0, color: c.alreadyOn ? 'var(--text-faint)' : c.group === 'pipe_allowance' ? 'var(--text-muted)' : 'var(--text-strong)' }}>
                        <b>{c.tagText || c.fixture}</b>
                        {c.tagText ? <span style={quiet}> · {c.fixture}</span> : null}
                        <span style={quiet}> × {c.count}</span>
                        <span style={{ ...quiet, display: 'block' }} data-testid="takeoff-product">{c.product ?? (c.pieces.length > 0 ? 'every part order only — the row comes in to type with Edit' : c.group === 'no_part' ? 'no part yet — cost it on Takeoffs, or type the product with Edit' : c.group === 'pipe_allowance' ? 'pipe or allowance' : '')}{c.alreadyOn ? ' · already on this revision' : ''}</span>
                        {c.pieces.length > 1 && !c.alreadyOn && c.group !== 'pipe_allowance' ? (
                          <span style={{ ...quiet, display: 'block' }} data-testid="takeoff-part-count">
                            {c.pieces.length} parts · the GC sees {c.productKeys.length}{c.pieces.length - c.productKeys.length > 0 ? ` · ${c.pieces.length - c.productKeys.length} order only` : ''}
                          </span>
                        ) : null}
                        {(c.pieces.length > 1 || c.pieces.some((p) => p.assembly)) && !c.alreadyOn && c.group !== 'pipe_allowance' ? (
                          <span style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.25rem' }} data-testid="takeoff-pieces">
                            {pieceRuns(c.pieces).map((run, ri) => (
                              <span key={`${run.assembly ?? 'loose'}-${ri}`} style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                {run.assembly || c.pieces.some((p) => p.assembly) ? (
                                  <span style={{ ...quiet, fontSize: '0.7rem' }} data-testid="takeoff-piece-run">{run.assembly ? <>Inside <b style={{ fontWeight: 600, color: 'var(--text-base)' }}>{run.assembly}</b></> : 'On the takeoff'}</span>
                                ) : null}
                                <span style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', paddingLeft: run.assembly || c.pieces.some((p) => p.assembly) ? '0.6rem' : 0 }}>
                                  {run.pieces.map((p) => {
                                    const on = c.productKeys.includes(p.key)
                                    return (
                                      <button
                                        key={p.key}
                                        type="button"
                                        aria-pressed={on}
                                        aria-label={`${p.label}${on ? '' : ', order only'}`}
                                        title={`${p.label}${p.quantity !== 1 ? ` · ${p.quantity} on each fixture` : ''}${on ? ' · the GC sees it' : ' · order only: bought, not on the GC’s submittal'}${p.houseName ? ` · ${p.houseName}` : ''}`}
                                        disabled={busy}
                                        onClick={() => togglePiece(c, p.key)}
                                        style={on
                                          ? { ...chipBase, background: 'var(--bg-blue-tint)', border: '1px solid #2563eb', color: 'var(--text-blue-700)', fontWeight: 600 }
                                          : { ...chipBase, background: 'var(--surface)', border: '1px dashed var(--border-strong)', color: 'var(--text-faint)' }}
                                        data-testid="takeoff-piece"
                                        data-trim={p.trim ? 'true' : undefined}
                                      >
                                        {chipText(p)}{!on ? <span style={{ fontWeight: 400, opacity: 0.8 }}> · order only</span> : null}
                                      </button>
                                    )
                                  })}
                                </span>
                              </span>
                            ))}
                          </span>
                        ) : null}
                      </span>
                      {c.canSplit && !c.alreadyOn ? (
                        <label style={{ ...quiet, display: 'inline-flex', alignItems: 'center', gap: '0.3rem', whiteSpace: 'nowrap', cursor: 'pointer', color: isSplit(c) ? 'var(--text-blue-700)' : 'var(--text-muted)', fontWeight: isSplit(c) ? 600 : 400 }} title={`This name spells out ${c.tags.length} tags. Off: one row, ${c.tags.join(', ')}. On: a row each.`}>
                          <input type="checkbox" role="switch" aria-label={`Split ${c.tags.join(', ')}`} checked={isSplit(c)} disabled={busy || !isOn(c)} onChange={(e) => setSplit(c.countRowId, e.target.checked)} style={inp} data-testid="takeoff-split" />
                          Split
                        </label>
                      ) : <span />}
                      <span style={{ ...quiet, whiteSpace: 'nowrap' }}>{c.supplyHouseName ?? ''}</span>
                      {isSplit(c) && isOn(c) ? (
                        <div style={{ gridColumn: '2 / span 3', borderLeft: '2px solid #2563eb', paddingLeft: '0.7rem', margin: '0 0 0.25rem', display: 'grid', gap: '0.1rem', fontSize: '0.8rem' }} data-testid="takeoff-split-rows">
                          {c.tags.map((t) => <span key={t}><b>{t}</b><span style={quiet}> · {c.product ?? 'product to type'}{c.supplyHouseName ? ` · ${c.supplyHouseName}` : ''} · from {c.fixture}</span></span>)}
                        </div>
                      ) : null}
                    </Fragment>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
        <div style={{ padding: '0.6rem 1.25rem 1rem', borderTop: '1px solid var(--border-strong)', display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ ...quiet, color: 'var(--text-strong)' }}><span data-testid="takeoff-bar">{candidateBar(counts, revLabel)}</span> · <button type="button" onClick={() => setRuleOpen(true)} style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'var(--text-muted)', textDecoration: 'underline', cursor: 'pointer' }} data-testid="split-rule-link">when can a row split?</button></span>
          <span style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button type="button" onClick={tickAllWithProduct} disabled={busy} style={btn}>Tick all with a product</button>
            <button type="button" onClick={onClose} disabled={busy} style={btn}>Cancel</button>
            <button type="button" onClick={confirm} disabled={busy || counts.rows === 0} style={{ ...btnPrimary, opacity: counts.rows === 0 ? 0.6 : 1 }} data-testid="takeoff-confirm">
              {mode === 'build' ? `Build ${revLabel} with ${counts.rows} row${counts.rows === 1 ? '' : 's'}` : `Add ${counts.rows} row${counts.rows === 1 ? '' : 's'} to ${revLabel}`}
            </button>
          </span>
        </div>
      </div>
      {ruleOpen ? <SplitRuleModal examples={splitExplanation(candidates)} onClose={() => setRuleOpen(false)} /> : null}
    </div>
  )
}
