import { useEffect, useRef, useState } from 'react'
import type { ProgressGroup, StageProgress } from '../../lib/gcMode/gcModel'

/**
 * GC mode — design spike: the progress ring at the head of a Project Board row, drawn the way a
 * watch draws an activity ring. A dim track of the stage's color, a thick round-capped arc from
 * twelve o'clock, the count in the middle. It fills from empty when it first shows and slides
 * when the number changes. A closed ring gets a check under the count.
 *
 * Hover it (or tap it on a phone, or tab to it) and a card opens under it: what the ring counts,
 * by type, with what is left in each type spelled out and what is done folded into one line.
 */

const LEFT = '#f59e0b'
const DONE = '#16a34a'
/** Past this many open items in one type, the card says "and N more". */
const LEFT_SHOWN = 4

export function GcProgressRing({
  progress,
  color,
  stageLabel,
  size = 56,
  stroke = 7,
}: {
  progress: StageProgress
  color: string
  stageLabel: string
  size?: number
  stroke?: number
}) {
  const target = Math.min(Math.max(progress.share, 0), 1)
  // Start empty, then fill on the next frame, so the ring sweeps in the way a watch's does.
  const [shown, setShown] = useState(0)
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(target))
    // A hidden tab never runs animation frames: the timer fills the ring anyway.
    const fallback = window.setTimeout(() => setShown(target), 150)
    return () => {
      cancelAnimationFrame(id)
      window.clearTimeout(fallback)
    }
  }, [target])

  const [hovered, setHovered] = useState(false)
  // Focus opens the card only when it came from the keyboard: a click focuses the ring too, and
  // that focus must not hold the card open after a second click closes it.
  const [keyFocus, setKeyFocus] = useState(false)
  const [pinned, setPinned] = useState(false)
  const wrap = useRef<HTMLSpanElement | null>(null)
  // A tap pins the card open (a phone has no hover); a press anywhere else lets it go.
  useEffect(() => {
    if (!pinned) return
    const away = (e: PointerEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setPinned(false)
    }
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPinned(false)
        setKeyFocus(false)
      }
    }
    document.addEventListener('pointerdown', away)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('pointerdown', away)
      document.removeEventListener('keydown', esc)
    }
  }, [pinned])
  const open = hovered || keyFocus || pinned

  const r = (size - stroke) / 2
  const around = 2 * Math.PI * r
  const closed = target >= 1
  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  return (
    <span
      ref={wrap}
      style={{ position: 'relative', display: 'inline-block', width: size, height: size }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      // The row behind opens the project on a click; the ring and its card keep their clicks.
      onClick={(e) => e.stopPropagation()}
    >
      <span
        role="button"
        tabIndex={0}
        aria-label={`${progress.headline} Show what is done and what is left.`}
        aria-expanded={open}
        onClick={() => {
          setPinned((p) => !p)
          // A second click closes it even while the pointer is still over the ring.
          if (pinned) setHovered(false)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setKeyFocus(false)
            setHovered(false)
            setPinned(false)
          } else if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setPinned((p) => !p)
          }
        }}
        onFocus={(e) => setKeyFocus(e.currentTarget.matches(':focus-visible'))}
        onBlur={() => setKeyFocus(false)}
        style={{ position: 'relative', display: 'grid', placeItems: 'center', width: size, height: size, cursor: 'pointer', borderRadius: '50%' }}
      >
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }} aria-hidden>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeOpacity={0.18} strokeWidth={stroke} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={around}
            // A sliver at zero would draw a round dot; hide the arc until there is something to show.
            strokeDashoffset={around * (1 - shown)}
            strokeOpacity={shown > 0 ? 1 : 0}
            style={{ transition: reduced ? undefined : 'stroke-dashoffset 0.9s cubic-bezier(0.22, 1, 0.36, 1)' }}
          />
        </svg>
        <span style={{ position: 'relative', display: 'grid', justifyItems: 'center', lineHeight: 1.05, fontVariantNumeric: 'tabular-nums' }}>
          <span style={{ fontSize: progress.center.length > 4 ? '0.72rem' : '0.82rem', fontWeight: 700, color: 'var(--text-base)' }}>{progress.center}</span>
          {closed && <span style={{ fontSize: '0.7rem', fontWeight: 700, color }}>✓</span>}
        </span>
      </span>
      {open && <ProgressCard progress={progress} color={color} stageLabel={stageLabel} />}
    </span>
  )
}

