import { BaseEdge, getSmoothStepPath, type EdgeProps } from '@xyflow/react'
import { buildRoutedEdgePath, dropHairpinPoints } from '../../lib/checklistTechTreeLayout'

/**
 * Roadmap Map edge that follows dagre's computed route: real handle positions
 * at both ends, dagre's interior waypoints in between (they thread the gaps
 * between stage boxes), rounded at every bend. Falls back to a plain
 * smoothstep when no waypoints are present.
 */
export function ChecklistTechTreeRoutedEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  style,
  markerEnd,
  interactionWidth,
}: EdgeProps) {
  const routePoints = (data as { routePoints?: Array<{ x: number; y: number }> } | undefined)?.routePoints
  let path: string | null = null
  if (routePoints && routePoints.length > 2) {
    // Endpoints come from the measured handles so the line meets the card
    // exactly; dagre's own endpoint approximations are dropped. That
    // substitution can turn dagre's wandering virtual-label midpoint into a
    // needle spike (v2.2302's "stray line"), so the final polyline gets the
    // same hairpin filter as the layout — if nothing useful survives, this
    // edge is better off as a plain smoothstep.
    const points = dropHairpinPoints([
      { x: sourceX, y: sourceY },
      ...routePoints.slice(1, -1),
      { x: targetX, y: targetY },
    ])
    if (points.length > 2) {
      path = buildRoutedEdgePath(points)
    }
  }
  if (path == null) {
    ;[path] = getSmoothStepPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition })
  }
  return <BaseEdge id={id} path={path} style={style} markerEnd={markerEnd} interactionWidth={interactionWidth} />
}
