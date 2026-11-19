/**
 * What a failed read on the Workflow page says. The lead sentence names what could not be loaded
 * and `formatErrorMessage` adds the reason by the failure's class: no access, a link to nothing,
 * a lost signal, or the server's own words after a colon. A Supabase result's error is a plain
 * object, so its `.message` alone shows the server's raw text and never the reason a person can
 * act on.
 */
import { formatErrorMessage } from '../../utils/errorHandling'

export type WorkflowRead = 'workflow' | 'project' | 'steps' | 'lineItems'

export const WORKFLOW_READ_LEADS: Record<WorkflowRead, string> = {
  workflow: 'The workflow could not be loaded.',
  project: 'The project could not be loaded.',
  steps: 'The steps could not be loaded.',
  lineItems: 'The line items could not be loaded.',
}

export function workflowReadFailure(what: WorkflowRead, error: unknown): string {
  return formatErrorMessage(error, WORKFLOW_READ_LEADS[what])
}
