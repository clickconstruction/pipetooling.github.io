import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6296',
  date: '2026-11-01',
  title: 'My email: a label you leave out stays out of an open conversation too',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'Opening a mail on My email no longer lists the mails of its conversation that sit under a Gmail label you leave out.',
    'A mail under such a label never shows in the list either, even when Gmail’s search lets one through.',
  ],
}

export default note
