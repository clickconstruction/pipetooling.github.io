import { afterEach, describe, expect, it, vi } from 'vitest'
import { owedStore } from './owedStore'

const OWED = { what: 'the start date', byYmd: '2026-10-05', byWords: null, markedBy: 'Rosa', markedAt: '2026-09-26T19:30:00.000Z' }

afterEach(() => owedStore.cancel(owedStore.get().contactId))

describe('owedStore', () => {
  it('holds one person’s settle, tells its readers, and ends it on Not done yet', () => {
    const heard = vi.fn()
    const stop = owedStore.subscribe(heard)
    owedStore.start('priya', OWED)
    expect(owedStore.get()).toMatchObject({ contactId: 'priya', owed: OWED })
    owedStore.cancel('greg')
    expect(owedStore.get().contactId).toBe('priya')
    owedStore.cancel('priya')
    expect(owedStore.get()).toMatchObject({ contactId: null, owed: null })
    expect(heard).toHaveBeenCalledTimes(2)
    stop()
  })

  it('moves its version when a settle lands, so the thread reads again', () => {
    const before = owedStore.get().version
    owedStore.start('priya', OWED)
    owedStore.landed()
    expect(owedStore.get()).toMatchObject({ contactId: null, owed: null, version: before + 1 })
  })

  it('counts the boxes there to take a settle, each once', () => {
    const before = owedStore.get().takers
    const away = owedStore.addTaker()
    expect(owedStore.get().takers).toBe(before + 1)
    away()
    away()
    expect(owedStore.get().takers).toBe(before)
  })
})

describe('owedStore: the open thread’s owed', () => {
  it('publishes what cut 2 read for the open person, and forgets it when the thread closes', () => {
    owedStore.publish('priya', OWED)
    expect(owedStore.get().open).toEqual({ contactId: 'priya', owed: OWED })
    owedStore.unpublish('greg')
    expect(owedStore.get().open?.contactId).toBe('priya')
    owedStore.unpublish('priya')
    expect(owedStore.get().open).toBeNull()
  })

  it('moves the version when the box writes what we owe some other way', () => {
    const before = owedStore.get().version
    owedStore.changed()
    expect(owedStore.get().version).toBe(before + 1)
  })
})
