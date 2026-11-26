import { describe, expect, it } from 'vitest'
import { JOB_NOTE_DELETED_WORDS, TASK_COMMENT_DELETED_WORDS, TEST_NOTE_DELETE_PRESS, jobNoteDeleteConfirm, jobNoteDeleteProblem, noteAnswersProblem, taskCommentDeleteConfirm, taskCommentDeleteProblem, testNoteDeleteDrawn } from './testNoteDelete'

describe('deleting a test job’s note and a test task’s comment (punch list #443, row 13)', () => {
  it('is drawn for a dev and for nobody else', () => {
    expect(testNoteDeleteDrawn('dev')).toBe(true)
    for (const role of ['master_technician', 'assistant', 'controller', 'subcontractor', 'helpers', 'estimator', 'primary', 'superintendent', null, undefined]) expect(testNoteDeleteDrawn(role)).toBe(false)
  })

  it('a job’s note goes only on a ZZ test job, by the job’s name or its customer’s', () => {
    expect(jobNoteDeleteProblem({ job_name: 'ZZ Test walk job', customer_name: 'Harbor Row' })).toBe('')
    expect(jobNoteDeleteProblem({ job_name: 'Loft rough-in', customer_name: 'zz test customer' })).toBe('')
    expect(jobNoteDeleteProblem({ job_name: 'Loft rough-in', customer_name: 'Harbor Row' })).toBe('Only a note on a test job can be deleted. The job’s name or its customer’s name must start with ZZ.')
    expect(jobNoteDeleteProblem(null)).toBe('The job could not be read, so nobody knows whether it is a test job. Nothing was deleted.')
  })

  it('a task’s comment goes only when it is a comment on a ZZ task', () => {
    expect(taskCommentDeleteProblem({ event_type: 'comment' }, 'ZZ Test comment task')).toBe('')
    expect(taskCommentDeleteProblem({ event_type: 'completed' }, 'ZZ Test comment task')).toBe('Only a comment a person wrote can be deleted. The app’s own lines stay.')
    expect(taskCommentDeleteProblem({ event_type: 'comment' }, 'Walk the lofts')).toBe('Only a comment on a test task can be deleted. The task’s title must start with ZZ.')
    expect(taskCommentDeleteProblem(null, 'ZZ Test comment task')).toBe('The comment is not there any more. Read the task again.')
  })

  it('a note or comment a tag names as its answer stays, with the count, and nothing goes on no count', () => {
    expect(noteAnswersProblem(0)).toBe('')
    expect(noteAnswersProblem(1)).toBe('1 tag names this as its answer. It stays.')
    expect(noteAnswersProblem(3)).toBe('3 tags name this as their answer. It stays.')
    expect(noteAnswersProblem(null)).toBe('The tags that may name this as their answer could not be counted. Nothing was deleted.')
    expect(noteAnswersProblem(Number.NaN)).toBe('The tags that may name this as their answer could not be counted. Nothing was deleted.')
  })

  it('the confirms name the author and the act, and the toasts say what went', () => {
    expect(jobNoteDeleteConfirm('Dana')).toEqual({
      title: 'Delete Dana’s note?',
      message: 'It leaves this job’s Activity for everyone, with its tags. Deleted records keeps a copy. Anyone it told by push keeps that push.',
      confirmLabel: 'Delete the note',
    })
    expect(taskCommentDeleteConfirm('Luis')).toEqual({
      title: 'Delete Luis’s comment?',
      message: 'It leaves this task’s activity for everyone, with its tags, and nothing keeps a copy. Anyone it told by push keeps that push.',
      confirmLabel: 'Delete the comment',
    })
    expect(TEST_NOTE_DELETE_PRESS).toBe('Delete…')
    expect(JOB_NOTE_DELETED_WORDS).toBe('The note was deleted.')
    expect(TASK_COMMENT_DELETED_WORDS).toBe('The comment was deleted.')
  })
})
