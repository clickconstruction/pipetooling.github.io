import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6539',
  date: '2026-11-05',
  title: 'The job window is wider on a computer, with the job’s name first and the tabs in a strip under it',
  kind: 'feature',
  roles: ['dev', 'controller', 'assistant', 'master_technician', 'estimator'],
  highlights: [
    'The job window grows from 560 to 760 pixels wide on a computer, so the title and the seven tabs each get a line of their own instead of sharing one.',
    'The first line now reads the job’s number, its name and its status, with the ? and the ✕ at the right. A quiet line under it carries the development, the customer, the old numbers and the kind.',
    'The tabs run in a strip under the title, the open one underlined, the same strip the Jobs page uses. The “esc to close” words moved into the ✕’s tip.',
    'On a phone nothing moves: the window still fills the screen with the tabs first.',
  ],
}

export default note
