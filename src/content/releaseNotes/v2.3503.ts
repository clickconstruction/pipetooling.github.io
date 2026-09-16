import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3503',
  date: '2026-09-16',
  title: 'Supply houses: record a return',
  kind: 'feature',
  highlights: [
    'The Add Invoice form now asks what the paper is — an invoice, or a credit memo from a return or a price correction.',
    'Type the amount as a positive number either way. Picking Credit is what takes it off the balance, so a slipped minus key can never invent one.',
    'Before you save, the form says what it will do: "Takes $888.10 off what we owe Reece, and $888.10 off J878’s parts cost."',
    'On the aging table a credit sits in its own Credits open column — it has a size, but not an age, so it never cancels out an invoice that really is late.',
  ],
}

export default note
