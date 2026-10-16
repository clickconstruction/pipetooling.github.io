import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5576',
  date: '2026-10-16',
  title: 'Training: the OSHA 30 refresher asks each question once',
  kind: 'fix',
  roles: ['helpers', 'subcontractor', 'primary', 'master_technician', 'superintendent', 'dev'],
  highlights: [
    'Lessons 1, 2, 21 and 30 get questions on their own ground. They had borrowed later lessons’ questions, so a person met the same question twice on the way through.',
    'The final check’s bank keeps only questions no lesson asks, and a draw never repeats a question.',
    'A check in the build holds it: no question asked twice across a course.',
  ],
}

export default note
