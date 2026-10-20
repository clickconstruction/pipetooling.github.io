import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5636',
  date: '2026-10-19',
  title: 'Reminders, demand letters, lien notices and bills emailed again show in the job’s trail',
  kind: 'fix',
  highlights: [
    'Each contract reminder the app emails a customer now adds a line to the job’s activity, under Billing.',
    'A demand letter and a lien or retainage notice each add a line with who it went to, how and how much.',
    'A paper bill emailed again adds a “Bill emailed again” line. The Pipeline row’s activity box shows it, the demand letter and the notice beside the bill.',
    'Sends made before today get their lines too, except letters and notices that were voided.',
  ],
}

export default note
