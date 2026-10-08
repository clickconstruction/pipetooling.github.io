import { describe, expect, it } from 'vitest'
import { oneLaborSyncAtATime } from './laborSyncQueue'

const tick = () => new Promise((r) => setTimeout(r, 0))

describe('oneLaborSyncAtATime', () => {
  it('runs syncs of one estimate one after another, in the order they were asked', async () => {
    const log: string[] = []
    const sync = (name: string) => async () => {
      log.push(`${name} start`)
      await tick()
      log.push(`${name} end`)
    }
    await Promise.all([oneLaborSyncAtATime('ce1', sync('a')), oneLaborSyncAtATime('ce1', sync('b')), oneLaborSyncAtATime('ce1', sync('c'))])
    expect(log).toEqual(['a start', 'a end', 'b start', 'b end', 'c start', 'c end'])
  })

  it('lets two estimates sync side by side', async () => {
    const log: string[] = []
    const sync = (name: string) => async () => {
      log.push(`${name} start`)
      await tick()
      log.push(`${name} end`)
    }
    await Promise.all([oneLaborSyncAtATime('ce1', sync('a')), oneLaborSyncAtATime('ce2', sync('b'))])
    expect(log.slice(0, 2)).toEqual(['a start', 'b start'])
  })

  it('a failed sync rejects its own caller and never blocks the next', async () => {
    const failed = oneLaborSyncAtATime('ce3', async () => { throw new Error('read failed') })
    let ran = false
    const after = oneLaborSyncAtATime('ce3', async () => { ran = true })
    await expect(failed).rejects.toThrow('read failed')
    await after
    expect(ran).toBe(true)
  })
})
