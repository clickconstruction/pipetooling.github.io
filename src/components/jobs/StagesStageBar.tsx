import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { fitStageChips, type PipelineStageState } from '../../lib/jobs/pipelineStageBar'
import type { ProgressPaymentSegment, ProgressPaymentTone, ProgressPaymentView } from '../../lib/jobs/progressPaymentCell'

/**
 * The Pipeline row's bar (v2.3198 chips + bar; v2.3419 the two channels on
 * every row): numbered chips when the job has stages, one bar whose segments
 * are the stages or the line items — the top channel is WORK (fill), the 3 px
 * bottom channel is MONEY poured in order (green paid · blue billed · amber
 * done-not-billed) — and one line of words. Pure presentation over
 * `buildProgressPaymentView`; the only state is the measured width that picks
 * how many chip names fit and which segments can carry their label.
 */

const WORK_FILL = '#2563eb'
const PAID = '#16a34a'
const BILLED = '#1d4ed8'
const UNBILLED = '#f59e0b'

const TONE_COLOR: Record<ProgressPaymentTone, string> = {
  plain: 'var(--text-muted)',
  muted: 'var(--text-faint)',
  amber: 'var(--text-amber-700)',
  green: 'var(--text-green-700)',
  red: 'var(--text-red-700)',
}

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

/** ~11px system font: an average glyph is a shade over half an em. */
const textPx = (text: string) => Math.ceil(text.length * 6.2) + 8

/** The label a segment can carry at this width: the full label, a shorter one, or none. */
function segmentLabelFor(seg: ProgressPaymentSegment, segPx: number | null): string | null {
  if (!seg.label) return null
  if (segPx == null) return seg.label
  if (textPx(seg.label) <= segPx) return seg.label
  // Try the tail of a "Name · 80%" / "Name 80%" label, then the check alone.
  const tail = seg.label.match(/(\d{1,3}%|✓)$/)?.[1] ?? null
  if (tail && textPx(tail) <= segPx) return tail
  if (seg.state === 'done' && segPx >= 18) return '✓'
  return null
}

/** A chip: a button when the bar opens Bill, a plain span otherwise. The list item stays the wrapper. */
function ChipShell({ onClick, title, style, children }: { onClick?: () => void; title: string; style: CSSProperties; children: ReactNode }) {
  if (!onClick) {
    return (
      <span role="listitem" title={title} style={style}>
        {children}
      </span>
    )
  }
  return (
    <span role="listitem">
      <button
        type="button"
        onClick={onClick}
        title={title}
        data-stage-chip
        style={{ ...style, fontFamily: 'inherit', fontSize: 'inherit', lineHeight: 'inherit', margin: 0, cursor: 'pointer' }}
      >
        {children}
      </button>
    </span>
  )
}

