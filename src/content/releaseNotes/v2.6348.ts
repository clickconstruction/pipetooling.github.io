import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6348',
  date: '2026-11-02',
  title: 'The edge drift check stops flagging every function when one more joins the shared kernels',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Thirty edge functions bundle a generated copy of the app’s kernels, and every file of that copy listed all thirty in its header. Each time a function started using the copy, that header changed in every file, so the drift check named every one of them to redeploy though none ran different code.',
    'The headers now point at the generator’s one list instead. A function that joins it changes nothing the others bundle, and a test fails if the list ever comes back into the files.',
    'This rewrites the headers one last time, so the thirty read as behind until one batch redeploy after the merge. What they do does not change.',
  ],
}

export default note
