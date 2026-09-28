import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3965',
  date: '2026-09-28',
  title: 'Contract sweep: an unsent draft goes out with the current standard terms',
  kind: 'fix',
  highlights: [
    'After the standard terms were edited, agreements already saved as drafts kept the old wording — and the old wording is what went to the customer. A draft now follows the Contract Book document it was written from until the moment it is sent or handed over.',
    'The sweep’s pane and Preview PDF show the wording that will go out, so what you read is what the customer gets.',
    'A draft you wrote in the Contract window from a different document, or from the built-in wording, keeps the terms you chose there.',
    'Agreements already sent or signed are untouched: they keep the wording they went out with.',
  ],
}

export default note
