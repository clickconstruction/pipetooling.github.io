import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8748',
  date: '2026-11-27',
  title: 'Trade partners: Remove from the bench says what can still hold a company',
  kind: 'fix',
  highlights: [
    'The window that asks before a remove said the company’s row leaves Trade partners. Sometimes the company stayed, since we had emailed it.',
    'The window now names the three things that can still hold a company: an email we sent, a file they sent and a Messages thread.',
    'When a company stays, its row says why in one plain sentence, and the remove press leaves that row until the page is loaded again.',
  ],
}

export default note
