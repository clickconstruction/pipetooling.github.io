import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7144',
  date: '2026-11-13',
  title: 'Messages: the mail run names every sender before it files',
  kind: 'feature',
  highlights: [
    'The run that files old mail onto its jobs now says who each mail will be filed under, before anything is filed.',
    'A conversation whose sender has no named contact is held, with the press that names them. The run never makes an unnamed sender.',
    'The run refuses to file during office hours, and it stops if a filing makes an unnamed sender after all.',
    'Nothing has been filed yet. The first job waits on the office’s never-tag list and a yes.',
  ],
}

export default note
