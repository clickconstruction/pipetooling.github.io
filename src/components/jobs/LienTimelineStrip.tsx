import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { LienTimeline, LienTimelineStep } from '../../lib/jobs/lienTimeline'

/**
 * The lien timeline drawn (v2.3761): the job's Chapter 53 steps on one rail,
 * today marked, one *Next on the path* line under it. `layout: 'row'` is the
 * rail; `'list'` is the same steps stacked, for a phone or a narrow pane,
 * where seven columns would be seven slivers; `'auto'` (the default) picks by
 * the strip's own width, not the viewport's — the desk's pane column is
 * narrow on a tablet too. `'mini'` is the row without its names, for a list
 * of jobs (PR 2). Reads the kernel's output only.
 */

export type LienTimelineLayout = 'auto' | 'row' | 'list' | 'mini'

/** Below this many pixels the row becomes the list (about 75 px per step at seven steps). */
export const LIEN_TIMELINE_LIST_BELOW_PX = 520

type Tone = { ring: string; fill: string; ink: string; mark: string }

function toneFor(s: LienTimelineStep): Tone {
  switch (s.state) {
    case 'done':
      return { ring: 'var(--text-green-800)', fill: 'var(--text-green-800)', ink: '#fff', mark: '✓' }
    case 'due':
      return (s.daysLeft ?? 99) <= 7
        ? { ring: 'var(--text-red-600)', fill: 'var(--bg-red-tint)', ink: 'var(--text-red-600)', mark: '!' }
        : { ring: 'var(--text-amber-800)', fill: 'var(--bg-amber-tint)', ink: 'var(--text-amber-800)', mark: '!' }
    case 'missed':
      return { ring: 'var(--text-red-600)', fill: 'var(--text-red-600)', ink: '#fff', mark: '✗' }
    case 'blocked':
      return { ring: 'var(--border-strong)', fill: 'var(--bg-subtle)', ink: 'var(--text-muted)', mark: '–' }
    case 'undated':
      return { ring: 'var(--border-strong)', fill: 'var(--surface)', ink: 'var(--text-muted)', mark: '' }
    default:
      return { ring: 'var(--border-strong)', fill: 'var(--surface)', ink: 'var(--text-muted)', mark: '' }
  }
}

function wordsColor(s: LienTimelineStep): string {
  if (s.state === 'missed') return 'var(--text-red-600)'
  if (s.state === 'due') return (s.daysLeft ?? 99) <= 7 ? 'var(--text-red-600)' : 'var(--text-amber-800)'
  if (s.state === 'done' && s.kind !== 'last_work') return 'var(--text-green-800)'
  return 'var(--text-muted)'
}

/** The mini row has no room for a year: `Nov 16, 2027` → `Nov ’27`; `served Jul 16` → `Jul 16`. */
function miniDateWords(words: string): string {
  const m = /^(?:filed |served |sent )?([A-Z][a-z]{2}) (\d{1,2})(?:, (\d{2})(\d{2}))?$/.exec(words)
  if (!m) return words
  return m[3] ? `${m[1]} ’${m[4]}` : `${m[1]} ${m[2]}`
}

function nextColor(tone: LienTimeline['next']['tone']): string {
  return tone === 'red' ? 'var(--text-red-600)' : tone === 'amber' ? 'var(--text-amber-800)' : tone === 'green' ? 'var(--text-green-800)' : 'var(--text-strong)'
}

function Node({ s, size }: { s: LienTimelineStep; size: number }) {
  const t = toneFor(s)
  return (
    <span
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        border: `2px ${s.state === 'undated' ? 'dashed' : 'solid'} ${t.ring}`,
        background: t.fill,
        color: t.ink,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size <= 12 ? 8 : 9,
        fontWeight: 800,
        lineHeight: 1,
        flex: 'none',
        position: 'relative',
        zIndex: 1,
      }}
    >
      {t.mark}
    </span>
  )
}

export type LienTimelineStripProps = {
  timeline: LienTimeline
  layout?: LienTimelineLayout
  /** A dashed step's door — `contract_end` opens Edit Job on the contract row; the desk passes it only once the job carries that field (v2.3753). */
  onDoor?: (door: NonNullable<LienTimelineStep['door']>) => void
  /** Whether to draw the Next line (the row and list do; a list of jobs prints it in its own column). */
  withNext?: boolean
  style?: CSSProperties
}

