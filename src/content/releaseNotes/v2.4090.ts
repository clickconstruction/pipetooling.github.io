import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4090',
  date: '2026-09-28',
  title: 'Submittals is one road, and every step of it works by hand',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'estimator', 'controller'],
  highlights: [
    'The Submittals page now runs in the order of its eight stages, top to bottom, with a numbered rail down the left: a finished stage folds to one green line, the stage you are on is open and ringed, the later ones are sketched so you see the whole road. Every button lives inside its stage; the seven-button bar is gone. Open every stage brings the old all-at-once view back and remembers your choice.',
    'Nothing needs the robot. On a bid with no schedule, Type or paste the schedule takes the tags off the plans right here. Build Rev 1 with no picks and type each row’s product with Edit, or + Add a row by hand for anything not on the schedule. A call that came by phone or email can be entered on any revision. Then print the procurement log.',
    'The working revision is named once at the top — Working on Rev 3 · draft, started from Rev 2 — with older revisions as chips under it; Their call says which revision it is about, and holds the thread and the reviewer’s own files.',
  ],
}

export default note
