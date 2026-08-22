import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2101',
  date: '2026-08-22',
  title: 'Deleting a vehicle task reliably clears the assignee’s checklist',
  kind: 'fix',
  highlights: [
    'Assigning a vehicle maintenance task and then deleting it in the same sitting used to leave the task stranded on the assignee’s Today list — now the delete takes it off their checklist every time.',
    'Completing or reassigning a task got the same hardening, and the delete confirmation now correctly warns when it will also come off someone’s checklist.',
  ],
}

export default note
