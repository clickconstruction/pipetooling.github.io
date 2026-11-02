import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6399',
  date: '2026-11-02',
  title: 'Settings → How fast a change ships: how long a change has been taking to reach the app, from the last three days',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'A new tab beside Release notes answers “can I have X” with a number: a headline like A change asked for today has been taking about 4 hours to reach the app, and where nine in ten land, from every change that merged in the last 24 hours.',
    'Under it, a chart of the last three days by the hour: the typical hours from a change’s pull request opening to its merge, with a gap where nothing merged. Four tiles say what opened and merged today, what is open now and what is in the merge queue.',
    'The hours count from the pull request opening, not from when you asked, and the app updates a few minutes after a merge. The numbers come from GitHub every 15 minutes; no office screen reads GitHub itself. A dev can press Read GitHub now.',
  ],
}

export default note
