import { useLayoutEffect, useRef, useState } from 'react'
import { fitStageChips, segmentLabel, type PipelineStageBar, type PipelineStageEdge, type PipelineStageState } from '../../lib/jobs/pipelineStageBar'

/**
 * The Pipeline row's stage strip (v2.3198, mock-up A′): numbered chips, one
 * bar whose segments are the stages (fill = work, bottom edge = the draw), and
 * a one-line caption. Pure presentation over `buildPipelineStageBar`; the only
 * state is the measured width that picks how many chip names fit.
 */

const WORK_FILL = '#2563eb'
const EDGE_COLOR: Record<PipelineStageEdge, string> = {
  paid: '#16a34a',
  billed: '#1d4ed8',
  ready: '#f59e0b',
  later: 'var(--border-strong)',
}
const EDGE_WORD: Record<PipelineStageEdge, string> = { paid: 'paid', billed: 'billed', ready: 'ready to bill', later: 'not yet billed' }

function useMeasuredWidth<T extends HTMLElement>(): [React.RefObject<T>, number | null] {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState<number | null>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const read = () => setWidth(el.getBoundingClientRect().width || null)
    read()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(read)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, width]
}

function chipColors(state: PipelineStageState): { border: string; color: string; bg: string; disc: string; discInk: string; weight: number } {
  switch (state) {
    case 'done':
      return { border: '#16a34a', color: 'var(--text-green-700)', bg: 'var(--surface)', disc: '#16a34a', discInk: 'white', weight: 500 }
    case 'live':
      return { border: '#2563eb', color: 'var(--text-strong)', bg: 'var(--bg-blue-tint)', disc: '#2563eb', discInk: 'white', weight: 600 }
    default:
      return { border: 'var(--border)', color: 'var(--text-muted)', bg: 'var(--surface)', disc: 'transparent', discInk: 'var(--text-muted)', weight: 500 }
  }
}

export function StagesStageBar({ bar, compact = false }: { bar: PipelineStageBar; compact?: boolean }) {
  const [stripRef, stripWidth] = useMeasuredWidth<HTMLDivElement>()
  const [barRef, barWidth] = useMeasuredWidth<HTMLDivElement>()
  const fit = fitStageChips(bar.segments, stripWidth)
  const gapPx = 3

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? '0.25rem' : '0.3rem', minWidth: 0 }}>
      <div ref={stripRef} role="list" aria-label="Stages" style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0, overflow: 'hidden', fontSize: '0.6875rem', lineHeight: 1.2 }}>
        {fit.chips.map((c, i) => {
          const k = chipColors(c.state)
          return (
            <span key={c.number} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
              {i > 0 ? (
                <span aria-hidden style={{ color: 'var(--text-faint)', fontSize: '0.625rem' }}>
                  →
                </span>
              ) : null}
              <span
                role="listitem"
                title={`${c.title}${c.pctText ? ` · ${c.pctText} done` : c.state === 'done' ? ' · done' : ''}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: c.text || c.pctText ? '1px 7px 1px 3px' : '1px 3px',
                  borderRadius: 999,
                  border: `1px solid ${k.border}`,
                  color: k.color,
                  background: k.bg,
                  fontWeight: k.weight,
                  whiteSpace: 'nowrap',
                }}
              >
                <span
                  aria-hidden
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 14,
                    height: 14,
                    borderRadius: '50%',
                    fontSize: 9,
                    fontWeight: 700,
                    background: k.disc,
                    color: k.discInk,
                    border: c.state === 'later' ? '1px solid var(--border-strong)' : `1px solid ${k.disc}`,
                    boxSizing: 'border-box',
                  }}
                >
                  {c.state === 'done' ? '✓' : c.number}
                </span>
                <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>{`Stage ${c.number} `}</span>
                {c.text ? <span>{c.text}</span> : null}
                {c.pctText ? <small style={{ fontWeight: 700, color: 'var(--text-blue-700)', fontSize: '0.625rem' }}>{c.pctText}</small> : null}
              </span>
            </span>
          )
        })}
      </div>

      <div
        ref={barRef}
        role="img"
        aria-label={bar.caption}
        title={bar.segments.map((s) => `${s.name} — ${s.stateLine}`).join('\n')}
        style={{ display: 'flex', gap: gapPx, height: 13, minWidth: 0 }}
      >
        {bar.segments.map((s) => {
          const segPx = barWidth != null ? Math.max(0, (barWidth - gapPx * (bar.segments.length - 1)) * (s.widthPct / 100)) : null
          const label = segmentLabel(s, segPx)
          const onFill = s.workPct >= 40
          return (
            <div
              key={s.fixtureId}
              title={`${s.name} — ${s.stateLine}${s.workSource === 'job' ? ' (fill from the job’s % done)' : ''} · draw ${EDGE_WORD[s.edge]}`}
              style={{
                flex: `${s.widthPct} 1 0px`,
                position: 'relative',
                minWidth: 14,
                height: 13,
                borderRadius: 4,
                background: 'var(--bg-subtle)',
                overflow: 'hidden',
                boxSizing: 'border-box',
              }}
            >
              {s.workPct > 0 ? (
                <div aria-hidden style={{ position: 'absolute', left: 0, top: 0, bottom: 3, width: `${s.workPct}%`, background: WORK_FILL, opacity: s.state === 'later' ? 0.55 : 1 }} />
              ) : null}
              <div aria-hidden style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 3, background: EDGE_COLOR[s.edge] }} />
              {label ? (
                <div
                  aria-hidden
                  style={{
                    position: 'absolute',
                    inset: '0 0 3px 0',
                    display: 'flex',
                    alignItems: 'center',
                    paddingLeft: 4,
                    fontSize: 9,
                    fontWeight: 700,
                    lineHeight: 1,
                    color: onFill ? 'white' : 'var(--text-strong)',
                    pointerEvents: 'none',
                  }}
                >
                  {label}
                </div>
              ) : null}
            </div>
          )
        })}
      </div>

      <div
        style={{
          fontSize: '0.6875rem',
          color: bar.captionTone === 'amber' ? 'var(--text-amber-700)' : bar.captionTone === 'green' ? 'var(--text-green-700)' : 'var(--text-muted)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          minWidth: 0,
        }}
        title={bar.caption}
      >
        {bar.caption}
      </div>
    </div>
  )
}

export default StagesStageBar
