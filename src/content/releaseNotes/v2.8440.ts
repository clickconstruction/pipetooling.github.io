import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8440',
  date: '2026-11-24',
  title: 'GC projects: take back an ask the company has not heard about',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'An ask the company has not heard about now has Take the ask back… beside Will not do it and Cannot do it. A window asks first, and its button reads Take the ask back.',
    'The ask is deleted and the company reads as never asked on that trade. You can ask them again, or remove them from the bench if nothing else is on their record.',
    'An ask they opened, were emailed about, were called on or quoted shows no press. It still closes with Will not do it or Cannot do it.',
    'The take-back refuses in words when the screen was stale, and the app keeps who asked and who took it back.',
  ],
}

export default note
