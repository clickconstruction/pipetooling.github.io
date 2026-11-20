// @vitest-environment jsdom
/**
 * The Schedule look's press (punch list #382, the audit): a write, then a read. The two fail apart. A write that
 * fails is thrown to the caller, who says the press was not kept. A read that fails after a write that landed is not
 * thrown: the Go is standing, so the hook keeps the failure for the look's retry panel and the caller closes its
 * panel as after any write. Every job and day here is made up.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { memoryStart, memoryStartChecksIo, type MemoryStart } from '../test/startChecksMemoryIo'
import type { StartChecksIo } from '../lib/startChecks/startChecksIo'
import { useSiteStartChecks } from './useSiteStartChecks'

vi.mock('../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

const JOBS = [{ id: 'j1', label: 'J2101', part: 'Lodge' }]

function seeded(): MemoryStart {
  return memoryStart({
    lines: [{ fixtureId: 'top', jobId: 'j1', name: 'Top Out', order: 1, finished: false, window: ['2026-12-01', '2026-12-12'] }],
    rows: {
      bullets: [{ id: 'b1', job_id: 'j1', fixture_id: 'top', sort_order: 1, words: 'Power is on for our tools.', waits_on: 'them', wants_photo: false, shown_to_gc: true, by_day: null, reads: null, hand_ok: false, hand_ok_at: null, hand_ok_by_name: '', template_id: null, removed_at: null, created_at: '2026-11-10T15:00:00Z' }],
      marks: [],
      asks: [],
      theirDays: [],
      decisions: [],
      arrivals: [],
    },
  })
}

/** The memory io, with the signal lost between a Go and the read after it, once. */
function dropsTheReadAfterAGo(db: MemoryStart): StartChecksIo {
  const io = memoryStartChecksIo(db)
  let dropNextRead = false
  return {
    ...io,
    decide: async (...args) => {
      await io.decide(...args)
      dropNextRead = true
    },
    readRows: async (jobIds) => {
      if (dropNextRead) {
        dropNextRead = false
        throw new TypeError('Failed to fetch')
      }
      return io.readRows(jobIds)
    },
  }
}

async function mount(io: StartChecksIo) {
  const hook = renderHook(() => useSiteStartChecks({ developmentId: 'dev-1', jobs: JOBS, contact: 'Ray', far: false, enabled: true, io }))
  await waitFor(() => expect(hook.result.current.stages).toHaveLength(1))
  return hook
}

afterEach(cleanup)

describe('useSiteStartChecks press', () => {
  it('a Go that landed is not thrown when the read after it fails: the failure is kept for Retry, and a read again shows the Go', async () => {
    const db = seeded()
    const { result } = await mount(dropsTheReadAfterAGo(db))
    let thrown: unknown = null
    await act(async () => {
      await result.current.press((io) => io.decide('top', 'go', [], null)).catch((e: unknown) => {
        thrown = e
      })
    })
    expect(thrown).toBeNull()
    expect(db.rows.decisions).toHaveLength(1)
    expect(result.current.failure).toMatchObject({ kind: 'network' })
    expect(result.current.shows).toBe(true)
    // Retry is the look's reload. A read that lands clears the failure and shows the one Go.
    act(() => result.current.reload())
    await waitFor(() => expect(result.current.failure).toBeNull())
    expect(result.current.rows.decisions.map((d) => d.kind)).toEqual(['go'])
    expect(db.calls).toEqual(['decide'])
  })

  it('a write that fails is still thrown to the caller, and no read failure is kept', async () => {
    const db = seeded()
    const { result } = await mount(memoryStartChecksIo(db))
    db.failNext = 'The job is shut until its papers are signed.'
    let thrown: unknown = null
    await act(async () => {
      await result.current.press((io) => io.decide('top', 'go', [], null)).catch((e: unknown) => {
        thrown = e
      })
    })
    expect((thrown as Error).message).toBe('The job is shut until its papers are signed.')
    expect(result.current.failure).toBeNull()
    expect(db.rows.decisions).toHaveLength(0)
  })

  it('a press whose read lands clears a read failure left standing', async () => {
    const db = seeded()
    const { result } = await mount(dropsTheReadAfterAGo(db))
    await act(async () => {
      await result.current.press((io) => io.decide('top', 'go', [], null))
    })
    expect(result.current.failure).not.toBeNull()
    const goId = db.rows.decisions[0]?.id as string
    await act(async () => {
      await result.current.press((io) => io.takeBackDecision(goId))
    })
    expect(result.current.failure).toBeNull()
    expect(result.current.rows.decisions.map((d) => !!d.taken_back_at)).toEqual([true])
  })
})
