import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7717',
  date: '2026-11-17',
  title: 'Bids: the row kinds, markup and tax tools are their own piece',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Behind the scenes, the part of the Pricing tab that keeps each row’s kind, tags, markup and tax choice moved out of the big Pricing file into its own.',
    'The rules that turn a typed markup into a number now have their own tests, with the dollars pinned on a whole row.',
    'Nothing changes on screen. The Pricing file is smaller, which makes each part easier to change safely.',
  ],
}

export default note
