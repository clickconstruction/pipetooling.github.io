import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7404',
  date: '2026-11-15',
  title: 'Record payment: place a check on its sheets by hand (sub labor train)',
  kind: 'feature',
  highlights: [
    'When a check covers more than one sheet, Record payment can now be placed By hand. A box opens for each of the sub’s open sheets, filled oldest first as a start, and you change them to match the check.',
    'The window shows what is placed against what was sent, and the press stays dead until every dollar is placed.',
    'The press now says what it will do when a payment goes past its sheet, such as Record $2,200.00 on 2 sheets.',
  ],
}

export default note
