import { describe, expect, it, vi } from 'vitest'
import { appTzWallTimeMs } from '../../utils/dateUtils'
import { markSent, newPress, type OutboxPress } from './outbox'
import { createOutboxState } from './outboxState'

const DAY = '2026-10-29'
const at = (h: number, m: number) => appTzWallTimeMs(DAY, h, m)

function press(id: string, seq: number, userId = 'u1'): OutboxPress {
  return newPress({ id, seq, kind: 'job-note', userId, pressedAt: at(8, 0), payload: { jobId: 'j1', body: 'Slab is poured.' } })
}

function fakeIo(kept: OutboxPress[] = []) {
  const written: OutboxPress[] = []
  const deleted: string[] = []
  let cleared = 0
  return {
    io: {
      readAll: async () => kept,
      write: async (p: OutboxPress) => {
        written.push(p)
      },
      del: async (id: string) => {
        deleted.push(id)
      },
      clear: async () => {
        cleared += 1
      },
    },
    written,
    deleted,
    cleared: () => cleared,
  }
}

describe('outboxState', () => {
  it('starts empty, puts a press in order and writes it through', () => {
    const { io, written } = fakeIo()
    const s = createOutboxState(io)
    expect(s.presses()).toEqual([])
    s.put(press('b', 2))
    s.put(press('a', 1))
    expect(s.presses().map((p) => p.id)).toEqual(['a', 'b'])
    expect(written.map((p) => p.id)).toEqual(['b', 'a'])
  })

  it('notifies on every change and bumps its version', () => {
    const s = createOutboxState(fakeIo().io)
    const cb = vi.fn()
    const unsub = s.subscribe(cb)
    const v0 = s.version()
    s.put(press('a', 1))
    expect(cb).toHaveBeenCalledTimes(1)
    expect(s.version()).toBe(v0 + 1)
    s.remove('a')
    expect(cb).toHaveBeenCalledTimes(2)
    s.remove('a') // nothing to remove: no notice
    expect(cb).toHaveBeenCalledTimes(2)
    unsub()
    s.put(press('b', 2))
    expect(cb).toHaveBeenCalledTimes(2)
  })

  it('load reads the device’s presses for this person, pruned, and drops what prune left out from the device', async () => {
    const mine = press('a', 1)
    const someoneElses = press('o', 2, 'u2')
    const staleSent = markSent(press('s', 3), {}, appTzWallTimeMs('2026-10-20', 9, 0))
    const { io, deleted } = fakeIo([mine, someoneElses, staleSent])
    const s = createOutboxState(io)
    await s.load('u1', at(10, 0))
    expect(s.userId()).toBe('u1')
    expect(s.presses().map((p) => p.id)).toEqual(['a'])
    expect(deleted.sort()).toEqual(['o', 's'])
  })

  it('a press made while the load was out stays beside the device’s', async () => {
    const { io } = fakeIo([press('a', 1)])
    const s = createOutboxState(io)
    const loading = s.load('u1', at(10, 0))
    s.put(press('b', 2))
    await loading
    expect(s.presses().map((p) => p.id)).toEqual(['a', 'b'])
  })

  it('replace writes what changed and deletes what is gone', () => {
    const { io, written, deleted } = fakeIo()
    const s = createOutboxState(io)
    const a = press('a', 1)
    const b = press('b', 2)
    s.put(a)
    s.put(b)
    written.length = 0
    const sentA = markSent(a, {}, at(9, 0))
    s.replace([sentA])
    expect(s.presses()).toEqual([sentA])
    expect(written.map((p) => p.id)).toEqual(['a'])
    expect(deleted).toEqual(['b'])
  })

  it('clear drops memory and the device, and forgets whose presses they were', async () => {
    const f = fakeIo()
    const s = createOutboxState(f.io)
    await s.load('u1', at(10, 0))
    s.put(press('a', 1))
    await s.clear()
    expect(s.presses()).toEqual([])
    expect(s.userId()).toBeNull()
    expect(f.cleared()).toBe(1)
  })
})
