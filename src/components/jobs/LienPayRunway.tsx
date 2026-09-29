import type { CSSProperties } from 'react'
import type { LienPayRunway as LienPayRunwayModel, LienRunwayTone } from '../../lib/jobs/lienPayRunway'

/**
 * The lien runway under a Billed / Collections row's money bar (v2.4051):
 * today at the left, the green dot where the money is expected, the flag on
 * the last day to lien, the run between them green (room) or red-hatched
 * (the lien dies first), a hollow flag for a sub job's § 53.056 notice while it
 * is owed (a check once recorded), and two lines under it — the dates, then the
 * verdict — that are a door to the job's Lien window. Pure presentation — every mark and word comes from
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
  const lienFlag = m?.notice && !m.notice.done ? 'var(--text-700)' : flag
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
    // Two deliberate lines — the dates, then the verdict (v2.4064); each line stays whole, none wraps mid-sentence.
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
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
      {runway.lines.map((line, i) => (
        <span key={i} style={{ whiteSpace: 'nowrap', fontWeight: i === runway.lines.length - 1 ? 700 : 600 }}>
          {line}
          {onOpen && i === runway.lines.length - 1 ? ' ›' : ''}
        </span>
      ))}
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
        {/* the § 53.056 notice on a sub job (v2.4096): hollow while owed, a check once recorded */}
        {m.notice && !m.notice.done ? (
          <>
            <div style={{ position: 'absolute', left: `calc(${m.notice.pct}% - 1px)`, top: 0, width: 2, height: trackH, background: flag }} />
            <div style={{ position: 'absolute', left: `calc(${m.notice.pct}% + 1px)`, top: 0, width: 9, height: 7, background: flag, clipPath: 'polygon(0 0, 100% 50%, 0 100%)' }} />
            <div style={{ position: 'absolute', left: `calc(${m.notice.pct}% + 2.5px)`, top: 1.5, width: 5, height: 4, background: 'var(--surface)', clipPath: 'polygon(0 0, 100% 50%, 0 100%)' }} />
          </>
        ) : null}
        {m.notice && m.notice.done ? (
          <div
            style={{
              position: 'absolute',
              left: `calc(${m.notice.pct}% - 6px)`,
              top: 4,
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: '#15803d',
              color: '#ffffff',
              fontSize: 9,
              lineHeight: '12px',
              textAlign: 'center',
              fontWeight: 700,
            }}
          >
            ✓
          </div>
        ) : null}
        {/* the lien flag — neutral while a notice is owed, so the eye lands on the hollow flag first */}
        <div style={{ position: 'absolute', left: `calc(${m.lien.pct}% - 1px)`, top: 0, width: 2, height: trackH, background: lienFlag }} />
        <div
          style={{
            position: 'absolute',
            left: `calc(${m.lien.pct}% + 1px)`,
            top: 0,
            width: 9,
            height: 7,
            background: lienFlag,
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
