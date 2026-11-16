/**
 * The Plans look's second view, By date: every set of drawings on the site against time, with the bids, the
 * days crews were on site and the lines kept on History on the same axis, today's line across them all, and
 * every mark again as a dated line under the chart. The lanes, the shapes, the names that fit and the print
 * page are `lib/plans/plansByDate.ts`; this file draws those shapes in the theme's colours, shows a mark's
 * line on a hover, a focus or a press, and opens the print. It carries no money, so the overview door draws
 * it too. The view is a look: nothing here writes.
 */
import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { openHtmlPrintWindow } from '../../lib/jobsDocuments/printWindow'
import { PBD_PAINT, PLANS_BY_DATE_CLUSTER_WORDS, PLANS_BY_DATE_NARROW, dayWords, layoutPlansByDate, plansByDateGlyph, plansByDatePrintHtml, type PbdClass, type PbdGlyph, type PbdInk, type PbdPrim, type PlansByDateModel } from '../../lib/plans/plansByDate'
import { EmptyState } from '../EmptyState'
import { LinkButton } from './developmentPageBits'

/** The screen's colours for the kernel's inks: theme tokens, so the chart follows light and dark. */
const SCREEN_INK: Record<PbdInk, string> = {
  set: 'var(--house-series-2)',
  bid: 'var(--bid-mark)',
  crew: 'var(--man-hours-field)',
  strong: 'var(--text-strong)',
  text: 'var(--text-700)',
  muted: 'var(--text-muted)',
  surface: 'var(--surface)',
  border: 'var(--border)',
  borderStrong: 'var(--border-strong)',
}

function paintStyle(cls: PbdClass): CSSProperties {
  const p = PBD_PAINT[cls]
  return {
    fill: p.fill ? (p.fill === 'none' || p.fill === 'transparent' ? p.fill : SCREEN_INK[p.fill]) : undefined,
    stroke: p.stroke ? SCREEN_INK[p.stroke] : undefined,
    strokeWidth: p.strokeWidth,
    strokeDasharray: p.dash,
    strokeLinecap: p.round ? 'round' : undefined,
    opacity: p.opacity,
    fontSize: p.fontSize,
    fontWeight: p.fontWeight,
  }
}

function Prim({ p }: { p: PbdPrim }): ReactNode {
  const style = paintStyle(p.cls)
  if (p.t === 'line') return <line x1={p.x1} y1={p.y1} x2={p.x2} y2={p.y2} style={style} />
  if (p.t === 'circle') return <circle cx={p.cx} cy={p.cy} r={p.r} style={style} />
  if (p.t === 'path') return <path d={p.d} style={style} />
  if (p.t === 'rect') return <rect x={p.x} y={p.y} width={p.w} height={p.h} rx={p.rx} transform={p.turn ? `rotate(45 ${p.x + p.w / 2} ${p.y + p.h / 2})` : undefined} style={style} />
  return (
    <text x={p.x} y={p.y} textAnchor={p.anchor} style={style}>
      {p.text}
      {p.tail ? (
        <tspan dx={6} style={{ ...paintStyle('subWord'), fontWeight: 400 }}>
          {p.tail}
        </tspan>
      ) : null}
    </text>
  )
}

/** A mark's own shape at the size of a word, for the key and the list. */
function Glyph({ glyph }: { glyph: PbdGlyph }) {
  const g = plansByDateGlyph(glyph)
  return (
    <svg width={g.width} height={g.height} viewBox={`${-g.width / 2} ${-g.height / 2} ${g.width} ${g.height}`} aria-hidden style={{ flex: 'none' }}>
      {g.prims.map((p, i) => (
        <Prim key={i} p={p} />
      ))}
    </svg>
  )
}

/** Past this many lines the list opens on the newest and folds the older ones behind a press. */
export const PLANS_BY_DATE_LIST_FOLD = 40

export type PlansByDatePrint = { siteName: string; customerName: string | null; printedBy: string | null }

