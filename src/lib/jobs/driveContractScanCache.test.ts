import { describe, expect, it, vi } from 'vitest'
import { DRIVE_SCAN_TTL_MS, createDriveScanCache } from './driveContractScanCache'
import type { DriveScanFile } from './driveContractMatch'

const file = { id: 'f1', name: 'Contract.pdf' } as DriveScanFile

describe('driveContractScanCache', () => {
  it('shares one scan between everyone who asks while it runs, then keeps the answer for 15 minutes', async () => {
    let t = 1_000
    const invoke = vi.fn(async () => ({ ok: true, files: [file] }))
    const cache = createDriveScanCache(invoke, () => t)
    const [a, b] = await Promise.all([cache.get(), cache.get()])
    expect(a).toEqual([file])
    expect(b).toBe(a)
    expect(invoke).toHaveBeenCalledTimes(1)

    t += DRIVE_SCAN_TTL_MS - 1
    await cache.get()
    expect(invoke).toHaveBeenCalledTimes(1)
    t += 2
    await cache.get()
    expect(invoke).toHaveBeenCalledTimes(2)
  })

  it('never remembers a failure, so the next open tries again', async () => {
    const invoke = vi.fn().mockResolvedValueOnce({ ok: false, files: [] }).mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce({ ok: true, files: [file] })
    const cache = createDriveScanCache(invoke)
    expect(await cache.get()).toBeNull()
    expect(await cache.get()).toBeNull()
    expect(await cache.get()).toEqual([file])
    expect(invoke).toHaveBeenCalledTimes(3)
  })

  it('clear() forgets the answer', async () => {
    const invoke = vi.fn(async () => ({ ok: true, files: [file] }))
    const cache = createDriveScanCache(invoke)
    await cache.get()
    cache.clear()
    await cache.get()
    expect(invoke).toHaveBeenCalledTimes(2)
  })
})
