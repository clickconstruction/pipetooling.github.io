import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7943',
  date: '2026-11-19',
  title: 'Lien desk: every filed lien’s copies carry the job’s number',
  kind: 'fix',
  highlights: [
    'A job made in the app has a Click number and no HCP number. Filed liens: copies to mail showed those jobs by name alone, on its cards and on the mail sheet.',
    'Every row now shows the job’s number, and the copy kept on the job is titled with it. Liens due the same day come off the printer in job number order.',
    'Add the stamped scans shows the number too, so a scan named with a Click number finds its lien.',
    'The letters and the clerk’s stamped pages are unchanged.',
  ],
}

export default note
