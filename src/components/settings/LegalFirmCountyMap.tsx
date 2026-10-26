import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { NO_FIRM_HUE, countyWords, type CountyAssignments, type FirmHue, type FirmLegendRow } from '../../lib/legal/firmCounties'
import { casesInCounty, effectiveStand, STAND_COLOR, type LegalMapCase } from '../../lib/legal/firmMap'
import { dotRadiusPx, dotRadiusView, inView, isDrag, labelFontSize, labelShows, padBox, panTo, viewBoxAttr, viewPoint, wheelFactor, zoomAt, zoomStep, type ViewBox } from '../../lib/legal/countyMapView'
import { loadTxCountyMap } from '../../lib/legal/txCountyMapIo'
import type { CountyMap } from '../../lib/legal/txCountyMap'

/**
 * The Texas county map on Settings → Collections law firms (punch list #144, PR 1 and
 * 1b): every county as a path, filled with the hue of the firm that holds it in the draft,
 * gray when none; today's cases as faint dots at their job's geocode. One SVG whose view
 * box moves (`countyMapView.ts`): the wheel or a pinch zooms at the cursor, a drag pans,
 * + and − step, Central Texas and All of Texas reset. County names draw as the view
 * tightens. A drag is never a click. A click on a county goes to the block (`onPress`),
 * which owns the draft and the rules; a click on a dot goes to `onPressCase` and never
 * colors. Real county lines from `public/geo/tx-counties.json` (docs/TX_COUNTY_MAP.md).
 * Since v2.5784 (PR 3) the Legal desk's Map draws with the same component in `lens` mode: the
 * words say tap, not color; the dots are full size; the county last tapped is outlined
 * (`selectedCounty`); the legend's "for reference" tail is left off.
 */
const MAP_W = 600
const MIN_VIEW_W = 20
const WORLD_PAD = 60
/** The view the map opens on: the company's Central Texas service area, west of Austin to east of Seguin. */
const CENTRAL_TEXAS = { w: -99.3, e: -96.9, s: 28.95, n: 31.05 }

type ViewName = 'central' | 'all'

