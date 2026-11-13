import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7162',
  date: '2026-11-13',
  title: 'Materials on site: a job reads by its number, not a dash',
  kind: 'fix',
  highlights: [
    'On Materials → On site, Jobs → Materials and the phone’s On site tab, a job made in the app read as a dash and its name. Every job that holds a box today is one of those.',
    'The job’s number now shows on the desk’s rows, the job’s own page, the phone’s job press, the search across jobs and Print labels’ list of jobs.',
    'A manifest printed for a box now carries the job’s number too.',
    'A job with a number from the old system reads as it did.',
  ],
}

export default note
