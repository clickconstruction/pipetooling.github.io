/**
 * The Plans look's second view, By date: every set of drawings on the site against time, with the bids, the
 * days crews were on site and the lines kept on History on the same axis, today's line across them all, and
 * every mark again as a dated line under the chart. The lanes, the shapes, the names that fit and the print
 * page are `lib/plans/plansByDate.ts`; this file draws those shapes in the theme's colours, shows a mark's
 * line on a hover, a focus or a press, and opens the print, which files its copy. It carries no money, so
 * the overview door draws it too. The view is a look: nothing here changes a record.
 */
import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { printAndFile } from '../../lib/sent/sentCopiesIo'
import { PBD_PAINT, PLANS_BY_DATE_CLUSTER_WORDS, PLANS_BY_DATE_FAINT, PLANS_BY_DATE_NARROW, dayWords, plansByDateListHead, plansByDateListRows, plansByDateLogTitle, plansByDateLogWords, layoutPlansByDate, plansByDateGlyph, plansByDatePrintHtml, type PbdClass, type PbdGlyph, type PbdInk, type PbdPrim, type PlansByDateModel } from '../../lib/plans/plansByDate'
import { EmptyState } from '../EmptyState'
import { plansByDateClusterCard, plansByDateTipCard, type PbdCard, type PbdCardAction } from '../../lib/plans/plansByDateCards'
import { LinkButton } from './developmentPageBits'
import { useItemCard } from '../../hooks/usePlansByDateItemCard'
import { PlansByDateItemCard } from './PlansByDateItemCard'
import { TRIP_KIND_COLOR } from '../trips/TripDayBits'

/** The screen's colours for the kernel's inks: theme tokens, so the chart follows light and dark. */
const SCREEN_INK: Record<PbdInk, string> = {
  set: 'var(--house-series-2)',
  bid: 'var(--bid-mark)',
  bidWash: 'var(--bid-mark-wash-strong)',
  over: 'var(--text-red-700)',
  overWash: 'var(--bg-red-100)',
  crew: 'var(--man-hours-field)',
  // A trip day wears its kind's colour, the one the Trips look draws (punch list #379).
  tripSite: TRIP_KIND_COLOR.site,
  tripRoad: TRIP_KIND_COLOR.road,
  tripReady: TRIP_KIND_COLOR.ready,
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
    ...(p.halo ? { paintOrder: 'stroke', stroke: SCREEN_INK.surface, strokeWidth: 3, strokeLinejoin: 'round' as const } : {}),
  }
}

