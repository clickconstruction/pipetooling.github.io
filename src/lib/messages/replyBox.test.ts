import { describe, expect, it } from 'vitest'
import type { JobTile } from './jobTiles'
import { lastOurTextAt, priorTexts, replyJob, tieWords } from './replyBox'
import type { ThreadMessage } from './thread'

const tile = (key: string, num: string, name: string): JobTile => ({ key, kind: 'bid', num, name, day: { words: '', tone: '' } })
const TILES: Record<string, JobTile> = {
  'bid:b482': tile('bid:b482', 'B482', 'Hillside Phase 2'),
  'bid:b470': tile('bid:b470', 'B470', 'Bell Family Dental'),
}

const line = (set: Partial<ThreadMessage> & Pick<ThreadMessage, 'id' | 'at'>): ThreadMessage => ({
  contactId: 'greg',
  jobId: null,
  channel: 'text',
  direction: 'out',
  who: 'Robert · from the company number',
  body: 'Checking on the number. Still good for today?',
  channelId: 'ch-cell',
  ...set,
})

describe('the job a reply lands on', () => {
  it('starts on the job the thread shows, else the star, else none', () => {
    expect(replyJob(undefined, 'bid:b470', 'bid:b482')).toBe('bid:b470')
    expect(replyJob(undefined, null, 'bid:b482')).toBe('bid:b482')
    expect(replyJob(undefined, null, null)).toBeNull()
  })

  it('keeps what they chose, a job or no job, over the view and the star', () => {
    expect(replyJob('bid:b482', 'bid:b470', null)).toBe('bid:b482')
    expect(replyJob(null, 'bid:b470', 'bid:b482')).toBeNull()
  })
})

describe('the Tie to words', () => {
  it('names the job by its badge and name, and says why when nobody chose it', () => {
    expect(tieWords(undefined, null, 'bid:b482', TILES)).toEqual({ job: 'B482 Hillside Phase 2', aside: 'default' })
    expect(tieWords(undefined, 'bid:b470', 'bid:b482', TILES)).toEqual({ job: 'B470 Bell Family Dental', aside: 'in view' })
    expect(tieWords('bid:b470', null, 'bid:b482', TILES)).toEqual({ job: 'B470 Bell Family Dental', aside: null })
  })

  it('reads the person alone with no star, and no job when they chose none', () => {
    expect(tieWords(undefined, null, null, TILES)).toEqual({ job: 'the person alone', aside: null })
    expect(tieWords(null, 'bid:b470', 'bid:b482', TILES)).toEqual({ job: 'no job', aside: null })
  })

  it('still reads when the tile has not loaded', () => {
    expect(tieWords('bid:b999', null, null, TILES).job).toBe('a job not loaded')
  })
})

describe('our last text to a number', () => {
  const lines = [
    line({ id: 'm1', at: '2026-09-01T15:00:00.000Z' }),
    line({ id: 'm2', at: '2026-09-20T15:00:00.000Z', direction: 'in', who: 'Greg' }),
    line({ id: 'm3', at: '2026-09-10T15:00:00.000Z', optoutLine: 'held' }),
    line({ id: 'm4', at: '2026-09-25T15:00:00.000Z', channelId: 'ch-office' }),
    line({ id: 'm5', at: '2026-09-28T15:00:00.000Z', channel: 'email', channelId: 'ch-cell' }),
  ]

  it('is the newest text out on that number, a held one included, in any order', () => {
    expect(lastOurTextAt(lines, 'ch-cell')).toBe(Date.parse('2026-09-10T15:00:00.000Z'))
    expect(lastOurTextAt([...lines].reverse(), 'ch-cell')).toBe(Date.parse('2026-09-10T15:00:00.000Z'))
  })

  it('reads each number alone, and none for a number we never texted or no number', () => {
    expect(lastOurTextAt(lines, 'ch-office')).toBe(Date.parse('2026-09-25T15:00:00.000Z'))
    expect(lastOurTextAt(lines, 'ch-new')).toBeNull()
    expect(lastOurTextAt(lines, null)).toBeNull()
  })
})

describe('the texts already on their phone', () => {
  const lines = [
    line({ id: 't3', at: '2026-09-20T15:00:00.000Z', direction: 'in', who: 'Greg', body: 'Yes, by noon.' }),
    line({ id: 't1', at: '2026-09-01T15:00:00.000Z' }),
    line({ id: 't2', at: '2026-09-10T15:00:00.000Z' }),
    line({ id: 'n1', at: '2026-09-21T15:00:00.000Z', channel: 'note', direction: 'team', channelId: null }),
    line({ id: 'o1', at: '2026-09-22T15:00:00.000Z', channelId: 'ch-office' }),
  ]

  it('are the last two on that number, both ways, oldest first', () => {
    expect(priorTexts(lines, 'ch-cell').map((m) => m.id)).toEqual(['t2', 't3'])
    expect(priorTexts(lines, 'ch-cell', 3).map((m) => m.id)).toEqual(['t1', 't2', 't3'])
  })

  it('are none with no number or a count of none', () => {
    expect(priorTexts(lines, null)).toEqual([])
    expect(priorTexts(lines, 'ch-cell', 0)).toEqual([])
  })
})
