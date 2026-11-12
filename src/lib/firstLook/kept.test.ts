import { describe, expect, it } from 'vitest'
import { KEPT_MAX_AGE_MS, createMemoryKeptStore, openKeptStore, type KeptFile } from './kept'

const file = (id: string, code: string, keptAt: number): KeptFile => ({ id, code, kind: 'photo', name: `${id}.jpg`, mime: 'image/jpeg', blob: new Blob(['x']), keptAt, seconds: null, fileId: null, location: null, resumed: 0, pieceFails: 0, startedAt: null })

describe('what the phone keeps', () => {
  it('lists a link\'s files oldest first, and no other link\'s', async () => {
    const store = createMemoryKeptStore()
    await store.put(file('b', 'aaaaaaaaaa', 20))
    await store.put(file('a', 'aaaaaaaaaa', 10))
    await store.put(file('c', 'bbbbbbbbbb', 5))
    expect((await store.list('aaaaaaaaaa')).map((f) => f.id)).toEqual(['a', 'b'])
    expect((await store.list('bbbbbbbbbb')).map((f) => f.id)).toEqual(['c'])
    expect(await store.list('cccccccccc')).toEqual([])
  })

  it('remembers what the next try needs', async () => {
    const store = createMemoryKeptStore()
    await store.put(file('a', 'aaaaaaaaaa', 10))
    await store.patch('a', { fileId: 'f1', location: 'loc', resumed: 2 })
    await store.patch('missing', { fileId: 'x' })
    expect((await store.list('aaaaaaaaaa'))[0]).toMatchObject({ fileId: 'f1', location: 'loc', resumed: 2 })
  })

  it('drops a sent file, and sweeps what is older than a week', async () => {
    const store = createMemoryKeptStore()
    const now = 1_000_000_000_000
    await store.put(file('old', 'aaaaaaaaaa', now - KEPT_MAX_AGE_MS - 1))
    await store.put(file('new', 'aaaaaaaaaa', now - 1000))
    await store.put(file('sent', 'aaaaaaaaaa', now - 500))
    await store.remove('sent')
    await store.sweep(now - KEPT_MAX_AGE_MS)
    expect((await store.list('aaaaaaaaaa')).map((f) => f.id)).toEqual(['new'])
  })

  it('a browser with no lasting store keeps the files in memory and says so', async () => {
    const store = await openKeptStore(async () => null)
    expect(store.lasting).toBe(false)
    await store.put(file('a', 'aaaaaaaaaa', 1))
    expect((await store.list('aaaaaaaaaa')).map((f) => f.id)).toEqual(['a'])
  })
})