export default function LegalFirmCountyMap({ assignments, hues, firmNames, legend, pickedFirmId, cases, heldCaseId, onPress, onHoverCounty, onPressCase, lens = false, selectedCounty = null, idleWords }: {
  assignments: CountyAssignments
  hues: ReadonlyMap<string, FirmHue>
  firmNames: ReadonlyMap<string, string>
  legend: ReadonlyArray<FirmLegendRow>
  pickedFirmId: string | null
  cases: ReadonlyArray<LegalMapCase>
  /** The held case's `id`. */
  heldCaseId: string | null
  onPress: (county: string) => void
  onHoverCounty: (county: string | null) => void
  onPressCase: (c: LegalMapCase) => void
  /** The desk's Map (v2.5784): the words and the dots of a lens, not a picker. */
  lens?: boolean
  /** The county whose cases the lens lists; outlined. */
  selectedCounty?: string | null
  /** The readout while nothing is hovered (#144 PR 4: the portal shows no dots, so the lens words would mislead). */
  idleWords?: string
}) {
  const [map, setMap] = useState<CountyMap | null>(null)
  const [failed, setFailed] = useState(false)
  const [hovered, setHovered] = useState<string | null>(null)
  const [vb, setVbState] = useState<ViewBox | null>(null)
  const [view, setView] = useState<ViewName | null>('central')
  const [pageW, setPageW] = useState(MAP_W)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const vbRef = useRef<ViewBox | null>(null)
  const dragRef = useRef<{ id: number; x: number; y: number; start: ViewBox; moved: boolean } | null>(null)
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map())
  const pinchRef = useRef<number | null>(null)
  const suppressClickRef = useRef(false)

  const setVb = useCallback((next: ViewBox, name: ViewName | null) => {
    vbRef.current = next
    setVbState(next)
    setView(name)
  }, [])

  const world = useMemo(() => (map ? padBox({ x: 0, y: 0, w: map.width, h: map.height }, WORLD_PAD) : null), [map])
  const views = useMemo((): Record<ViewName, ViewBox> | null => {
    if (!map) return null
    const all: ViewBox = { x: 0, y: 0, w: map.width, h: map.height }
    const [x0, y0] = map.project(CENTRAL_TEXAS.w, CENTRAL_TEXAS.n)
    const [x1, y1] = map.project(CENTRAL_TEXAS.e, CENTRAL_TEXAS.s)
    // The same aspect as the whole state, so the SVG keeps its height whatever the view.
    const w = x1 - x0
    const h = (w * map.height) / map.width
    const central: ViewBox = { x: x0, y: (y0 + y1) / 2 - h / 2, w, h }
    return { central, all }
  }, [map])

  useEffect(() => {
    let live = true
    loadTxCountyMap(MAP_W).then(
      (m) => {
        if (live) setMap(m)
      },
      () => {
        if (live) setFailed(true)
      },
    )
    return () => {
      live = false
    }
  }, [])
  useEffect(() => {
    if (views && !vbRef.current) setVb(views.central, 'central')
  }, [views, setVb])

  // The SVG's page width, for dots that stay 6–12 px whatever the view.
  useEffect(() => {
    const el = svgRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width
      if (w && w > 0) setPageW(w)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [map])

  // The wheel must be a non-passive listener to keep the page from scrolling under the map.
  useEffect(() => {
    const el = svgRef.current
    if (!el || !world) return
    const onWheel = (ev: WheelEvent) => {
      const cur = vbRef.current
      if (!cur) return
      ev.preventDefault()
      const r = el.getBoundingClientRect()
      const [cx, cy] = viewPoint(cur, (ev.clientX - r.left) / Math.max(1, r.width), (ev.clientY - r.top) / Math.max(1, r.height))
      setVb(zoomAt(cur, world, wheelFactor(ev.deltaY), cx, cy, MIN_VIEW_W), null)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [world, setVb, map])

  const onPointerDown = (ev: ReactPointerEvent<SVGSVGElement>) => {
    const cur = vbRef.current
    if (!cur || (ev.pointerType === 'mouse' && ev.button !== 0)) return
    pointersRef.current.set(ev.pointerId, { x: ev.clientX, y: ev.clientY })
    // No capture yet: capturing on the press would retarget the click to the SVG, and no county or dot would get it.
    if (pointersRef.current.size === 1) dragRef.current = { id: ev.pointerId, x: ev.clientX, y: ev.clientY, start: cur, moved: false }
    else {
      // A second finger: the drag becomes a pinch.
      dragRef.current = null
      pinchRef.current = null
    }
  }
  const onPointerMove = (ev: ReactPointerEvent<SVGSVGElement>) => {
    const cur = vbRef.current
    if (!cur || !world) return
    const pts = pointersRef.current
    if (!pts.has(ev.pointerId)) return
    pts.set(ev.pointerId, { x: ev.clientX, y: ev.clientY })
    const r = ev.currentTarget.getBoundingClientRect()
    if (pts.size >= 2) {
      const [a, b] = [...pts.values()]
      if (!a || !b) return
      const d = Math.hypot(a.x - b.x, a.y - b.y)
      const prev = pinchRef.current
      pinchRef.current = d
      if (prev && d > 0) {
        const [cx, cy] = viewPoint(cur, ((a.x + b.x) / 2 - r.left) / Math.max(1, r.width), ((a.y + b.y) / 2 - r.top) / Math.max(1, r.height))
        setVb(zoomAt(cur, world, prev / d, cx, cy, MIN_VIEW_W), null)
      }
      suppressClickRef.current = true
      return
    }
    const drag = dragRef.current
    if (!drag || drag.id !== ev.pointerId) return
    const dx = ev.clientX - drag.x
    const dy = ev.clientY - drag.y
    if (!drag.moved && isDrag(dx, dy)) {
      drag.moved = true
      // Now it is a drag: hold the pointer so the pan keeps going past the map's edge.
      ev.currentTarget.setPointerCapture(ev.pointerId)
    }
    if (drag.moved) setVb(panTo(drag.start, world, dx / Math.max(1, r.width), dy / Math.max(1, r.height), MIN_VIEW_W), null)
  }
  const onPointerEnd = (ev: ReactPointerEvent<SVGSVGElement>) => {
    pointersRef.current.delete(ev.pointerId)
    if (pointersRef.current.size < 2) pinchRef.current = null
    const drag = dragRef.current
    if (drag?.moved || suppressClickRef.current) {
      // The click that ends a drag or a pinch is swallowed; the guard lifts on the next tick.
      suppressClickRef.current = true
      setTimeout(() => {
        suppressClickRef.current = false
      }, 0)
    }
    if (drag?.id === ev.pointerId) dragRef.current = null
  }
  const clicked = (act: () => void) => {
    if (suppressClickRef.current) return
    act()
  }

  const holderOf = (county: string) => assignments.get(county) ?? null
  const hueOf = (county: string): FirmHue => {
    const holder = holderOf(county)
    return (holder && hues.get(holder)) || NO_FIRM_HUE
  }
  const countyLine = (county: string) => {
    const n = casesInCounty(cases, county).length
    return `${countyWords(county)} · ${firmNames.get(holderOf(county) ?? '') ?? 'no firm yet'}${n ? ` · ${n} ${n === 1 ? 'case' : 'cases'}` : ''}`
  }
  const readout = hovered ? countyLine(hovered) : idleWords ?? (lens ? 'Tap a county to list its cases. Tap a dot to pick one out.' : pickedFirmId ? 'Click a county to color it for the picked firm. Click it again to clear it.' : 'Pick a firm on the left, then click counties.')
  // Longhands: the view buttons flip between `btn` and `btnOn`, and React warns on a `border` shorthand under a `borderColor` (v2.5780).
  const btn = { padding: '0.2rem 0.6rem', borderRadius: 4, borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text-base)', fontSize: '0.78rem', cursor: 'pointer' } as const
  const btnOn = { ...btn, borderColor: 'var(--text-base)', fontWeight: 600 } as const

  return (
    <div data-legal-county-map>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 6 }}>
        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginRight: 'auto' }}>{lens ? 'Tap a county for its cases · scroll to zoom, drag to pan' : 'Click a county to color it for the firm picked · scroll to zoom, drag to pan'}</span>
        <button type="button" aria-pressed={view === 'central'} onClick={() => views && setVb(views.central, 'central')} disabled={!views} style={view === 'central' ? btnOn : btn}>
          Central Texas
        </button>
        <button type="button" aria-pressed={view === 'all'} onClick={() => views && setVb(views.all, 'all')} disabled={!views} style={view === 'all' ? btnOn : btn}>
          All of Texas
        </button>
      </div>
      {failed ? (
        <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', margin: 0 }}>The county map did not load. Reload the page to try again.</p>
      ) : !map || !vb || !world ? (
        <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', margin: 0 }}>Drawing the counties…</p>
      ) : (
        <div style={{ position: 'relative', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', overflow: 'hidden' }}>
          <svg
            ref={svgRef}
            viewBox={viewBoxAttr(vb)}
            data-legal-county-view={viewBoxAttr(vb)}
            role="img"
            aria-label={lens ? 'Cases on the county map' : 'Texas counties by law firm'}
            style={{ width: '100%', height: 'auto', display: 'block', cursor: dragRef.current?.moved ? 'grabbing' : 'grab', touchAction: 'none' }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerEnd}
            onPointerCancel={onPointerEnd}
            onMouseLeave={() => {
              setHovered(null)
              onHoverCounty(null)
            }}
          >
            <g>
              {map.shapes.map((s) => {
                const hue = hueOf(s.name)
                const isHovered = hovered === s.name
                const isSelected = lens && selectedCounty === s.name
                return (
                  <path
                    key={s.fips}
                    d={s.d}
                    data-county={s.name}
                    data-firm={holderOf(s.name) ?? ''}
                    data-selected={isSelected ? '1' : undefined}
                    fill={hue.fill}
                    stroke={isHovered || isSelected ? 'var(--text-base)' : 'var(--border-strong)'}
                    strokeWidth={isSelected ? 2 : isHovered ? 1.6 : 0.6}
                    vectorEffect="non-scaling-stroke"
                    strokeLinejoin="round"
                    style={{ transition: 'fill 120ms' }}
                    onPointerEnter={() => {
                      setHovered(s.name)
                      onHoverCounty(s.name)
                    }}
                    onClick={() => clicked(() => onPress(s.name))}
                    tabIndex={0}
                    onFocus={() => setHovered(s.name)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        onPress(s.name)
                      }
                    }}
                  >
                    <title>{countyLine(s.name)}</title>
                  </path>
                )
              })}
            </g>
            <g style={{ pointerEvents: 'none' }}>
              {map.shapes.map((s) => {
                const colored = holderOf(s.name) !== null
                if (!inView(vb, s.cx, s.cy) || !labelShows(vb, map.width, colored)) return null
                return (
                  <text key={`l-${s.fips}`} x={s.cx} y={s.cy} fontSize={labelFontSize(vb)} textAnchor="middle" dominantBaseline="middle" fontWeight={colored ? 600 : 500} fill={colored ? hueOf(s.name).ink : 'var(--text-base)'} data-county-label={s.name}>
                    {s.name}
                  </text>
                )
              })}
            </g>
            <g>
              {cases.map((c) => {
                if (c.lat == null || c.lng == null) return null
                const [x, y] = map.project(c.lng, c.lat)
                if (!inView(vb, x, y)) return null
                const stand = effectiveStand(c, assignments)
                const held = c.id === heldCaseId
                return (
                  <circle
                    key={c.id}
                    cx={x}
                    cy={y}
                    r={dotRadiusView(vb, pageW, dotRadiusPx(c.balance) * (lens ? 1 : 0.75))}
                    fill={STAND_COLOR[stand]}
                    fillOpacity={held ? 1 : lens ? 0.9 : 0.8}
                    stroke="var(--text-base)"
                    strokeOpacity={held ? 1 : 0.55}
                    strokeWidth={held ? 2 : 1}
                    vectorEffect="non-scaling-stroke"
                    data-case={c.id}
                    data-stand={stand}
                    style={{ cursor: 'pointer' }}
                    onPointerEnter={() => {
                      // A dot sits over its county: landing on it straight is landing on the county.
                      if (c.county) {
                        setHovered(c.county)
                        onHoverCounty(c.county)
                      }
                    }}
                    onClick={(e) => {
                      e.stopPropagation()
                      clicked(() => onPressCase(c))
                    }}
                  >
                    <title>{`${c.name} · ${c.balance.toLocaleString('en-US', { style: 'currency', currency: 'USD' })} · ${c.county ? countyWords(c.county) : 'off the map'}`}</title>
                  </circle>
                )
              })}
            </g>
          </svg>
          <div style={{ position: 'absolute', right: 8, top: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <button type="button" title="Zoom in" aria-label="Zoom in" onClick={() => setVb(zoomStep(vb, world, 1, MIN_VIEW_W), null)} style={{ ...btn, width: 26, height: 26, padding: 0, fontSize: '0.95rem' }}>
              +
            </button>
            <button type="button" title="Zoom out" aria-label="Zoom out" onClick={() => setVb(zoomStep(vb, world, -1, MIN_VIEW_W), null)} style={{ ...btn, width: 26, height: 26, padding: 0, fontSize: '0.95rem' }}>
              −
            </button>
          </div>
        </div>
      )}
      <div data-legal-county-readout style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 6, minHeight: '1.2em' }}>{readout}</div>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center', marginTop: 6, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
        {legend.map((row) => (
          <span key={row.firmId ?? 'none'} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span aria-hidden style={{ width: 12, height: 12, borderRadius: 3, background: row.hue.fill, border: `1px solid ${row.hue.border}`, display: 'inline-block' }} />
            {row.name}
          </span>
        ))}
        {lens ? null : <span>· the dots are today’s cases, for reference; the desk’s Map works them</span>}
      </div>
    </div>
  )
}
