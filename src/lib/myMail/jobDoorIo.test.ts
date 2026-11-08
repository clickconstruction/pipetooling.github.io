import { describe, expect, it, vi } from 'vitest'
import type { MyMailListOk, MyMailRow } from './contract'
import { readJobDoor } from './jobDoorIo'

/** The door's read (punch list #263 PR A): nothing to draw for a switch that is off, a refusal or no search; the rows otherwise. */
const row: MyMailRow = {
  gmailId: 'm1',
  threadId: 't1',
  direction: 'in',
  who: { name: 'Dale Okafor', address: 'dale@ridgeway.example' },
  subject: 'Re: 4 Elm Ct water heater',
  snippet: '',
  at: '2026-11-08T15:12:00Z',
  files: 0,
  folded: null,
  tagged: null,
  guess: null,
  inMessages: null,
}
const ok: MyMailListOk = { ok: true, address: 'grace@clickplumbing.example', rows: [row], nextPageToken: null, folded: 0 }

describe('readJobDoor', () => {
  it('asks the switch, then reads To tag searched on the addresses and the number, and answers the rows with the search', async () => {
    const list = vi.fn(async () => ok)
    const read = await readJobDoor(['dale@ridgeway.example'], 'JP1077', { setting: async () => ({ on: true }), io: { list } })
    expect(list).toHaveBeenCalledWith({ view: 'toTag', q: 'from:dale@ridgeway.example OR to:dale@ridgeway.example OR "JP1077"' })
    expect(read).toEqual({ query: 'from:dale@ridgeway.example OR to:dale@ridgeway.example OR "JP1077"', rows: [row] })
  })

  it('reads nothing when the switch is off, and nothing when there is nothing to search for', async () => {
    const list = vi.fn(async () => ok)
    const setting = vi.fn(async () => ({ on: false }))
    expect(await readJobDoor(['dale@ridgeway.example'], 'JP1077', { setting, io: { list } })).toBeNull()
    expect(list).not.toHaveBeenCalled()
    expect(await readJobDoor([], '', { setting: async () => ({ on: true }), io: { list } })).toBeNull()
    expect(list).not.toHaveBeenCalled()
  })

  it('answers no line on the function’s refusal, whatever its kind, and throws a lost signal as it is', async () => {
    const refused = vi.fn(async () => ({ ok: false as const, error: 'offWorkspace' as const, words: 'Google will not read this address for the app.' }))
    expect(await readJobDoor(['dale@ridgeway.example'], 'JP1077', { setting: async () => ({ on: true }), io: { list: refused } })).toBeNull()
    const lost = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    })
    await expect(readJobDoor(['dale@ridgeway.example'], 'JP1077', { setting: async () => ({ on: true }), io: { list: lost } })).rejects.toThrow('Failed to fetch')
  })
})
