import { describe, expect, it } from 'vitest'
import { nodeHeightForGroup } from './checklistTechTreeLayout'

describe('nodeHeightForGroup', () => {
  it('uses a smaller height when collapsed than expanded for the same task count', () => {
    const n = 5
    const expanded = nodeHeightForGroup(n, false)
    const collapsed = nodeHeightForGroup(n, true)
    expect(collapsed < expanded).toBe(true)
  })
})

describe('layoutTechTreeFlow edge routing', () => {
  const groupIds = ['a', 'b', 'c']
  const taskCountByGroup = new Map([
    ['a', 2],
    ['b', 3],
    ['c', 1],
  ])

  it('keeps dagre waypoints on multi-hop edges and types them techTreeRouted', async () => {
    const { layoutTechTreeFlow } = await import('./checklistTechTreeLayout')
    const res = layoutTechTreeFlow({
      groupIds,
      taskCountByGroup,
      flowEdges: [
        { id: 'e1', from: 'a', to: 'b' },
        { id: 'e2', from: 'b', to: 'c' },
      ],
      collapsedGroupIds: new Set(),
    })
    for (const e of res.edges) {
      expect(['techTreeRouted', 'smoothstep']).toContain(e.type)
      if (e.type === 'techTreeRouted') {
        const pts = (e.data as { routePoints: Array<{ x: number; y: number }> }).routePoints
        expect(pts.length).toBeGreaterThan(2)
        for (const p of pts) {
          expect(Number.isFinite(p.x)).toBe(true)
          expect(Number.isFinite(p.y)).toBe(true)
        }
      }
    }
  })
})

describe('buildRoutedEdgePath', () => {
  it('handles empty and single-point inputs', async () => {
    const { buildRoutedEdgePath } = await import('./checklistTechTreeLayout')
    expect(buildRoutedEdgePath([])).toBe('')
    expect(buildRoutedEdgePath([{ x: 5, y: 6 }])).toBe('M 5,6')
  })

  it('draws a straight two-point segment with no curves', async () => {
    const { buildRoutedEdgePath } = await import('./checklistTechTreeLayout')
    expect(buildRoutedEdgePath([{ x: 0, y: 0 }, { x: 10, y: 0 }])).toBe('M 0,0 L 10,0')
  })

  it('rounds interior bends with quadratics through the waypoint', async () => {
    const { buildRoutedEdgePath } = await import('./checklistTechTreeLayout')
    const d = buildRoutedEdgePath(
      [
        { x: 0, y: 0 },
        { x: 20, y: 0 },
        { x: 20, y: 20 },
      ],
      8,
    )
    expect(d).toContain('Q 20,0')
    expect(d.startsWith('M 0,0')).toBe(true)
    expect(d.endsWith('L 20,20')).toBe(true)
  })

  it('clamps the corner radius on short segments instead of overshooting', async () => {
    const { buildRoutedEdgePath } = await import('./checklistTechTreeLayout')
    // Segments of length 4: radius must clamp to 2, keeping tangent points inside.
    const d = buildRoutedEdgePath(
      [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 4, y: 4 },
      ],
      8,
    )
    expect(d).toContain('L 2,0')
    expect(d).toContain('Q 4,0 4,2')
  })
})

describe('dropHairpinPoints', () => {
  it('removes a needle apex that reverses direction (the stray-line spike)', async () => {
    const { dropHairpinPoints } = await import('./checklistTechTreeLayout')
    // Real prod shape (v2.2302): endpoints ~90px apart, midpoint ~500px below.
    const out = dropHairpinPoints([
      { x: 1782, y: 985 },
      { x: 1825, y: 1469 },
      { x: 1868, y: 960 },
    ])
    expect(out).toEqual([
      { x: 1782, y: 985 },
      { x: 1868, y: 960 },
    ])
  })

  it('keeps a legitimate right-angle dodge around a node', async () => {
    const { dropHairpinPoints } = await import('./checklistTechTreeLayout')
    const dodge = [
      { x: 0, y: 0 },
      { x: 0, y: 120 },
      { x: 300, y: 120 },
      { x: 300, y: 0 },
      { x: 400, y: 0 },
    ]
    expect(dropHairpinPoints(dodge)).toEqual(dodge)
  })

  it('drops zero-length duplicate points, then re-checks the joined turn', async () => {
    const { dropHairpinPoints } = await import('./checklistTechTreeLayout')
    const out = dropHairpinPoints([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 0 },
      { x: 0, y: 1 },
    ])
    // duplicate removed, then the ~180° turn at (100,0) collapses too
    expect(out).toEqual([
      { x: 0, y: 0 },
      { x: 0, y: 1 },
    ])
  })

  it('leaves two-point and empty inputs alone', async () => {
    const { dropHairpinPoints } = await import('./checklistTechTreeLayout')
    expect(dropHairpinPoints([])).toEqual([])
    const two = [
      { x: 0, y: 0 },
      { x: 10, y: 10 },
    ]
    expect(dropHairpinPoints(two)).toEqual(two)
  })
})
