/**
 * Punch list #397 PR 1: opening the Workflow page makes nothing. Pins the decision (a found
 * workflow is used, a GC project gets none, an open with none draws the empty state, only a
 * press creates), the inserted row, and the empty state's words by role.
 */
import { describe, expect, it } from 'vitest'
import { START_WORKFLOW_LABEL, canStartWorkflow, newWorkflowRow, noWorkflowWords, workflowFindStep } from './workflowStart'

describe('workflowFindStep', () => {
  it('uses the workflow the project already has, pressed or not, GC or not', () => {
    for (const pressed of [false, true]) {
      for (const isGcProject of [false, true]) {
        expect(workflowFindStep({ found: true, isGcProject, pressed })).toBe('use')
      }
    }
  })

  it('makes none for a GC project, even on a press', () => {
    expect(workflowFindStep({ found: false, isGcProject: true, pressed: false })).toBe('gc')
    expect(workflowFindStep({ found: false, isGcProject: true, pressed: true })).toBe('gc')
  })

  it('an open with no workflow draws the empty state and writes nothing', () => {
    expect(workflowFindStep({ found: false, isGcProject: false, pressed: false })).toBe('empty')
  })

  it('only a press creates', () => {
    expect(workflowFindStep({ found: false, isGcProject: false, pressed: true })).toBe('create')
    const creating = [false, true].flatMap((found) => [false, true].flatMap((isGcProject) => [false, true].map((pressed) => ({ found, isGcProject, pressed })))).filter((i) => workflowFindStep(i) === 'create')
    expect(creating).toEqual([{ found: false, isGcProject: false, pressed: true }])
  })
})

describe('newWorkflowRow', () => {
  it('is a draft named after its project', () => {
    expect(newWorkflowRow('p1', 'Elm Street')).toEqual({ project_id: 'p1', name: 'Elm Street workflow', status: 'draft' })
  })

  it('falls back to Workflow when the project has no name', () => {
    expect(newWorkflowRow('p1', null).name).toBe('Workflow')
    expect(newWorkflowRow('p1', '   ').name).toBe('Workflow')
  })
})

describe('canStartWorkflow', () => {
  it('is the roles the insert policy admits: dev, master, assistant and controller', () => {
    for (const role of ['dev', 'master_technician', 'assistant', 'controller']) expect(canStartWorkflow(role)).toBe(true)
  })

  it('leaves out a superintendent, whose insert the policy refuses, and every field role', () => {
    for (const role of ['superintendent', 'subcontractor', 'helpers', 'estimator', 'primary', null, undefined]) expect(canStartWorkflow(role)).toBe(false)
  })
})

describe('noWorkflowWords', () => {
  it('gives the roles that can start one both sentences and the press', () => {
    expect(noWorkflowWords(true)).toEqual({
      main: 'No workflow on this project yet. Steps you add here show to the people they are assigned to.',
      next: START_WORKFLOW_LABEL,
      tail: '',
    })
    expect(START_WORKFLOW_LABEL).toBe('Start a workflow')
  })

  it('gives every other role the first sentence alone, with no press', () => {
    expect(noWorkflowWords(false)).toEqual({ main: 'No workflow on this project yet.', next: '', tail: '' })
    expect(noWorkflowWords(false, true).next).toBe('')
  })

  it('reads that it is starting while the press runs', () => {
    expect(noWorkflowWords(true, true).next).toBe('Starting the workflow\u2026')
    expect(noWorkflowWords(true, true).main).toBe(noWorkflowWords(true).main)
  })
})
