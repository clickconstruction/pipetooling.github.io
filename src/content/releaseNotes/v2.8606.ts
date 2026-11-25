import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8606',
  date: '2026-11-25',
  title: 'The merge queue splits its tests three ways, and a new SQL bed no longer sends its pull request through every test',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'With its tests on two runners, a merge queue build took 20 to 21 minutes on its first five builds, not the 15 aimed at. Each runner prepares nearly the whole app before its first test, whatever its share.',
    'The queue now splits the tests across three runners. That is four jobs a build, and 24 when six builds run at once against a limit of 20, so at the busiest moments a few wait their turn.',
    'A pull request that adds a SQL bed adds one line to the list of scripts. That line sent the pull request through every test on its own run. It now takes the tests near its change, like any other.',
  ],
}

export default note
