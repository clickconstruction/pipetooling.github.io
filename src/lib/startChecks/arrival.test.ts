import { describe, expect, it } from 'vitest'
import { stageCheckPayloadFrom, stageCheckTitleParts } from '../jobs/stageCheckDispatch'
import { plainSentence, sentenceParts } from '../valuesInPlace'
import { ARRIVAL_WORDS, notAsToldFrom } from './arrival'

// Every name here is made up.
const PAYLOAD = { stage_check: { fixture_id: 'f1', question_id: null, reason: 'other', stage_name: 'Rough In', words: 'Not as told on arrival', start_check_arrival_id: 'a1', not_as_told: ['b1', 'b2'], told_by: 'Ray Ortiz' } }

describe('the crew’s card on arrival', () => {
  it('names a No by its count, and claims nobody’s word in its lead', () => {
    expect(ARRIVAL_WORDS.send(1)).toBe('Tell Dispatch: 1 thing not as told')
    expect(ARRIVAL_WORDS.send(3)).toBe('Tell Dispatch: 3 things not as told')
    expect(ARRIVAL_WORDS.saidNo(2)).toBe('Dispatch has it: 2 things not as told.')
    // The stage is a value the app works out, so the sentence marks it and the card draws it apart.
    expect(plainSentence(ARRIVAL_WORDS.lead('Top Out'))).toBe('Look before you unload. These must be true before Top Out.')
    expect(sentenceParts(ARRIVAL_WORDS.lead('Top Out'))).toEqual(['Look before you unload. These must be true before ', { kind: 'stage', text: 'Top Out' }, '.'])
  })
})

describe('a No on arrival, as Dispatch reads it', () => {
  it('reads the stage, the arrival, the bullets and who told us off the payload start_check_arrive writes', () => {
    expect(notAsToldFrom(PAYLOAD)).toEqual({ fixtureId: 'f1', stageName: 'Rough In', arrivalId: 'a1', bullets: ['b1', 'b2'], toldBy: 'Ray Ortiz' })
    expect(notAsToldFrom({ stage_check: { ...PAYLOAD.stage_check, told_by: null, not_as_told: 'b1' } })).toMatchObject({ toldBy: '', bullets: [] })
  })

  it('is not a check: the stage check’s own reader answers null for it, and it answers null for a check', () => {
    expect(stageCheckPayloadFrom(PAYLOAD)).toBeNull()
    expect(notAsToldFrom({ stage_check: { fixture_id: 'f3', question_id: 't3', reason: 'need_part', stage_name: 'Trim Set' } })).toBeNull()
    for (const junk of [null, undefined, 'x', 3, {}, { stage_check: null }, { stage_check: { fixture_id: '', start_check_arrival_id: 'a1' } }]) expect(notAsToldFrom(junk)).toBeNull()
  })

  it('carries a title the check window can read back: the stage, the bullet, and the words with who told us', () => {
    // The title as `start_check_arrive` builds it. The window has no live read for it, so this is all it draws from.
    const title = 'Rough In · “The slab is poured.” · something else: not as told on arrival, and 1 more. Ray Ortiz told us it was ready'
    expect(stageCheckTitleParts(title, null)).toEqual({ stageName: 'Rough In', question: 'The slab is poured.', reasonTail: 'something else', words: 'not as told on arrival, and 1 more. Ray Ortiz told us it was ready' })
  })
})
