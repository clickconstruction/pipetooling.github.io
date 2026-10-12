import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5250',
  date: '2026-10-12',
  title: 'Messages: the reply box’s words and the quick replies, behind the scenes',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'The rules for writing back to a person are ready: Text, Email and Note, the line under the box, and the opt-out line the carriers require.',
    'A text counts its pieces the way the carriers do, so a Spanish text with an accent shows the texts it really takes.',
    'Quick replies are ready to group by who a line is for and the step a person is on, with every change kept.',
    'Nothing on screen changes yet.',
  ],
}

export default note
