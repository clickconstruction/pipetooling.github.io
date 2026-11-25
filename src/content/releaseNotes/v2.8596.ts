import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8596',
  date: '2026-11-25',
  title: 'A change is checked in about a third of the time: the merge queue splits its tests across runners and a pull request tests near its change',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'On November 25 one check of a change took 27 to 59 minutes on a single runner, and every change paid it twice: once on its own pull request and once in the merge queue.',
    'The merge queue still runs everything. The typecheck and the checks now run on one runner while the tests run on two others, so a queue build is about as long as its slowest part. The first five took 20 to 21 minutes, against a middle of 39 before.',
    'A pull request’s own run now takes the tests near its change and every test that reads files, about a tenth to a fifth of the suite. A change to the packages or the build’s own config still runs the whole suite there.',
    'Of the 17 pull request runs that failed in their tests from November 20 to 25, the lighter run would have caught all 15 real ones. The merge queue is the only way onto main and still catches the rest.',
  ],
}

export default note
