import { describe, expect, it } from 'vitest'
import { ASK_QUESTION_MAX, formatAsk, parseAsk } from './punchListAsk'

describe('parseAsk', () => {
  it('reads who, the kind and the question', () => {
    expect(parseAsk('owner · walk · Walk the pace card with one superintendent, on his own phone.')).toEqual({
      ask: { who: 'owner', kind: 'walk', question: 'Walk the pace card with one superintendent, on his own phone.' },
    })
  })

  it('reads no ask from an empty value', () => {
    expect(parseAsk('')).toBeNull()
    expect(parseAsk('   ')).toBeNull()
    expect(parseAsk(undefined)).toBeNull()
  })

  it('takes who and the kind in any case, and a question that ends in a question mark', () => {
    expect(parseAsk('Owner · Decide · Build PRs 4 to 6 now, or after the site is walked?')).toEqual({
      ask: { who: 'owner', kind: 'decide', question: 'Build PRs 4 to 6 now, or after the site is walked?' },
    })
  })

  it('keeps a divider that sits inside the question', () => {
    const got = parseAsk('office · use · Work the first forty rows · about a third of the dollars.')
    expect(got).toEqual({ ask: { who: 'office', kind: 'use', question: 'Work the first forty rows · about a third of the dollars.' } })
  })

  it('says what is wrong with a line that has fewer than three parts', () => {
    expect(parseAsk('owner · Walk it.')).toEqual({ problem: expect.stringContaining('who · kind · question') })
  })

  it('names a who and a kind it does not know', () => {
    expect(parseAsk('grace · look · Look at it.')).toEqual({ problem: expect.stringContaining('"grace"') })
    expect(parseAsk('owner · ponder · Look at it.')).toEqual({ problem: expect.stringContaining('"ponder"') })
  })

  it('refuses a question with no end mark, and one too long for a row', () => {
    expect(parseAsk('owner · look · Look at it')).toEqual({ problem: expect.stringContaining('full stop') })
    const long = `${'word '.repeat(40)}end.`
    expect(long.length).toBeGreaterThan(ASK_QUESTION_MAX)
    expect(parseAsk(`owner · look · ${long}`)).toEqual({ problem: expect.stringContaining(`${ASK_QUESTION_MAX}`) })
  })

  it('reads back the line it writes', () => {
    const ask = { who: 'anyone', kind: 'walk', question: 'Be at hand for the walk.' } as const
    expect(parseAsk(formatAsk(ask))).toEqual({ ask })
  })
})
