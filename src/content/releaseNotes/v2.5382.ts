import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5382',
  date: '2026-10-13',
  title: 'Lien desk: the owner’s letter fits the window envelope, and a scan of its code is noticed, behind the scenes (Docsmit train, PR 4, migration 20261013130000)',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'A notice that mails through the mail service goes in a window envelope. The owner’s cover letter can now carry the address block where the window shows, with a small code under it.',
    'The code opens the bills behind the notice. When the owner scans it, the mailed piece quietly notes that it was read.',
    'Nothing changes for a notice printed here. The run window’s button that uses this comes next.',
  ],
}

export default note
