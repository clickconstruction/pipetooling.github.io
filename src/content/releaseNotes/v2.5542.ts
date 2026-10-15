import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5542',
  date: '2026-10-14',
  title: 'Messages: the three controls at the top of a thread stand one height, with no border',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'At the top right of a thread, the call button, the ⋯ menu and the who-has-it pill each drew their own border at their own height, so the row looked uneven.',
    'The three now stand on one row of one height, with no border and a quiet highlight under the pointer. The pill still tints blue when the thread is yours.',
    'The pill on Follow up’s rows keeps its border.',
  ],
}

export default note
