import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6897',
  date: '2026-11-10',
  title: 'A bill takes its lines when the paper prints its number with a suffix the office did not type',
  kind: 'fix',
  highlights: [
    'On Materials → Supply houses, some bills stayed at *No lines yet* because the paper prints a longer number than the one typed: a shipment or release after it, such as *.001* or *01*.',
    'The app now gives such a bill its lines when the typed number is the start of the printed one and the paper’s total is the amount on the bill’s row.',
    'The bills held before are read again by themselves over the next hour. A bill whose total does not agree still waits for a person.',
  ],
}

export default note
