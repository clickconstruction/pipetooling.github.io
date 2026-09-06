import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2900',
  date: '2026-09-05',
  title: 'Workflow steps say "Unassigned", every assignee resolves to a name, and notifications default on',
  kind: 'fix',
  highlights: [
    'A stage card with nobody on it now reads "Unassigned" instead of "Assigned to: unknown" — on the Workflow page and the Dashboard\'s assigned-stage cards.',
    'Superintendents no longer see office assignees tagged "(not a user)": the Workflow page and the Add-step picker read every role in the company, so an assistant, the controller or an estimator on a step shows up as a real person and can be picked.',
    'Assigning a person to a step that had nobody switches on the three per-step Notify toggles (started, complete, reopened); new steps start with them on. Turn one off and it stays off through reassignments.',
    'Projects → Job History now says "N of M working jobs linked" — the count only ever covered working jobs.',
  ],
}

export default note
