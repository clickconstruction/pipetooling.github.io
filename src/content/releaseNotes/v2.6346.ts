import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6346',
  date: '2026-11-02',
  title: 'Fill them in: the working jobs with no kind, one press each',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'The Needs You card counts the jobs working with no kind: no price before the work, no bid, no stages and no HCP number, so the app cannot read them. Its button opens the Pipeline on those jobs.',
    'On Quickfill the same line opens Fill them in, one job at a time, newest first. The card shows the money, what the app read, the clock time and the bills.',
    'Press Project or Service call and the kind is saved and the next job comes up. When the hours plainly lean one way, that press is blue, and the choice is still yours. Skip sends a job to the back, and Undo takes a press back.',
  ],
}

export default note
