// @vitest-environment jsdom
/**
 * The Dashboard's Lien desk card names the leader for the office (v2.8372, punch list #423): one read of one row, by
 * the id the Board's rule picks, named as the desk names him. No id, no read. A failed read, or a person the desk
 * would not name, leaves the card on *waiting on the leader*. A name read for an older id is never shown.
 */
import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useLienDeskLeaderName, type LienDeskLeaderNameIo } from './useLienDeskLeaderName'

// Made-up people.
const row = (id: string, name: string, over: Record<string, unknown> = {}) => ({ id, name, role: 'master_technician', archived_at: null, is_digital_twin: false, is_sample: false, is_walk_tester: false, ...over })

const ioOf = (rows: Record<string, ReturnType<typeof row> | null>): LienDeskLeaderNameIo & { person: ReturnType<typeof vi.fn> } => ({
  person: vi.fn(async (id: string) => rows[id] ?? null),
})

describe('useLienDeskLeaderName', () => {
  it('reads one row by the id and gives the name the desk gives', async () => {
    const io = ioOf({ 'u-sam': row('u-sam', 'Sam') })
    const { result } = renderHook(() => useLienDeskLeaderName('u-sam', io))
    expect(result.current).toBeNull()
    await waitFor(() => expect(result.current).toBe('Sam'))
    expect(io.person).toHaveBeenCalledTimes(1)
    expect(io.person).toHaveBeenCalledWith('u-sam')
  })

  it('makes no read without an id: the leader’s own Dashboard says wait on you', () => {
    const io = ioOf({})
    const { result } = renderHook(() => useLienDeskLeaderName(null, io))
    expect(result.current).toBeNull()
    expect(io.person).not.toHaveBeenCalled()
  })

  it('stays null for a person the desk would not name', async () => {
    const io = ioOf({ 'u-old': row('u-old', 'Former', { archived_at: '2026-01-02T00:00:00Z' }) })
    const { result } = renderHook(() => useLienDeskLeaderName('u-old', io))
    await waitFor(() => expect(io.person).toHaveBeenCalled())
    await Promise.resolve()
    expect(result.current).toBeNull()
  })

  it('stays null when the read fails', async () => {
    const io: LienDeskLeaderNameIo = { person: vi.fn(async () => { throw new Error('offline') }) }
    const { result } = renderHook(() => useLienDeskLeaderName('u-sam', io))
    await waitFor(() => expect(io.person).toHaveBeenCalled())
    await Promise.resolve()
    expect(result.current).toBeNull()
  })

  it('never shows a name read for an older id', async () => {
    let release: (v: ReturnType<typeof row>) => void = () => {}
    const slow = new Promise<ReturnType<typeof row>>((r) => { release = r })
    const io: LienDeskLeaderNameIo = { person: vi.fn((id: string) => (id === 'u-sam' ? slow : Promise.resolve(row('u-ana', 'Ana')))) }
    const { result, rerender } = renderHook(({ id }: { id: string | null }) => useLienDeskLeaderName(id, io), { initialProps: { id: 'u-sam' as string | null } })
    rerender({ id: 'u-ana' })
    await waitFor(() => expect(result.current).toBe('Ana'))
    release(row('u-sam', 'Sam'))
    await slow
    await Promise.resolve()
    expect(result.current).toBe('Ana')
  })
})
