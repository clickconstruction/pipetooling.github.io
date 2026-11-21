import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8117',
  date: '2026-11-20',
  title: 'The dev seat deploys bundled, so it has room to grow past the 5 MB limit',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'The 5 MB limit is Supabase’s, for a function sent as raw source files. A function bundled before the upload is held to 20 MB. The test deploy on 2026-11-20 went through.',
    'The dev seat now deploys bundled, from main, by a job on GitHub. The usual deploy command starts the job, waits for it and prints the size.',
    'The size check holds the dev seat to 5.8 MB of source, up from 4.5 MB. Every other function deploys as before and keeps the 4.5 MB check.',
    'One question is open: which of the bundle’s two sizes Supabase counts. If it is the smaller one, the seat’s limit can rise to about 12 MB.',
  ],
}

export default note
