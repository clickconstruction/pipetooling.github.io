import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5508',
  date: '2026-10-13',
  title: 'Messages: the Text tab says when texts are off',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'While Send texts is off in Settings, the Text tab says texts wait in place of the box. Email and notes write as before.',
    'The same line shows in a job window’s Text box, so nobody writes a text that cannot go.',
  ],
}

export default note