export function DevelopmentPlansByDate({ model, phone, notes = [], print }: { model: PlansByDateModel | null; phone: boolean; /** Quiet lines under the chart: what is not on it, and why. */ notes?: ReadonlyArray<string>; print: PlansByDatePrint }) {
  const [tipKey, setTipKey] = useState<string | null>(null)
  const [allRows, setAllRows] = useState(false)
  const [printNote, setPrintNote] = useState<string | null>(null)
  // The chart is laid out at the width it really has, so its words keep their size on a tablet and a wide screen alike.
  const chartRef = useRef<HTMLDivElement>(null)
  const [chartWidth, setChartWidth] = useState<number | null>(null)
  const drawn = !!model && !model.empty
  useLayoutEffect(() => {
    const el = chartRef.current
    if (!el || !drawn) return
    const read = () => {
      const w = Math.round(el.getBoundingClientRect().width)
      if (w > 0) setChartWidth((prev) => (prev === w ? prev : w))
    }
    read()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(read)
    observer.observe(el)
    return () => observer.disconnect()
  }, [drawn])
  const narrow = phone || (chartWidth != null && chartWidth < PLANS_BY_DATE_NARROW)
  const layout = useMemo(() => (model && !model.empty ? layoutPlansByDate(model, narrow ? 'phone' : 'desktop', chartWidth ?? undefined) : null), [model, narrow, chartWidth])

  if (!model) {
    return (
      <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: 0 }} data-testid="pbd-reading">
        Reading the site’s sets…
      </p>
    )
  }
  if (model.empty || !layout) {
    return <EmptyState main="Nothing on this site has a date yet." tail="A set lands here on the date on its sheets, and a bid on the day it was sent." compact />
  }

  const tip = tipKey ? (layout.marks.find((m) => m.key === tipKey) ?? null) : null
  const tipLeft = tip ? (tip.cx / layout.width) * 100 : 0
  const listRows = model.rows.length - 1
  const folded = !allRows && model.rows.length > PLANS_BY_DATE_LIST_FOLD
  const rows = folded ? model.rows.slice(model.rows.length - PLANS_BY_DATE_LIST_FOLD) : model.rows
  const older = model.rows.length - rows.length

  const openPrint = () => {
    const html = plansByDatePrintHtml({
      siteName: print.siteName,
      customerName: print.customerName,
      model,
      notes,
      printedAt: new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }),
      printedBy: print.printedBy,
    })
    setPrintNote(openHtmlPrintWindow(html) ? null : 'The print window was blocked. Allow pop-ups for this site and press again.')
  }

  return (
    <div data-testid="plans-by-date" style={{ minWidth: 0 }}>
      <div data-testid="pbd-figures" style={{ display: 'grid', gridTemplateColumns: `repeat(${narrow ? 2 : 4}, minmax(0, 1fr))`, gap: 8, marginBottom: 10 }}>
        {model.figures.map((f) => (
          <div key={f.key} data-testid={`pbd-figure-${f.key}`} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', background: 'var(--bg-subtle)', minWidth: 0 }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{f.label}</div>
            <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-strong)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.25 }}>{f.value}</div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', overflowWrap: 'anywhere' }}>{f.sub}</div>
          </div>
        ))}
      </div>

      <p aria-label="What the marks mean" data-testid="pbd-legend" style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', fontSize: '0.74rem', color: 'var(--text-muted)', margin: '0 0 4px' }}>
        {model.legend.map((l) => (
          <span key={l.glyph} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' }}>
            <Glyph glyph={l.glyph} />
            {l.words}
          </span>
        ))}
        {layout.clusters > 0 ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' }} data-testid="pbd-legend-cluster">
            <Glyph glyph="cluster" />
            {PLANS_BY_DATE_CLUSTER_WORDS}
          </span>
        ) : null}
      </p>

      {/* A press on the chart's ground puts the hover line away, so a phone can close what a tap opened. */}
      <div ref={chartRef} style={{ position: 'relative', minWidth: 0 }} onClick={() => setTipKey(null)} data-testid="pbd-chart">
        <svg viewBox={`0 0 ${layout.width} ${layout.height}`} role="group" aria-label={layout.summary} style={{ display: 'block', width: '100%', height: 'auto', overflow: 'visible', fontFamily: 'inherit' }}>
          {layout.back.map((p, i) => (
            <Prim key={`b${i}`} p={p} />
          ))}
          {layout.marks.map((m) => (
            <g
              key={m.key}
              role="img"
              aria-label={m.tip}
              tabIndex={0}
              data-testid={`pbd-mark-${m.key}`}
              style={{ outline: 'none' }}
              onMouseEnter={() => setTipKey(m.key)}
              onMouseLeave={() => setTipKey((k) => (k === m.key ? null : k))}
              onFocus={() => setTipKey(m.key)}
              onBlur={() => setTipKey((k) => (k === m.key ? null : k))}
              onClick={(e) => {
                e.stopPropagation()
                setTipKey(m.key)
              }}
            >
              {m.prims.map((p, i) => (
                <Prim key={i} p={p} />
              ))}
              <Prim p={m.hit} />
            </g>
          ))}
          {layout.labels.map((p, i) => (
            <Prim key={`l${i}`} p={p} />
          ))}
        </svg>
        {tip ? (
          <div
            role="status"
            data-testid="pbd-tip"
            style={{
              position: 'absolute',
              left: `${tipLeft}%`,
              top: `${(tip.top / layout.height) * 100}%`,
              transform: `translate(${tipLeft < 22 ? '0' : tipLeft > 78 ? '-100%' : '-50%'}, calc(-100% - 6px))`,
              maxWidth: narrow ? 230 : 300,
              width: 'max-content',
              background: 'var(--text-strong)',
              color: 'var(--surface)',
              borderRadius: 6,
              padding: '5px 8px',
              fontSize: '0.76rem',
              lineHeight: 1.35,
              pointerEvents: 'none',
              zIndex: 2,
            }}
          >
            {tip.tip}
          </div>
        ) : null}
      </div>

      <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', margin: '6px 0 0' }} data-testid="pbd-note">
        {narrow ? 'Press a mark for its line. The chart names the set each part builds from, and the list has the rest.' : 'Rest the pointer on a mark for its line. A name that would not fit stays in the hover and in the list.'}
        {notes.map((n) => ` ${n}`).join('')}
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'baseline', gap: '4px 10px', margin: '12px 0 4px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
        <span>
          <strong style={{ color: 'var(--text-strong)' }}>Every dated line on the chart</strong> · {listRows} {listRows === 1 ? 'line' : 'lines'} · oldest first
        </span>
        <span style={{ display: 'inline-flex', gap: 8, alignItems: 'baseline', fontSize: '0.78rem' }}>
          {printNote ? <span data-testid="pbd-print-note">{printNote}</span> : null}
          <LinkButton onClick={openPrint} title="Opens the chart and its list on one landscape page; the print window saves it as a PDF too">
            Print or save as PDF
          </LinkButton>
        </span>
      </div>
      <div data-testid="pbd-list" style={{ borderTop: '1px solid var(--border)', fontSize: '0.8rem' }}>
        {folded ? (
          <div style={{ padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
            <LinkButton onClick={() => setAllRows(true)} title="The list opens on the newest lines">
              Show the {older} older {older === 1 ? 'line' : 'lines'}
            </LinkButton>
          </div>
        ) : null}
        {rows.map((r) => (
          <div
            key={r.key}
            data-testid={`pbd-row-${r.key}`}
            style={{
              display: 'grid',
              gridTemplateColumns: narrow ? '92px minmax(0, 1fr)' : '100px 170px minmax(0, 1fr)',
              columnGap: 10,
              padding: r.bid ? '4px 6px' : '4px 0',
              margin: r.bid ? '0 -6px' : undefined,
              borderRadius: r.bid ? 4 : undefined,
              background: r.bid ? 'var(--bid-mark-wash)' : undefined,
              borderBottom: '1px solid var(--border)',
              alignItems: 'baseline',
            }}
          >
            <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--text-strong)', whiteSpace: 'nowrap', fontWeight: r.today ? 700 : undefined }}>{dayWords(r.ymd)}</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-700)', minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              <Glyph glyph={r.glyph} />
              {r.lane}
            </span>
            <span style={{ color: r.today ? 'var(--text-strong)' : 'var(--text-700)', fontWeight: r.today ? 700 : undefined, overflowWrap: 'anywhere', minWidth: 0, gridColumn: narrow ? '1 / -1' : undefined }}>
              {r.text}
              {r.soft ? <span style={{ color: 'var(--text-muted)' }}> · {r.soft}</span> : null}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
