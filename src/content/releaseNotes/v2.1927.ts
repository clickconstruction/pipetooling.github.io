import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.1927',
  date: '2026-08-20',
  title: '"Ready to ask for" stops counting money you already billed',
  kind: 'fix',
  highlights: [
    'Capable of Being Billed only subtracted payments received — a Working job with a sent (or queued) invoice kept counting that money as still billable, so "Ready to ask for" overstated by every open bill on a Working job.',
    'It now subtracts open bills and ready-to-bill drafts too: bill a job and the money moves from "Ready to ask for" to "Waiting on customers" immediately.',
    'The Capable of Being Billed breakdown gained an "Open bills" column so you can see exactly what was subtracted.',
  ],
}

export default note
