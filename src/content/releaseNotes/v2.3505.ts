import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3505',
  date: '2026-09-16',
  title: 'What customers see now lists every page and email anyone outside the company gets',
  kind: 'feature',
  highlights: [
    'Settings → What customers see gained two audiences, the supply house and the collections law firm, and every surface that shipped after the tab was built now has its place: the customer\'s own agreement email and signing page, the submittal review room, the test report and statement emails, the bill by email, the hazmat notice, the demand letter and the notice to the owner of record, and the firm\'s emails and portal.',
    'The ones not rendered yet show as Next release cards that say what they are and which release brings them, so the tab is honest about what it does and does not show.',
    'A count at the top says how many steps there are, how many render live, and how many wait on a release — and a check now runs on every change so a new public page or customer email cannot ship without a place on this tab.',
  ],
}

export default note
