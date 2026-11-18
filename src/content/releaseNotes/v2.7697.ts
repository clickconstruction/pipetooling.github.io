import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7697',
  date: '2026-11-17',
  title: 'Checklist Review: see a person’s Task Mode screen in a window (punch list #381)',
  kind: 'feature',
  roles: ['dev', 'master_technician'],
  highlights: [
    'On Checklist → Review, open a person’s card. A new press, See their Task Mode, sits beside Add task for.',
    'The window draws that person’s day as their phone draws it: Next, Then, Done today, Still open and Waiting For.',
    'It is a look. You stay signed in as yourself, and no press on their screen works. A task’s title still opens its notes.',
    'Read again reads the day again. Coming up, the next seven days, arrives with the next update.',
  ],
}

export default note
