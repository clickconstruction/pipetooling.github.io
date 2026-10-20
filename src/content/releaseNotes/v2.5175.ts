import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5175',
  date: '2026-10-10',
  title: 'GC mode: a waiver a trade partner signs in its portal is kept as a PDF',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'Once trade partners may sign their lien waivers in the portal, each one signed is kept as a PDF in the job’s Drive folder.',
    'The PDF is the app’s own release of lien form, with the name they typed and the day they signed.',
    'The Draws window links each signed waiver beside its chip. Closeout links the final release on its step.',
  ],
}

export default note
