import { describe, expect, it, vi } from 'vitest'
import { recordMessageIds, walkHistory, type HistoryPage, type Took } from './historyWalk'

const rec = (id: string, ...messages: string[]) => ({ id, messagesAdded: messages.map((m) => ({ message: { id: m } })) })
/** A record of labels put on messages after they arrived: `[message id, the labels added]`. */
const labelled = (id: string, ...changes: [string, string[]][]) => ({ id, labelsAdded: changes.map(([m, labelIds]) => ({ message: { id: m }, labelIds })) })

/** Gmail's history as pages by token, and the run's takes, with a failure where asked. */
function box(pages: HistoryPage[], failOn?: string) {
  const page = vi.fn(async (token?: string) => pages[token ? Number(token) : 0]!)
  const taken: string[] = []
  const take = vi.fn(async (id: string): Promise<Took> => {
    if (id === failOn) throw new Error(`Writing ${id} failed`)
    taken.push(id)
    return id.startsWith('left') ? 'left' : 'taken'
  })
  return { page, take, taken }
}

describe('recordMessageIds: what one record brought to the Inbox (v2.5982)', () => {
  it('is the messages added, then the ones given the Inbox label later, each once', () => {
    expect(recordMessageIds(rec('101', 'a', 'b'))).toEqual(['a', 'b'])
    expect(recordMessageIds(labelled('102', ['c', ['INBOX', 'CATEGORY_PERSONAL']]))).toEqual(['c'])
    expect(recordMessageIds({ ...rec('103', 'a'), ...labelled('103', ['a', ['INBOX']], ['d', ['INBOX']]) })).toEqual(['a', 'd'])
  })

  it('passes over a label change that is not the Inbox, and one with no labels named', () => {
    expect(recordMessageIds(labelled('104', ['e', ['STARRED']], ['f', ['IMPORTANT', 'CATEGORY_UPDATES']]))).toEqual([])
    expect(recordMessageIds({ id: '105', labelsAdded: [{ message: { id: 'g' } }] })).toEqual([])
    expect(recordMessageIds({ id: '106' })).toEqual([])
  })
})

describe('walkHistory: where the next run starts', () => {
  it('takes a message that reached the Inbox by a label change, out of Spam, like one added to it (v2.5982)', async () => {
    const b = box([{ history: [rec('101', 'a'), labelled('102', ['rescued', ['INBOX']], ['starred', ['STARRED']])], historyId: '150' }])
    const walk = await walkHistory('100', b.page, b.take, 40)
    expect(b.taken).toEqual(['a', 'rescued'])
    expect(walk).toEqual({ cursor: '150', counts: { taken: 2, already: 0, left: 0, gone: 0 }, full: false, error: null })
  })


  it('reads every page, oldest first, and moves the point to the box\'s newest', async () => {
    const b = box([
      { history: [rec('101', 'a', 'b'), rec('102', 'left-c')], nextPageToken: '1', historyId: '150' },
      { history: [rec('103', 'd')], historyId: '160' },
    ])
    const walk = await walkHistory('100', b.page, b.take, 40)
    expect(b.taken).toEqual(['a', 'b', 'left-c', 'd'])
    expect(walk).toEqual({ cursor: '160', counts: { taken: 3, already: 0, left: 1, gone: 0 }, full: false, error: null })
  })

  it('a failure mid-batch leaves the point at the last record taken whole, and says what failed', async () => {
    const b = box([{ history: [rec('101', 'a'), rec('102', 'b', 'c'), rec('103', 'd')], historyId: '150' }], 'c')
    const walk = await walkHistory('100', b.page, b.take, 40)
    expect(b.taken).toEqual(['a', 'b'])
    expect(walk.cursor).toBe('101')
    expect((walk.error as Error).message).toBe('Writing c failed')
    expect(walk.counts.taken).toBe(2)
  })

  it('a failure on the first message keeps the point where the run started', async () => {
    const b = box([{ history: [rec('101', 'a')], historyId: '150' }], 'a')
    expect((await walkHistory('100', b.page, b.take, 40)).cursor).toBe('100')
  })

  it('a run at its cap stops at the last record taken whole, and the next run takes the rest', async () => {
    const b = box([{ history: [rec('101', 'a', 'b'), rec('102', 'c', 'd')], historyId: '150' }])
    const walk = await walkHistory('100', b.page, b.take, 3)
    expect(b.taken).toEqual(['a', 'b', 'c'])
    expect(walk).toMatchObject({ cursor: '101', full: true, error: null })
  })

  it('an empty history moves the point to the newest; a page that fails throws with nothing past the point', async () => {
    expect((await walkHistory('100', box([{ historyId: '120' }]).page, vi.fn(), 40)).cursor).toBe('120')
    expect((await walkHistory('100', box([{}]).page, vi.fn(), 40)).cursor).toBe('100')
    const failing = vi.fn(async () => {
      throw new Error('404')
    })
    await expect(walkHistory('100', failing, vi.fn(), 40)).rejects.toThrow('404')
  })
})
