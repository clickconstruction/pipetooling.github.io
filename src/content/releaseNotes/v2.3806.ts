import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3806',
  date: '2026-09-24',
  title: 'The Pipeline row says when a check came back',
  kind: 'feature',
  highlights: [
    'On the Pipeline’s Billed Awaiting Payment rows, a job that still counts a returned check as paid wears a red badge beside the paid figure — “⚠ check returned · $13,680” — with the bank’s reason on hover. Clicking it opens the job on ③ Payments received, where Unlink and remove takes the payment off.',
    'On a phone, the same job’s one-line row shows “check returned · $13,680” as its one chip, ahead of every other fact, because the paid figure itself is wrong until someone acts. Tapping it opens the same payments row.',
    'This is the third and last piece of noticing a returned check in the app: the Dashboard card and the Accounts Receivable chip came first, then the email and push the moment the bank reports it, and now the row the office watches all day.',
  ],
}

export default note
