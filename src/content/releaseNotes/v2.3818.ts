import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3818',
  date: '2026-09-25',
  title: 'Put a GC on notice: the claim you read is the claim that prints',
  kind: 'fix',
  highlights: [
    'The notice preview now shows exactly what the run prints. A job with closed months used to preview the whole balance (“$17,585”) beside a footnote saying most of it was not in the claim; it now shows the form’s real claim (“$3,859.72 for August”) with the closed months in the letter only.',
    'The Claim column, the table total, the step bar, the footer and the leader’s approval card all show what the forms claim — timely months only. A job whose every window has closed reads “no notice · every window closed · $26,400 still owed” instead of a claim it will never make.',
    'An affidavit date that has passed reads “closed Jun 15”, and one that can no longer follow any notice reads “—”. The owners step says “3 owners found (4 jobs)” so it matches its Use all found · 3 button.',
  ],
}

export default note
