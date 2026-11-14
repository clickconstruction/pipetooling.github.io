import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7185',
  date: '2026-11-13',
  title: 'Checklist: the ⋮ menu on Manage reaches Delete on a phone',
  kind: 'fix',
  highlights: [
    'On a phone, the ⋮ menu of the last task on Checklist → Manage was cut off. Only the top of Edit showed, and Delete could not be reached. The menu now opens above the task when there is no room under it.',
    'When the list fails to load, Manage no longer says "No tasks yet." beside the error.',
    'A task that is only for you no longer reads "notifies on done" on Manage.',
  ],
}

export default note
