import { describe, expect, it } from 'vitest'
import { lienDoNowBarParts } from './lienDoNowBar'
import type { LienBoard, LienBoardTile } from './lienBoard'

const tile = (t: Partial<LienBoardTile> & Pick<LienBoardTile, 'key' | 'figure' | 'label'>): LienBoardTile => ({ line: null, tone: 'quiet', destination: null, ...t })

const board = (tiles: LienBoardTile[], dayWords: string | null = 'tomorrow'): Pick<LienBoard, 'tiles' | 'dayWords'> => ({ tiles, dayWords })

describe('lienDoNowBarParts', () => {
  it('says the Board’s three counts in the tiles’ own words, each with the tile’s door', () => {
    const parts = lienDoNowBarParts(
      board([
        tile({ key: 'by_day', figure: '21', label: 'by tomorrow · 10 to file · 11 to send', tone: 'red', line: '8 will not make tomorrow as they stand.' }),
        tile({ key: 'waiting', figure: '3', label: 'waiting on Malachi', tone: 'violet', destination: { kind: 'stage', stage: 'awaiting' } }),
        tile({ key: 'in_mail', figure: '7', label: 'in the run', tone: 'amber', destination: { kind: 'run' } }),
        tile({ key: 'unpaid', figure: '$202,575', label: 'unpaid on the desk' }),
      ]),
    )
    expect(parts.map((p) => p.words)).toEqual(['21 by tomorrow', '3 waiting on Malachi', '7 in the run'])
    expect(parts.map((p) => p.tone)).toEqual(['red', 'violet', 'amber'])
    expect(parts.map((p) => p.destination)).toEqual([null, { kind: 'stage', stage: 'awaiting' }, { kind: 'run' }])
  })

  it('leaves out the money and a count at zero', () => {
    const parts = lienDoNowBarParts(
      board([
        tile({ key: 'by_day', figure: '4', label: 'by Monday · 4 to send', tone: 'amber' }),
        tile({ key: 'waiting', figure: '0', label: 'waiting on the leader', line: 'Nothing waits on the leader.' }),
        tile({ key: 'in_mail', figure: '0', label: 'in the run', line: 'Nothing is in the run.' }),
        tile({ key: 'unpaid', figure: '$900', label: 'unpaid on the desk' }),
      ], 'Monday'),
    )
    expect(parts.map((p) => p.words)).toEqual(['4 by Monday'])
  })

  it('is empty on an empty desk', () => {
    const parts = lienDoNowBarParts(board([tile({ key: 'by_day', figure: '0', label: 'nothing dated' }), tile({ key: 'unpaid', figure: '$0', label: 'unpaid on the desk' })], null))
    expect(parts).toEqual([])
  })
})
