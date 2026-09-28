import type { CSSProperties } from 'react'
import type { LienPayRunway as LienPayRunwayModel, LienRunwayTone } from '../../lib/jobs/lienPayRunway'

/**
 * The lien runway under a Billed / Collections row's money bar (v2.4051):
 * today at the left, the green dot where the money is expected, the flag on
 * the last day to lien, the run between them green (room) or red-hatched
 * (the lien dies first), and one sentence under it that is a door to the
 * job's Lien window. Pure presentation — every mark and word comes from
 * `buildLienPayRunway`.
 */

const TONE_COLOR: Record<LienRunwayTone, string> = {
  green: 'var(--text-green-700)',
  amber: 'var(--text-amber-800)',
  red: 'var(--text-red-700)',
  grey: 'var(--text-muted)',
}

const FLAG_COLOR: Record<LienRunwayTone, string> = {
  green: '#15803d',
  amber: '#b45309',
  red: '#b91c1c',
  grey: 'var(--text-muted)',
}

const HATCH = 'repeating-linear-gradient(135deg, #fca5a5 0 3px, var(--bg-red-tint) 3px 6px)'

export default function LienPayRunway({
  runway,
  onOpen,
  compact = false,
}: {
  runway: LienPayRunwayModel
  /** Opens the job's Lien window (the timeline spells out the basis). */
  onOpen?: () => void
  compact?: boolean
}) {
  if (runway.state === 'none') return null
  const color = TONE_COLOR[runway.tone]
  const flag = FLAG_COLOR[runway.tone]
  const m = runway.marks
  const trackH = 20
  const wrap: CSSProperties = { display: 'flex', flexDirection: 'column', gap: '0.15rem', width: '100%', maxWidth: '100%', marginTop: compact ? '0.1rem' : '0.2rem' }
  const wordsStyle: CSSProperties = {
    fontSize: '0.75rem',
    fontWeight: 600,
    color,
    background: 'none',
    border: 'none',
    borderBottom: `1px dotted ${color}`,
    padding: 0,
    cursor: onOpen ? 'pointer' : 'default',
    textAlign: 'center',
    lineHeight: 1.3,
    alignSelf: 'center',
    // The sentence wraps at its separators in the 13rem table column (v2.4051): a clipped verdict is no verdict.
    whiteSpace: 'normal',
    maxWidth: '100%',
    fontVariantNumeric: 'tabular-nums',
  }
  const words = (
    <button
      type="button"
      className="lienRunwayWords"
      data-state={runway.state}
      title={runway.title}
      onClick={
        onOpen
          ? (e) => {
              e.stopPropagation()
              onOpen()
            }
          : undefined
      }
      style={wordsStyle}
    >
      {runway.words}
      {onOpen ? ' ›' : ''}
    </button>
  )
  if (!m) {
    // Closed or filed: one line, no track.
    return (
      <div className="lienRunway" data-state={runway.state} style={wrap}>
        {words}
      </div>
    )
  }
  return (
    <div className="lienRunway" data-state={runway.state} style={wrap}>
      <div
        aria-hidden
        style={{ position: 'relative', height: trackH, width: '100%' }}
      >
        {/* the track */}
        <div style={{ position: 'absolute', left: 0, right: 0, top: 9, height: 2, background: 'var(--border)' }} />
        {/* the run between the marks */}
        {m.gap ? (
          <div
            style={{
              position: 'absolute',
              left: `${m.gap.fromPct}%`,
              width: `${Math.max(0, m.gap.toPct - m.gap.fromPct)}%`,
              top: 7,
              height: 6,
              borderRadius: 3,
              background: m.gap.kind === 'room' ? 'var(--bg-green-200)' : HATCH,
            }}
          />
        ) : null}
        {/* today */}
        <div style={{ position: 'absolute', left: 0, top: 3, width: 2, height: 14, background: 'var(--text-muted)' }} />
        {/* the pay dot */}
        {m.pay ? (
          <div
            style={{
              position: 'absolute',
              left: `calc(${m.pay.pct}% - 5px)`,
              top: 5,
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: '#16a34a',
              border: '2px solid var(--surface)',
              boxShadow: '0 0 0 1px #16a34a',
            }}
          />
        ) : null}
        {/* the flag */}
        <div style={{ position: 'absolute', left: `calc(${m.lien.pct}% - 1px)`, top: 0, width: 2, height: trackH, background: flag }} />
        <div
          style={{
            position: 'absolute',
            left: `calc(${m.lien.pct}% + 1px)`,
            top: 0,
            width: 9,
            height: 7,
            background: flag,
            clipPath: 'polygon(0 0, 100% 50%, 0 100%)',
          }}
        />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.625rem', color: 'var(--text-muted)', lineHeight: 1 }}>
        <span>today</span>
        <span>{runway.endLabel}</span>
      </div>
      {words}
    </div>
  )
}
