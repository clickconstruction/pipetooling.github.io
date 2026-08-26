import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2317',
  date: '2026-08-26',
  title: 'Archiving a user frees up their roadmap tasks',
  kind: 'feature',
  highlights: [
    'Archiving a user now takes them off every open roadmap task, so those tasks drop into the "Needs a person" lane instead of sitting assigned to someone who\'s gone.',
    'Restoring the user puts them back on their old tasks — but only the ones still open that nobody else has picked up in the meantime.',
    'Completed tasks keep their name either way, so history stays credited.',
  ],
}

export default note
