import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8375',
  date: '2026-11-23',
  title: 'People → HR: an agent can add a large file as evidence by itself',
  kind: 'feature',
  highlights: [
    'A dev\'s agent can now put a recording or any file of up to 50 MB on a person\'s evidence record without anyone dragging it into Drive first. It could only send a small file before.',
    'The file goes from the computer straight to the app\'s private storage. The app then checks it is the very file that was planned, by its size and its fingerprint, before it keeps the record.',
    'A file that does not match is refused and removed, and nothing is written.',
    'A large file on an open record is still copied into the person\'s Drive folder. A counsel-only record still stays in the app alone.',
  ],
}

export default note
