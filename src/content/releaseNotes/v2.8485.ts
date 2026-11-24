import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8485',
  date: '2026-11-24',
  title: 'People → Contracts: a company’s row offers what it says, and its presses fit a thumb',
  kind: 'fix',
  highlights: [
    'Under a sub’s company with nothing sent, the row now says Send for signature offers the Contract Book’s papers for subs. It no longer names two papers the list may not hold.',
    'Send for signature opens with the signer’s address when the company already keeps one. Before, a sub with no roster email opened on an empty box.',
    'On a phone, Send for signature and Enter from paper under a company’s row are a fingertip tall.',
  ],
}

export default note
