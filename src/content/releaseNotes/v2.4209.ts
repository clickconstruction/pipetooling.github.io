import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4209',
  date: '2026-09-29',
  title: 'Pipeline: the Not scheduled line says ACTIVITY, underlined',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'Under a Not scheduled flag, the line that dates the last day on site is labeled ACTIVITY instead of LAST — the same date, the same “7 days ago · worked” under it.',
    'A job nobody has been out to reads “ACTIVITY none yet” instead of “never worked”.',
    'The label is underlined like DONE, BILLED and PAID: underlined means it already happened, plain (NEXT, ENDS) means it is coming.',
  ],
}

export default note
