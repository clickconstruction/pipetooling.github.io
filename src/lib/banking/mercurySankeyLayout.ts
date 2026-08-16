/**
 * Pure Sankey layout kernel for the Banking → Mercury → Visuals tab (v2.1712).
 *
 * Takes abstract nodes (assigned to columns) and links, returns positioned
 * rects and ribbon paths for an SVG of the given size. No DOM, no colors —
 * nodes carry a `tone` the component maps to theme-aware fills.
 *
 * Layout rules (deliberately simple — flows here are shallow, 2–3 columns):
 * - Node height ∝ value; one shared $-per-px scale = the tightest column's.
 * - Columns stack top-down in input order, vertically centered.
 * - Link ribbons stack on each node in (source column, source y, target y)
 *   order so ribbons never cross at their endpoints.
 */

export type SankeyTone =
  | 'series1'
  | 'series2'
  | 'series3'
  | 'series4'
  | 'series5'
  | 'series6'
  | 'neutral'
  | 'ink'
  | 'warn'

export type SankeyNodeInput = {
  id: string
  col: number
  label: string
  /** Optional second line under the label (e.g. a tx count). */
  sublabel?: string
  value: number
  tone: SankeyTone
  /** Clicking this node's bar drills a layer deeper (v2.1717). */
  focusable?: boolean
}

export type SankeyLinkInput = {
  source: string
  target: string
  value: number
  /** Ribbon tone; defaults to the source node's tone. */
  tone?: SankeyTone
  /** Transactions behind this ribbon — presence makes it click-through (v2.1713). */
  txIds?: string[]
}

export type SankeyInput = { nodes: SankeyNodeInput[]; links: SankeyLinkInput[] }

export type SankeyLayoutOptions = {
  width: number
  height: number
  /** Node bar width in px (default 10). */
  nodeWidth?: number
  /** Vertical gap between nodes in a column (default 10). */
  padY?: number
  /** Label gutter left of the first column (default 150). */
  padLeft?: number
  /** Label gutter right of the last column (default 150). */
  padRight?: number
}

export type PositionedSankeyNode = SankeyNodeInput & {
  x: number
  y: number
  h: number
  /** Which side of the bar the label sits on. */
  labelSide: 'left' | 'right'
}

export type PositionedSankeyLink = {
  sourceId: string
  targetId: string
  sourceLabel: string
  targetLabel: string
  value: number
  tone: SankeyTone
  /** SVG path for the filled ribbon. */
  path: string
  /** Transactions behind this ribbon (empty = not click-through). */
  txIds: string[]
}

export type SankeyLayout = {
  nodes: PositionedSankeyNode[]
  links: PositionedSankeyLink[]
  width: number
  height: number
}

const r2 = (n: number): number => Math.round(n * 100) / 100

/**
 * Position nodes and links. Nodes with value <= 0 and links with a missing
 * endpoint or value <= 0 are dropped (callers build inputs from live data —
 * empty buckets are normal, not errors). Returns null when nothing drawable
 * remains.
 */
export function layoutSankey(input: SankeyInput, opts: SankeyLayoutOptions): SankeyLayout | null {
  const nodeWidth = opts.nodeWidth ?? 10
  const padY = opts.padY ?? 10
  const padLeft = opts.padLeft ?? 150
  const padRight = opts.padRight ?? 150

  const nodes: PositionedSankeyNode[] = input.nodes
    .filter((n) => n.value > 0)
    .map((n) => ({ ...n, x: 0, y: 0, h: 0, labelSide: 'right' as const }))
  if (nodes.length === 0) return null

  const cols = Math.max(...nodes.map((n) => n.col)) + 1
  if (cols < 2) return null
  const colX = (c: number): number => padLeft + c * ((opts.width - padLeft - padRight - nodeWidth) / (cols - 1))

  // Shared scale: the tightest column's $-per-px so every column fits.
  let scale = Infinity
  for (let c = 0; c < cols; c++) {
    const list = nodes.filter((n) => n.col === c)
    if (list.length === 0) continue
    const total = list.reduce((s, n) => s + n.value, 0)
    const usable = opts.height - 20 - (list.length - 1) * padY
    if (total > 0 && usable > 0) scale = Math.min(scale, usable / total)
  }
  if (!Number.isFinite(scale) || scale <= 0) return null

  for (let c = 0; c < cols; c++) {
    const list = nodes.filter((n) => n.col === c)
    const stackH = list.reduce((s, n) => s + n.value * scale, 0) + (list.length - 1) * padY
    let y = (opts.height - stackH) / 2
    for (const n of list) {
      n.h = n.value * scale
      n.y = y
      n.x = colX(c)
      n.labelSide = c < cols - 1 ? 'left' : 'right'
      y += n.h + padY
    }
  }

  const byId = new Map(nodes.map((n) => [n.id, n]))
  const sourceOffset = new Map<string, number>()
  const targetOffset = new Map<string, number>()
  const drawable = input.links
    .filter((l) => l.value > 0 && byId.has(l.source) && byId.has(l.target))
    .map((l) => ({ ...l, sn: byId.get(l.source)!, tn: byId.get(l.target)! }))
  drawable.sort((a, b) => a.sn.col - b.sn.col || a.sn.y - b.sn.y || a.tn.y - b.tn.y)

  const links: PositionedSankeyLink[] = drawable.map((l) => {
    const h = l.value * scale
    const x0 = l.sn.x + nodeWidth
    const x1 = l.tn.x
    const y0 = l.sn.y + (sourceOffset.get(l.sn.id) ?? 0)
    const y1 = l.tn.y + (targetOffset.get(l.tn.id) ?? 0)
    sourceOffset.set(l.sn.id, (sourceOffset.get(l.sn.id) ?? 0) + h)
    targetOffset.set(l.tn.id, (targetOffset.get(l.tn.id) ?? 0) + h)
    const m = (x0 + x1) / 2
    return {
      sourceId: l.sn.id,
      targetId: l.tn.id,
      sourceLabel: l.sn.label,
      targetLabel: l.tn.label,
      value: l.value,
      tone: l.tone ?? l.sn.tone,
      txIds: l.txIds ?? [],
      path:
        `M${r2(x0)},${r2(y0)} C${r2(m)},${r2(y0)} ${r2(m)},${r2(y1)} ${r2(x1)},${r2(y1)} ` +
        `L${r2(x1)},${r2(y1 + h)} C${r2(m)},${r2(y1 + h)} ${r2(m)},${r2(y0 + h)} ${r2(x0)},${r2(y0 + h)} Z`,
    }
  })

  return { nodes, links, width: opts.width, height: opts.height }
}

/** $1.23M / $46K / $3,585 — matches the tab's caption formatting. */
export function formatSankeyUsd(v: number): string {
  const abs = Math.abs(v)
  if (abs >= 1e6) return `$${(abs / 1e6).toFixed(2)}M`
  if (abs >= 1e4) return `$${Math.round(abs / 1e3).toLocaleString()}K`
  return `$${Math.round(abs).toLocaleString()}`
}
