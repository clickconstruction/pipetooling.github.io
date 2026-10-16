import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5568',
  date: '2026-10-15',
  title: 'People: a training chip beside the paperwork ones',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'On People → Users and the Person tab rail, a person whose required training is not done carries a red training due chip, and one whose pass has lapsed or is about to carries an amber training lapsed chip, the same way an expiring paper or license shows.',
    'The chip moves the dot like a paper does: red moves it, amber moves it when nothing red is there. The fold-out names the course and the day.',
    'Only the office sees it, and only once a course is on.',
  ],
}

export default note
