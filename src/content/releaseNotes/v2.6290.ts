import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6290',
  date: '2026-11-01',
  title: 'My email never opens in a session started with Imitate or View as',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'Imitate and View as no longer show anyone’s own mail on the My email tab in Messages. The tab says the session was opened with Imitate or View as, and reads nothing.',
    'Every Imitate and View as is now kept on record, and My email reads only the address you sign in with.',
  ],
}

export default note
