import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6324',
  date: '2026-11-01',
  title: 'The Development page on a phone: the walk’s two fixes are held by tests',
  kind: 'infra',
  highlights: [
    'The two phone fixes from the owner’s walk of the Development page on 2026-10-30, the five count tiles with no blank cell and the History composer’s Source chips three a row, are now held by tests at a phone’s width, so a later change cannot undo them unseen.',
    'Nothing on the page itself changes.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
}

export default note
