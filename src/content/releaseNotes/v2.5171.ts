import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5171',
  date: '2026-10-10',
  title: 'GC mode: the customer signs our contract in their portal',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'Our contract now waits in the customer’s portal under the job, with its price, every term we bill by and the file.',
    'They sign it there with their name typed or drawn, and what they signed stays a press away.',
    'A file that changed after it went, or a price that changed, is never signed: they are told we will send a new one.',
    'Nothing is emailed yet. The email that tells them comes next.',
  ],
}

export default note
