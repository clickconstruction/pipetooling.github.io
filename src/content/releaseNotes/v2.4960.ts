import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4960',
  date: '2026-10-08',
  title: 'My Time day editor: tests for rejecting, saving and closing',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Behind the scenes, new tests cover the time editor’s money steps. They check rejecting a session and the payroll hours that follow it, recording a no-call no-show, and the calls that split clock sessions.',
    'They also cover Save and every way to close the editor without saving.',
    'Nothing changes on screen.',
  ],
}

export default note
