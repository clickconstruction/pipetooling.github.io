import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3662',
  date: '2026-09-21',
  title: 'Lien desk: the bottom bar says the one next step, with one main button',
  kind: 'feature',
  highlights: [
    'The bar now leads with what happens next — “Next: the leader approves it”, “Next: straight into the run” — and one main button for it, instead of a status sentence and two competing coloured buttons.',
    'When something blocks the notice, the dim dead Send button is gone: the bar says “Fix gate 1 · owner of record — then this can go” and the button takes you to that gate and its fix.',
    'Skipping a month — the one decision here that cannot be undone — is now a red sentence under the buttons that states its cost, rather than a button beside Save draft. It still opens the same reason box.',
    'Who gets the mail, the courtesy PDF and the cover-note box share one line; the bar no longer repeats the job’s name.',
  ],
}

export default note
