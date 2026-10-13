import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5361',
  date: '2026-10-12',
  title: 'Messages: a thread’s windows open from the bottom on a phone',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'On a phone, a message, Who is this? and the job picker open from the bottom of the screen and stay above the keyboard.',
    'The menu under ⋯ opens from the bottom too, with rows a thumb can hit and Cancel.',
    'Escape closes the window on top first. The job picker opened over a message no longer closes the message instead.',
  ],
}

export default note
