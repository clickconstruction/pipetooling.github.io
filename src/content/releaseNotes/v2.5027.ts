import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5027',
  date: '2026-10-09',
  title: 'Submittals: a submittal leaves only through Share',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'A submittal now leaves the office only from the Submittals tab, through Share or Send the link.',
    'The Sent by email on… button beside Share is gone. Typing in the GC’s first answer no longer marks a revision sent by email.',
    'A revision already marked sent by email keeps that mark.',
    'Saving a row’s cut sheet still works, to read it or to file it in the GC’s own system.',
  ],
}

export default note
