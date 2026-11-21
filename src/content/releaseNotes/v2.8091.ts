import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8091',
  date: '2026-11-20',
  title: 'The dev seat gets a test deploy that bundles it first, to see if the larger size limit applies',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Supabase holds a function sent as raw source files to 5 MB, and one bundled before the upload to 20 MB. The dev seat is sent as raw files and stands at 4.49 MB.',
    'A new job, run by hand, deploys the dev seat from main bundled first. It reports the size Supabase counted and whether the deploy went through.',
    'Nothing else changes. Every function still deploys the way it did, and the 4.5 MB check stands. Whether the seat moves to the bundled deploy is decided after the test.',
  ],
}

export default note
