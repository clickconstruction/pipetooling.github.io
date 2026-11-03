import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6332',
  date: '2026-11-02',
  title: 'The file index reads long plan sets from the first page, and a dev’s agent can run its backfill job by job',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'A long PDF used to be held as too big for the index. Now it is read from its first page until its time runs out, so a plan set’s cover, index and general notes are found by their words. Only a PDF over 50 MB is left to Drive’s search.',
    'Index this job’s files stops before the limit that used to cut a press short, and carries on in the next round by itself. Its tally says how many files have their words.',
    'A dev’s agent asks the dev seat where our own file index stands: how many files, how many with text, how many read only in part, which live jobs still have none, and when the sweep last looked.',
    'The agent plans the backfill over the live jobs, the paid ones or one job, then runs it one job at a time. A job whose Drive folder cannot be opened is passed over and named, a file held again is tried once an hour, and a stopped loop loses nothing.',
  ],
}

export default note
