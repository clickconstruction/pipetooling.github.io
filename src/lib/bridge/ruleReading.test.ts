import { describe, expect, it } from 'vitest'
import { RULE_READING_SHUT, ruleReadingAfter, type RuleReading, type RuleReadingEvent } from './ruleReading'

const run = (...events: RuleReadingEvent[]): RuleReading => events.reduce(ruleReadingAfter, RULE_READING_SHUT)

describe('the Bridge rule’s long reading (punch list #321, finding 275)', () => {
  it('one press opens it, however the pointer got there, and the next press shuts it', () => {
    // A tap on a phone, or a click by a mouse: the arrival opens it and the click must not shut it.
    expect(run('look', 'press')).toEqual({ open: true, held: true })
    // A press with no look before it (a script, a screen reader's activate).
    expect(run('press')).toEqual({ open: true, held: true })
    // Focus and hover both, then the click.
    expect(run('look', 'look', 'press')).toEqual({ open: true, held: true })
    expect(run('look', 'press', 'press')).toEqual(RULE_READING_SHUT)
    // And a third press opens it again though no new look came.
    expect(run('look', 'press', 'press', 'press')).toEqual({ open: true, held: true })
  })

  it('a look alone opens it for as long as it lasts', () => {
    expect(run('look')).toEqual({ open: true, held: false })
    expect(run('look', 'lookEnded')).toEqual(RULE_READING_SHUT)
  })

  it('a pressed reading shuts when the pointer or the focus leaves, as before, and on Escape or a press outside', () => {
    expect(run('look', 'press', 'lookEnded')).toEqual(RULE_READING_SHUT)
    // And the press after that opens it again: the old press is not remembered.
    expect(run('look', 'press', 'lookEnded', 'look', 'press')).toEqual({ open: true, held: true })
    expect(run('look', 'press', 'dismiss')).toEqual(RULE_READING_SHUT)
    // Escape shuts a look's reading too.
    expect(run('look', 'dismiss')).toEqual(RULE_READING_SHUT)
  })

  it('a second press shuts it though the pointer still rests there, and the next look opens it again', () => {
    expect(run('look', 'press', 'press', 'look')).toEqual({ open: true, held: false })
  })

  it('hands back the same state when nothing changes, so the screen does not draw again', () => {
    expect(ruleReadingAfter(RULE_READING_SHUT, 'lookEnded')).toBe(RULE_READING_SHUT)
    expect(ruleReadingAfter(RULE_READING_SHUT, 'dismiss')).toBe(RULE_READING_SHUT)
    const looked = run('look')
    expect(ruleReadingAfter(looked, 'look')).toBe(looked)
  })
})
