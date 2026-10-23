/**
 * The county map's view (punch list #144, the picker's zoom and pan): one SVG whose view
 * box moves while the county paths are drawn once. Pure math over a `ViewBox`, so the
 * wheel, the pinch, the + and − buttons, the drag and the two reset views all go through
 * the same four rules and are tested without a browser:
 *
 * 1. A zoom keeps the point under the cursor where it is.
 * 2. The view never shows more than the world, nor less than `minW` units across, and its
 *    middle stays inside the world, so a drag cannot lose the map.
 * 3. County names draw once the view is about a third of the state or less; a colored
 *    county's name always draws.
 * 4. A dot for a case is sized on the page, 6 to 12 px by balance, whatever the view.
 */

export type ViewBox = { x: number; y: number; w: number; h: number }

/** The + and − buttons step by this; the wheel by `wheelFactor`. */
export const ZOOM_STEP = 1.4

/** How many wheel pixels make one e-fold of zoom: `exp(deltaY * WHEEL_RATE)`. */
export const WHEEL_RATE = 0.0015

/** Moving the pointer this far (page px) while pressed is a drag, not a click. */
export const DRAG_SLOP_PX = 3

/** The view is tight enough for every county's name when it shows this much of the state's width or less. */
export const LABELS_AT_FRACTION = 1 / 3

/** A colored county's name draws from this much of the state's width; zoomed out past it, no name fits. */
export const COLORED_LABELS_AT_FRACTION = 0.7

const round3 = (n: number) => Math.round(n * 1000) / 1000

/** Rule 2: the view inside the world, at least `minW` wide, its middle inside the world. */
export function clampView(vb: ViewBox, world: ViewBox, minW: number): ViewBox {
  const aspect = vb.h / vb.w || 1
  const w = Math.max(minW, Math.min(world.w, vb.w))
  const h = w * aspect
  const x = Math.max(world.x - w / 2, Math.min(world.x + world.w - w / 2, vb.x))
  const y = Math.max(world.y - h / 2, Math.min(world.y + world.h - h / 2, vb.y))
  return { x: round3(x), y: round3(y), w: round3(w), h: round3(h) }
}

/** Rule 1: scale the view by `factor` (< 1 zooms in) about the view point `(cx, cy)`. */
export function zoomAt(vb: ViewBox, world: ViewBox, factor: number, cx: number, cy: number, minW: number): ViewBox {
  const nw = Math.max(minW, Math.min(world.w, vb.w * factor))
  const f = nw / vb.w
  return clampView({ x: cx - (cx - vb.x) * f, y: cy - (cy - vb.y) * f, w: nw, h: vb.h * f }, world, minW)
}

/** The + button (`direction` 1) or − (−1), about the view's middle. */
export function zoomStep(vb: ViewBox, world: ViewBox, direction: 1 | -1, minW: number): ViewBox {
  return zoomAt(vb, world, direction === 1 ? 1 / ZOOM_STEP : ZOOM_STEP, vb.x + vb.w / 2, vb.y + vb.h / 2, minW)
}

/** A wheel tick: `deltaY` up (negative) zooms in. */
export function wheelFactor(deltaY: number): number {
  return Math.exp(deltaY * WHEEL_RATE)
}

/** A drag from where the pointer went down: `dxFrac`, `dyFrac` are the pointer's travel as fractions of the SVG's page size. */
export function panTo(start: ViewBox, world: ViewBox, dxFrac: number, dyFrac: number, minW: number): ViewBox {
  return clampView({ x: start.x - dxFrac * start.w, y: start.y - dyFrac * start.h, w: start.w, h: start.h }, world, minW)
}

/** A page point (fractions of the SVG's size) as a view point. */
export function viewPoint(vb: ViewBox, xFrac: number, yFrac: number): [number, number] {
  return [vb.x + xFrac * vb.w, vb.y + yFrac * vb.h]
}

/** Whether a press that travelled `dx, dy` page px is a drag (rule: never a click). */
export function isDrag(dx: number, dy: number): boolean {
  return Math.hypot(dx, dy) > DRAG_SLOP_PX
}

/** Rule 3: whether every county's name draws at this view width, for a state `stateW` wide. */
export function labelsShow(vb: ViewBox, stateW: number): boolean {
  return vb.w <= stateW * LABELS_AT_FRACTION
}

/** Whether a county's name draws: every name when tight, else a colored county's until the view is most of the state. */
export function labelShows(vb: ViewBox, stateW: number, colored: boolean): boolean {
  return labelsShow(vb, stateW) || (colored && vb.w <= stateW * COLORED_LABELS_AT_FRACTION)
}

/** The name's font size in view units: readable at every zoom because it scales with the view. */
export function labelFontSize(vb: ViewBox): number {
  return Math.round(vb.w * 0.029 * 100) / 100
}

/** Rule 4: a case dot's radius on the page, 6 to 12 px by the balance. */
export function dotRadiusPx(amount: number): number {
  const a = Number.isFinite(amount) && amount > 0 ? amount : 0
  return Math.max(6, Math.min(12, 3.5 + Math.sqrt(a) / 18))
}

/** The same radius in view units, so it stays `px` wide on a page where the SVG is `svgPageW` px wide. */
export function dotRadiusView(vb: ViewBox, svgPageW: number, radiusPx: number): number {
  return round3(radiusPx * (vb.w / Math.max(1, svgPageW)))
}

/** The `viewBox` attribute. */
export function viewBoxAttr(vb: ViewBox): string {
  return `${vb.x} ${vb.y} ${vb.w} ${vb.h}`
}

/** Whether a view point is on screen. */
export function inView(vb: ViewBox, x: number, y: number): boolean {
  return x >= vb.x && x <= vb.x + vb.w && y >= vb.y && y <= vb.y + vb.h
}

/** A box `pad` units bigger on every side: the world around the state, so a drag can show its edge. */
export function padBox(box: ViewBox, pad: number): ViewBox {
  return { x: box.x - pad, y: box.y - pad, w: box.w + 2 * pad, h: box.h + 2 * pad }
}
