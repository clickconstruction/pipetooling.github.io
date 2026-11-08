import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6657',
  date: '2026-11-07',
  title: 'The estimate text carries a shorter link',
  kind: 'feature',
  highlights: [
    'When the office sends an estimate from the Tell the customer sheet, the text now carries a 75-character link in place of the 107-character one, to the same page with the same powers for the same 14 days. The email keeps its button and its own link.',
    'The text’s link is a second link of its own, so Send the link again retires the old emailed link and leaves a link texted before working until its day.',
    'When the short link cannot be made, the text goes with the email’s own link, so no text is lost.',
  ],
}

export default note
