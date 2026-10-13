import { describe, expect, it } from 'vitest'
import type { JobTile } from './jobTiles'
import type { BoxSettings } from './boxes'
import { fromLine, replyToHeader } from './compose'
import { lastFromThem, lastOurTextAt, priorTexts, replyCompany, replyJob, tieWords } from './replyBox'
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

describe('their last message, for Find a reply', () => {
  it('is their newest line in, on any channel, in any order', () => {
    const lines = [
      line({ id: 'a', at: '2026-09-20T15:00:00.000Z', direction: 'in', who: 'Greg' }),
      line({ id: 'b', at: '2026-09-28T15:00:00.000Z', direction: 'in', channel: 'email', who: 'Greg' }),
      line({ id: 'c', at: '2026-09-30T15:00:00.000Z' }),
    ]
    expect(lastFromThem(lines)?.id).toBe('b')
    expect(lastFromThem([...lines].reverse())?.id).toBe('b')
  })

  it('is none when they never wrote', () => {
    expect(lastFromThem([line({ id: 'c', at: '2026-09-30T15:00:00.000Z' })])).toBeNull()
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

describe('the company a reply goes as (replyCompany)', () => {
  // Made-up settings: what `messages_boxes_v1` would hold once the owner types it.
  const SETTINGS: BoxSettings = {
    team: { address: 'team@clickplumbing.example', phone: '(512) 555-0144', numberId: 'PNteam0144' },
    bids: { address: 'bids@clickconstruction.example', phone: '(512) 555-0199', numberId: 'PNbids0199' },
  }

  it('names the letterhead of the job, and no number or address until the sends go from the boxes', () => {
    expect(replyCompany('pipeline:j1040')).toEqual({ name: 'Click Plumbing and Electrical', phone: '', mailbox: '', address: '' })
    expect(replyCompany('bid:b482').name).toBe('Click Construction')
    expect(fromLine('text', replyCompany(null))).toEqual(['from the company number', 'Click Construction'])
  })

  it('takes the number and the address of the customer’s box, or of bids@ for a trade partner', () => {
    const dana = replyCompany('pipeline:j1040', { settings: SETTINGS, kind: 'customer', wroteTo: null })
    expect(dana).toEqual({ name: 'Click Plumbing and Electrical', phone: '(512) 555-0144', numberWords: 'the company number', mailbox: 'team@clickplumbing.example', address: '' })
    const greg = replyCompany('bid:b482', { settings: SETTINGS, kind: 'trade', wroteTo: null })
    expect(fromLine('email', greg)).toEqual(['from Click Construction', 'replies to bids@clickconstruction.example'])
    expect(fromLine('text', greg)).toEqual(['from the bids number (512) 555-0199', 'Click Construction'])
  })

  it('answers from the box they wrote to', () => {
    const elena = replyCompany('bid:b482', { settings: SETTINGS, kind: 'customer', wroteTo: 'bids' })
    expect(fromLine('text', elena)).toEqual(['from the bids number (512) 555-0199', 'Click Construction'])
    expect(fromLine('email', elena)).toEqual(['from Click Construction', 'replies to bids@clickconstruction.example'])
  })

  it('texts from the company number while bids@ has no number of its own, as quo-send sends it', () => {
    const noBidsNumber: BoxSettings = { ...SETTINGS, bids: { ...SETTINGS.bids, numberId: '' } }
    const greg = replyCompany('bid:b482', { settings: noBidsNumber, kind: 'trade', wroteTo: null })
    expect(fromLine('text', greg)).toEqual(['from the company number (512) 555-0144', 'Click Construction'])
    expect(replyToHeader(greg)).toBe('bids@clickconstruction.example')
  })

  it('leaves the number and the address out while Settings has none', () => {
    expect(replyCompany('pipeline:j1040', { settings: null, kind: 'customer', wroteTo: null })).toEqual({
      name: 'Click Plumbing and Electrical',
      phone: '',
      numberWords: 'the company number',
      mailbox: '',
      address: '',
    })
    // With nothing read, a trade partner's text still says the company number, which is what quo-send uses.
    expect(fromLine('text', replyCompany('bid:b482', { settings: null, kind: 'trade', wroteTo: null }))).toEqual(['from the company number', 'Click Construction'])
  })
})
