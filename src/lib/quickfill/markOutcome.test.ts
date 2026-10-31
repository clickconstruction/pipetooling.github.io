import { describe, expect, it } from 'vitest'
import {
  isMarkOutcome,
  markOutcomeForCount,
  markOutcomeStampWord,
  markOutcomeWord,
  markPressBarLabel,
  markPresses,
  questionRequestPayload,
  questionRequestReference,
  questionRequestTitle,
  QUICKFILL_QUESTION_ACTION,
} from './markOutcome'

describe('markOutcome · the press that fits the count (punch list #176, change 1)', () => {
  it('a plain press is done at zero and worked above it; a station with no count is a look, which reads as done', () => {
    expect(markOutcomeForCount(0)).toBe('done')
    expect(markOutcomeForCount(50)).toBe('worked')
    expect(markOutcomeForCount(null)).toBe('done')
    expect(markOutcomeForCount(undefined)).toBe('done')
  })

  it('at 50 open: Done is dim, Worked it · 50 left is lit, Not sure is lit', () => {
    const presses = markPresses(50)
    expect(presses.map((p) => p.outcome)).toEqual(['done', 'worked', 'question'])
    expect(presses[0]).toMatchObject({ label: 'Done · 0 open', enabled: false, hint: 'lights up at zero' })
    expect(presses[1]).toMatchObject({ label: 'Worked it · 50 left', enabled: true })
    expect(presses[2]).toMatchObject({ label: 'Not sure what to do', enabled: true })
  })

  it('at zero: Done is lit and Worked it is dim', () => {
    const [done, worked, question] = markPresses(0)
    expect(done).toMatchObject({ label: 'Done · 0 open', enabled: true, hint: 'nothing left here' })
    expect(worked).toMatchObject({ label: 'Worked it', enabled: false })
    expect(question?.enabled).toBe(true)
  })

  it('a station with no count offers Looked, lit, and no Worked it', () => {
    const [done, worked] = markPresses(null)
    expect(done).toMatchObject({ label: 'Looked', enabled: true })
    expect(worked?.enabled).toBe(false)
  })

  it('the noun follows the station: 10 due, 25 waiting', () => {
    expect(markPresses(0, 'due')[0]?.label).toBe('Done · 0 due')
    expect(markPresses(25, 'waiting')[1]?.label).toBe('Worked it · 25 left')
  })

  it('on the bar the press also says where it goes next, except Not sure', () => {
    const [done, worked, question] = markPresses(3)
    expect(markPressBarLabel(done!, 'next →')).toBe('Done · 0 open · next →')
    expect(markPressBarLabel(worked!, 'done ✓')).toBe('Worked it · 3 left · done ✓')
    expect(markPressBarLabel(question!, 'next →')).toBe('Not sure what to do')
  })

  it('the request a Not sure press files: the station, its count and the words, the question as the reference', () => {
    expect(questionRequestTitle('Prospects', 268, '')).toBe('Quickfill · Prospects · 268 open: not sure what to do.')
    expect(questionRequestTitle('Prospects', 268, '  268 never changes and I do not know which are mine to call. ')).toBe(
      'Quickfill · Prospects · 268 open: not sure what to do. 268 never changes and I do not know which are mine to call.',
    )
    expect(questionRequestTitle('Field photos → Drive', null, '')).toBe('Quickfill · Field photos → Drive: not sure what to do.')
    expect(questionRequestReference('Did every prospect hear from us on time?')).toBe('The station asks: Did every prospect hear from us on time?')
    expect(questionRequestReference('  ')).toBeNull()
    expect(questionRequestReference(null)).toBeNull()
    expect(QUICKFILL_QUESTION_ACTION).toBe('quickfill_question')
    expect(questionRequestPayload({ sectionId: 'prospects', label: 'Prospects', count: 268, question: 'Did every prospect hear from us on time?' })).toEqual({
      sectionId: 'prospects',
      label: 'Prospects',
      count: 268,
      question: 'Did every prospect hear from us on time?',
    })
  })

  it('the history words: done · worked · asked, and looked for a mark from before the column', () => {
    expect(markOutcomeWord('done')).toBe('done')
    expect(markOutcomeWord('worked')).toBe('worked')
    expect(markOutcomeWord('question')).toBe('asked')
    expect(markOutcomeWord(null)).toBe('looked')
    expect(markOutcomeStampWord('question')).toBe('asked')
    expect(markOutcomeStampWord(undefined)).toBe('marked')
    expect(isMarkOutcome('worked')).toBe(true)
    expect(isMarkOutcome('looked')).toBe(false)
  })

  it('while counting: Done and Worked it wait with no count in their words, Not sure stays lit (v2.5868)', () => {
    const [done, worked, question] = markPresses(null, 'open', true)
    expect(done).toMatchObject({ outcome: 'done', label: 'Done', enabled: false, hint: 'counting…' })
    expect(worked).toMatchObject({ outcome: 'worked', label: 'Worked it', enabled: false, hint: 'counting…' })
    expect(question).toMatchObject({ outcome: 'question', enabled: true })
  })

  it('held on a kept station (#183 PR 4): Done and Worked it keep their words but wait with reading again…, Not sure stays lit', () => {
    const [done, worked, question] = markPresses(3, 'open', false, true)
    expect(done).toMatchObject({ outcome: 'done', label: 'Done · 0 open', enabled: false, hint: 'reading again…' })
    expect(worked).toMatchObject({ outcome: 'worked', label: 'Worked it · 3 left', enabled: false, hint: 'reading again…' })
    expect(question).toMatchObject({ outcome: 'question', enabled: true })
    // Still counting wins the words: the count is not in either way.
    expect(markPresses(null, 'open', true, true)[0]).toMatchObject({ label: 'Done', hint: 'counting…' })
  })
})
