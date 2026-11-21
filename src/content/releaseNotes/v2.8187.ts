import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8187',
  date: '2026-11-21',
  title: 'Document builder: the database can keep every open of a link',
  kind: 'feature',
  highlights: [
    'A link from the Document builder kept a count of its opens, the first day and the last. The database now has a place for each open by itself.',
    'An open by someone signed in will name their account. An open by someone with no account will keep where it came from and what their browser says about itself.',
    'A sheet’s link now closes when the sheet is taken off the last trade’s page. While any trade still has the sheet, the link stays on.',
    'The builder starts showing who opened a link, and says when a link closed this way, in the release that follows.',
  ],
}

export default note
