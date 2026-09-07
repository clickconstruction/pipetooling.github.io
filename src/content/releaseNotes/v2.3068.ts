import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3068',
  date: '2026-09-07',
  title: 'People → Review costs sub sheets by their job link',
  kind: 'fix',
  highlights: [
    'The per-person review and the Team Summary now put each sub sheet’s hours and cost on the job it is linked to, instead of matching job numbers as text. Every "Subs:" figure, the office-job exclusion and the paid-jobs-only filter follow the link.',
  ],
}

export default note
