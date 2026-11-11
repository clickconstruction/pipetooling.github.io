import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6931',
  date: '2026-11-11',
  title: 'The money emails leave a bill paid in kind out, as the screens do',
  kind: 'fix',
  highlights: [
    'The emailed Payment forecast no longer counts a bill an in kind arrangement pays as money coming. Its last line says how much is scheduled in kind.',
    'Money waiting no longer lists a customer as slow over a bill an in kind arrangement pays. This holds on the Pay speeds window and in its email.',
    'Both say in one line how much they left out, so a total never shrinks with no word.',
  ],
}

export default note
