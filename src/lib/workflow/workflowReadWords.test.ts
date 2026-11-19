/**
 * A failed read on the Workflow page names what could not be loaded, then its reason. The cases
 * are a Supabase result's error as it arrives: a plain object with a code, never an Error.
 */
import { describe, expect, it } from 'vitest'
import { WORKFLOW_READ_LEADS, workflowReadFailure, type WorkflowRead } from './workflowReadWords'

const refused = { code: '42501', message: 'permission denied for table project_workflow_steps' }
const noRow = { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' }
const slow = { code: '57014', message: 'canceling statement due to statement timeout' }

describe('workflowReadFailure', () => {
  it('leads every read with what could not be loaded', () => {
    for (const what of Object.keys(WORKFLOW_READ_LEADS) as WorkflowRead[]) {
      expect(workflowReadFailure(what, refused).startsWith(WORKFLOW_READ_LEADS[what])).toBe(true)
    }
    expect(WORKFLOW_READ_LEADS).toEqual({
      workflow: 'The workflow could not be loaded.',
      project: 'The project could not be loaded.',
      steps: 'The steps could not be loaded.',
      lineItems: 'The line items could not be loaded.',
    })
  })

  it('follows the lead with a reason a person can act on, never the raw server text, for a refusal or a missing row', () => {
    const noAccess = workflowReadFailure('steps', refused)
    expect(noAccess).toMatch(/^The steps could not be loaded\. \S/)
    expect(noAccess).not.toContain('permission denied for table')
    const gone = workflowReadFailure('project', noRow)
    expect(gone).toMatch(/^The project could not be loaded\. \S/)
    expect(gone).not.toContain('JSON object requested')
    expect(gone).not.toBe(noAccess.replace('steps', 'project'))
  })

  it('keeps the server\u2019s own words after a colon when the code has no sentence of its own', () => {
    expect(workflowReadFailure('steps', slow)).toBe('The steps could not be loaded: canceling statement due to statement timeout')
  })

  it('says a lost signal as a lost signal, with no server text', () => {
    const offline = workflowReadFailure('workflow', { message: 'TypeError: Failed to fetch' })
    expect(offline).toMatch(/^No connection/)
    expect(offline).not.toContain('Failed to fetch')
  })
})
