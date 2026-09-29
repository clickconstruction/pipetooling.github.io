import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4131',
  date: '2026-09-29',
  title: 'Pipeline: the job you opened is marked',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'Click a job on the Pipeline and the row takes a blue bar down its left edge and a faint blue tint; the Job activity / notes panel under it carries the same, with no line between them, so the row and its notes read as one card.',
    'Blue means “you opened this”. The amber flash still means “we scrolled you here” (a search hit or a link into the board).',
    'Works on every stage, for job rows and bill rows alike.',
  ],
}

export default note
