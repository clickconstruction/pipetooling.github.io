import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3109',
  date: '2026-09-07',
  title: 'Robot estimator: a /bid command and a shared toolkit',
  kind: 'infra',
  highlights: [
    'A Claude Code session in this repo can now type /bid b482 (shadow a live bid), /bid next (let the dispatcher pick), or /bid backtest b376, and the whole robot pipeline runs in its fixed order — no more assembling it from five documents.',
    'The shell helpers the robot relies on (calling the harness, signed-in reads, the plans-readable probe, repointing a robot shell’s plans) now ship in the repo, so any machine with a twin key is ready in one step.',
  ],
}

export default note
