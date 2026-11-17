import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7587',
  date: '2026-11-17',
  title: 'Checklist: Forward opens on Pick a person',
  kind: 'fix',
  highlights: [
    'Forward on the Checklist now opens with nobody picked. The button stays grey until you pick a name, then reads Forward to that name.',
    'The window used to show the first name in the list beside the words Required: Assignee, so it looked picked when it was not.',
    'On Review the list no longer offers the person who already has the task. If a task cannot be forwarded, the window says why.',
    'Forward is now the same window on the Checklist and on My Inbox.',
  ],
}

export default note
