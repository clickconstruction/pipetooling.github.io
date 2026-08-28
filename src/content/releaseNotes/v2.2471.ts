import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2471',
  date: '2026-08-28',
  title: 'Bid room status, everywhere you work bids',
  kind: 'feature',
  highlights: [
    'The room\'s state now shows as a chip on the Send-to strip, the Bid Board\'s per-GC lines, and Waiting to hear: "rev 2 · opened 3×", "✍ signed — Base bid $249,971", "✍ declined".',
    'Waiting to hear puts it right beside Last contact — so the chase call starts knowing whether they\'ve been reading, and what they looked at.',
    'The Cover Letter panel grew its management verbs: once signed it links straight to the signed record; before that you can Email the link again, or Close the room (the link shows a polite withdrawn page).',
  ],
}

export default note
