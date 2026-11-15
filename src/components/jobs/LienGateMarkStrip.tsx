import { LIEN_GATE_MARK_NAMES, lienGateMarksSummary, type LienGateMark } from '../../lib/jobs/lienGateMarks'

/**
 * The five gate marks on a Lien affidavits list row (design spike, the owner's ask of 2026-11-15): one dot per
 * gate in the pane's order, green for a clear gate, a red cross for an open one, a hollow dot for a slot the job
 * is not asked (a job contracted with the owner has no GC and no notice). Each mark names its gate on hover; the
 * whole strip reads its summary to a screen reader.
 */
export function LienGateMarkStrip({ marks, size = 9 }: { marks: ReadonlyArray<LienGateMark>; size?: number }) {
  return (
    <span data-lien-gate-marks role="img" aria-label={`Gates: ${lienGateMarksSummary(marks)}`} title={lienGateMarksSummary(marks)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, lineHeight: 1 }}>
      {marks.map((m) => (
        <span key={m.slot} aria-hidden data-lien-gate-mark={m.slot} data-state={m.state} title={`${LIEN_GATE_MARK_NAMES[m.slot]} — ${m.title}`} style={markStyle(m, size)}>
          {m.state === 'open' ? '✕' : ''}
        </span>
      ))}
    </span>
  )
}

function markStyle(m: LienGateMark, size: number): React.CSSProperties {
  const base: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: size, height: size, borderRadius: '50%', boxSizing: 'border-box', fontSize: size - 1, fontWeight: 800 }
  if (m.state === 'ok') return { ...base, background: 'var(--text-green-700)', opacity: 0.75 }
  if (m.state === 'open') return { ...base, color: 'var(--text-red-600)', fontSize: size + 2, lineHeight: 1 }
  return { ...base, border: '1.5px solid var(--border-strong)', background: 'transparent' }
}
