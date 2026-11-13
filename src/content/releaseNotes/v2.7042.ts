import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7042',
  date: '2026-11-12',
  title: 'Pipeline: a billed row’s lien line no longer says the same thing twice',
  kind: 'fix',
  highlights: [
    'A billed row used to read File the lien by Nov 16, 4d, and under it File the affidavit, by Nov 16, 4d. It now says it once: File the affidavit by Nov 16, with the count beside it.',
    'The small line under a lien date keeps only what is new, like Needs the owner or Waiting on Robert. It no longer repeats the day and the count above it.',
    'When the money is expected after the last day, the bold line under the rule now reads Money lands too late, with how many days short. Ask for a date no longer repeats the count on the Expected row.',
    'An affidavit that is not drafted reads Affidavit to draft. It read Notice to draft. An affidavit waiting on a leader names the leader.',
  ],
}

export default note
