import { Fragment, useMemo, useState, type CSSProperties } from 'react'
import { candidateBar, candidateCounts, GROUP_LABELS, type CandidateGroup, type TakeoffCandidate } from '../../lib/submittals/takeoffCandidates'

type Props = {
  /** 'build' makes Rev 1 from the ticked rows; 'add' puts the ticked rows onto the draft. */
  mode: 'build' | 'add'
  revLabel: string
  candidates: ReadonlyArray<TakeoffCandidate>
  busy?: boolean
  onConfirm: (ticked: ReadonlyArray<TakeoffCandidate>, ticks: ReadonlyMap<string, boolean>) => void
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

/**
 * Choose from the takeoff (v2.4107): the takeoff's fixtures in three groups with the
 * part under each as the product and the house it came from. Fixtures and equipment
 * start ticked, pipe and allowances unticked; the estimator prunes here, once, and the
 * ticks are remembered on the bid. The parent writes the rows and the ticks.
 */
export function SubmittalTakeoffPicker({ mode, revLabel, candidates, busy = false, onConfirm, onClose }: Props) {
  const [ticks, setTicks] = useState<Map<string, boolean>>(() => new Map(candidates.map((c) => [c.countRowId, c.ticked && !c.alreadyOn])))
  const counts = useMemo(() => candidateCounts(candidates, ticks), [candidates, ticks])
  const groups = useMemo(() => ORDER.map((g) => ({ g, items: candidates.filter((c) => c.group === g) })).filter((x) => x.items.length > 0), [candidates])
  const isOn = (c: TakeoffCandidate) => !c.alreadyOn && (ticks.get(c.countRowId) ?? c.ticked)
  const set = (id: string, on: boolean) => setTicks((m) => new Map(m).set(id, on))
  const tickAllWithProduct = () => setTicks((m) => {
    const next = new Map(m)
    for (const c of candidates) if (c.product && !c.alreadyOn) next.set(c.countRowId, true)
    return next
  })
  const confirm = () => onConfirm(candidates.filter(isOn), ticks)

  return (
    <div role="presentation" onMouseDown={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div role="dialog" aria-modal="true" aria-label="Choose from the takeoff" onMouseDown={(e) => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 8, maxWidth: 820, width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 10px 40px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '1rem 1.25rem 0.5rem', display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--text-strong)' }}>Choose from the takeoff</h3>
            <p style={{ ...quiet, margin: '0.2rem 0 0' }}>One row per fixture; the part under it is the product, with the house it came from. Your ticks are remembered on the bid.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ ...btn, padding: '0.2rem 0.55rem' }}>×</button>
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
                <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: '0.2rem 0.6rem', alignItems: 'center', fontSize: '0.8125rem', padding: '0.3rem 0' }}>
                  {items.map((c) => (
                    <Fragment key={c.countRowId}>
                      <input type="checkbox" aria-label={`${c.tagText || c.fixture}`} checked={isOn(c)} disabled={busy || c.alreadyOn} onChange={(e) => set(c.countRowId, e.target.checked)} style={inp} data-testid="takeoff-candidate" data-group={c.group} />
                      <span style={{ minWidth: 0, color: c.alreadyOn ? 'var(--text-faint)' : c.group === 'pipe_allowance' ? 'var(--text-muted)' : 'var(--text-strong)' }}>
                        <b>{c.tagText || c.fixture}</b>
                        {c.tagText ? <span style={quiet}> · {c.fixture}</span> : null}
                        <span style={quiet}> × {c.count}</span>
                        <span style={{ ...quiet, display: 'block' }}>{c.product ?? (c.group === 'no_part' ? 'no part yet — cost it on Takeoffs, or type the product with Edit' : c.group === 'pipe_allowance' ? 'pipe or allowance' : '')}{c.alreadyOn ? ' · already on this revision' : ''}</span>
                      </span>
                      <span style={{ ...quiet, whiteSpace: 'nowrap' }}>{c.supplyHouseName ?? ''}</span>
                    </Fragment>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
        <div style={{ padding: '0.6rem 1.25rem 1rem', borderTop: '1px solid var(--border-strong)', display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ ...quiet, color: 'var(--text-strong)' }} data-testid="takeoff-bar">{candidateBar(counts, revLabel)}</span>
          <span style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button type="button" onClick={tickAllWithProduct} disabled={busy} style={btn}>Tick all with a product</button>
            <button type="button" onClick={onClose} disabled={busy} style={btn}>Cancel</button>
            <button type="button" onClick={confirm} disabled={busy || counts.ticked === 0} style={{ ...btnPrimary, opacity: counts.ticked === 0 ? 0.6 : 1 }} data-testid="takeoff-confirm">
              {mode === 'build' ? `Build ${revLabel} with ${counts.ticked} row${counts.ticked === 1 ? '' : 's'}` : `Add ${counts.ticked} row${counts.ticked === 1 ? '' : 's'} to ${revLabel}`}
            </button>
          </span>
        </div>
      </div>
    </div>
  )
}
