import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6524',
  date: '2026-11-04',
  title: 'The dev seat can apply an approval it planned',
  kind: 'fix',
  roles: ['dev'],
  highlights: [
    'A planned approval of clock sessions through the dev seat now applies. Before, the plan’s hash took in the approval’s own time stamp, so every run hashed differently and the apply always refused.',
    'The hash still commits to each session as the plan saw it and to what the change does, so a session edited in between still refuses the apply.',
  ],
}

export default note
