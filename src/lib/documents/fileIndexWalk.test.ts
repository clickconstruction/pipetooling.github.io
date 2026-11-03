import { describe, expect, it } from 'vitest'
import { walkUp, WALK_MAX, type FileHome, type HomeAt } from '../../../supabase/functions/_shared/fileIndexKernel'

/**
 * How far a walk climbs (punch list #240, v2.6403): a plan export sat nine folders down, past the old limit of eight, so
 * its files read *Not under a job* with their path cut off, though the bid held the folder at the top of them.
 */
const BID: FileHome = { kind: 'bid', id: 'b1', number: '1', name: 'Made-up tower', customerId: null }
const chain = (depth: number): Map<string, { name: string; parent: string | null }> => {
  const folders = new Map<string, { name: string; parent: string | null }>()
  for (let i = 1; i <= depth; i++) folders.set(`f${i}`, { name: `level ${i}`, parent: i === 1 ? 'home' : `f${i - 1}` })
  return folders
}
const reader = (folders: Map<string, { name: string; parent: string | null }>) => async (id: string) => folders.get(id) ?? { name: '', parent: null }

describe('walkUp, climbing', () => {
  it('reaches a home nine folders down and names every folder between, top first', async () => {
    const homes = new Map<string, HomeAt>([['home', { home: BID, via: null }]])
    const walk = await walkUp('f9', homes, 'root', reader(chain(9)))
    expect(walk.home).toEqual(BID)
    expect(walk.names).toHaveLength(9)
    expect(walk.names[0]).toBe('level 1')
    expect(walk.names[8]).toBe('level 9')
    expect(walk.path.startsWith('level 1 › level 2')).toBe(true)
  })
  it('still gives up past the limit, so a loop in the folders cannot walk forever', async () => {
    const looped = new Map([
      ['a', { name: 'a', parent: 'b' }],
      ['b', { name: 'b', parent: 'a' }],
    ])
    let reads = 0
    const walk = await walkUp('a', new Map(), 'root', async (id) => {
      reads += 1
      return looped.get(id)!
    })
    expect(walk.home).toBeNull()
    expect(reads).toBe(WALK_MAX)
  })
  it('climbs at least sixteen folders', () => {
    expect(WALK_MAX).toBeGreaterThanOrEqual(16)
  })
})