function Prim({ p }: { p: PbdPrim }): ReactNode {
  const style = paintStyle(p.cls)
  if (p.t === 'line') return <line x1={p.x1} y1={p.y1} x2={p.x2} y2={p.y2} style={style} />
  if (p.t === 'circle') return <circle cx={p.cx} cy={p.cy} r={p.r} style={style} />
  if (p.t === 'path') return <path d={p.d} style={style} />
  if (p.t === 'rect') return <rect x={p.x} y={p.y} width={p.w} height={p.h} rx={p.rx} transform={p.turn ? `rotate(45 ${p.x + p.w / 2} ${p.y + p.h / 2})` : undefined} style={p.faint ? { ...style, opacity: PLANS_BY_DATE_FAINT } : style} />
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
/** The list folds only past this many lines, so a list a few lines over forty is not cut for a handful. */
export const PLANS_BY_DATE_LIST_FOLD_AT = 60

export type PlansByDatePrint = { siteName: string; customerName: string | null; printedBy: string | null; /** Where the printed page's copy is filed: a print counts as a send. */ developmentId: string; customerId: string | null }

export function DevelopmentPlansByDate({
  model,
  phone,
  notes = [],
  print,
  cards = null,
  onAct,
}: {
  model: PlansByDateModel | null
  phone: boolean
  /** Quiet lines under the chart: what is not on it, and why. */
  notes?: ReadonlyArray<string>
  print: PlansByDatePrint
  /** Every item's card (`buildPlansByDateCards`); without them an item's card is its one line. */
  cards?: ReadonlyMap<string, PbdCard> | null
  /** A card's press, done by the page. */
  onAct?: (action: PbdCardAction) => void
}) {
  const [allRows, setAllRows] = useState(false)
  // The list opens on the drawings and the bids, as the owner's chart did; a press adds the crews' days and the History lines.
  const [withLog, setWithLog] = useState(false)
  // On a narrow screen the key folds behind a press, so the chart is not pushed six lines down the page.
  const [keyOpen, setKeyOpen] = useState(false)
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
  // One card for the whole view: every item answers the pointer with its details and its presses.
  const item = useItemCard(narrow)

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

  const cardFor = (key: string): PbdCard | null => {
    const have = cards?.get(key)
    if (have) return have
    const shape = layout.marks.find((m) => m.key === key)
    if (shape?.members && cards) return plansByDateClusterCard(key, shape.members, cards, model)
    return shape ? plansByDateTipCard(key, shape.tip) : null
  }
  const openCard = item.state ? cardFor(item.state.key) : null
  // The item a card is open on stands out on the chart and in the list at once, so the two read as one thing.
  const openKey = item.state?.key ?? null
  const isOpen = (key: string, members?: ReadonlyArray<string>) => openKey != null && (openKey === key || (members?.includes(openKey) ?? false))
  const act = (action: PbdCardAction) => {
    item.close()
    onAct?.(action)
  }
  const list = plansByDateListRows(model.rows, withLog)
  const head = plansByDateListHead(list)
  const folded = !allRows && list.rows.length > PLANS_BY_DATE_LIST_FOLD_AT
  const rows = folded ? list.rows.slice(list.rows.length - PLANS_BY_DATE_LIST_FOLD) : list.rows
  const older = list.rows.length - rows.length

  const openPrint = () => {
    const html = plansByDatePrintHtml({
      siteName: print.siteName,
      customerName: print.customerName,
      model,
      notes,
      printedAt: new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }),
      printedBy: print.printedBy,
      withLog,
    })
    // A print counts as a send (the owner's rule, `docs/SENT_COPIES.md`): the page that printed is filed in Documents under the site.
    const printed = printAndFile(html, { kind: 'plans_by_date', title: `Plans by date · ${print.siteName}`, customerId: print.customerId, source: { table: 'developments', id: print.developmentId } })
    setPrintNote(printed ? null : 'The print window was blocked. Allow pop-ups for this site and press again.')
  }

  return (
    <div data-testid="plans-by-date" style={{ minWidth: 0 }}>
      <div data-testid="pbd-figures" style={{ display: 'grid', gridTemplateColumns: narrow ? 'repeat(2, minmax(0, 1fr))' : 'repeat(auto-fit, minmax(170px, 1fr))', gap: 8, marginBottom: 10 }}>
        {model.figures.map((f) => (
          <div key={f.key} role="button" tabIndex={0} {...item.bind(`figure-${f.key}`)} data-testid={`pbd-figure-${f.key}`} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', background: 'var(--bg-subtle)', minWidth: 0, cursor: 'pointer' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{f.label}</div>
            <div style={{ fontSize: '1.15rem', fontWeight: 700, color: f.over ? 'var(--text-red-700)' : 'var(--text-strong)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.25 }}>{f.value}</div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', overflowWrap: 'anywhere' }}>{f.sub}</div>
          </div>
        ))}
      </div>

      {narrow ? (
        <div style={{ margin: '0 0 4px', fontSize: '0.76rem' }}>
          <LinkButton onClick={() => setKeyOpen((v) => !v)} title="The key to the chart’s marks">
            {keyOpen ? 'Hide what the marks mean' : 'What the marks mean'}
          </LinkButton>
        </div>
      ) : null}
      {!narrow || keyOpen ? (
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
      ) : null}

      <div ref={chartRef} style={{ position: 'relative', minWidth: 0 }} data-testid="pbd-chart">
        <svg viewBox={`0 0 ${layout.width} ${layout.height}`} role="group" aria-label={layout.summary} style={{ display: 'block', width: '100%', height: 'auto', overflow: 'visible', fontFamily: 'inherit' }}>
          {layout.back.map((p, i) => (
            <Prim key={`b${i}`} p={p} />
          ))}
          {/* A lane's name and today's pill take the pointer too. */}
          {layout.nameHits.map((h) => (
            <rect key={h.key} x={h.x} y={h.y} width={h.w} height={h.h} role="button" aria-label={h.label} tabIndex={0} {...item.bind(h.key)} data-testid={`pbd-name-${h.key}`} style={{ fill: 'transparent', cursor: 'pointer', outline: 'none' }} />
          ))}
          {layout.marks.map((m) => (
            <g key={m.key} role="button" aria-label={m.tip} tabIndex={0} {...item.bind(m.key)} data-testid={`pbd-mark-${m.key}`} style={{ outline: 'none', cursor: 'pointer' }}>
              {/* The halo under an item whose card is open. */}
              {m.hit.t === 'circle' ? (
                <circle cx={m.hit.cx} cy={m.hit.cy} r={m.hit.r} data-testid={isOpen(m.key, m.members) ? 'pbd-mark-open' : undefined} style={{ fill: isOpen(m.key, m.members) ? 'var(--bg-blue-tint)' : 'transparent', fillOpacity: 0.55, stroke: isOpen(m.key, m.members) ? 'var(--text-strong)' : 'none', strokeWidth: 1.5 }} />
              ) : m.hit.t === 'rect' ? (
                <rect x={m.hit.x} y={m.hit.y + 5} width={m.hit.w} height={m.hit.h - 10} rx={8} data-testid={isOpen(m.key, m.members) ? 'pbd-mark-open' : undefined} style={{ fill: 'transparent', stroke: isOpen(m.key, m.members) ? 'var(--text-strong)' : 'none', strokeWidth: 1.5 }} />
              ) : null}
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
      </div>
      {item.state && openCard ? (
        <PlansByDateItemCard
          card={openCard}
          glyph={openCard.glyph ? <Glyph glyph={openCard.glyph} /> : null}
          anchor={item.anchorRef.current}
          cardRef={item.cardRef}
          pinned={item.state.pinned}
          sheet={narrow}
          canBack={item.state.trail.length > 0}
          onBack={item.back}
          onGo={item.go}
          onAct={act}
          onClose={() => item.close(true)}
          hover={item.cardHover}
        />
      ) : null}

      <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', margin: '6px 0 0' }} data-testid="pbd-note">
        {narrow ? 'Press anything on the chart or in the list for its details. The chart names the set each part builds from.' : 'Rest the pointer on anything for its details and its presses. Press it to keep the card open.'}
        {notes.map((n) => ` ${n}`).join('')}
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'baseline', gap: '4px 10px', margin: '12px 0 4px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
        <span>
          <strong style={{ color: 'var(--text-strong)' }}>{head.title}</strong> · {head.count} · oldest first
          {list.hidden > 0 ? (
            <>
              {' · '}
              <LinkButton onClick={() => setWithLog(true)} title={plansByDateLogTitle(model)}>
                Also show the {list.hidden} {plansByDateLogWords(model)} {list.hidden === 1 ? 'line' : 'lines'}
              </LinkButton>
            </>
          ) : withLog && list.issues > 0 ? (
            <>
              {' · '}
              <LinkButton onClick={() => setWithLog(false)} title="Lists the drawings and the bids alone">
                Show only the drawings and the bids
              </LinkButton>
            </>
          ) : null}
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
            role="button"
            tabIndex={0}
            {...item.bind(r.key, 'list')}
            style={{
              cursor: 'pointer',
              boxShadow: isOpen(r.key) ? 'inset 3px 0 0 var(--text-strong)' : undefined,
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
