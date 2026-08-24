import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2227',
  date: '2026-08-24',
  title: 'Payment forecast email counts every billed line',
  kind: 'fix',
  highlights: [
    'The forecast email now includes billed lines on jobs that are still in Working — progressive-billing break-offs were being left out, so the email undercounted what the on-screen forecast showed.',
    'Verified side-by-side against the live board: the email and the modal now show the same bills and the same totals.',
  ],
}

export default note
