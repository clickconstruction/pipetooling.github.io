import { describe, expect, it } from 'vitest'
import { BID_BOARD_TOOLS_WRAP_MQ, bidBoardToolsRowLayout } from './bidBoardToolsRow'

describe('bidBoardToolsRowLayout (v2.6109)', () => {
  it('wraps only under 366 px: 375 keeps the one-line row v2.5977 measured', () => {
    expect(BID_BOARD_TOOLS_WRAP_MQ).toBe('(max-width: 365px)')
  })

  it('on a 320 phone the row wraps, the search shares the first line and the group keeps the right', () => {
    expect(bidBoardToolsRowLayout(true)).toEqual({
      rowWrap: 'wrap',
      searchFlex: '1 1 9rem',
      groupMarginLeft: 'auto',
    })
  })

  it('on every other width the row draws as before: one line, the search shrinking', () => {
    expect(bidBoardToolsRowLayout(false)).toEqual({
      rowWrap: 'nowrap',
      searchFlex: '1 1 auto',
      groupMarginLeft: undefined,
    })
  })
})
