import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7526',
  date: '2026-11-16',
  title: 'Lien desk: take a job off the lien path when no lien stands behind it',
  kind: 'feature',
  highlights: [
    'A new press, Not lienable…, takes one job off the lien path. It is on a held lien affidavit’s row on the Lien desk and in the job’s own Lien window.',
    'The window shows what the job billed and what lien papers already went out. You type the reason. Your name, the day and the reason stay on the job.',
    'The job leaves the Board, the lists and the run. Nothing is filed, voided or deleted, and its lien dates still run.',
    'A new bin on the Board, Off the lien path, lists these jobs with the reason. Put it back… on a row returns the job with its papers.',
  ],
}

export default note
