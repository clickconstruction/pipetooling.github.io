import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2751',
  date: '2026-09-04',
  title: 'Issue unconditional releases straight from the Dashboard',
  kind: 'feature',
  highlights: [
    'The Needs you item for cleared conditional lien releases now opens a list instead of dropping you on the Pipeline board: every waiting release with its job, the check that cleared it, and when.',
    'Each row has an Issue unconditional button that opens the Release of Lien window already on the unconditional form with the covered bill lines and amount filled in — mint it and the row disappears.',
    'The job name opens the Job window for context, and View release reopens the original conditional document.',
    'Same list on phones from the Quickfill Needs you section.',
  ],
}

export default note
