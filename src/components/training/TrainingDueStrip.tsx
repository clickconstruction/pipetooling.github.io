import type { CSSProperties } from 'react'
import type { DueChip, TrainingDueStrip as TrainingDueStripModel } from '../../lib/training/trainingDueStrip'

/**
 * A course's due date drawn as a strip (punch list #217, field-11; a prototype behind the Training
 * card's *Due strip* switch, also on Settings → Training's See who). A thin track from the day the
 * person passed (a green dot, the day and the version under it) to the day the pass runs out (a
 * diamond, the day and *in 4 days* under it), the last `dueSoonDays` shaded amber, today a blue tick
 * on the track, so *in 4 days* is a position inside a shaded window. Past the day the tick sits red
 * at the end; a pass a retake day voided runs to a red cut at that day instead, with no window. The
 * whole strip reads as one sentence on hover and to a screen reader. Nothing drawn with no pass:
 * the chip alone says *not done*. The shape is the lien Windows calendar's bar over
 * `trainingDueStrip.ts`.
 */

const TRACK_H = 14
const LABELS_H = 48

const TONE: Record<DueChip['tone'], CSSProperties> = {
  red: { background: 'var(--bg-red-100)', color: 'var(--text-red-700)' },
  amber: { background: 'var(--bg-amber-100)', color: 'var(--text-amber-800)' },
  green: { background: 'var(--bg-green-100)', color: 'var(--text-green-800)' },
  grey: { background: 'var(--bg-muted)', color: 'var(--text-muted)' },
}

export function DueChipSpan({ chip, small }: { chip: DueChip; small?: boolean }) {
  return (
    <span data-testid="training-due-chip" data-tone={chip.tone} style={{ ...TONE[chip.tone], borderRadius: 999, padding: small ? '0 0.45rem' : '0.1rem 0.6rem', fontSize: small ? '0.72rem' : '0.78rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
      {chip.label}
    </span>
  )
}

function Label({ label, align }: { label: { head: string; sub: string }; align: 'left' | 'right' }) {
  const lines = label.sub.split(' · ')
  return (
    <div aria-hidden style={{ position: 'absolute', top: 0, [align]: 0, textAlign: align, maxWidth: '58%', fontSize: '0.7rem', lineHeight: 1.25, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
      <div style={{ fontWeight: 700, color: 'var(--text-strong)' }}>{label.head}</div>
      {lines.map((l) => (
        <div key={l} style={{ fontVariantNumeric: 'tabular-nums' }}>
          {l}
        </div>
      ))}
    </div>
  )
}

export function TrainingDueStrip({ strip, compact }: { strip: TrainingDueStripModel; compact?: boolean }) {
  if (strip.todayPct == null) return null
  const cut = strip.state === 'superseded'
  const tickColour = strip.overrun ? 'var(--text-red-700)' : 'var(--text-link)'
  return (
    <div
      role="img"
      aria-label={strip.words}
      title={strip.words}
      data-testid="training-due-strip"
      data-state={strip.state}
      data-today-pct={strip.todayPct}
      style={{ position: 'relative', height: TRACK_H + (compact ? 0 : LABELS_H), margin: compact ? '0.15rem 0' : '0.35rem 0 0', maxWidth: compact ? 220 : 420 }}
    >
      <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: TRACK_H }} aria-hidden>
        {/* The track, and the last dueSoonDays of it shaded. */}
        <div style={{ position: 'absolute', left: 4, right: 4, top: TRACK_H / 2 - 1, height: 2, background: cut ? 'var(--text-faint-300)' : 'var(--border)', borderRadius: 1 }} />
        {strip.windowPct < 100 ? (
          <div
            data-testid="training-due-window"
            style={{ position: 'absolute', left: `${strip.windowPct}%`, right: 4, top: TRACK_H / 2 - 4, height: 8, background: 'var(--bg-amber-200)', borderRadius: 2 }}
          />
        ) : null}
        {/* The pass. */}
        <div style={{ position: 'absolute', left: 0, top: TRACK_H / 2 - 4, width: 8, height: 8, borderRadius: 8, background: cut ? 'var(--text-faint)' : 'var(--text-green-700)' }} />
        {/* The end: the due day, or the retake cut. */}
        {cut ? (
          <div style={{ position: 'absolute', right: 0, top: 0, width: 3, height: TRACK_H, background: 'var(--text-red-700)', borderRadius: 1 }} />
        ) : (
          <div style={{ position: 'absolute', right: 0, top: TRACK_H / 2 - 4, width: 8, height: 8, transform: 'rotate(45deg)', background: 'var(--text-strong)', borderRadius: 1 }} />
        )}
        {/* Today. */}
        <div
          data-testid="training-due-today"
          style={{ position: 'absolute', left: `calc(${strip.todayPct}% - 1px)`, top: 0, width: 2, height: TRACK_H, background: tickColour, borderRadius: 1, boxShadow: '0 0 0 1px var(--surface)' }}
        />
      </div>
      {!compact && strip.startLabel && strip.endLabel ? (
        <div style={{ position: 'absolute', left: 0, right: 0, top: TRACK_H + 3, height: LABELS_H - 3 }}>
          <Label label={strip.startLabel} align="left" />
          <Label label={strip.endLabel} align="right" />
        </div>
      ) : null}
    </div>
  )
}
