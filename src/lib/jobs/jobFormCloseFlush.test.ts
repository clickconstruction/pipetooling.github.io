import { describe, expect, it } from 'vitest'
import { flushDirtySliceForClose } from './jobFormCloseFlush'

const instantSleep = () => Promise.resolve()

describe('flushDirtySliceForClose', () => {
  it('returns clean without saving when nothing is dirty', async () => {
    let saves = 0
    const outcome = await flushDirtySliceForClose({
      isRunning: () => false,
      isDirty: () => false,
      runSave: async () => {
        saves++
        return true
      },
      sleep: instantSleep,
    })
    expect(outcome).toBe('clean')
    expect(saves).toBe(0)
  })

  it('saves a dirty slice and reports saved', async () => {
    let dirty = true
    let saves = 0
    const outcome = await flushDirtySliceForClose({
      isRunning: () => false,
      isDirty: () => dirty,
      runSave: async () => {
        saves++
        dirty = false
        return true
      },
      sleep: instantSleep,
    })
    expect(outcome).toBe('saved')
    expect(saves).toBe(1)
  })

  it('reports failed when the save fails, without retrying forever', async () => {
    let saves = 0
    const outcome = await flushDirtySliceForClose({
      isRunning: () => false,
      isDirty: () => true,
      runSave: async () => {
        saves++
        return false
      },
      sleep: instantSleep,
    })
    expect(outcome).toBe('failed')
    expect(saves).toBe(1)
  })

  it('waits for an in-flight run that leaves the slice clean', async () => {
    let running = true
    let ticks = 0
    let saves = 0
    const outcome = await flushDirtySliceForClose({
      isRunning: () => running,
      isDirty: () => running, // persisted once the in-flight run finishes
      runSave: async () => {
        saves++
        return true
      },
      sleep: async () => {
        ticks++
        if (ticks >= 3) running = false
      },
    })
    expect(outcome).toBe('clean')
    expect(saves).toBe(0)
    expect(ticks).toBeGreaterThanOrEqual(3)
  })

  it('saves again when the first pass leaves the slice dirty (queued follow-up)', async () => {
    let saves = 0
    const outcome = await flushDirtySliceForClose({
      isRunning: () => false,
      isDirty: () => saves < 2,
      runSave: async () => {
        saves++
        return true
      },
      sleep: instantSleep,
    })
    expect(outcome).toBe('saved')
    expect(saves).toBe(2)
  })

  it('waits out an in-flight run, then saves remaining dirt', async () => {
    let running = true
    let dirty = true
    let saves = 0
    const outcome = await flushDirtySliceForClose({
      isRunning: () => running,
      isDirty: () => dirty,
      runSave: async () => {
        saves++
        dirty = false
        return true
      },
      sleep: async () => {
        running = false
      },
    })
    expect(outcome).toBe('saved')
    expect(saves).toBe(1)
  })
})
