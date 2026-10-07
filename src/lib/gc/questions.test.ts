import { describe, expect, it } from 'vitest'
import { answeredNotInSet, openQuestions, questionInNote, questionState, questionsCloseOn, questionsOpen, type PlanQuestionView } from './questions'

const q = (over: Partial<PlanQuestionView>): PlanQuestionView => ({
  id: 'q1',
  packageId: 'elec',
  askedByName: 'Pecan Valley Electric',
  text: 'Is the panel in bay 2 a 400 A?',
  sheets: ['E-101'],
  askedOn: '2026-10-02',
  sentToArchitectOn: null,
  answeredOn: null,
  answer: '',
  inSetId: null,
  ...over,
})

describe('questions about the plans', () => {
  it('close three days before our bid is due, and never open on a bid we lost', () => {
    expect(questionsCloseOn({ stage: 'bidding', bidDue: '2026-10-08' })).toBe('2026-10-05')
    expect(questionsCloseOn({ stage: 'building', bidDue: '2026-10-08' })).toBeNull()
    expect(questionsOpen({ stage: 'bidding', bidDue: '2026-10-08', lostOn: null }, '2026-10-04')).toBe(true)
    expect(questionsOpen({ stage: 'bidding', bidDue: '2026-10-08', lostOn: null }, '2026-10-05')).toBe(false)
    expect(questionsOpen({ stage: 'bidding', bidDue: null, lostOn: '2026-10-01' }, '2026-10-02')).toBe(false)
  })

  it('reads where a question stands and which ones wait or can ride in a set', () => {
    const asked = q({})
    const sent = q({ id: 'q2', sentToArchitectOn: '2026-10-03', askedOn: '2026-10-01' })
    const done = q({ id: 'q3', answeredOn: '2026-10-04', answer: 'Yes, 400 A.' })
    const carried = q({ id: 'q4', answeredOn: '2026-10-04', answer: 'No.', inSetId: 'set1' })
    expect(questionState(asked)).toBe('asked')
    expect(questionState(sent)).toBe('with the architect')
    expect(questionState(done)).toBe('answered')
    expect(openQuestions({ questions: [asked, sent, done] }).map((x) => x.id)).toEqual(['q2', 'q1'])
    expect(answeredNotInSet({ questions: [asked, done, carried] }).map((x) => x.id)).toEqual(['q3'])
    expect(questionInNote(done, 'Electrical')).toBe('E-101, Electrical: Is the panel in bay 2 a 400 A? Answer: Yes, 400 A.')
  })
})
