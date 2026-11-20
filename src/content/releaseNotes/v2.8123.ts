import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8123',
  date: '2026-11-20',
  title: 'A one-time job to learn which size Supabase counts against its 20 MB limit',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'A function bundled before the upload has two sizes, compressed and unpacked. Supabase holds one of them to 20 MB and does not say which.',
    'A job run by hand makes a throwaway function, deploys it twice at sizes that tell the two apart, calls it once and deletes it.',
    'The throwaway function reads nothing and writes nothing, and is not kept in the code. The job is removed once the answer is written down.',
  ],
}

export default note
