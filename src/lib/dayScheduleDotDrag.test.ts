import { describe, expect, it } from 'vitest'
import {
  boundaryDotsFromBlocks,
  dotMinutesToPgTime,
  resolveDotDrag,
  separateSharedDot,
  snapDotMinutes,
  type BoundaryDot,
  type DotBlock,
} from './dayScheduleDotDrag'

const A: DotBlock = { blockId: 'a', startMin: 8 * 60, endMin: 12 * 60 }
const B: DotBlock = { blockId: 'b', startMin: 12 * 60, endMin: 16 * 60 }
const GAP_B: DotBlock = { blockId: 'b', startMin: 13 * 60, endMin: 16 * 60 }

describe('boundaryDotsFromBlocks', () => {
  it('separate blocks get start+end dots each', () => {
    const dots = boundaryDotsFromBlocks([A, GAP_B])
    expect(dots.map((d) => d.kind)).toEqual(['start', 'end', 'start', 'end'])
  })

  it('touching blocks share one dot', () => {
    const dots = boundaryDotsFromBlocks([B, A]) // order independent
    expect(dots.map((d) => d.kind)).toEqual(['start', 'shared', 'end'])
    const shared = dots[1] as Extract<BoundaryDot, { kind: 'shared' }>
    expect(shared.beforeBlockId).toBe('a')
    expect(shared.afterBlockId).toBe('b')
    expect(shared.min).toBe(12 * 60)
  })

  it('overlapping blocks never share a dot', () => {
    const dots = boundaryDotsFromBlocks([
      { blockId: 'a', startMin: 480, endMin: 720 },
      { blockId: 'b', startMin: 700, endMin: 900 },
    ])
    expect(dots.map((d) => d.kind)).toEqual(['start', 'end', 'start', 'end'])
  })
})

describe('snapDotMinutes', () => {
  it('snaps to 15-minute steps', () => {
    expect(snapDotMinutes(487)).toBe(480)
    expect(snapDotMinutes(488)).toBe(495)
  })
})

describe('resolveDotDrag', () => {
  it('drags an end dot right in 15m steps', () => {
    const r = resolveDotDrag({ kind: 'end', blockId: 'a', min: 720 }, 745, [A, GAP_B])
    expect(r.dotMin).toBe(750)
    expect(r.updates.get('a')).toEqual({ startMin: 480, endMin: 750 })
  })

  it('end dot clamps at the next block start (merge point), never overlapping', () => {
    const r = resolveDotDrag({ kind: 'end', blockId: 'a', min: 720 }, 1000, [A, GAP_B])
    expect(r.dotMin).toBe(GAP_B.startMin)
    expect(r.updates.get('a')).toEqual({ startMin: 480, endMin: GAP_B.startMin })
  })

  it('start dot clamps at the previous block end', () => {
    const r = resolveDotDrag({ kind: 'start', blockId: 'b', min: 780 }, 0, [A, GAP_B])
    expect(r.dotMin).toBe(A.endMin)
  })

  it('start dot cannot pass its own end minus 30m', () => {
    const r = resolveDotDrag({ kind: 'start', blockId: 'b', min: 780 }, 16 * 60, [A, GAP_B])
    expect(r.dotMin).toBe(16 * 60 - 30)
  })

  it('rail bounds clamp (04:00–20:00)', () => {
    const r = resolveDotDrag({ kind: 'start', blockId: 'a', min: 480 }, 0, [A])
    expect(r.dotMin).toBe(4 * 60)
    const r2 = resolveDotDrag({ kind: 'end', blockId: 'a', min: 720 }, 24 * 60, [A])
    expect(r2.dotMin).toBe(20 * 60)
  })

  it('shared dot moves both edges together and keeps 30m on each side', () => {
    const dot: BoundaryDot = { kind: 'shared', beforeBlockId: 'a', afterBlockId: 'b', min: 720 }
    const r = resolveDotDrag(dot, 900, [A, B])
    expect(r.dotMin).toBe(900)
    expect(r.updates.get('a')).toEqual({ startMin: 480, endMin: 900 })
    expect(r.updates.get('b')).toEqual({ startMin: 900, endMin: 960 })
    const clamped = resolveDotDrag(dot, 24 * 60, [A, B])
    expect(clamped.dotMin).toBe(B.endMin - 30)
  })

  it('no-op drag returns empty updates', () => {
    const r = resolveDotDrag({ kind: 'end', blockId: 'a', min: 720 }, 722, [A, GAP_B])
    expect(r.updates.size).toBe(0)
    expect(r.dotMin).toBe(720)
  })
})

describe('separateSharedDot', () => {
  const dot: Extract<BoundaryDot, { kind: 'shared' }> = {
    kind: 'shared',
    beforeBlockId: 'a',
    afterBlockId: 'b',
    min: 720,
  }

  it('later block jumps +15m without extending its end', () => {
    expect(separateSharedDot(dot, [A, B])).toEqual({ blockId: 'b', startMin: 735, endMin: 960 })
  })

  it('refuses when the later block would drop below 30 minutes', () => {
    const shortB: DotBlock = { blockId: 'b', startMin: 720, endMin: 750 }
    expect(separateSharedDot(dot, [A, shortB])).toBeNull()
  })
})

describe('dotMinutesToPgTime', () => {
  it('formats HH:MM:SS', () => {
    expect(dotMinutesToPgTime(465)).toBe('07:45:00')
  })
})
