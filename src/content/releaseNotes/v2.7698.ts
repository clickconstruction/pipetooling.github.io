import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7698',
  date: '2026-11-17',
  title: 'Checklist Review: a person’s Task Mode window shows what is coming up (punch list #381)',
  kind: 'feature',
  roles: ['dev', 'master_technician'],
  highlights: [
    'The window that shows a person’s Task Mode now lists Coming up beside it: their open tasks for the next seven days.',
    'A repeating task is named on the first day it comes up. After that the day counts it.',
    'On a phone a bar switches between Their screen and Coming up.',
    'A week with nothing dated offers Add task for that person.',
  ],
}

export default note
