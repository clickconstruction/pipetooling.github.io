import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5631',
  date: '2026-10-19',
  title: 'Pipeline: the Stripe Resend line wraps under its button',
  kind: 'fix',
  highlights: [
    'On a Pipeline row the Stripe “Resend · Email sent” line no longer sets the width of the job’s name block. The block is as wide as the name, the address and the customer line, and the time, then “Email sent”, wrap under the Resend button inside it.',
    'So the activity box comes in to meet the name block on rows where that line was the widest thing, which was the space the owner noticed.',
  ],
}

export default note