export default function LienTimelineStrip({ timeline, layout: layoutProp = 'auto', onDoor, withNext = true, style }: LienTimelineStripProps) {
  const { steps, next, todayIndex, kindUnknown } = timeline
  const n = Math.max(1, steps.length)
  const hostRef = useRef<HTMLDivElement | null>(null)
  const [narrow, setNarrow] = useState(false)
  useEffect(() => {
    if (layoutProp !== 'auto') return
    const el = hostRef.current
    if (!el) return
    const read = () => setNarrow(el.getBoundingClientRect().width < LIEN_TIMELINE_LIST_BELOW_PX)
    read()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(read)
    ro.observe(el)
    return () => ro.disconnect()
  }, [layoutProp])
  const layout: Exclude<LienTimelineLayout, 'auto'> = layoutProp === 'auto' ? (narrow ? 'list' : 'row') : layoutProp
  const nextLine = withNext ? (
    <div data-lien-timeline-next style={{ display: 'flex', flexWrap: 'wrap', gap: '0.2rem 0.5rem', alignItems: 'baseline', fontSize: '0.8125rem', paddingTop: layout === 'list' ? '0.4rem' : '0.35rem', borderTop: layout === 'mini' ? 'none' : '1px solid var(--border)', marginTop: layout === 'mini' ? 0 : '0.3rem' }}>
      <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Next on the path</span>
      <strong style={{ color: nextColor(next.tone) }}>{next.words}</strong>
      {next.aside ? <span style={{ color: 'var(--text-muted)' }}>{next.aside}</span> : null}
      {kindUnknown ? <span style={{ color: 'var(--text-amber-800)' }}>Commercial dates shown — a residential property is a month earlier.</span> : null}
    </div>
  ) : null

  if (layout === 'list') {
    return (
      <div ref={hostRef} data-lien-timeline data-layout="list" style={{ display: 'grid', gap: 0, ...style }}>
        <div style={{ position: 'relative', display: 'grid', gap: 0 }}>
          <span aria-hidden style={{ position: 'absolute', left: 7, top: 8, bottom: 8, width: 2, background: 'var(--border-strong)' }} />
          {steps.map((s, i) => (
            <div key={s.key} data-lien-timeline-step={s.key} style={{ display: 'grid', gridTemplateColumns: '16px minmax(0, 1fr)', gap: '0 0.6rem', alignItems: 'start', padding: '0.28rem 0', borderTop: i === todayIndex && i > 0 ? '2px dashed var(--text-link)' : 'none', position: 'relative' }}>
              {i === todayIndex && i > 0 ? <span style={{ position: 'absolute', right: 0, top: -9, fontSize: '0.62rem', fontWeight: 700, color: 'var(--text-link)', background: 'var(--surface)', padding: '0 4px' }}>today</span> : null}
              <Node s={s} size={16} />
              <div style={{ minWidth: 0, fontSize: '0.8125rem', lineHeight: 1.3 }}>
                <span style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{s.label}</span>
                <span style={{ margin: '0 0.4rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: s.state === 'undated' || s.state === 'blocked' ? 'var(--text-muted)' : 'var(--text-strong)' }}>{s.dateWords}</span>
                <span style={{ color: wordsColor(s) }}>{s.words}</span>
                {s.door && onDoor ? (
                  <button type="button" onClick={() => onDoor(s.door!)} style={{ marginLeft: '0.4rem', border: 'none', background: 'none', color: 'var(--text-link)', font: 'inherit', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', padding: 0 }}>
                    set the date ›
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
        {nextLine}
      </div>
    )
  }

  const mini = layout === 'mini'
  const nodeSize = mini ? 12 : 14
  const railTop = mini ? 5 : 6
  return (
    <div ref={hostRef} data-lien-timeline data-layout={layout} style={{ display: 'grid', gap: 0, minWidth: 0, ...style }}>
      <div style={{ position: 'relative', padding: mini ? '0 4px' : '0 6px' }}>
        <span aria-hidden style={{ position: 'absolute', left: `calc(${100 / n / 2}% + 2px)`, right: `calc(${100 / n / 2}% + 2px)`, top: railTop, height: 2, background: 'var(--border-strong)' }} />
        {todayIndex > 0 && todayIndex < n ? (
          <span aria-hidden title="today" style={{ position: 'absolute', left: `${(todayIndex / n) * 100}%`, top: mini ? -3 : -4, height: mini ? 18 : 22, width: 0, borderLeft: '2px dashed var(--text-link)' }}>
            {mini ? null : <span style={{ position: 'absolute', top: -2, left: 5, fontSize: '0.6rem', fontWeight: 700, color: 'var(--text-link)', whiteSpace: 'nowrap' }}>today</span>}
          </span>
        ) : null}
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`, position: 'relative' }}>
          {steps.map((s) => (
            <div key={s.key} data-lien-timeline-step={s.key} title={`${s.label}${s.dateWords ? ` · ${s.dateWords}` : ''}${s.words ? ` · ${s.words}` : ''}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '0 2px', minWidth: 0, fontSize: mini ? '0.68rem' : '0.72rem', lineHeight: 1.25 }}>
              <Node s={s} size={nodeSize} />
              {mini ? null : <span style={{ marginTop: 3, fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.03em', textTransform: 'uppercase', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{s.label}</span>}
              <span style={{ marginTop: mini ? 2 : 1, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: s.state === 'undated' || s.state === 'blocked' ? 'var(--text-muted)' : 'var(--text-strong)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{mini ? miniDateWords(s.dateWords) : s.dateWords}</span>
              {mini ? null : (
                <span style={{ color: wordsColor(s), maxWidth: '100%' }}>
                  {s.words}
                  {s.door && onDoor ? (
                    <>
                      {' '}
                      <button type="button" onClick={() => onDoor(s.door!)} style={{ border: 'none', background: 'none', color: 'var(--text-link)', font: 'inherit', fontSize: 'inherit', fontWeight: 600, cursor: 'pointer', padding: 0 }}>
                        set the date ›
                      </button>
                    </>
                  ) : null}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
      {nextLine}
    </div>
  )
}
