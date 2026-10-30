import { describe, expect, it } from 'vitest'
import type { StageChecklistAnswer, StageChecklistQuestion } from './stageChecklist'
import { checklistMarkWords, stageChecklistMarks, stageNotReady } from './stageChecklistMarks'

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
