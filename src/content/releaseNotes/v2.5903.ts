import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5903',
  date: '2026-10-26',
  title: 'Every error line a person sees is counted',
  kind: 'feature',
  highlights: [
    'When the app shows an error, it now records which family it was, the code, what was being done and on which page. Once per kind per page load, never the words a person typed.',
    'Settings → Usage lists the error lines people meet most, by family and code, so the ones that need a plainer sentence or a guide are known rather than guessed.',
  ],
}

export default note
