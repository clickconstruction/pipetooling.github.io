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
  g.setGraph({ rankdir: 'LR', ranksep: 90, nodesep: 50, marginx: 20, marginy: 20 })

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

  const edges: Edge[] = flowEdges.map((e) => ({
    id: e.id,
    source: e.from,
    target: e.to,
    type: 'smoothstep',
    animated: false,
  }))

  return { nodes, edges, nodeHeights }
}

export { DEFAULT_WIDTH as techTreeNodeWidth, nodeHeightForTasks as techTreeNodeHeightForTaskCount }
