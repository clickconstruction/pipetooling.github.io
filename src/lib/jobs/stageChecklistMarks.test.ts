import { describe, expect, it } from 'vitest'
import type { StageChecklistAnswer, StageChecklistQuestion } from './stageChecklist'
import { checklistMarkWords, markGlyph, stageChecklistMarks, stageNotReady, stageWithDispatch, withDispatchCounts, withDispatchMarkWords } from './stageChecklistMarks'

const Q: StageChecklistQuestion[] = [
  { id: 'q1', kind: 'rough_in', order: 1, words: 'Did the water test hold?', asksPhoto: false },
  { id: 'q2', kind: 'rough_in', order: 2, words: 'Are the stub-outs marked?', asksPhoto: false },
]
const a = (questionId: string, pick: StageChecklistAnswer['pick']): StageChecklistAnswer => ({ questionId, pick, note: '', photo: null })
const FIXTURES = [
  { id: 'f1', name: 'Rough In' },
  { id: 'f2', name: 'Top Out' },
  { id: 'f3', name: 'Permit' },
]

describe('stageChecklistMarks: the Pipeline’s one more state', () => {
  it('marks only the stages with a checklist, by their standing', () => {
    const marks = stageChecklistMarks(FIXTURES, Q, new Map([['f1', [a('q1', 'yes')]]]))!
    expect([...marks.keys()]).toEqual(['f1'])
    expect(marks.get('f1')!.standing).toBe('not_ready')
    expect(stageNotReady(marks.get('f1'))).toBe(true)
    expect(stageNotReady(marks.get('f2'))).toBe(false)
  })
  it('counts an item added for the stage, on that stage alone (#237)', () => {
    const item: StageChecklistQuestion = { id: 'j1', kind: 'rough_in', order: 0, words: 'Are the carriers in units 7 and 8 set?', asksPhoto: false, fixtureId: 'f1' }
    const other = { id: 'f4', name: 'Rough In' }
    const filled = new Map([
      ['f1', [a('q1', 'yes'), a('q2', 'yes')]],
      ['f4', [a('q1', 'yes'), a('q2', 'yes')]],
    ])
    const marks = stageChecklistMarks([...FIXTURES, other], [...Q, item], filled)!
    // The stage that read filled reads not ready again, which is the point; another job's Rough In is not touched.
    expect(checklistMarkWords(marks.get('f1'))).toBe('checklist 2 of 3 answered · not ready')
    expect(stageNotReady(marks.get('f1'))).toBe(true)
    expect(checklistMarkWords(marks.get('f4'))).toBe('checklist filled')
    // No company question at all: the item alone gives its stage a mark, and only that stage.
    const alone = stageChecklistMarks([...FIXTURES, other], [item], new Map())!
    expect([...alone.keys()]).toEqual(['f1'])
    expect(checklistMarkWords(alone.get('f1'))).toBe('checklist 0 of 1 answered · not ready')
  })
  it('is null while no question exists, so the row reads as before', () => {
    expect(stageChecklistMarks(FIXTURES, [], new Map())).toBeNull()
  })
  it('words the title', () => {
    const marks = stageChecklistMarks(FIXTURES, Q, new Map([['f1', [a('q1', 'yes')]]]))!
    expect(checklistMarkWords(marks.get('f1'))).toBe('checklist 1 of 2 answered · not ready')
    const filled = stageChecklistMarks(FIXTURES, Q, new Map([['f1', [a('q1', 'yes'), a('q2', 'not_here')]]]))!
    expect(checklistMarkWords(filled.get('f1'))).toBe('checklist filled')
    expect(checklistMarkWords(undefined)).toBe('')
  })
})

describe('a check with Dispatch on the mark (punch list #245, PR 3)', () => {
  const half = new Map([['f1', [a('q1', 'yes')]]])
  it('counts the open requests by stage from the rows the board read', () => {
    const counts = withDispatchCounts([{ fixture_id: 'f1' }, { fixture_id: 'f1' }, { fixture_id: 'f2' }, { fixture_id: null }])
    expect([...counts.entries()]).toEqual([
      ['f1', 2],
      ['f2', 1],
    ])
  })
  it('puts the count on the stage with a request, the flag in the box’s place, and the words on the title', () => {
    const marks = stageChecklistMarks(FIXTURES, Q, half, new Map([['f1', 1]]))!
    expect(marks.get('f1')).toMatchObject({ standing: 'not_ready', withDispatch: 1 })
    expect(stageWithDispatch(marks.get('f1'))).toBe(true)
    expect(markGlyph(marks.get('f1'))).toBe('⚑')
    expect(checklistMarkWords(marks.get('f1'))).toBe('checklist 1 of 2 answered · not ready · with Dispatch')
    expect(withDispatchMarkWords({ withDispatch: 2 })).toBe('2 with Dispatch')
  })
  it('leaves a stage without a request as it was, box and all', () => {
    const marks = stageChecklistMarks(FIXTURES, Q, half, new Map([['f2', 1]]))!
    expect(marks.get('f1')!.withDispatch).toBeUndefined()
    expect(stageWithDispatch(marks.get('f1'))).toBe(false)
    expect(markGlyph(marks.get('f1'))).toBe('☐')
    expect(checklistMarkWords(marks.get('f1'))).toBe('checklist 1 of 2 answered · not ready')
    // Without the map at all, the older callers read the same marks.
    expect(stageChecklistMarks(FIXTURES, Q, half)!.get('f1')!.withDispatch).toBeUndefined()
  })
})
