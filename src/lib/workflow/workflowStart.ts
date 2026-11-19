/**
 * Starting a project's workflow (punch list #397 PR 1). Opening the Workflow page only reads: a
 * project with no workflow draws an empty state, and the workflow is made when a person presses
 * **Start a workflow** or saves something that needs one (a first step, a template, a projection).
 * Before this, the open itself inserted a draft `project_workflows` row, so a person who opened the
 * page to look left a record behind.
 *
 * `workflowFindStep` is the whole decision; `useWorkflowStepsEngine` runs it for its two finders,
 * `findWorkflow` (the open, `pressed: false`) and `ensureWorkflow` (a press, `pressed: true`).
 */
import { emptyWords, type EmptyWords } from '../emptyWords'
import { isAssistantLike } from '../subcontractorLikeRole'

/** What to do once the project's workflow and its GC row have been read. */
export type WorkflowFindStep =
  /** The project has a workflow: use it. */
  | 'use'
  /** A GC project gets no plumbing workflow (v2.4846): the page says where it lives. */
  | 'gc'
  /** No workflow and nobody asked for one: draw the empty state, write nothing. */
  | 'empty'
  /** No workflow and a person's press needs one: insert it. */
  | 'create'

export function workflowFindStep(input: { found: boolean; isGcProject: boolean; pressed: boolean }): WorkflowFindStep {
  if (input.found) return 'use'
  if (input.isGcProject) return 'gc'
  return input.pressed ? 'create' : 'empty'
}

/** The row a new workflow is inserted as: a draft named after its project. */
export function newWorkflowRow(projectId: string, projectName: string | null | undefined): { project_id: string; name: string; status: 'draft' } {
  const name = projectName?.trim()
  return { project_id: projectId, name: name ? `${name} workflow` : 'Workflow', status: 'draft' }
}

/**
 * Who gets the press: the roles the `project_workflows` insert policy admits, which are dev,
 * master, assistant and controller. A superintendent manages steps on the page, but the policy
 * refuses their insert, so the press is left off for them and never drawn to refuse.
 */
export function canStartWorkflow(role: string | null | undefined): boolean {
  return role === 'dev' || role === 'master_technician' || isAssistantLike(role)
}

/** The press on the empty state, and the sentence that leads a refusal's reason. */
export const START_WORKFLOW_LABEL = 'Start a workflow'
/** What the press reads while its insert runs, so a second press is not needed. */
export const STARTING_WORKFLOW_LABEL = 'Starting the workflow…'
export const START_WORKFLOW_FAILED = 'The workflow could not be started.'

/** What the second sentence tells the people who may start one. */
const WHO_SEES_STEPS = 'Steps you add here show to the people they are assigned to.'

/**
 * The empty state's words. The roles that can start one (`canStartWorkflow`) read who will see
 * its steps and get the press; every other role reads the first sentence alone. While the
 * press runs (`starting`) it reads that it is starting; a second press joins the first one's call.
 */
export function noWorkflowWords(canStart: boolean, starting = false): EmptyWords {
  const base = emptyWords({ kind: 'make', noun: 'workflow on this project', control: START_WORKFLOW_LABEL })
  if (!canStart) return { main: base.main, next: '', tail: '' }
  return { main: `${base.main} ${WHO_SEES_STEPS}`, next: starting ? STARTING_WORKFLOW_LABEL : base.next, tail: '' }
}
