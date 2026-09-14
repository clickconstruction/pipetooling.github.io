import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3402',
  date: '2026-09-14',
  title: 'Bank payments: the deposit-matching check no longer fails on a busy build',
  kind: 'fix',
  highlights: [
    'A behind-the-scenes check of the Bank payments window (the payer chip filling an allocation line) sometimes reported a failure on the build servers even though nothing was wrong in the app. The check now waits for the window to finish settling before it clicks, so a build no longer turns red for it. Nothing changed in the app itself.',
  ],
}

export default note
