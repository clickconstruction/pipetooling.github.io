import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2019',
  date: '2026-08-21',
  kind: 'fix',
  title: 'Payment forecast: tile numbers centered',
  highlights: [
    "The bucket tiles across the top of the Payment forecast (Past expected, This week, Next week, …) now center their title, dollar total, and bill count instead of hugging the left edge.",
  ],
}

export default note
