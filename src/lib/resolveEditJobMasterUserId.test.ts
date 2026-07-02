import { describe, expect, it } from 'vitest'
import { resolveEditJobMasterUserId } from './resolveEditJobMasterUserId'

const PROJECT = 'proj-1'
const PROJECT_MASTER = 'master-project-owner'
const EXISTING_MASTER = 'master-existing-owner'

describe('resolveEditJobMasterUserId', () => {
  it('follows the project owner when the job is linked to a project in the loaded list', () => {
    expect(
      resolveEditJobMasterUserId({
        projectId: PROJECT,
        projectMasterUserId: PROJECT_MASTER,
        existingJobMasterUserId: EXISTING_MASTER,
      }),
    ).toBe(PROJECT_MASTER)
  })

  it('keeps the existing job owner when the job is not linked to a project', () => {
    expect(
      resolveEditJobMasterUserId({
        projectId: null,
        projectMasterUserId: null,
        existingJobMasterUserId: EXISTING_MASTER,
      }),
    ).toBe(EXISTING_MASTER)
  })

  it('falls back to the existing owner when a project id is set but the project is not in the loaded list', () => {
    // The row already matches that project's master via jobs_ledger_project_master_match,
    // so preserving the existing owner is correct and invariant-safe.
    expect(
      resolveEditJobMasterUserId({
        projectId: PROJECT,
        projectMasterUserId: null,
        existingJobMasterUserId: EXISTING_MASTER,
      }),
    ).toBe(EXISTING_MASTER)
  })
})
