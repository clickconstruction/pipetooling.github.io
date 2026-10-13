import { describe, expect, it } from 'vitest'
import type { BoxSettings } from '../messages/boxes'
import { boxWords, readerBoxes } from './readerBoxes'

// Made-up addresses: what the secret and `messages_boxes_v1` would hold.
const BIDS = 'bids@clickconstruction.example'
const TEAM = 'team@clickplumbing.example'
const settings = (team: string, bids = ''): BoxSettings => ({
  team: { address: team, phone: '', numberId: '' },
  bids: { address: bids, phone: '', numberId: '' },
})

describe('readerBoxes: the boxes gmail-sync reads', () => {
  it('reads bids@ alone while Settings holds no team address, as today', () => {
    expect(readerBoxes(settings(''), BIDS)).toEqual([{ mailbox: 'bids', address: BIDS, words: 'bids@' }])
    expect(readerBoxes(null, BIDS)).toEqual([{ mailbox: 'bids', address: BIDS, words: 'bids@' }])
  })

  it('reads the team box too once its address is typed, bids@ first', () => {
    expect(readerBoxes(settings(` ${TEAM} `), BIDS)).toEqual([
      { mailbox: 'bids', address: BIDS, words: 'bids@' },
      { mailbox: 'team', address: TEAM, words: 'team@' },
    ])
  })

  it('takes bids@ from Settings when the secret is empty, and reads nothing with neither', () => {
    expect(readerBoxes(settings('', BIDS), '')).toEqual([{ mailbox: 'bids', address: BIDS, words: 'bids@' }])
    expect(readerBoxes(settings(''), null)).toEqual([])
  })

  it('never reads one mailbox twice, nor words that are not an address', () => {
    expect(readerBoxes(settings('BIDS@clickconstruction.example'), BIDS).map((b) => b.mailbox)).toEqual(['bids'])
    expect(readerBoxes(settings('team'), BIDS).map((b) => b.mailbox)).toEqual(['bids'])
  })
})

describe('boxWords', () => {
  it('names a box by its own part with its @', () => {
    expect(boxWords(BIDS)).toBe('bids@')
    expect(boxWords('office@clickplumbing.example')).toBe('office@')
  })
})
