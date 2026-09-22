import { describe, expect, it, vi } from 'vitest'
import { DRIVE_SCAN_TTL_MS, createDriveScanCache } from './driveContractScanCache'
import type { DriveScanFile } from './driveContractMatch'

const file = { id: 'f1', name: 'Contract.pdf' } as DriveScanFile
const answer = { ok: true, files: [file], scannedAt: '2026-09-22T09:00:00.000Z', cached: false, jobFolders: 273, scanned: 123 }

describe('driveContractScanCache', () => {
  it('shares one scan between everyone who asks while it runs, then keeps the answer for 15 minutes', async () => {
    let t = 1_000
    const invoke = vi.fn(async () => answer)
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
    const invoke = vi.fn().mockResolvedValueOnce({ ...answer, ok: false, files: [], error: 'Drive is not connected yet' }).mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce(answer)
    const cache = createDriveScanCache(invoke)
    expect(await cache.get()).toBeNull()
    expect(cache.lastError()).toBe('Drive is not connected yet')
    expect(await cache.get()).toBeNull()
    expect(cache.lastError()).toBe('network')
    expect(await cache.get()).toEqual([file])
    expect(cache.lastError()).toBeNull()
    expect(invoke).toHaveBeenCalledTimes(3)
  })

  it('clear() forgets the answer', async () => {
    const invoke = vi.fn(async () => answer)
    const cache = createDriveScanCache(invoke)
    await cache.get()
    cache.clear()
    await cache.get()
    expect(invoke).toHaveBeenCalledTimes(2)
  })

  it('held() carries the scan\'s own stamp and counts; refresh() asks the function to scan again now (v2.3709)', async () => {
    const invoke = vi.fn(async () => answer)
    const cache = createDriveScanCache(invoke)
    expect(cache.held()).toBeNull()
    await cache.get()
    expect(cache.held()).toEqual({ files: [file], scannedAt: '2026-09-22T09:00:00.000Z', jobFolders: 273, scanned: 123 })
    expect(invoke).toHaveBeenLastCalledWith({ force: false })
    await cache.refresh()
    expect(invoke).toHaveBeenCalledTimes(2)
    expect(invoke).toHaveBeenLastCalledWith({ force: true })
    // While a refresh runs, another asker joins it rather than starting a third scan.
    const slow = vi.fn(() => new Promise<typeof answer>((r) => setTimeout(() => r(answer), 5)))
    const shared = createDriveScanCache(slow)
    await Promise.all([shared.refresh(), shared.get()])
    expect(slow).toHaveBeenCalledTimes(1)
  })
})
