import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7503',
  date: '2026-11-16',
  title: 'Lien desk: sending a printed notice back takes its signature off, and says so',
  kind: 'fix',
  highlights: [
    'Back to Approved · to print and the run’s Take back now clear the signature on purpose. The notice lands unsigned, with its signing line open, so it can be signed another way.',
    'Both say so before anything changes. A signed notice’s Back to Approved · to print asks first, and the run’s question counts the signatures that come off.',
    'Until now the signature went quietly: the notice read unsigned after a take-back and nothing had said why.',
    'The approval still stands, and a line under the paper says who cleared the signature and when.',
  ],
}

export default note
