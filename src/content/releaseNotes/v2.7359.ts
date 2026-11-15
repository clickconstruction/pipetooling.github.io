import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7359',
  date: '2026-11-15',
  title: 'A lien notice closed as paid shows in the job’s History',
  kind: 'feature',
  highlights: [
    'When the run closes a notice because the job was paid, the job’s History gets one line under Billing, like “Lien notice for Sep 2026 closed by Dana · the job was paid, nothing was mailed — the paper said $2,400.00”.',
    'The line says who closed it, which months it named and what the paper claimed, so the job’s record shows a notice was drafted and printed and then not sent.',
    'A notice closed before this update gets its line too.',
  ],
}

export default note
