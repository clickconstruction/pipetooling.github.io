import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3858',
  date: '2026-09-26',
  title: 'Lien windows: the signer is the job’s master, in every window',
  kind: 'fix',
  highlights: [
    'The Pipeline’s three lien windows — the notice prefill, the release of record and the instruments window — each worked out who signs on their own; now all three ask the one rule the Lien desk already uses: the job’s master plumber, his title line or his name, else the person at the keyboard.',
    'One fix comes with it: the instruments window (the § 53.056 notice and the affidavit on a job) had been handed the release window’s answer, so it signed as the person at the keyboard whenever the release window was closed. It now signs as its own job’s master.',
  ],
}

export default note
