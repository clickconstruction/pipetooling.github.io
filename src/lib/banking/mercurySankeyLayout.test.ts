import { describe, expect, it } from 'vitest'
import { formatSankeyUsd, layoutSankey, type SankeyInput } from './mercurySankeyLayout'

const OPTS = { width: 900, height: 400 }

function threeColInput(): SankeyInput {
  return {
    nodes: [
      { id: 'in', col: 0, label: 'In', value: 100, tone: 'ink' },
      { id: 'a', col: 1, label: 'A', value: 60, tone: 'series1' },
      { id: 'b', col: 1, label: 'B', value: 40, tone: 'series2' },
      { id: 'a1', col: 2, label: 'A1', value: 60, tone: 'series1' },
      { id: 'b1', col: 2, label: 'B1', value: 40, tone: 'series2' },
    ],
    links: [
      { source: 'in', target: 'a', value: 60 },
      { source: 'in', target: 'b', value: 40 },
      { source: 'a', target: 'a1', value: 60 },
      { source: 'b', target: 'b1', value: 40 },
    ],
  }
}

describe('layoutSankey', () => {
  it('node heights are proportional to value on a shared scale', () => {
    const layout = layoutSankey(threeColInput(), OPTS)!
    const n = Object.fromEntries(layout.nodes.map((x) => [x.id, x]))
    expect(n.a!.h / n.b!.h).toBeCloseTo(60 / 40, 5)
    expect(n.in!.h).toBeCloseTo(n.a!.h + n.b!.h, 5)
  })

  it('columns advance left to right and last column labels sit on the right', () => {
    const layout = layoutSankey(threeColInput(), OPTS)!
    const n = Object.fromEntries(layout.nodes.map((x) => [x.id, x]))
    expect(n.in!.x).toBeLessThan(n.a!.x)
    expect(n.a!.x).toBeLessThan(n.a1!.x)
    expect(n.in!.labelSide).toBe('left')
    expect(n.a1!.labelSide).toBe('right')
  })

  it('ribbons stack without overlap: link offsets tile each node edge exactly', () => {
    const layout = layoutSankey(threeColInput(), OPTS)!
    const n = Object.fromEntries(layout.nodes.map((x) => [x.id, x]))
    const fromIn = layout.links.filter((l) => l.sourceId === 'in')
    // Both ribbons leave the `in` node; their combined value covers the node.
    const total = fromIn.reduce((s, l) => s + l.value, 0)
    expect(total).toBe(100)
    // The first path starts at the node top edge, the second lower down.
    const y = (path: string) => Number(/M[\d.]+,([\d.]+)/.exec(path)![1])
    const ys = fromIn.map((l) => y(l.path)).sort((a, b) => a - b)
    expect(ys[0]).toBeCloseTo(n.in!.y, 1)
    expect(ys[1]!).toBeGreaterThan(ys[0]!)
  })

  it('drops zero-value nodes and dangling links; returns null when nothing remains', () => {
    const layout = layoutSankey(
      {
        nodes: [
          { id: 'in', col: 0, label: 'In', value: 10, tone: 'ink' },
          { id: 'zero', col: 1, label: 'Z', value: 0, tone: 'neutral' },
          { id: 'a', col: 1, label: 'A', value: 10, tone: 'series1' },
        ],
        links: [
          { source: 'in', target: 'zero', value: 0 },
          { source: 'in', target: 'missing', value: 5 },
          { source: 'in', target: 'a', value: 10 },
        ],
      },
      OPTS,
    )!
    expect(layout.nodes.map((n) => n.id).sort()).toEqual(['a', 'in'])
    expect(layout.links).toHaveLength(1)
    expect(layoutSankey({ nodes: [], links: [] }, OPTS)).toBeNull()
    expect(
      layoutSankey({ nodes: [{ id: 'x', col: 0, label: 'X', value: 5, tone: 'ink' }], links: [] }, OPTS),
    ).toBeNull()
  })

  it('link tone defaults to the source node tone and can be overridden', () => {
    const layout = layoutSankey(threeColInput(), OPTS)!
    expect(layout.links.find((l) => l.sourceId === 'a')!.tone).toBe('series1')
    const withTone = layoutSankey(
      {
        nodes: [
          { id: 'in', col: 0, label: 'In', value: 10, tone: 'ink' },
          { id: 'a', col: 1, label: 'A', value: 10, tone: 'series1' },
        ],
        links: [{ source: 'in', target: 'a', value: 10, tone: 'warn' }],
      },
      OPTS,
    )!
    expect(withTone.links[0]!.tone).toBe('warn')
  })
})

describe('formatSankeyUsd', () => {
  it('picks units by magnitude', () => {
    expect(formatSankeyUsd(3220323)).toBe('$3.22M')
    expect(formatSankeyUsd(41011)).toBe('$41K')
    expect(formatSankeyUsd(3585)).toBe('$3,585')
    expect(formatSankeyUsd(-3585)).toBe('$3,585')
  })
})
