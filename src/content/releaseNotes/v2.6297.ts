import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6297',
  date: '2026-11-01',
  title: 'Plan sets by part: the ground under the Plans section coming to every job',
  kind: 'feature',
  highlights: [
    'The app can now keep a set of plans on a part of a site, such as the Lodge or the Bunker, and say which set that part builds from today.',
    'A job names its part and follows it. When an updated set comes in, the part switches and every job on it sees the new set. Nothing has to be moved job by job.',
    'A job outside any development gets the same thing on its own. An as-built the crew makes has a place of its own too, kept with the job and marking up the set it built from.',
    'Nothing changes on screen yet. The Plans section in the job window’s Documents tab is the next release.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
}

export default note
