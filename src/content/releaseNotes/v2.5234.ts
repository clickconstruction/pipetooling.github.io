import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5234',
  date: '2026-10-11',
  title: 'The Bridge: Build reads by percent complete (link PR 3)',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'The Build card reads now. Built per week is each job’s change in percent complete times its contract, from the hand-set percents and the field reports. Sold per week is the contract on the jobs created.',
    'The pile is the contract left to build on open jobs. A job with no percent is read as half done and drawn grey, with a count of how many there are.',
    'Build competes with Bill and Collect for the weakest link by the same rule: the most weeks to clear what is already waiting.',
  ],
}

export default note
