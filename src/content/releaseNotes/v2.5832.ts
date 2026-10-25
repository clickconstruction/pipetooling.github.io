import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5832',
  date: '2026-10-24',
  title: 'Liens window: the property kind is the job’s own, and no early residential dates',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'For about a second after it opened, the Liens window said the property kind was not set and showed the residential dates. A commercial job’s affidavit read a month early until the kind arrived.',
    'The window now reads the property record the job is linked to first. Until it is in, the top reads “Reading the job’s property record…” and shows no dates.',
    'The window reads that link from the job itself, so it matches Edit Job’s Property record row and the Legal desk.',
  ],
}

export default note