/**
 * The card under the ring. It starts flush with the ring's bottom edge (the gap is padding inside
 * the card), so the pointer can travel from the ring into the card without the hover dropping.
 */
function ProgressCard({ progress, color, stageLabel }: { progress: StageProgress; color: string; stageLabel: string }) {
  return (
    <span
      role="dialog"
      aria-label="What is done and what is left"
      style={{ position: 'absolute', top: '100%', left: -6, zIndex: 40, paddingTop: 6, cursor: 'default' }}
    >
      <span
        style={{
          display: 'grid',
          gap: '0.65rem',
          width: '23rem',
          maxWidth: 'calc(100vw - 2.5rem)',
          maxHeight: '70vh',
          overflowY: 'auto',
          padding: '0.75rem 0.85rem',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderTop: `3px solid ${color}`,
          borderRadius: 10,
          boxShadow: '0 12px 32px rgba(15, 23, 42, 0.2)',
          color: 'var(--text-base)',
          fontSize: '0.82rem',
          lineHeight: 1.35,
          textAlign: 'left',
        }}
      >
        <span style={{ display: 'grid', gap: '0.1rem' }}>
          <span style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color }}>{stageLabel}</span>
          <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{progress.headline}</span>
        </span>
        {progress.groups.map((g) => (
          <GroupBlock key={g.key} group={g} color={color} />
        ))}
        {progress.also.length > 0 && (
          <span style={{ display: 'grid', gap: '0.2rem', borderTop: '1px solid var(--border)', paddingTop: '0.55rem' }}>
            <span style={{ fontWeight: 700, fontSize: '0.75rem', color: 'var(--text-muted)' }}>Also</span>
            {progress.also.map((line) => (
              <span key={line} style={{ color: 'var(--text-muted)' }}>{line}</span>
            ))}
          </span>
        )}
      </span>
    </span>
  )
}

function GroupBlock({ group, color }: { group: ProgressGroup; color: string }) {
  const done = group.items.filter((i) => i.done)
  const left = group.items.filter((i) => !i.done)
  const share = group.items.length === 0 ? 0 : done.length / group.items.length
  const complete = left.length === 0
  return (
    <span style={{ display: 'grid', gap: '0.25rem' }}>
      <span style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
        <span style={{ fontWeight: 700, flex: '1 1 auto' }}>
          {complete ? <span style={{ color: DONE }}>✓ </span> : null}
          {group.label}
        </span>
        <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: complete ? DONE : 'var(--text-muted)' }}>
          {done.length} of {group.items.length}
        </span>
      </span>
      <span style={{ display: 'block', height: 4, borderRadius: 999, background: 'var(--bg-muted)', overflow: 'hidden' }}>
        <span style={{ display: 'block', height: '100%', width: `${share * 100}%`, background: complete ? DONE : color, borderRadius: 999 }} />
      </span>
      <span style={{ color: 'var(--text-muted)', fontSize: '0.76rem' }}>{group.why}</span>
      {left.length > 0 && (
        <span style={{ display: 'grid', gap: '0.15rem', marginTop: '0.1rem' }}>
          {left.slice(0, LEFT_SHOWN).map((i) => (
            <span key={`${i.label}:${i.detail}`} style={{ display: 'grid', gridTemplateColumns: '0.8rem minmax(0, 1fr)', alignItems: 'baseline' }}>
              <span aria-hidden style={{ width: 7, height: 7, borderRadius: '50%', background: LEFT, display: 'inline-block' }} />
              <span>
                <span style={{ fontWeight: 600 }}>{i.label}</span>
                <span style={{ color: 'var(--text-muted)' }}> · {i.detail}</span>
              </span>
            </span>
          ))}
          {left.length > LEFT_SHOWN && <span style={{ color: 'var(--text-muted)', paddingLeft: '0.8rem' }}>and {left.length - LEFT_SHOWN} more</span>}
        </span>
      )}
      {done.length > 0 && !complete && (
        <span style={{ color: 'var(--text-muted)', fontSize: '0.76rem', paddingLeft: '0.8rem' }}>
          <span style={{ color: DONE, fontWeight: 600 }}>Done:</span> {group.doneWords ? group.doneWords(done.length) : done.map((i) => i.label).join(', ')}
        </span>
      )}
    </span>
  )
}
