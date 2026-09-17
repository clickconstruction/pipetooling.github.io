import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3567',
  date: '2026-09-17',
  title: 'Dispatch inbox: a phone-number request closes itself once the job has a number',
  kind: 'fix',
  highlights: [
    'An "add a customer phone number" request filed against a job that already has a number could never close on its own and sat in the Dispatch inbox until someone closed it by hand. The inbox now retires those the same way it retires stale photos-link requests, with a note saying why.',
  ],
}

export default note
