import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8219',
  date: '2026-11-21',
  title: 'In kind: the Billed awaiting payment email and the pay reminder leave a bill an arrangement pays out',
  kind: 'fix',
  highlights: [
    'The Billed awaiting payment email no longer lists a bill an in kind arrangement pays, with its days in red. Its totals and its 30 to 90 and 90+ chips count money owed only.',
    'The email says in one line how much it left out as scheduled in kind.',
    'A residential customer whose bill is paid in kind is no longer offered a pay reminder each morning. The Paid step waits with no due day, and Remind now still works.',
  ],
}

export default note
