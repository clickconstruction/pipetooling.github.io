import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8439',
  date: '2026-11-24',
  title: 'Document builder: Publish asks first',
  kind: 'fix',
  highlights: [
    'Publish revision on the Sub NDA now opens a window before anything is published. It says who sees the new revision, and that a publish cannot be taken back.',
    'The window’s button carries the revision’s number, like Publish revision 3. Not yet closes it and leaves the draft a draft.',
    'A Publish button that is greyed out still opens nothing.',
  ],
}

export default note
