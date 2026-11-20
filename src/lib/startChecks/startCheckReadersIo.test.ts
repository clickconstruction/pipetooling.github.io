/**
 * Before we start: the readers stay out of the first download's way. `startCheckReadersIo.ts` is reached from
 * eager screens, so what it imports by name is in the main chunk; v2.8015 imported the permit city list there and
 * took the permit rules with it. The permit read is fetched instead, and only for a seat that may read permits.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../supabase', () => ({ supabase: {} }))
const readPermitsOnSites = vi.fn()
vi.mock('./startCheckPermitsIo', () => ({ readPermitsOnSites }))

import { supabaseStartReadersIo, type ReaderJob } from './startCheckReadersIo'

const job: ReaderJob = { id: 'j1', bidId: null, address: '100 Main St, San Antonio, TX', developmentId: null }
const asked = (role: string | null) => ({ jobs: [job], orderLog: [], trips: [], permits: ['j1'], role, todayYmd: '2026-11-20' })

describe('the start-check readers', () => {
  it('import nothing of the permit rules by name', () => {
    const source = readFileSync(new URL('./startCheckReadersIo.ts', import.meta.url), 'utf8')
    const named = source.split('\n').filter((line) => /^import\b/.test(line) && !/^import type\b/.test(line))
    expect(named.filter((line) => /research\/|startCheckPermitsIo/.test(line))).toEqual([])
    expect(source).toContain("await import('./startCheckPermitsIo')")
  })

  it('fetch the permit read for a seat that reads permits, and hand back what it read', async () => {
    readPermitsOnSites.mockReset()
    readPermitsOnSites.mockResolvedValue(new Map([['j1', { state: 'no_records' }]]))
    for (const role of ['dev', 'estimator']) {
      const reads = await supabaseStartReadersIo.read(asked(role))
      expect(reads.get('j1')).toEqual({ permits: { state: 'no_records' } })
    }
    expect(readPermitsOnSites).toHaveBeenCalledTimes(2)
    expect(readPermitsOnSites).toHaveBeenLastCalledWith([job])
  })

  it('tell a seat that cannot read permits so, without fetching the read', async () => {
    readPermitsOnSites.mockReset()
    const reads = await supabaseStartReadersIo.read(asked('subcontractor'))
    expect(reads.get('j1')).toEqual({ permits: { state: 'cannot' } })
    expect(readPermitsOnSites).not.toHaveBeenCalled()
  })

  it('mark the permit bullets failed when the read fails, and nothing else', async () => {
    readPermitsOnSites.mockReset()
    readPermitsOnSites.mockRejectedValue(new Error('offline'))
    const reads = await supabaseStartReadersIo.read(asked('dev'))
    expect(reads.get('j1')).toEqual({ failed: true })
  })
})