/** The bar: a full-width unstyled button around it when it opens Bill. */
function BarShell({ onClick, children }: { onClick?: () => void; children: ReactNode }) {
  if (!onClick) return <>{children}</>
  return (
    <button
      type="button"
      onClick={onClick}
      title={STAGE_CLICK_TITLE}
      data-stage-bar
      style={{ display: 'block', width: '100%', padding: 0, margin: 0, border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', minWidth: 0 }}
    >
      {children}
    </button>
  )
}

export const STAGE_CLICK_TITLE = 'Open Bill → ① Line Items'

/**
 * `onStageClick` (v2.3461): every chip and the bar itself open the job's Bill
 * window at ① Line Items — the one place stages are set — so the *Set stages*
 * link under the bar (v2.3421) is gone.
 */
export function StagesStageBar({ view, compact = false, onStageClick }: { view: ProgressPaymentView; compact?: boolean; onStageClick?: () => void }) {
  const [stripRef, stripWidth] = useMeasuredWidth<HTMLDivElement>()
  const [barRef, barWidth] = useMeasuredWidth<HTMLDivElement>()
  const gapPx = 3
  const chips = view.mode === 'stages' && view.stageBar ? fitStageChips(view.stageBar.segments, stripWidth).chips : []
  const segCount = view.segments.length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? '0.25rem' : '0.3rem', minWidth: 0 }} data-progress-mode={view.mode}>
      {chips.length > 0 ? (
        <div ref={stripRef} role="list" aria-label="Stages" style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0, overflow: 'hidden', fontSize: '0.6875rem', lineHeight: 1.2 }}>
          {chips.map((c, i) => {
            const k = chipColors(c.state)
            const suffix = c.state === 'live' && c.text ? view.liveChipSuffix : null
            return (
              <span key={c.number} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
                {i > 0 ? (
                  <span aria-hidden style={{ color: 'var(--text-faint)', fontSize: '0.625rem' }}>
                    →
                  </span>
                ) : null}
                <ChipShell
                  onClick={onStageClick}
                  title={`${c.title}${c.pctText ? ` · ${c.pctText} done` : c.state === 'done' ? ' · done' : c.state === 'live' ? ' · the crew is here' : ''}${onStageClick ? ` · ${STAGE_CLICK_TITLE}` : ''}`}
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
                  {suffix && !c.pctText ? <small style={{ fontWeight: 500, color: 'var(--text-muted)', fontSize: '0.625rem' }}>{`· ${suffix}`}</small> : null}
                </ChipShell>
              </span>
            )
          })}
        </div>
      ) : null}

      {segCount > 0 ? (
        <BarShell onClick={onStageClick}>
        <div
          ref={barRef}
          role="img"
          aria-label={view.words.full}
          title={`${view.segments.map((s) => s.title).join('\n')}${onStageClick ? `\n${STAGE_CLICK_TITLE}` : ''}`}
          style={{ display: 'flex', gap: gapPx, height: 14, minWidth: 0 }}
        >
          {view.segments.map((s) => {
            const segPx = barWidth != null ? Math.max(0, (barWidth - gapPx * (segCount - 1)) * (s.widthPct / 100)) : null
            const label = segmentLabelFor(s, segPx)
            const onFill = s.fillPct >= 40 && (label === '✓' || /^\d{1,3}%$/.test(label ?? '') || (segPx != null && (s.fillPct / 100) * segPx >= textPx(label ?? '')))
            return (
              <div
                key={s.key}
                title={s.title}
                data-segment-state={s.state}
                style={{
                  flex: `${s.widthPct} 1 0px`,
                  position: 'relative',
                  minWidth: 14,
                  height: 14,
                  borderRadius: 4,
                  background: 'var(--bg-subtle)',
                  overflow: 'hidden',
                  boxSizing: 'border-box',
                  outline: s.state === 'live' ? `1px solid ${WORK_FILL}` : undefined,
                  outlineOffset: -1,
                }}
              >
                {s.fillPct > 0 ? (
                  <div aria-hidden style={{ position: 'absolute', left: 0, top: 0, bottom: 3, width: `${s.fillPct}%`, background: WORK_FILL, opacity: s.state === 'later' ? 0.55 : 1 }} />
                ) : null}
                {/* The money channel: paid · billed · done-not-billed, poured left to right. */}
                <div aria-hidden style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 3, display: 'flex', background: 'var(--border)' }}>
                  {s.money.paidFrac > 0 ? <span style={{ width: `${s.money.paidFrac * 100}%`, background: PAID }} /> : null}
                  {s.money.billedFrac > 0 ? <span style={{ width: `${s.money.billedFrac * 100}%`, background: BILLED }} /> : null}
                  {s.money.unbilledFrac > 0 ? <span style={{ width: `${s.money.unbilledFrac * 100}%`, background: UNBILLED }} /> : null}
                </div>
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
                      whiteSpace: 'nowrap',
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
        </BarShell>
      ) : null}

      <div
        data-progress-words
        style={{
          fontSize: '0.6875rem',
          color: TONE_COLOR[view.words.tone],
          fontWeight: view.words.tone === 'red' ? 600 : 400,
          // v2.3446: two lines, then an ellipsis — a 176 px desktop cell was
          // cutting the sentence at "Top Out · Tristen on site Sat · 4…".
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          whiteSpace: 'normal',
          overflow: 'hidden',
          lineHeight: 1.25,
          minWidth: 0,
          maxWidth: '100%',
        }}
        title={view.words.full}
      >
        {view.words.text}
      </div>
    </div>
  )
}

export default StagesStageBar
