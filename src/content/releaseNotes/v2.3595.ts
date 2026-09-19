import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3595',
  date: '2026-09-18',
  title: 'Email reports: one list, by person',
  kind: 'feature',
  highlights: [
    'Jobs → Reports → Email reports now answers "who gets report email, and what?" in one table: a row per person, a Digest chip for each scheduled digest they are on (their own slice — which jobs, all users or their team, costs), and an Every-report chip saying whose reports they get as filed. The two tabs are gone.',
    'Edit a row to change both settings for that person in one place; + Add person starts a row; Remove takes them off everything. Saving one person never touches anyone else.',
    'The schedules themselves (name, days, time) are a line under the list — click a name to change or delete one, New… to make one — and Preview or send a test folds beneath it.',
  ],
}

export default note
