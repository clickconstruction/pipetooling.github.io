import dagre from 'dagre'
import type { Edge, Node } from '@xyflow/react'

const DEFAULT_WIDTH = 280
const ROW_H = 28
const PADDING = 12
const HEADER_H = 36
/** One line for task count (and optional "Locked" hint) in collapsed group cards. */
const COLLAPSED_SUB_H = 24

function nodeHeightForTasks(taskCount: number): number {
  return nodeHeightForGroup(taskCount, false)
}

/** Dagre node height: expanded by task row count, or fixed compact height when collapsed. */
export function nodeHeightForGroup(taskCount: number, collapsed: boolean): number {
  if (collapsed) {
    return PADDING * 2 + HEADER_H + COLLAPSED_SUB_H
  }
  return PADDING * 2 + HEADER_H + Math.max(1, taskCount) * ROW_H
}

/**
 * Build React Flow nodes/edges with dagre left-to-right layout. Node type `groupNode` — merge `data` in the parent.
 */
export function layoutTechTreeFlow(args: {
  groupIds: string[]
  taskCountByGroup: Map<string, number>
  flowEdges: Array<{ id: string; from: string; to: string }>
  /** When a group id is in this set, use compact node height in dagre. */
  collapsedGroupIds: ReadonlySet<string>
}): { nodes: Node[]; edges: Edge[]; nodeHeights: Map<string, number> } {
  const { groupIds, taskCountByGroup, flowEdges, collapsedGroupIds } = args
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  // edgesep spreads edges sharing a corridor into their own lanes so parallel
  // runs don't overlap (perpendicular crossings remain, by design).
  g.setGraph({ rankdir: 'LR', ranksep: 90, nodesep: 50, edgesep: 28, marginx: 20, marginy: 20 })

  const nodeHeights = new Map<string, number>()
  for (const id of groupIds) {
    const nTasks = taskCountByGroup.get(id) ?? 0
    const h = nodeHeightForGroup(nTasks, collapsedGroupIds.has(id))
    nodeHeights.set(id, h)
    g.setNode(id, { width: DEFAULT_WIDTH, height: h })
  }
  for (const e of flowEdges) {
    g.setEdge(e.from, e.to)
  }
  dagre.layout(g)

  const nodes: Node[] = groupIds.map((id) => {
    const pos = g.node(id) as { x: number; y: number; width: number; height: number } | undefined
    const w = pos?.width ?? DEFAULT_WIDTH
    const h = pos?.height ?? 120
    const x = (pos?.x ?? 0) - w / 2
    const y = (pos?.y ?? 0) - h / 2
    return {
      id,
      type: 'groupNode',
      position: { x, y },
      data: { groupId: id, height: h, width: w },
    }
  })

  // Dagre routes every edge through the gaps BETWEEN nodes (virtual nodes for
  // multi-rank spans) — keep its waypoints so the rendered line follows that
  // route instead of a handle-to-handle smoothstep that slices through boxes.
  const edges: Edge[] = flowEdges.map((e) => {
    const routed = g.edge({ v: e.from, w: e.to }) as { points?: Array<{ x: number; y: number }> } | undefined
    const routePoints = dropHairpinPoints(routed?.points ?? [])
    return {
      id: e.id,
      source: e.from,
      target: e.to,
      type: routePoints.length > 2 ? 'techTreeRouted' : 'smoothstep',
      animated: false,
      data: routePoints.length > 2 ? { routePoints } : undefined,
    }
  })

  return { nodes, edges, nodeHeights }
}

/**
 * Dagre wart (v2.2302): the midpoint of a short edge is a zero-size virtual
 * label node whose y can be pushed hundreds of px off the corridor by
 * unrelated nodes in its alignment pass — the rendered line then dives to a
 * needle apex in empty canvas and doubles straight back (the "stray line").
 * A real dodge around a node turns ~90° per corner; only a degenerate spike
 * reverses direction. Drop interior waypoints whose turn is a near-reversal;
 * an edge reduced to its endpoints falls back to a plain smoothstep.
 */
export function dropHairpinPoints(
  points: ReadonlyArray<{ x: number; y: number }>,
): Array<{ x: number; y: number }> {
  const pts = [...points]
  let changed = true
  while (changed && pts.length > 2) {
    changed = false
    for (let i = 1; i < pts.length - 1; i++) {
      const a = pts[i - 1]!
      const b = pts[i]!
      const c = pts[i + 1]!
      const v1x = b.x - a.x
      const v1y = b.y - a.y
      const v2x = c.x - b.x
      const v2y = c.y - b.y
      const l1 = Math.hypot(v1x, v1y)
      const l2 = Math.hypot(v2x, v2y)
      if (l1 < 0.5 || l2 < 0.5) {
        pts.splice(i, 1)
        changed = true
        break
      }
      const cos = (v1x * v2x + v1y * v2y) / (l1 * l2)
      if (cos < -0.6) {
        pts.splice(i, 1)
        changed = true
        break
      }
    }
  }
  return pts
}

/**
 * SVG path through a polyline with rounded bends: straight runs, each interior
 * waypoint turned via a quadratic whose control point is the waypoint itself.
 */
export function buildRoutedEdgePath(
  points: ReadonlyArray<{ x: number; y: number }>,
  cornerRadius = 8,
): string {
  if (points.length === 0) return ''
  const first = points[0]!
  if (points.length === 1) return `M ${first.x},${first.y}`
  let d = `M ${first.x},${first.y}`
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1]!
    const p = points[i]!
    const next = points[i + 1]!
    const inLen = Math.hypot(p.x - prev.x, p.y - prev.y)
    const outLen = Math.hypot(next.x - p.x, next.y - p.y)
    const r = Math.min(cornerRadius, inLen / 2, outLen / 2)
    if (r < 0.5 || inLen === 0 || outLen === 0) {
      d += ` L ${p.x},${p.y}`
      continue
    }
    const inX = p.x - ((p.x - prev.x) / inLen) * r
    const inY = p.y - ((p.y - prev.y) / inLen) * r
    const outX = p.x + ((next.x - p.x) / outLen) * r
    const outY = p.y + ((next.y - p.y) / outLen) * r
    d += ` L ${inX},${inY} Q ${p.x},${p.y} ${outX},${outY}`
  }
  const last = points[points.length - 1]!
  d += ` L ${last.x},${last.y}`
  return d
}

export { DEFAULT_WIDTH as techTreeNodeWidth, nodeHeightForTasks as techTreeNodeHeightForTaskCount }
