import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5439',
  date: '2026-10-13',
  title: 'Messages: change, add and remove quick replies in one window',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'Edit on the quick replies opens every line, grouped by who it is for and its step, with how often each is used.',
    'Press a line to change its words or who it is for. The old words stay in its history with who and when.',
    'Remove a line you no longer use, and bring it back from the Removed tab.',
    'Find a reply has Edit quick replies too, and a search that finds nothing adds your words as a new line.',
  ],
}

export default note
