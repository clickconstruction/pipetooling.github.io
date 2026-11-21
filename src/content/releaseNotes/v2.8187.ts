import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8187',
  date: '2026-11-21',
  title: 'Document builder: the database can keep every open of a link',
  kind: 'feature',
  highlights: [
    'A link from the Document builder kept a count of its opens, the first day and the last. The database now has a place for each open by itself.',
    'An open by someone signed in will name their account. An open by someone with no account will keep where it came from and what their browser says about itself.',
    'Nothing on the screen changes yet. The link starts filling it, and the builder starts showing it, in the release that follows.',
  ],
}

export default note
