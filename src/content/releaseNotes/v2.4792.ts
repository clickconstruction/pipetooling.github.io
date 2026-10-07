import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4792',
  date: '2026-10-07',
  title: 'Uncollectible: give up on a bill from the Pipeline, stamped with the reason (step 3 of 6)',
  kind: 'feature',
  highlights: [
    'Under a Collections row\'s icons, Uncollectible… asks for the reason and moves the job into the Uncollectible band at the foot of Collections, stamped in red with the word, the reason, the day and the dollars.',
    'The Collections header counts only what you still chase; the band carries its own count and dollars. Mark Paid still works, Put it back in Collections reverses it, and the bill\'s Stripe invoice is marked uncollectible too.',
    'On a phone the card reads the reason and wears the UNCOLLECTIBLE chip. A new guide, mark a bill uncollectible, walks it through.',
  ],
}

export default note
