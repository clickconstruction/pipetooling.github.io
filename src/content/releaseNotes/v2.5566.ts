import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5566',
  date: '2026-10-15',
  title: 'Training: read a course at your own pace, and pass its checks',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator', 'primary', 'superintendent', 'subcontractor', 'helpers'],
  highlights: [
    'A training course is a page of its own, so a long read works on a phone and opens where you left off. The lessons sit on the left with a tick on each one done; read them in any order.',
    'Each lesson is five minutes: why it matters, what to know with the numbers in bold, the traps the real quizzes set, the numbers to remember, and four checks. A wrong pick says why and offers Try again. The lesson is done when all four are right.',
    'The final check opens once every lesson is done: twenty questions from every part, fourteen right passes, new questions on a retake. A pass is recorded with the day and your score.',
    'The first course is the OSHA 30 refresher. It is a refresher, not an OSHA card. Nothing shows until a dev turns the course on in Settings → Training.',
  ],
}

export default note
