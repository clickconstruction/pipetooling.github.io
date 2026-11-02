import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6331',
  date: '2026-11-02',
  title: 'Company papers: no folder yet reads as a next step, not an error',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'Before a company folder is set, Documents → Company now says No company folder yet with a Where files go press, instead of a red error line. The same goes for an upload the app turns down: its own words show.',
  ],
}

export default note
