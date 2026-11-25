import { describe, expect, it } from 'vitest'
import { LANE_LIST, LONG_NAME_FIT, ONE_COLUMN, SEARCH_HIT_ROW_FIT, SEARCH_HIT_WHEN_FIT, SEARCH_HIT_WORDS_FIT, SEARCH_WORDS_ROOM, WAITING_ACTS_FIT, WAITING_NAME_FIT, WAITING_NAME_ROOM, WAITING_ROW_FIT, WENT_OUT_NAME_FIT, WENT_OUT_NAME_ROOM, WENT_OUT_ROW_FIT, WENT_OUT_WHEN_FIT } from './pageFit'

describe('pageFit', () => {
  it('names a column that takes the room it is given, not the room its widest child wants', () => {
    expect(ONE_COLUMN).toBe('minmax(0, 1fr)')
    expect(LANE_LIST).toEqual({ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '0.5rem' })
  })

  it('lets a Waiting on them row wrap, with the name keeping its room and able to shrink', () => {
    expect(WAITING_ROW_FIT).toEqual({ display: 'flex', flexWrap: 'wrap' })
    expect(WAITING_NAME_ROOM).toBe('11rem')
    expect(WAITING_NAME_FIT).toEqual({ flex: '1 1 11rem', minWidth: 0 })
  })

  it('keeps the chip and the presses at the right and inside the row', () => {
    expect(WAITING_ACTS_FIT).toEqual({ marginLeft: 'auto', minWidth: 0, maxWidth: '100%' })
  })

  it('lets a Went out today row wrap, and its long last line break, where it was one line of 660 px', () => {
    expect(WENT_OUT_ROW_FIT.flexWrap).toBe('wrap')
    expect(WENT_OUT_NAME_ROOM).toBe('9rem')
    expect([WENT_OUT_NAME_FIT.flex, WENT_OUT_NAME_FIT.minWidth, WENT_OUT_NAME_FIT.gridTemplateColumns]).toEqual(['1 1 9rem', 0, 'minmax(0, 1fr)'])
    // The line is no longer held to one: it breaks inside the row, set to the right.
    expect(WENT_OUT_WHEN_FIT.whiteSpace).toBeUndefined()
    expect([WENT_OUT_WHEN_FIT.maxWidth, WENT_OUT_WHEN_FIT.minWidth, WENT_OUT_WHEN_FIT.overflowWrap, WENT_OUT_WHEN_FIT.textAlign, WENT_OUT_WHEN_FIT.marginLeft]).toEqual(['100%', 0, 'anywhere', 'right', 'auto'])
  })

  it('leaves a short hour beside the name at 375 px: the mark, the name\'s room and a 102 px hour fit a row\'s 298', () => {
    const rem = 16
    const gap = 0.6 * rem
    expect(15 + gap + 9 * rem + gap + 102).toBeLessThanOrEqual(298)
    // A waiting row's right side is 264 px, so beside 11 rem it never fits a phone and always takes its own line.
    expect(11 * rem + gap + 264).toBeGreaterThan(298)
  })

  it('lets a name with no space in it break inside its column', () => {
    expect(LONG_NAME_FIT).toEqual({ overflowWrap: 'anywhere', minWidth: 0 })
  })

  it('gives a search hit a column that takes the room it is given, and lets the row wrap', () => {
    expect(SEARCH_HIT_ROW_FIT.flexWrap).toBe('wrap')
    expect(SEARCH_WORDS_ROOM).toBe('11rem')
    expect([SEARCH_HIT_WORDS_FIT.display, SEARCH_HIT_WORDS_FIT.gridTemplateColumns, SEARCH_HIT_WORDS_FIT.flex, SEARCH_HIT_WORDS_FIT.minWidth]).toEqual(['grid', 'minmax(0, 1fr)', '1 1 11rem', 0])
    // The date stays one line and sits at the right, beside the words or on the line under them.
    expect(SEARCH_HIT_WHEN_FIT).toEqual({ marginLeft: 'auto', whiteSpace: 'nowrap' })
  })

  it('keeps a search hit\'s date beside its words at 402 px, and drops it under them at 320', () => {
    const rem = 16
    const gap = 0.6 * rem
    // A row is the page less 56 px of margins, and its own border and padding take 29 px. A date is about 75 px.
    const room = (page: number) => page - 56 - 29
    expect(11 * rem + gap + 75).toBeLessThanOrEqual(room(402))
    expect(11 * rem + gap + 75).toBeGreaterThan(room(320))
  })
})
