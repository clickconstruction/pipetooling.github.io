import { describe, expect, it } from 'vitest'
import { ASKED_ARCHITECT_TOAST } from '../messages/promises'
import { plainWordsFailures } from '../plainWords'
import { askArchitectToast, askedByOf, lineGcProject, planQuestionOf } from './askArchitect'

describe('Ask the architect (cut 2, v2.5289)', () => {
  it('only a line on a GC project can go to its architect', () => {
    expect(lineGcProject({ jobId: 'project:p1' })).toBe('p1')
    expect(lineGcProject({ jobId: 'bid:b1' })).toBeNull()
    expect(lineGcProject({ jobId: 'pipeline:j1' })).toBeNull()
    expect(lineGcProject({ jobId: null })).toBeNull()
    expect(lineGcProject(undefined)).toBeNull()
  })

  it('who asked is the person, at their company when they have one', () => {
    expect(askedByOf({ name: 'Greg Paulk', company: 'Hillside Excavation' })).toBe('Greg Paulk at Hillside Excavation')
    expect(askedByOf({ name: 'Greg Paulk', company: null })).toBe('Greg Paulk')
    expect(askedByOf({ name: 'Hillside Excavation', company: 'Hillside Excavation' })).toBe('Hillside Excavation')
    expect(askedByOf({ name: '', company: 'Hillside Excavation' })).toBe('Hillside Excavation')
  })

  it('a line becomes a question about the job as a whole, in their words', () => {
    expect(planQuestionOf({ jobId: 'project:p1', body: '  Is the detention pond in sitework or ours? ' }, { name: 'Greg Paulk', company: 'Hillside Excavation' })).toEqual({
      projectId: 'p1',
      packageId: null,
      askedByName: 'Greg Paulk at Hillside Excavation',
      text: 'Is the detention pond in sitework or ours?',
      sheets: [],
    })
    expect(planQuestionOf({ jobId: 'bid:b1', body: 'Is it ours?' }, { name: 'Greg Paulk' })).toBeNull()
    expect(planQuestionOf({ jobId: 'project:p1', body: '   ' }, { name: 'Greg Paulk' })).toBeNull()
  })

  it('says sent only when the email went', () => {
    expect(askArchitectToast({ sent: true, to: 'studio@archfirm.example' })).toEqual({ words: 'Sent to studio@archfirm.example as a plan question.', tone: 'success' })
    expect(askArchitectToast({ sent: true })).toEqual({ words: ASKED_ARCHITECT_TOAST, tone: 'success' })

    const refused = askArchitectToast({ sent: false, job: 'Boerne Clinic', reason: 'The project has no architect on record. Add one on the project first.' })
    expect(refused).toEqual({
      words:
        'The question is under Questions about the plans on Boerne Clinic. The email to the architect did not go. The project has no architect on record. Add one on the project first. The office can email it from there.',
      tone: 'error',
    })
    expect(askArchitectToast({ sent: false, job: null, reason: 'A training account cannot send email' }).words).toBe(
      'The question is under Questions about the plans on its job. The email to the architect did not go. A training account cannot send email. The office can email it from there.',
    )
  })

  it('keeps its own words plain', () => {
    expect(plainWordsFailures(askArchitectToast({ sent: false, job: 'Boerne Clinic', reason: '' }).words)).toEqual([])
    expect(plainWordsFailures(askArchitectToast({ sent: true, to: 'studio@archfirm.example' }).words)).toEqual([])
  })
})
