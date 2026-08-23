import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2186',
  date: '2026-08-23',
  title: 'The page stays put behind every modal',
  kind: 'fix',
  highlights: [
    'When any modal, sheet, or dialog is open, the page underneath no longer scrolls — on phones too — and it comes back exactly where you left it when the modal closes.',
    'Works for every modal in the app at once, including ones added later; stacked modals keep the page frozen until the last one closes.',
  ],
}

export default note
